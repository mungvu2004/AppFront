/**
 * Closing a storey, and proving afterwards that it closed.
 *
 * A garbage collector cannot free a vertex buffer. The `BufferGeometry` object is
 * ordinary JavaScript and will be collected the moment nothing points at it, but
 * the buffer it uploaded lives in the driver, and the only thing that releases it
 * is somebody calling `.dispose()`. So a viewer that swaps storeys by dropping the
 * old group and building a new one leaks the entire old storey — a hundred and ten
 * geometries a swap — and the leak is invisible in a heap snapshot, because in the
 * heap there is nothing left to see. Twenty swaps and the tab is gone.
 *
 * Three things here, and they are the three halves of the same problem:
 *
 * - {@link disposeFloor} frees a storey: every geometry, every material it owns,
 *   every texture those materials owned, and then the group is taken out of the
 *   scene and emptied so no stale reference to one wall keeps the other hundred
 *   and nine alive.
 * - {@link ResourceLedger} counts what is still live and says so when the count
 *   climbs sample after sample. Freeing correctly is not something to be believed;
 *   a leak that only shows up on the twentieth swap is exactly the leak nobody
 *   finds by reading the code.
 * - `materialCache.ts` owns the materials that are *meant* to be shared, so that
 *   closing one storey cannot free the material four other storeys are drawing
 *   with.
 *
 * **What this module refuses to free**, and why each one would be a bug:
 *
 * - **A `Sprite`'s geometry.** Three keeps a single module-level quad and hands
 *   the same object to every sprite ever constructed (`Sprite.js`, `let _geometry`).
 *   Disposing it does not just break this sprite — the variable is never reset, so
 *   every sprite created afterwards gets the disposed geometry, for the lifetime
 *   of the page.
 * - **A material a cache issued.** That is the cache's to free, and only when its
 *   last holder lets go.
 * - **A `BatchedMesh`'s geometry**, separately: `BatchedMesh.dispose()` already
 *   frees it along with the two internal textures it keeps, and calling both would
 *   dispatch the event twice.
 *
 * `InstancedMesh` is the opposite case and worth stating: its `dispose()` frees a
 * morph texture and notifies the renderer but does **not** touch the geometry, so
 * the geometry is freed here as well as the mesh being disposed.
 *
 * What it cannot work out for itself is what lies outside the subtree. A geometry
 * shared with a mesh in another group is freed with this one — which is exactly
 * the arrangement `merge.ts` makes when it builds an `InstancedMesh` over the
 * original geometry, and the reason its own documentation says a batch dies with
 * the meshes it borrowed from. Close them together, or name the shared resources
 * in {@link DisposeFloorOptions.retain} and close them separately.
 */

import {
  BatchedMesh,
  InstancedMesh,
  LOD,
  Sprite,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from 'three';

import { formatNumber } from '@/lib/format/number';

import type { MaterialCache } from './materialCache';

/* -------------------------------------------------------------------------- */
/* Internals: reading what an object owns.                                     */
/* -------------------------------------------------------------------------- */

/**
 * Read structurally rather than with `instanceof`.
 *
 * A texture may come from a loader, and a geometry from a worker or a second copy
 * of three in the dependency tree; both carry the flag, and neither is guaranteed
 * to be an instance of the class this module imported.
 */
function isGeometry(value: unknown): value is BufferGeometry {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { readonly isBufferGeometry?: unknown }).isBufferGeometry === true
  );
}

function isMaterial(value: unknown): value is Material {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { readonly isMaterial?: unknown }).isMaterial === true
  );
}

function isTexture(value: unknown): value is Texture {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { readonly isTexture?: unknown }).isTexture === true
  );
}

/**
 * The geometry this object is responsible for freeing, or `null`.
 *
 * `null` for a sprite, whose quad belongs to three and is shared by every sprite
 * in the page, and for a `BatchedMesh`, which frees its own. Both sides of this
 * module read ownership through this one function, so what {@link disposeFloor}
 * frees and what {@link ResourceLedger} counts cannot drift apart.
 */
function ownedGeometry(object: Object3D): BufferGeometry | null {
  if (object instanceof Sprite || object instanceof BatchedMesh) {
    return null;
  }
  const geometry = (object as { readonly geometry?: unknown }).geometry;
  return isGeometry(geometry) ? geometry : null;
}

