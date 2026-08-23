/**
 * Turning a built storey into an open box: materials on, ceilings off.
 *
 * `buildFloorMesh` hands back geometry with no material and a tag on every
 * part saying what it stands for. This module reads the tags and paints — and
 * it paints by **role**, not by kind alone: a slab gets the finish its room
 * declares, a railing wall is glass where a partition is plaster, a pane is
 * glass where a door leaf is timber. That is the step `paintByPartKind` in
 * `../perf/materialCache.ts` cannot take, because it keys on the part kind and
 * nothing else; this keys on the part *and the plan entry behind it*.
 *
 * The one part an open-box view has no use for is the ceiling, and it is
 * removed rather than hidden so it costs nothing on every frame after. The
 * caller gets the removed meshes back and disposes their geometry.
 *
 * Two details are free because the extruder made them so: a wall's cut top and
 * reveals are its second material group, so the dark section edge a cutaway
 * needs is one entry in a material array; and a slab's edge is its second group
 * too, so a balcony shows a dark rim without anyone modelling one.
 */

import { Mesh, type Group, type Material } from 'three';

import { readPartData } from '../build/scene';

import type { SceneMaterials } from './materials';
import { isFinish, type Finish, type PlanOpening, type PlanRoom, type PlanWall } from './plan';

/** What a plan's parts need to be painted. */
export interface DressingPlan {
  readonly walls: readonly PlanWall[];
  readonly openings: readonly PlanOpening[];
  readonly rooms: readonly PlanRoom[];
}

/** What `dressStorey` took out of the storey. */
export interface DressingReport {
  /** The ceiling meshes removed from the group; their geometry is not yet disposed. */
  readonly removed: readonly Mesh[];
  /** Room ids whose finish was not one the catalogue knows; they were painted as tile. */
  readonly unknownFinishes: readonly string[];
}

/** The slab material for each finish. */
export function floorMaterialFor(materials: SceneMaterials, finish: Finish): Material {
  switch (finish) {
    case 'wood':
      return materials.woodFloor;
    case 'decking':
      return materials.decking;
    case 'tile':
      return materials.tileFloor;
  }
}

/** Whether an opening hangs glass rather than a leaf. */
export function isGlazed(opening: PlanOpening | undefined): boolean {
  return opening?.kind === 'window' || opening?.swing === 'sliding';
}

/**
 * Hand every built part its material, and take the ceilings away.
 *
 * Every mesh is set to cast and receive shadows, with two exceptions that
 * would otherwise draw a dark rectangle where light should pass: glass
 * balustrades and glazing cast none.
 */
export function dressStorey(storey: Group, plan: DressingPlan, materials: SceneMaterials): DressingReport {
  const wallKinds = new Map(plan.walls.map((wall) => [wall.id, wall.kind]));
  const openingById = new Map(plan.openings.map((opening) => [opening.id, opening]));
  const finishes = new Map(plan.rooms.map((room) => [room.id, room.finish]));

  const removed: Mesh[] = [];
  const unknownFinishes: string[] = [];

  storey.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }

    const part = readPartData(object);
    object.castShadow = true;
    object.receiveShadow = true;

    switch (part?.kind) {
      case 'wall': {
        const isRailing = wallKinds.get(part.entityId) === 'railing';
        object.material = isRailing ? materials.glass : [materials.plaster, materials.cut];
        object.castShadow = !isRailing;
        break;
      }
      case 'floorSlab': {
        const declared = finishes.get(part.entityId) ?? '';
        const finish: Finish = isFinish(declared) ? declared : 'tile';
        if (!isFinish(declared)) {
          unknownFinishes.push(part.entityId);
        }
        object.material = [floorMaterialFor(materials, finish), materials.cut];
        break;
      }
      case 'opening': {
        const glazed = isGlazed(openingById.get(part.entityId));
        object.material = glazed ? materials.glass : materials.woodDark;
        object.castShadow = !glazed;
        break;
      }
      case 'ceiling':
        removed.push(object);
        break;
      default:
        break;
    }
  });

  for (const ceiling of removed) {
    ceiling.removeFromParent();
  }

  return { removed, unknownFinishes };
}
