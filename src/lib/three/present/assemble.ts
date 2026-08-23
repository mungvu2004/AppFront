/**
 * A plan, built, dressed, furnished and lit — everything that turns, in one group.
 *
 * This is the step between "a JSON file" and "a scene": the plan goes through
 * the product's own `buildFloorMesh`, the result is dressed as an open box,
 * every furniture entry is placed (procedurally at once, as a model later), and
 * the plan's ceiling lights are hung. No renderer is touched, which is what
 * lets a test run a whole house through here and count what came out.
 */

import { Group, Mesh } from 'three';

import type { LevelId } from '@/domain/spatial/types';

import { buildFloorMesh } from '../build/floor';
import { readPartData } from '../build/scene';
import type { WallPartData } from '../build/wall';

import { dressStorey } from './dressing';
import { fitJoinery } from './joinery';
import { addCeilingLights } from './lighting';
import type { SceneMaterials } from './materials';
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

/** What came out of assembling a plan. */
export interface AssembledHouse {
  /** Every storey, piece and light, ready to be centred and added to a scene. */
  readonly house: Group;
  readonly pieces: readonly PlacedPiece[];
  /** Openings the wall builder refused, with its reasons. Empty on a sound plan. */
  readonly refusals: readonly WallPartData['refusals'][number][];
  /** Rooms whose finish was not one the catalogue knows; painted as tile. */
  readonly unknownFinishes: readonly string[];
}

export interface AssembleOptions extends PlacementOptions {
  /** Told about each piece that kept its procedural geometry, and why. */
  readonly onFallback?: (entry: PlanFurniture, reason: unknown) => void;
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
    for (const part of [...dressing.removed, ...joinery.removed]) {
      part.geometry.dispose();
    }
    unknownFinishes.push(...dressing.unknownFinishes);

    house.add(storey);

    for (const entry of plan.furniture) {
      if ((entry.levelId ?? firstLevelId) !== level.id) {
        continue;
      }

      const piece = placeFurniture(entry, levelId, materials, options);
      house.add(piece.group);
      pieces.push(piece);
    }

    addCeilingLights(house, palette, level, planRooms, plan.ceilingLights);
  }

  return { house, pieces, refusals, unknownFinishes };
}
