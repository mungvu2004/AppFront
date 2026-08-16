/**
 * One material per colour token, instead of one material per object.
 *
 * `buildFloorMesh`, `buildWallMesh` and `toMesh` deliberately assign no material —
 * colour is a token decision and belongs to the caller — and three's constructors
 * default `material` to `new MeshBasicMaterial()`, a **default parameter**,
 * evaluated afresh on every mesh. So a storey straight out of the builders carries
 * one distinct material per mesh: a hundred and ten of them, each its own shader
 * program lookup and its own state change, for a scene that has four colours in
 * it. That is the waste this module exists to remove, and the reason
 * {@link SCENE_BUDGET}'s cap of forty materials is otherwise breached by a plan
 * nobody has coloured yet.
 *
 * The cache is **reference counted**, and that is the whole of its difficulty. A
 * material shared by four storeys must survive the first storey being closed and
 * must not survive the last one, and neither of those can be decided by looking at
 * the material: it has to be counted. So every material is handed out by
 * {@link MaterialCache.acquire} and handed back by {@link MaterialCache.release},
 * and only the release that takes the count to zero disposes anything.
 *
 * **One acquire per subtree, one release per subtree.** Not per mesh. Forty-eight
 * walls painted by {@link paintByPartKind} share one material and hold **one**
 * reference between them, because `disposeFloor` releases each distinct material
 * once when it closes the storey. Counting per mesh would work too, but only if
 * both sides agreed, and the side that walks a scene graph can only ever count
 * distinct materials — so distinct is what both sides count.
 *
 * The cache names each material after its key. That is not decoration: it makes
 * the key the material's identity everywhere else in the package at once —
 * `merge.ts` groups batches by `material.name`, `budget.ts`'s `tokenMaterialKey`
 * counts by it, and the cache issues by it. Three modules, one string, no way for
 * them to disagree about which materials are the same one.
 *
 * Textures are counted the same way one level down: disposing a material disposes
 * only the textures that no other **live cached** material still refers to.
 */

import { Mesh, type Material, type Object3D, type Texture } from 'three';

import { readPartData, type BuildPartKind } from '../build/scene';

/* -------------------------------------------------------------------------- */
/* Internals.                                                                  */
/* -------------------------------------------------------------------------- */

/** One material the cache has issued, and how many holders it has. */
interface Entry {
  readonly key: string;
  readonly material: Material;
  refs: number;
}

/** Every texture a material refers to, found by looking at what it holds. */
function texturesOf(material: Material): readonly Texture[] {
  const found: Texture[] = [];
  for (const value of Object.values(material as unknown as Record<string, unknown>)) {
    if (isTexture(value)) {
      found.push(value);
    }
  }
  return found;
}

/**
 * Is this a texture?
 *
 * Read structurally rather than with `instanceof Texture`, so a `DataTexture`, a
 * `CompressedTexture` or one from a loader in another copy of three is recognised
 * as one. A material's texture slots are the one place this package meets objects
 * it did not construct.
 */
function isTexture(value: unknown): value is Texture {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { readonly isTexture?: unknown }).isTexture === true
  );
}

/* -------------------------------------------------------------------------- */
/* The cache.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Materials issued by key and reference counted, so sharing one is safe to undo.
 *
 * ```ts
 * const cache = new MaterialCache();
 * const wall = cache.acquire('wall', () => new MeshStandardMaterial({ color }));
 * // …later, when the storey closes:
 * cache.release(wall); // disposed only if nothing else holds it
 * ```
 *
 * An instance owns everything it has issued and nothing else, so a viewer can keep
 * one per project and throw the whole thing away with {@link MaterialCache.clear}
 * when the project changes.
 */
export class MaterialCache {
  private readonly byKey = new Map<string, Entry>();
  private readonly byMaterial = new Map<Material, Entry>();

  /** How many distinct materials are live. */
  get size(): number {
    return this.byKey.size;
  }

  /** The keys currently issued, in the order they were first asked for. */
  keys(): readonly string[] {
    return [...this.byKey.keys()];
  }

  /**
   * The material for this key, made once and shared from then on.
   *
   * `create` is called only the first time a key is seen, so a caller can build an
   * expensive material inside it without checking whether it is needed. The
   * material is named after the key if it does not name itself.
   *
   * @throws RangeError when `create` returns a material this cache already issued
   * under a different key. One material under two keys would be released twice and
   * disposed while a holder still had it, which is precisely the failure this
   * class exists to prevent.
   */
  acquire(key: string, create: () => Material): Material {
    const existing = this.byKey.get(key);
    if (existing !== undefined) {
      existing.refs += 1;
      return existing.material;
    }

    const material = create();
    const clash = this.byMaterial.get(material);
    if (clash !== undefined) {
      throw new RangeError(
        `Material ${material.uuid} is already issued under key "${clash.key}"; ` +
          `it cannot also be issued under "${key}".`,
      );
    }

    if (material.name === '') {
      material.name = key;
    }

    const entry: Entry = { key, material, refs: 1 };
    this.byKey.set(key, entry);
    this.byMaterial.set(material, entry);

    return material;
  }

