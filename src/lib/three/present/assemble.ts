/**
 * A plan, built, dressed, furnished and lit — everything that turns, in one group.
 *
 * This is the step between "a JSON file" and "a scene": the plan goes through
 * the product's own `buildFloorMesh`, the result is dressed as an open box,
 * every furniture entry is placed (procedurally at once, as a model later), the
 * plan's ceiling lights are hung, the lights past the budget are drawn instead,
 * and what will never change is folded into a few meshes. No renderer is
 * touched, which is what lets a test run a whole house through here and count
 * what came out.
 */

import { Group, Mesh, type Object3D } from 'three';

import type { LevelId } from '@/domain/spatial/types';

import { buildFloorMesh } from '../build/floor';
import { readPartData } from '../build/scene';
import type { WallPartData } from '../build/wall';

import { dressStorey } from './dressing';
import { fitJoinery } from './joinery';
import { addCeilingLights, budgetLights, DEFAULT_LIGHT_BUDGET, type LightBudgetReport } from './lighting';
import type { SceneMaterials } from './materials';
import { mergeStatic } from './merge';
import { bakeVertexOcclusion, meshOccluders } from './occlusion';
import type { ScenePalette } from './palette';
import { placeFurniture, type PlacedPiece, type PlacementOptions } from './placement';
import {
  toBuildableLevel,
  toBuildableRoom,
  toDomainOpening,
  toDomainWall,
  type PlanFurniture,
  type PresentationPlan,
} from './plan';
import { fitTrim } from './trim';

/** What came out of assembling a plan. */
export interface AssembledHouse {
  /** Every storey, piece and light, ready to be centred and added to a scene. */
  readonly house: Group;
  readonly pieces: readonly PlacedPiece[];
  /** Openings the wall builder refused, with its reasons. Empty on a sound plan. */
  readonly refusals: readonly WallPartData['refusals'][number][];
  /** Rooms whose finish was not one the catalogue knows; painted as tile. */
  readonly unknownFinishes: readonly string[];
  /** Which of the plan's lights stayed real, and which were drawn as pools. */
  readonly lights: LightBudgetReport;
}

export interface AssembleOptions extends PlacementOptions {
  /** Told about each piece that kept its procedural geometry, and why. */
  readonly onFallback?: (entry: PlanFurniture, reason: unknown) => void;
  /**
   * Fold the static meshes — frames, rails, every piece that will never be
   * swapped for a model — into one mesh per material. On by default; a test
   * that wants to look at a piece's own meshes turns it off.
   */
  readonly batch?: boolean;
  /** How many of the plan's lights stay real; the rest are drawn. See `lighting.ts`. */
  readonly lightBudget?: number;
  /** Bake ambient occlusion into the static meshes' vertex colours. On by default. */
  readonly occlusion?: boolean;
}

/**
 * Build every storey of a plan into one group.
 *
 * @throws RangeError when a furniture entry names a variant or a facing the
 * catalogue does not know — a plan typo fails here, loudly, not on screen.
 */
export function assembleHouse(
  plan: PresentationPlan,
  palette: ScenePalette,
  materials: SceneMaterials,
  options: AssembleOptions = {},
): AssembledHouse {
  const house = new Group();
  const pieces: PlacedPiece[] = [];
  const refusals: WallPartData['refusals'][number][] = [];
  const unknownFinishes: string[] = [];
  const openings = plan.openings.map(toDomainOpening);
  const firstLevelId = plan.levels[0]?.id;
  /** Everything that is final the moment it is built, and so can be batched. */
  const staticRoots: Object3D[] = [];

  for (const level of plan.levels) {
    const levelId = level.id as LevelId;
    const planWalls = plan.walls.filter((wall) => wall.levelId === level.id);
    const planRooms = plan.rooms.filter((room) => room.levelId === level.id);

    const storey = buildFloorMesh({
      level: toBuildableLevel(level),
      walls: planWalls.map((wall) => toDomainWall(wall, level)),
      rooms: planRooms.map(toBuildableRoom),
      openings,
    });

    storey.traverse((object) => {
      const part = readPartData(object);
      if (object instanceof Mesh && part?.kind === 'wall') {
        refusals.push(...(object.userData as WallPartData).refusals);
      }
    });

    const dressingPlan = { walls: planWalls, openings: plan.openings, rooms: planRooms };
    const dressing = dressStorey(storey, dressingPlan, materials);
    const joinery = fitJoinery(storey, dressingPlan, materials);
    const trim = fitTrim(storey, dressingPlan, level, materials);
    for (const part of [...dressing.removed, ...joinery.removed]) {
      part.geometry.dispose();
    }
    unknownFinishes.push(...dressing.unknownFinishes);
    staticRoots.push(...joinery.added.filter((piece): piece is Group => piece instanceof Group), ...trim.added);

    house.add(storey);

    for (const entry of plan.furniture) {
      if ((entry.levelId ?? firstLevelId) !== level.id) {
        continue;
      }

      const piece = placeFurniture(entry, levelId, materials, options);
      house.add(piece.group);
      pieces.push(piece);

      // A piece that names a model the service may yet deliver keeps its own
      // meshes, so the swap has something to take out.
      if (entry.modelUrl === undefined || options.assets === undefined) {
        staticRoots.push(piece.group);
      }
    }

    addCeilingLights(house, palette, level, planRooms, plan.ceilingLights);
  }

  // A lamp's pool lands beside the lamp, inside a root already listed; a
  // downlight's lands on the house itself and is listed here.
  const lights = budgetLights(house, materials, options.lightBudget ?? DEFAULT_LIGHT_BUDGET);
  for (const { pool } of lights.drawn) {
    if (pool !== null && pool.parent === house) {
      staticRoots.push(pool);
    }
  }

  // Occlusion is read off every solid thing in the house and written onto the
  // static meshes only, before they are folded — a batch keeps its colours.
  if (options.occlusion !== false) {
    bakeVertexOcclusion(staticRoots, meshOccluders(house));
  }

  if (options.batch !== false) {
    mergeStatic(staticRoots, house);
  }

  return { house, pieces, refusals, unknownFinishes, lights };
}
