/**
 * The photographic PBR set (CC0, Poly Haven 1k JPG), applied after first paint.
 *
 * The house is drawable without these — present's drawn textures already
 * dress it — so they load lazily and land on the stage's material clones
 * once, with `needsUpdate` (one recompile, never per scroll update).
 *
 * Scale and colour compensate for the sources (coordinator's notes):
 * - plaster = beige_wall_001, 3 × 3 m, dark taupe → multiplied up to warm ivory;
 * - oak = laminate_floor_02, 1.7 × 1.7 m, boards along u → turned per room so
 *   they run along its long side, roughness kept ≥ 0.55;
 * - concrete = plastered_wall_04, 3.2 × 3.2 m → lifted, on the exterior face.
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
const PLASTER_TINT = new Color(1.55, 1.5, 1.45);
const OAK_TINT = new Color(1.2, 1.2, 1.2);
const CONCRETE_TINT = new Color(1.2, 1.2, 1.18);
const OAK_MIN_ROUGHNESS = 0.55;

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

async function loadSet(loader: TextureLoader, name: SetName): Promise<PbrSet> {
  const load = async (kind: 'diff' | 'nor' | 'rough'): Promise<Texture> => {
    const t = await loader.loadAsync(`${TEX_BASE}${name}_${kind}_1k.jpg`);
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.anisotropy = 4;
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
export async function applyPbr(house: StageHouse, rooms: readonly PlanRoom[]): Promise<PbrHandle> {
  const loader = new TextureLoader();
  const [plaster, oak, concrete] = await Promise.all([
    loadSet(loader, 'plaster'),
    loadSet(loader, 'oak'),
    loadSet(loader, 'concrete'),
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
    clone.map = set.diff;
    clone.normalMap = set.nor;
    clone.normalScale.set(0.35, 0.35);
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
  for (const floor of house.floors) {
    const room = rooms.find((r) => r.id === floor.id);
    const rotation = room === undefined || longSideAlongX(room) ? 0 : Math.PI / 2;
    floor.object.traverse((child) => {
      const material = (child as { material?: Material | Material[] }).material;
      for (const clone of Array.isArray(material) ? material : material === undefined ? [] : [material]) {
        if (!(clone instanceof MeshStandardMaterial) || !oakClones.has(clone)) {
          continue;
        }
        const set = keep(placed(oak, 'oak', floor.id, rotation));
        clone.map = set.diff;
        clone.normalMap = set.nor;
        clone.roughnessMap = set.rough;
        clone.roughness = Math.max(clone.roughness, OAK_MIN_ROUGHNESS);
        clone.color.copy(OAK_TINT);
        clone.needsUpdate = true;
      }
    });
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
