/**
 * The photographic PBR set (CC0, Poly Haven 1k JPG), applied after first paint.
 *
 * The house is drawable without these — present's drawn textures already
 * dress it — so they load lazily and land on the stage's material clones
 * once, with `needsUpdate` (one recompile, never per scroll update).
 *
 * Scale and colour compensate for the sources (coordinator's notes):
 * - plaster = beige_wall_001, 3 × 3 m, dark taupe → re-tinted to warm off-white;
 * - oak = laminate_floor_02, 1.7 × 1.7 m, boards along u → turned per room so
 *   they run along its long side, effective roughness ~0.55;
 * - concrete = plastered_wall_04, 3.2 × 3.2 m → its relief only, on the exterior face.
 * Wall and slab UVs are in metres (extruded shapes), so repeat = 1 / tile size.
 * Every room / wall gets its own offset and a small scale jitter so no two
 * neighbours repeat in step; clones share the image, so GPU memory is per set.
 */

import {
  Color,
  MeshLambertMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type Material,
  type Texture,
} from 'three';

import type { PlanRoom } from '@/lib/three/present';

import type { StageHouse } from './house';

export const TEX_BASE = '/landing/tex/';
type SetName = 'plaster' | 'oak' | 'concrete';
interface PbrSet {
  readonly diff: Texture;
  readonly nor: Texture;
  readonly rough: Texture;
}

export const TILE_M: Readonly<Record<SetName, number>> = { plaster: 3, oak: 1.7, concrete: 3.2 };
/**
 * Tint = target albedo / the image's mean albedo (both linear), so a set keeps
 * its grain but lands on the colour art direction asks for. Means measured
 * from the 1k JPGs: plaster (.340, .262, .188) is near-flat taupe, oak
 * (.329, .217, .126) saturated orange. The exterior uses concrete's relief only.
 */
export function tintFor(target: string, mean: readonly [number, number, number]): Color {
  const c = new Color(target);
  return c.setRGB(c.r / mean[0], c.g / mean[1], c.b / mean[2]);
}
const PLASTER_TINT = tintFor('#EFEFEC', [0.34, 0.262, 0.188]);
const OAK_TINT = tintFor('#C4AD94', [0.329, 0.217, 0.126]);
/** Cool crisp render (archviz-r2 fix 7): lands near #F1F2F0 in sun, not cream. */
const CONCRETE_TINT = new Color('#E9ECEE');
/**
 * `roughnessMap` multiplies `roughness`, and oak_rough's mean is 0.377: a factor of 0.55 gave ~0.21, a
 * mirror floor (archviz-r2 fix 11). This factor lands the mean at 0.55 (the shader clamps texels at 1).
 */
const OAK_ROUGH_MEAN = 0.377;
const OAK_ROUGHNESS = 0.68 / OAK_ROUGH_MEAN;
/** Oak on furniture and treads: oiled, not lacquered (CONTRACT-V3: no plastic sheen). */
const PIECE_OAK_ROUGHNESS = 0.8 / OAK_ROUGH_MEAN;
/**
 * The canvas tile floor (big 3-per-metre grid, dark grout, roughness 0.22) read as a CG bathroom:
 * the hall and wet rooms take concrete's set instead, as honed light limestone with no grid.
 * Concrete's means: albedo (.266, .255, .244), roughness map .932.
 */
const STONE_FLOOR_TINT = tintFor('#D9D3C9', [0.266, 0.255, 0.244]);
const STONE_FLOOR_ROUGHNESS = 0.72 / 0.932;
const STONE_FLOOR_ENV = 0.35;
/** A soft window sheen on the boards, not a sky-blue streak. */
const OAK_ENV = 0.3;
/** Oak on unit-UV faces (a 1 m tread, a 1.6 m table top): grain at a believable size. */
const PIECE_OAK_REPEAT = 0.6;
/** Linen: plaster's fine relief, tiled small and soft, reads as a weave on cushions and covers. */
const WEAVE_REPEAT = 3;
const WEAVE_STRENGTH = 0.35;

/** A deterministic 0..1 from a string: per-room variation that is the same every load. */
export function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/** Whether a room's long side runs along plan x (boards along u need no turn then). */
export function longSideAlongX(room: PlanRoom): boolean {
  const xs = room.outline.map((p) => p[0] ?? 0);
  const ys = room.outline.map((p) => p[1] ?? 0);
  return Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys);
}

/** Per-surface copy of a set: same image, own repeat / offset / rotation. */
function placed(set: PbrSet, name: SetName, id: string, rotation: number): PbrSet {
  const seed = seedOf(id);
  const repeat = (1 / TILE_M[name]) * (0.92 + seed * 0.16);
  const copy = (t: Texture): Texture => {
    const c = t.clone();
    c.repeat.set(repeat, repeat);
    c.offset.set(seed * 7.3, seed * 3.1);
    c.rotation = rotation;
    return c;
  };
  return { diff: copy(set.diff), nor: copy(set.nor), rough: copy(set.rough) };
}

export interface PbrHandle {
  dispose(): void;
}

async function loadSet(loader: TextureLoader, name: SetName, anisotropy: number): Promise<PbrSet> {
  const load = async (kind: 'diff' | 'nor' | 'rough'): Promise<Texture> => {
    const t = await loader.loadAsync(`${TEX_BASE}${name}_${kind}_1k.jpg`);
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.anisotropy = anisotropy;
    if (kind === 'diff') {
      t.colorSpace = SRGBColorSpace;
    }
    return t;
  };
  const [diff, nor, rough] = await Promise.all([load('diff'), load('nor'), load('rough')]);
  return { diff, nor, rough };
}

