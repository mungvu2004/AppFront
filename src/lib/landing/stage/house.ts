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
  Group,
  Mesh,
  type Material,
  type MeshDepthMaterial,
  type Object3D,
} from 'three';

import { readPartData } from '@/lib/three/build/scene';
import {
  assembleHouse,
  createMaterials,
  type AssetService,
  type PieceSource,
  type SceneMaterials,
  type ScenePalette,
} from '@/lib/three/present';

import type { LandingHouse } from '../types';

import {
  buildCeilings,
  buildGlows,
  createFrameMetal,
  createStageGlass,
  dressFacade,
  metalWindowFrames,
  type Facade,
} from './facade';
import { foldMeshes } from './merge';
import {
  createGrowthUniforms,
  growthDepthMaterial,
  growthOf,
  patchGrowth,
  type GrowthUniforms,
} from './patch';

/** One part that grows, fades or turns from drawn to built. */
export interface Grower {
  readonly id: string;
  readonly object: Object3D;
  readonly uniforms: GrowthUniforms;
  /** World y of the part's foot and its full height, measured once before any lift. */
  readonly baseY: number;
  readonly heightM: number;
  readonly upper: boolean;
  /** Storeys above the ground this part's level is: it lifts `liftK × build.upperLiftM` (T2 1×, T3 2×). */
  readonly liftK: number;
  /** Scene y of the part's storey floor (before any lift): joinery's cutaway is measured from it. */
  readonly floorY: number;
  /** Patch meshes added since (a `.glb` swapped in for a procedural piece) into the same uniforms. */
  readonly refresh: () => void;
}

export interface StageHouse {
  readonly root: Group;
  /** The upper storey's level group (moved by `build.upperLiftM`), or null on a one-storey plan. */
  readonly upper: Group | null;
  /** Storeys above the upper one, parented to it: each rides one more `upperLiftM` (the section shot). */
  readonly stacked: readonly Group[];
  readonly walls: ReadonlyMap<string, Grower>;
  readonly furniture: ReadonlyMap<string, Grower>;
  readonly floors: readonly Grower[];
  readonly joinery: readonly Grower[];
  readonly stair: Grower;
  /** The door the compliance scene fails (C4's D5): its leaf fades so the clear opening reads. */
  readonly failedDoorId: string | null;
  /** Furniture whose `.glb` may still arrive; resolves when each piece is final. */
  readonly pieces: readonly { readonly id: string; readonly ready: Promise<PieceSource> }[];
  readonly materials: SceneMaterials;
  /** Original material → every clone made of it, for `textures.ts`. */
  readonly clonesOf: ReadonlyMap<Material, readonly Material[]>;
  /** Everything this module created and `disposeStageHouse` frees. */
  readonly owned: readonly Material[];
  readonly facade: Facade;
  /** Room ceilings (plain meshes in their storeys), shown by `build.ceiling` outside the cutaway. */
  readonly ceilings: readonly Mesh[];
  /** Warm planes behind the large windows, shown for exterior shots only (facade.ts buildGlows). */
  readonly glows: readonly Mesh[];
  /** Ground storey's room extent (scene x0, z0, x1, z1) and its ceiling height: the camera is inside under it. */
  readonly inside: readonly [number, number, number, number, number];
  /** Which glass look is on (null until the first frame): written only when it flips. */
  readonly look: { exterior: boolean | null; far: boolean };
}

/** Walls cut for the interior / cutaway read stop at this height above their foot. */
export const CUTAWAY_HEIGHT_M = 1.2;
/** Joinery drops in from this far above its place. */
export const JOINERY_DROP_M = 0.02;
const LINEN = '#CFC6B8';

const box = new Box3();

interface Patcher {
  readonly clonesOf: Map<Material, Material[]>;
  readonly owned: Material[];
  readonly glass: Material;
  readonly materials: SceneMaterials;
}