/** Every material an object refers to, whether it carries one or several. */
function materialsOf(object: Object3D): readonly Material[] {
  const material = (object as { readonly material?: unknown }).material;
  if (Array.isArray(material)) {
    return material.filter(isMaterial);
  }
  return isMaterial(material) ? [material] : [];
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

/* -------------------------------------------------------------------------- */
/* Freeing a storey.                                                           */
/* -------------------------------------------------------------------------- */

/** What one close actually freed. */
export interface DisposeReport {
  /** Objects walked, the root included. */
  readonly objects: number;
  /** Geometries disposed, each counted once however many meshes shared it. */
  readonly geometries: number;
  /** Materials disposed outright, including cache releases that reached zero. */
  readonly materials: number;
  /** Materials handed back to a cache, whether or not that release freed them. */
  readonly released: number;
  /**
   * Textures disposed with the materials that owned them.
   *
   * Textures freed by a cache release are the cache's business and are not counted
   * here — it knows which of them another live material still needs.
   */
  readonly textures: number;
  /** Geometries and materials left alone because the caller asked to keep them. */
  readonly retained: number;
}

export interface DisposeFloorOptions {
  /**
   * Where shared materials came from.
   *
   * Materials this cache issued are **released**, not disposed, so a material four
   * storeys are drawing with survives the first of them closing. Materials it did
   * not issue belong to the meshes that hold them and are disposed.
   */
  readonly materials?: MaterialCache;
  /**
   * Whether to free materials at all. On by default.
   *
   * Turn it off when the caller owns every material itself — a viewer holding one
   * palette for the whole session — and wants only the geometry back.
   */
  readonly disposeMaterials?: boolean;
  /**
   * Geometries and materials the caller keeps, and this close must not free.
   *
   * For the one arrangement in this codebase where a resource legitimately
   * outlives the subtree it is found in: `mergeByMaterial` builds an
   * `InstancedMesh` over the **same geometry object** its source meshes hold —
   * sharing it is the whole saving — so closing the storey those meshes came from
   * would free the geometry the batch is still drawing with. Pass the batch's
   * geometry here and close the batch separately.
   *
   * It cannot hold back a `BatchedMesh`'s geometry, which that mesh frees itself
   * along with its internal textures. Keep the mesh instead of the geometry.
   */
  readonly retain?: ReadonlySet<BufferGeometry | Material>;
  /** Whether to take the root out of its parent. On by default. */
  readonly detach?: boolean;
}

/**
 * Free a storey: its geometry, its materials, its textures, and its place in the
 * scene.
 *
 * Everything in the subtree is walked, visible or not — a hidden mesh holds the
 * same buffer a visible one does, and a viewer that hides the storeys above the
 * current one would otherwise leak every one of them. `LOD` rungs come with it:
 * they are children of the `LOD`, so all three drawings of the storey are freed
 * and the `levels` array is emptied afterwards, which is the one reference an
 * ordinary detach leaves behind.
 *
 * The group is then removed from its parent and every node in it is emptied, so a
 * stale reference to a single wall cannot keep the other hundred and nine objects
 * reachable. After this the group is finished; do not draw it again.
 *
 * Safe to call twice. `dispose()` in three is a broadcast, not a state change, so a
 * second call frees nothing and breaks nothing — which matters, because "did I
 * already close this storey?" is a question a viewer should never have to answer.
 */
export function disposeFloor(root: Object3D, options: DisposeFloorOptions = {}): DisposeReport {
  const cache = options.materials;
  const retain = options.retain;
  const shouldDisposeMaterials = options.disposeMaterials ?? true;
  const shouldDetach = options.detach ?? true;
  const isRetained = (resource: BufferGeometry | Material): boolean =>
    retain !== undefined && retain.has(resource);

  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const selfDisposing: (InstancedMesh | BatchedMesh)[] = [];
  const visited: Object3D[] = [];

  root.traverse((object) => {
    visited.push(object);

    const geometry = ownedGeometry(object);
    if (geometry !== null) {
      geometries.add(geometry);
    }

    for (const material of materialsOf(object)) {
      materials.add(material);
    }

    if (object instanceof InstancedMesh || object instanceof BatchedMesh) {
      selfDisposing.push(object);
    }
  });

  let disposedGeometries = 0;
  let retained = 0;

  for (const geometry of geometries) {
    if (isRetained(geometry)) {
      retained += 1;
      continue;
    }
    geometry.dispose();
    disposedGeometries += 1;
  }

  // The mesh goes whatever happens to its geometry: a retained geometry is kept
  // for somebody else to draw with, not for this mesh to go on holding.
  for (const mesh of selfDisposing) {
    if (mesh instanceof BatchedMesh) {
      if (isRetained(mesh.geometry)) {
        retained += 1;
        continue;
      }
      disposedGeometries += 1;
    }
    mesh.dispose();
  }

  let disposedMaterials = 0;
  let released = 0;
  let disposedTextures = 0;

  for (const material of materials) {
    if (isRetained(material)) {
      retained += 1;
      continue;
    }

    if (cache !== undefined && cache.owns(material)) {
      released += 1;
      if (cache.release(material)) {
        disposedMaterials += 1;
      }
      continue;
    }

    if (!shouldDisposeMaterials) {
      continue;
    }

    for (const texture of texturesOf(material)) {
      texture.dispose();
      disposedTextures += 1;
    }
    material.dispose();
    disposedMaterials += 1;
  }

  if (shouldDetach) {
    root.removeFromParent();
  }

  for (const object of visited) {
    if (object instanceof LOD) {
      object.levels.length = 0;
    }
    object.clear();
  }

  return {
    objects: visited.length,
    geometries: disposedGeometries,
    materials: disposedMaterials,
    released,
    textures: disposedTextures,
    retained,
  };
}

/* -------------------------------------------------------------------------- */
/* The ledger.                                                                 */
/* -------------------------------------------------------------------------- */

/** The three kinds of graphics resource a storey holds. */
export type TrackedResource = 'geometries' | 'materials' | 'textures';

/** Every kind, in the order a warning list reports them. */
export const TRACKED_RESOURCES: readonly TrackedResource[] = [
  'geometries',
  'materials',
  'textures',
];

/** How much of each kind is live. */
export type ResourceCounts = Readonly<Record<TrackedResource, number>>;

/** A count that has gone up sample after sample, which is what a leak looks like. */
export interface LeakWarning {
  readonly resource: TrackedResource;
  /** The run of strictly rising counts that triggered it, oldest first. */
  readonly counts: readonly number[];
  /** How much it rose over the run. */
  readonly growth: number;
  /** Vietnamese sentence for the review log. */
  readonly message: string;
}

export interface ResourceLedgerOptions {
  /**
   * Consecutive rises before it warns. Three by default.
   *
   * Two would fire on an ordinary warm-up: opening a project builds a storey, then
   * a second storey, and the count rises twice for a perfectly good reason. Three
   * consecutive rises with nothing ever coming back is a storey that is not being
   * closed.
   */
  readonly growthLimit?: number;
  /** How many samples to keep for inspection. Thirty-two by default. */
  readonly historyLimit?: number;
}

/** Vietnamese names for the three kinds, used in the warning sentences. */
const RESOURCE_NOUNS: Readonly<Record<TrackedResource, string>> = {
  geometries: 'hình học',
  materials: 'vật liệu',
  textures: 'kết cấu',
};

const DEFAULT_GROWTH_LIMIT = 3;
const DEFAULT_HISTORY_LIMIT = 32;

/**
 * The little of a three resource the ledger needs: it can say when it is disposed.
 *
 * `BufferGeometry`, `Material` and `Texture` all extend `EventDispatcher` and all
 * dispatch `dispose` from their own `dispose()`, which is what makes the ledger
 * self-correcting — it does not have to be told who freed something, or care.
 */
interface DisposableResource {
  addEventListener(type: 'dispose', listener: () => void): void;
  removeEventListener(type: 'dispose', listener: () => void): void;
}

/**
 * A count of the graphics resources that are still alive, and a nose for the ones
 * that never die.
 *
 * ```ts
 * const ledger = new ResourceLedger();
 * ledger.track(storey);          // register everything the storey holds
 * disposeFloor(previousStorey);  // the ledger notices, without being told
 * const warnings = ledger.sample();
 * ```
 *
 * Tracking is by **subscription**, not by walking the scene, and that distinction
 * is the entire point: a leaked storey is one that has been taken out of the scene
 * and not freed, so a scene walk is exactly the measurement that cannot see it. A
 * resource is registered when it is tracked and forgotten when it dispatches
 * `dispose`, whoever caused that — so the ledger stays right even when something
 * other than {@link disposeFloor} does the freeing.
 *
 * It is an instance, not module state. A second viewer measuring a second scene is
 * an ordinary thing to want, and a shared count would report the two as one.
 *
 * A ledger holds a strong reference to everything it tracks, which is what keeps
 * the count honest and also means a ledger that is never {@link ResourceLedger.forget}ten
 * keeps dead objects reachable. Throw it away with the viewer it belongs to.
 */
export class ResourceLedger {
  private readonly growthLimit: number;
  private readonly historyLimit: number;

  private readonly liveGeometries = new Set<BufferGeometry>();
  private readonly liveMaterials = new Set<Material>();
  private readonly liveTextures = new Set<Texture>();

  /** Every subscription, so it can be undone. */
  private readonly handlers = new Map<object, () => void>();

  private readonly samples: ResourceCounts[] = [];
  private readonly warned = new Set<TrackedResource>();

  constructor(options: ResourceLedgerOptions = {}) {
    this.growthLimit = Math.max(1, options.growthLimit ?? DEFAULT_GROWTH_LIMIT);
    this.historyLimit = Math.max(2, options.historyLimit ?? DEFAULT_HISTORY_LIMIT);
  }

  /** How much of each kind is live right now. */
  get counts(): ResourceCounts {
    return {
      geometries: this.liveGeometries.size,
      materials: this.liveMaterials.size,
      textures: this.liveTextures.size,
    };
  }

  /** The samples taken so far, oldest first. */
  get history(): readonly ResourceCounts[] {
    return this.samples;
  }

  /**
   * Register everything a subtree holds.
   *
   * The same ownership rule {@link disposeFloor} frees by: a sprite's shared quad
   * and a `BatchedMesh`'s self-freed geometry are not counted, because a count of
   * things that will never be freed by a close would rise once and stay risen,
   * which reads as a leak and is not one.
   *
   * Tracking the same subtree twice counts nothing twice.
   *
   * @returns the counts after tracking.
   */
  track(root: Object3D): ResourceCounts {
    root.traverse((object) => {
      const geometry = ownedGeometry(object);
      if (geometry !== null) {
        this.trackGeometry(geometry);
      }
      for (const material of materialsOf(object)) {
        this.trackMaterial(material);
      }
    });

    return this.counts;
  }

  /** Register one geometry. */
  trackGeometry(geometry: BufferGeometry): void {
    this.watch(this.liveGeometries, geometry);
  }

  /** Register one material, and every texture it refers to. */
  trackMaterial(material: Material): void {
    this.watch(this.liveMaterials, material);
    for (const texture of texturesOf(material)) {
      this.trackTexture(texture);
    }
  }

  /** Register one texture. */
  trackTexture(texture: Texture): void {
    this.watch(this.liveTextures, texture);
  }

  /**
   * Take a reading, and say which counts have been climbing.
   *
   * Edge-triggered, like the budget warnings in `monitor.ts`: a count that is
   * still climbing on the next sample says nothing more, because the first warning
   * already said it. The run has to break — a sample that does not rise — before
   * the same resource can warn again.
   *
   * @returns the warnings raised by this sample; empty when nothing is climbing.
   */
  sample(): readonly LeakWarning[] {
    this.samples.push(this.counts);
    if (this.samples.length > this.historyLimit) {
      this.samples.shift();
    }

    const warnings: LeakWarning[] = [];

    for (const resource of TRACKED_RESOURCES) {
      const run = this.risingRun(resource);

      if (run === null) {
        this.warned.delete(resource);
        continue;
      }
      if (this.warned.has(resource)) {
        continue;
      }

      this.warned.add(resource);
      warnings.push(leakWarning(resource, run));
    }

    return warnings;
  }

  /**
   * Stop tracking everything, without freeing any of it.
   *
   * For handing a scene over to somebody else, or for throwing the ledger away
   * without throwing away what it was watching. It is not a way to close a storey —
   * {@link disposeFloor} is.
   */
  forget(): void {
    for (const [resource, handler] of this.handlers) {
      (resource as DisposableResource).removeEventListener('dispose', handler);
    }

    this.handlers.clear();
    this.liveGeometries.clear();
    this.liveMaterials.clear();
    this.liveTextures.clear();
    this.samples.length = 0;
    this.warned.clear();
  }

  /** Hold a resource, and let go of it the moment it says it has been disposed. */
  private watch<TResource extends DisposableResource>(
    live: Set<TResource>,
    resource: TResource,
  ): void {
    if (this.handlers.has(resource)) {
      return;
    }

    const handler = (): void => {
      live.delete(resource);
      this.handlers.delete(resource);
      resource.removeEventListener('dispose', handler);
    };

    live.add(resource);
    this.handlers.set(resource, handler);
    resource.addEventListener('dispose', handler);
  }

  /** The tail of the history for one resource, if every step of it rose. */
  private risingRun(resource: TrackedResource): readonly number[] | null {
    const needed = this.growthLimit + 1;
    if (this.samples.length < needed) {
      return null;
    }

    const tail = this.samples.slice(-needed).map((counts) => counts[resource]);

    for (let index = 1; index < tail.length; index += 1) {
      const previous = tail[index - 1];
      const current = tail[index];
      if (previous === undefined || current === undefined || current <= previous) {
        return null;
      }
    }

    return tail;
  }
}

function leakWarning(resource: TrackedResource, counts: readonly number[]): LeakWarning {
  const first = counts[0] ?? 0;
  const last = counts[counts.length - 1] ?? 0;

  return {
    resource,
    counts,
    growth: last - first,
    message:
      `Số ${RESOURCE_NOUNS[resource]} đang sống tăng liên tục ` +
      `${formatNumber(counts.length - 1)} lần: ${formatNumber(first)} lên ${formatNumber(last)} ` +
      `(thêm ${formatNumber(last - first)}). Nhiều khả năng có tầng chưa được đóng.`,
  };
}
