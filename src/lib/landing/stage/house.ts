/**
 * The demo house as the stage draws it: present's assembled house, with every
 * part that changes along the scroll given its own growth-patched materials.
 *
 * Everything that allocates happens here, once: the clones (one per original
 * material per object, so a wall's plaster can rise while its neighbour's
 * stays flat), the shadow-pass twins, the bounds each part grows within.
 * `applyBuild` then only writes numbers into uniforms and flips `visible` —
 * no material, geometry or vector is made per scroll update (Prompt 5 §7).
 *
 * The plan origin stays at the scene origin (no centring): x = x_mm / 1000,
 * z = y_mm / 1000, so anchors, ink and the timeline's camera agree without a
 * shared offset.
 */

import {
  Box3,
  DoubleSide,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  type Material,
  type MeshDepthMaterial,
  type Object3D,
} from 'three';

import { readPartData } from '@/lib/three/build/scene';
import { assembleHouse, createMaterials, type SceneMaterials, type ScenePalette } from '@/lib/three/present';

import type { LandingHouse, LandingState } from '../types';

import { NO_CLAMP_Y, createGrowthUniforms, growthDepthMaterial, patchGrowth, type GrowthUniforms } from './patch';

/** One part that grows, fades or turns from drawn to built. */
export interface Grower {
  readonly id: string;
  readonly object: Object3D;
  readonly uniforms: GrowthUniforms;
  /** World y of the part's foot and its full height, measured once before any lift. */
  readonly baseY: number;
  readonly heightM: number;
  readonly upper: boolean;
}

export interface StageHouse {
  readonly root: Group;
  /** The upper storey's level group (moved by `build.upperLiftM`), or null on a one-storey plan. */
  readonly upper: Group | null;
  readonly walls: ReadonlyMap<string, Grower>;
  readonly furniture: ReadonlyMap<string, Grower>;
  readonly floors: readonly Grower[];
  readonly joinery: readonly Grower[];
  readonly stair: Grower;
  readonly materials: SceneMaterials;
  /** Original material → every clone made of it, for `textures.ts`. */
  readonly clonesOf: ReadonlyMap<Material, readonly Material[]>;
  /** Everything this module created and `disposeStageHouse` frees. */
  readonly owned: readonly Material[];
}

/** Walls cut for the interior / cutaway read stop at this height above their foot. */
export const CUTAWAY_HEIGHT_M = 1.2;
/** Joinery drops in from this far above its place. */
export const JOINERY_DROP_M = 0.02;
/** Below this a part is hidden rather than drawn as a sliver. */
const SHOWN = 0.001;

const box = new Box3();

/** The stage's glass: mostly clear, a faint reflection — present's is a tinted standard. */
function createStageGlass(): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    color: 0xf4f7f7,
    roughness: 0.04,
    metalness: 0,
    ior: 1.5,
    reflectivity: 0.35,
    envMapIntensity: 1,
    transparent: true,
    opacity: 0.16,
    side: DoubleSide,
    depthWrite: false,
  });
}

interface Patcher {
  readonly clonesOf: Map<Material, Material[]>;
  readonly owned: Material[];
  readonly glass: Material;
  readonly materials: SceneMaterials;
}

/** Give every mesh under `object` growth clones that share one uniform set. */
function grow(patcher: Patcher, id: string, object: Object3D, upper: boolean, fade: boolean): Grower {
  object.updateMatrixWorld(true);
  box.setFromObject(object);
  const baseY = box.isEmpty() ? 0 : box.min.y;
  const heightM = box.isEmpty() ? 0 : box.max.y - box.min.y;
  const uniforms = createGrowthUniforms(baseY);
  const depth: MeshDepthMaterial = growthDepthMaterial(uniforms);
  patcher.owned.push(depth);
  const cache = new Map<Material, Material>();

  const cloneOf = (original: Material): Material => {
    const hit = cache.get(original);
    if (hit !== undefined) {
      return hit;
    }
    const base = original === patcher.materials.glass ? patcher.glass : original;
    const clone = patchGrowth(base, { baseY, uniforms, fade: fade || base.transparent });
    cache.set(original, clone);
    patcher.owned.push(clone);
    const list = patcher.clonesOf.get(original) ?? [];
    list.push(clone);
    patcher.clonesOf.set(original, list);
    return clone;
  };

  object.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return;
    }
    const material = child.material as Material | Material[];
    child.material = Array.isArray(material) ? material.map(cloneOf) : cloneOf(material);
    const glazed = (Array.isArray(material) ? material : [material]).includes(patcher.materials.glass);
    child.castShadow = !glazed;
    child.receiveShadow = true;
    child.customDepthMaterial = depth;
  });

  return { id, object, uniforms, baseY, heightM, upper };
}

/**
 * Assemble `house` and index its parts.
 *
 * @param makeStair Builds the flight (`buildStair`) in scene metres, from present's materials.
 */