/**
 * Give every mesh under `object` growth clones that share one uniform set.
 * present's materials use vertex colours (baked AO); a mesh without a colour
 * attribute (the stair, a `.glb`) would read them as black, so it gets a clone
 * with vertex colours off.
 */
function grow(
  patcher: Patcher,
  id: string,
  object: Object3D,
  liftK: number,
  fade: boolean,
  floorY: number,
  swappable = false,
): Grower {
  object.updateMatrixWorld(true);
  box.setFromObject(object);
  const baseY = box.isEmpty() ? 0 : box.min.y;
  const heightM = box.isEmpty() ? 0 : box.max.y - box.min.y;
  const uniforms = createGrowthUniforms(baseY);
  const depth: MeshDepthMaterial = growthDepthMaterial(uniforms);
  patcher.owned.push(depth);
  const cache = new Map<Material, Material>();
  const plainCache = new Map<Material, Material>();

  const cloneOf = (original: Material, coloured: boolean): Material => {
    if (growthOf(original) !== null) {
      return original;
    }
    const plain = !coloured && original.vertexColors;
    const hits = plain ? plainCache : cache;
    const hit = hits.get(original);
    if (hit !== undefined) {
      return hit;
    }
    const base = original === patcher.materials.glass ? patcher.glass : original;
    const clone = patchGrowth(base, { baseY, uniforms, fade: fade || base.transparent });
    if (plain) {
      clone.vertexColors = false;
    }
    hits.set(original, clone);
    patcher.owned.push(clone);
    const list = patcher.clonesOf.get(original) ?? [];
    list.push(clone);
    patcher.clonesOf.set(original, list);
    return clone;
  };

  const refresh = (): void => {
    object.traverse((child) => {
      if (!(child instanceof Mesh)) {
        return;
      }
      const material = child.material as Material | Material[];
      const coloured = (child.geometry as Mesh['geometry']).getAttribute('color') !== undefined;
      child.material = Array.isArray(material) ? material.map((m) => cloneOf(m, coloured)) : cloneOf(material, coloured);
      const glazed = (Array.isArray(material) ? material : [material]).includes(patcher.materials.glass);
      child.castShadow = !glazed;
      child.receiveShadow = true;
      child.customDepthMaterial = depth;
    });
    // A piece folds per child: present swaps its `procedural` child for the `.glb` by reference.
    for (const container of swappable ? object.children : [object]) {
      foldMeshes(container);
    }
  };
  refresh();

  return { id, object, uniforms, baseY, heightM, upper: liftK > 0, liftK, floorY, refresh };
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
  models: { readonly assets?: AssetService; readonly signal?: AbortSignal } = {},
): StageHouse {
  const materials = createMaterials(palette);
  // present's linen is its plaster white: Pascal sofas and armchairs read as raw clay (archviz-r2 fix 11).
  materials.linen.color.set(LINEN);
  const stair = makeStair(materials);
  const assembled = assembleHouse(house.plan, palette, materials, { batch: false, ...models });
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
  // present stands every piece on y = 0 (its houses have one storey): raise it to its floor,
  // or the upper rooms' furniture stands inside the ground floor, below its own slab.
  for (const piece of furnitureGroups) {
    piece.object.position.y += (levels.find((l) => l.id === piece.levelId)?.elevationMm ?? 0) / 1000;
    storeys.get(piece.levelId)?.add(piece.object);
  }
  const groundStorey = storeys.get(levels[0]?.id ?? '') ?? root;
  // Storeys above the first upper one ride on it (they lift together for the cutaway).
  const upperGroup = storeys.get(upperId ?? '');
  for (const level of levels.slice(2)) {
    const storey = storeys.get(level.id);
    if (storey !== undefined && upperGroup !== undefined) {
      upperGroup.add(storey);
    }
  }
  const isUpper = (levelId: string): number => Math.max(0, levels.findIndex((l) => l.id === levelId));
  const stacked = levels.slice(2).flatMap((l) => storeys.get(l.id) ?? []);
  const wallObjects = new Map<string, Object3D>();
  for (const storey of storeys.values()) {
    for (const child of storey.children) {
      const part = readPartData(child);
      if (part?.kind === 'wall') {
        wallObjects.set(part.entityId, child);
      }
    }
  }
  const facade = dressFacade(house, wallObjects);
  // buildStair's flight stands on y = 0; lift it to its storey's floor.
  stair.position.y = (house.plan.levels.find((l) => l.id === house.stair.levelId)?.elevationMm ?? 0) / 1000;
  (storeys.get(house.stair.levelId) ?? groundStorey).add(stair);

  const patcher: Patcher = { clonesOf: new Map(), owned: [], glass: createStageGlass(), materials };
  const frameMetal = createFrameMetal();
  patcher.owned.push(patcher.glass, frameMetal, ...facade.owned);
  for (const storey of storeys.values()) {
    metalWindowFrames(storey, house, materials.paint, frameMetal);
  }
  const floorOf = (levelId: string): number =>
    (house.plan.levels.find((l) => l.id === levelId)?.elevationMm ?? 0) / 1000;
  const walls = new Map<string, Grower>();
  const floors: Grower[] = [];
  const joinery: Grower[] = [];

  for (const [levelId, storey] of storeys) {
    const upper = isUpper(levelId);
    const floorY = floorOf(levelId);
    for (const child of [...storey.children]) {
      if (child === stair || storeys.has(readPartData(child)?.entityId ?? '') || furnitureGroups.some((piece) => piece.object === child)) {
        continue;
      }
      const part = readPartData(child);
      if (part?.kind === 'wall') {
        walls.set(part.entityId, grow(patcher, part.entityId, child, upper, false, floorY));
      } else if (part?.kind === 'floorSlab') {
        floors.push(grow(patcher, part.entityId, child, upper, false, floorY));
      } else {
        joinery.push(grow(patcher, part?.entityId ?? child.uuid, child, upper, true, floorY));
      }
    }
  }

  const furniture = new Map<string, Grower>();
  for (const piece of furnitureGroups) {
    furniture.set(
      piece.id,
      grow(patcher, piece.id, piece.object, isUpper(piece.levelId), false, floorOf(piece.levelId), true),
    );
  }
  const stairGrower = grow(patcher, house.stair.id, stair, isUpper(house.stair.levelId), false, floorOf(house.stair.levelId));
  const ceilings = buildCeilings(house, storeys);
  const glows = buildGlows(house, storeys);
  patcher.owned.push(ceilings.material, glows.material);
  const ground = house.plan.rooms.filter((r) => r.levelId === levels[0]?.id).flatMap((r) => r.outline);
  const gx = ground.map((p) => (p[0] ?? 0) / 1000);
  const gz = ground.map((p) => (p[1] ?? 0) / 1000);
  const groundTop = ((levels[0]?.elevationMm ?? 0) + (levels[0]?.heightMm ?? 0)) / 1000;
  const doors = new Set(house.plan.openings.filter((o) => o.kind === 'door').map((o) => o.id));

  return {
    root,
    upper: upperId === undefined ? null : (storeys.get(upperId) ?? null),
    stacked,
    walls,
    furniture,
    floors,
    joinery,
    stair: stairGrower,
    failedDoorId: house.checks.find((c) => !c.pass && doors.has(c.targetId))?.targetId ?? null,
    pieces: assembled.pieces.map((piece) => ({ id: readPartData(piece.group)?.entityId ?? '', ready: piece.ready })),
    materials,
    clonesOf: patcher.clonesOf,
    owned: patcher.owned,
    facade,
    ceilings: ceilings.meshes,
    glows: glows.meshes,
    inside: [Math.min(...gx), Math.min(...gz), Math.max(...gx), Math.max(...gz), groundTop],
    look: { exterior: null, far: false },
  };
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