/**
 * Load the three sets and put them on the house's clones. Resolves to a
 * handle that frees every texture; rejects only if nothing could load (the
 * caller keeps the drawn look).
 */
export async function applyPbr(house: StageHouse, rooms: readonly PlanRoom[], anisotropy = 8): Promise<PbrHandle> {
  const loader = new TextureLoader();
  const [plaster, oak, concrete] = await Promise.all([
    loadSet(loader, 'plaster', anisotropy),
    loadSet(loader, 'oak', anisotropy),
    loadSet(loader, 'concrete', anisotropy),
  ]);
  const made: Texture[] = [];
  const keep = (set: PbrSet): PbrSet => {
    made.push(set.diff, set.nor, set.rough);
    return set;
  };
  const { materials } = house;

  const onWall = (clone: Material, wallId: string): void => {
    if (!(clone instanceof MeshLambertMaterial)) {
      return;
    }
    const isExterior = house.clonesOf.get(materials.exterior)?.includes(clone) === true;
    const set = keep(placed(isExterior ? concrete : plaster, isExterior ? 'concrete' : 'plaster', wallId, 0));
    // The render's diffuse blotches once lifted ~3×: outside keeps only its relief.
    clone.map = isExterior ? null : set.diff;
    clone.normalMap = set.nor;
    clone.normalScale.setScalar(isExterior ? 0.25 : 0.3);
    clone.color.copy(isExterior ? CONCRETE_TINT : PLASTER_TINT);
    clone.needsUpdate = true;
  };

  for (const wall of house.walls.values()) {
    wall.object.traverse((child) => {
      const material = (child as { material?: Material | Material[] }).material;
      for (const clone of Array.isArray(material) ? material : material === undefined ? [] : [material]) {
        if (house.clonesOf.get(materials.plaster)?.includes(clone) === true || house.clonesOf.get(materials.exterior)?.includes(clone) === true) {
          onWall(clone, wall.id);
        }
      }
    });
  }

  const oakClones = new Set(house.clonesOf.get(materials.woodFloor) ?? []);
  const tileClones = new Set(house.clonesOf.get(materials.tileFloor) ?? []);
  for (const floor of house.floors) {
    const room = rooms.find((r) => r.id === floor.id);
    const rotation = room === undefined || longSideAlongX(room) ? 0 : Math.PI / 2;
    floor.object.traverse((child) => {
      const material = (child as { material?: Material | Material[] }).material;
      for (const clone of Array.isArray(material) ? material : material === undefined ? [] : [material]) {
        if (clone instanceof MeshStandardMaterial && tileClones.has(clone)) {
          const stone = keep(placed(concrete, 'concrete', floor.id, rotation));
          clone.map = stone.diff;
          clone.normalMap = stone.nor;
          clone.normalScale.setScalar(0.35);
          clone.roughnessMap = stone.rough;
          clone.roughness = STONE_FLOOR_ROUGHNESS;
          clone.envMapIntensity = STONE_FLOOR_ENV;
          clone.color.copy(STONE_FLOOR_TINT);
          clone.needsUpdate = true;
          continue;
        }
        if (!(clone instanceof MeshStandardMaterial) || !oakClones.has(clone)) {
          continue;
        }
        const set = keep(placed(oak, 'oak', floor.id, rotation));
        clone.map = set.diff;
        clone.normalMap = set.nor;
        clone.roughnessMap = set.rough;
        clone.roughness = OAK_ROUGHNESS;
        clone.envMapIntensity = OAK_ENV;
        clone.color.copy(OAK_TINT);
        clone.needsUpdate = true;
      }
    });
  }

  // Box UVs run 0..1 per face (treads, table tops): one fixed repeat instead of metres.
  const unit = (set: PbrSet): PbrSet =>
    keep({ diff: set.diff.clone(), nor: set.nor.clone(), rough: set.rough.clone() });
  const oakUnit = unit(oak);
  const weave = unit(plaster);
  for (const t of [oakUnit.diff, oakUnit.nor, oakUnit.rough]) {
    t.repeat.setScalar(PIECE_OAK_REPEAT);
  }
  weave.nor.repeat.setScalar(WEAVE_REPEAT);
  for (const clone of house.clonesOf.get(materials.wood) ?? []) {
    if (clone instanceof MeshStandardMaterial) {
      clone.map = oakUnit.diff;
      clone.normalMap = oakUnit.nor;
      clone.roughnessMap = oakUnit.rough;
      clone.roughness = PIECE_OAK_ROUGHNESS;
      clone.envMapIntensity = OAK_ENV;
      clone.color.copy(OAK_TINT);
      clone.needsUpdate = true;
    }
  }
  for (const role of [materials.fabric, materials.textile]) {
    for (const clone of house.clonesOf.get(role) ?? []) {
      if (clone instanceof MeshLambertMaterial) {
        clone.normalMap = weave.nor;
        clone.normalScale.setScalar(WEAVE_STRENGTH);
        clone.needsUpdate = true;
      }
    }
  }

  const sources = [plaster, oak, concrete].flatMap((s) => [s.diff, s.nor, s.rough]);
  return {
    dispose() {
      for (const t of [...made, ...sources]) {
        t.dispose();
      }
    },
  };
}