export function buildStageHouse(
  house: LandingHouse,
  makeStair: (materials: SceneMaterials) => Group,
  palette: ScenePalette,
): StageHouse {
  const materials = createMaterials(palette);
  const stair = makeStair(materials);
  const assembled = assembleHouse(house.plan, palette, materials, { batch: false });
  const root = assembled.house;
  const levels = [...house.plan.levels].sort((a, b) => a.elevationMm - b.elevationMm);
  const upperId = levels[1]?.id;

  const storeys = new Map<string, Group>();
  const furnitureGroups: { id: string; levelId: string; object: Object3D }[] = [];
  for (const child of [...root.children]) {
    const part = readPartData(child);
    if (part?.kind === 'level' && child instanceof Group) {
      storeys.set(part.entityId, child);
    } else if (part?.kind === 'furniture') {
      furnitureGroups.push({ id: part.entityId, levelId: part.levelId, object: child });
    } else {
      // The plan's downlights and their drawn pools: an evening look; the landing is daylight.
      child.visible = false;
    }
  }
  // A piece lifts with its storey; storey groups sit at identity, so moving it keeps its place.
  for (const piece of furnitureGroups) {
    storeys.get(piece.levelId)?.add(piece.object);
  }
  const groundStorey = storeys.get(levels[0]?.id ?? '') ?? root;
  // buildStair's flight stands on y = 0; lift it to its storey's floor.
  stair.position.y = (house.plan.levels.find((l) => l.id === house.stair.levelId)?.elevationMm ?? 0) / 1000;
  (storeys.get(house.stair.levelId) ?? groundStorey).add(stair);

  const patcher: Patcher = { clonesOf: new Map(), owned: [], glass: createStageGlass(), materials };
  patcher.owned.push(patcher.glass);
  const walls = new Map<string, Grower>();
  const floors: Grower[] = [];
  const joinery: Grower[] = [];

  for (const [levelId, storey] of storeys) {
    const upper = levelId === upperId;
    for (const child of [...storey.children]) {
      if (child === stair || furnitureGroups.some((piece) => piece.object === child)) {
        continue;
      }
      const part = readPartData(child);
      if (part?.kind === 'wall') {
        walls.set(part.entityId, grow(patcher, part.entityId, child, upper, false));
      } else if (part?.kind === 'floorSlab') {
        floors.push(grow(patcher, part.entityId, child, upper, false));
      } else {
        joinery.push(grow(patcher, part?.entityId ?? child.uuid, child, upper, true));
      }
    }
  }

  const furniture = new Map<string, Grower>();
  for (const piece of furnitureGroups) {
    furniture.set(piece.id, grow(patcher, piece.id, piece.object, piece.levelId === upperId, false));
  }
  const stairGrower = grow(patcher, house.stair.id, stair, house.stair.levelId === upperId, false);

  return {
    root,
    upper: upperId === undefined ? null : (storeys.get(upperId) ?? null),
    walls,
    furniture,
    floors,
    joinery,
    stair: stairGrower,
    materials,
    clonesOf: patcher.clonesOf,
    owned: patcher.owned,
  };
}

/** Rise a part to `amount` of its height (capped at `capM` above its foot). */
function rise(grower: Grower, amount: number, material: number, lift: number, capM = Infinity): void {
  const shown = amount > SHOWN;
  grower.object.visible = shown;
  grower.uniforms.uRiseY.value = grower.baseY + lift + Math.min(amount * grower.heightM, capM);
  grower.uniforms.uMat.value = material;
}

/** Write one frame's build state into the house. Allocates nothing. */
export function applyBuild(h: StageHouse, s: LandingState): void {
  const { build } = s;
  const upperLift = build.upperLiftM;
  if (h.upper !== null) {
    h.upper.position.y = upperLift;
    h.upper.visible = build.upper > SHOWN;
  }
  const liftOf = (grower: Grower): number => (grower.upper ? upperLift : 0);

  for (const wall of h.walls.values()) {
    const cap = wall.heightM + (CUTAWAY_HEIGHT_M - wall.heightM) * build.cutaway;
    rise(wall, build.wallRise[wall.id] ?? 0, build.material, liftOf(wall), Math.max(cap, 0));
  }
  for (const piece of h.furniture.values()) {
    rise(piece, build.furniture[piece.id] ?? 0, build.material, liftOf(piece));
  }
  for (const floor of h.floors) {
    rise(floor, build.floors, build.floors, liftOf(floor));
  }
  rise(h.stair, build.stair, build.material, liftOf(h.stair));

  for (const part of h.joinery) {
    part.object.visible = build.joinery > SHOWN;
    part.uniforms.uRiseY.value = NO_CLAMP_Y;
    part.uniforms.uOpacity.value = build.joinery;
    // Negative drop = raised: it settles into place as joinery reaches 1.
    part.uniforms.uDrop.value = -JOINERY_DROP_M * (1 - build.joinery);
    part.uniforms.uMat.value = build.material;
  }
}

/** Free every material this module made, present's set, and every geometry under the house. */
export function disposeStageHouse(h: StageHouse, disposePresent: (m: SceneMaterials) => void): void {
  h.root.traverse((object) => {
    if (object instanceof Mesh) {
      (object.geometry as { dispose(): void }).dispose();
    }
  });
  for (const material of h.owned) {
    material.dispose();
  }
  disposePresent(h.materials);
}