  /** Is this one of ours? */
  owns(material: Material): boolean {
    return this.byMaterial.has(material);
  }

  /** How many holders a material has; zero when the cache never issued it. */
  refCount(material: Material): number {
    return this.byMaterial.get(material)?.refs ?? 0;
  }

  /**
   * Hand a material back. It is disposed only by the release that takes its count
   * to zero.
   *
   * @returns whether this release actually disposed it.
   *
   * A material the cache never issued is left alone and answered `false` — it
   * belongs to whoever made it, and a cache that disposed other people's materials
   * would be worse than no cache.
   */
  release(material: Material): boolean {
    const entry = this.byMaterial.get(material);
    if (entry === undefined) {
      return false;
    }

    entry.refs -= 1;
    if (entry.refs > 0) {
      return false;
    }

    this.byKey.delete(entry.key);
    this.byMaterial.delete(material);
    this.disposeWithTextures(material);

    return true;
  }

  /**
   * Dispose everything, whatever the counts say.
   *
   * The teardown hammer, for a project change: after it, every material this cache
   * issued is dead, including ones a stale scene still points at. Anything still on
   * screen must go with it.
   *
   * @returns how many materials were disposed.
   */
  clear(): number {
    const materials = [...this.byMaterial.keys()];

    this.byKey.clear();
    this.byMaterial.clear();

    for (const material of materials) {
      this.disposeWithTextures(material);
    }

    return materials.length;
  }

  /**
   * Dispose a material, and the textures nothing else in the cache still uses.
   *
   * Called after the entry has already been removed, so `byMaterial` holds exactly
   * the materials that survive and the check reads the truth.
   */
  private disposeWithTextures(material: Material): void {
    const stillUsed = new Set<Texture>();
    for (const survivor of this.byMaterial.keys()) {
      for (const texture of texturesOf(survivor)) {
        stillUsed.add(texture);
      }
    }

    for (const texture of texturesOf(material)) {
      if (!stillUsed.has(texture)) {
        texture.dispose();
      }
    }

    material.dispose();
  }
}

/**
 * The cache a viewer uses when it has no reason to keep its own.
 *
 * The one piece of module state in this package, and it is here rather than
 * anywhere else for the reason the whole module exists: materials are the resource
 * that is *meant* to be shared between storeys, between viewers and across a
 * project, so the thing that owns them has to outlive any one of those. Everything
 * else — the ledger, the monitor — is an instance, because a second one of those
 * measuring a second scene is a normal thing to want and a second global would not
 * allow it.
 *
 * A test that wants isolation makes its own `new MaterialCache()`.
 */
export const sharedMaterialCache = new MaterialCache();

/* -------------------------------------------------------------------------- */
/* Painting a built storey.                                                    */
/* -------------------------------------------------------------------------- */

/** What {@link paintByPartKind} gave each kind of part. */
export type PaintedKinds = ReadonlyMap<BuildPartKind, Material>;

/**
 * Give every mesh in a storey the shared material for its part kind.
 *
 * This is the other half of the builders' decision not to assign materials: they
 * generate the shape, this applies the colour, and because the colour is looked up
 * per **kind** rather than per mesh, forty-eight walls come out sharing one
 * material instead of holding forty-eight identical ones.
 *
 * `create` is the caller's, and has to be: a colour comes from a token in
 * `src/styles/globals.css` by way of `src/lib/coloring`, and a module under
 * `src/lib/three` that picked one would be inventing a colour the design system
 * never approved.
 *
 * One reference is taken per **kind**, not per mesh, which is what `disposeFloor`
 * hands back when it closes the storey. Painting the same storey twice therefore
 * takes two references and needs two closes — which is correct, and is also a
 * thing not to do by accident.
 *
 * Meshes that carry no `PartUserData` are left exactly as they were: this function
 * paints the model, and an axis helper or a selection gizmo that wandered into the
 * group is not part of the model.
 */
export function paintByPartKind(
  root: Object3D,
  cache: MaterialCache,
  create: (kind: BuildPartKind) => Material,
): PaintedKinds {
  const painted = new Map<BuildPartKind, Material>();

  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }

    const kind = readPartData(object)?.kind;
    if (kind === undefined) {
      return;
    }

    let material = painted.get(kind);
    if (material === undefined) {
      material = cache.acquire(kind, () => create(kind));
      painted.set(kind, material);
    }

    object.material = material;
  });

  return painted;
}
