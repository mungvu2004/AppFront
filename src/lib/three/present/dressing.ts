/**
 * Turning a built storey into an open box: materials on, ceilings off.
 *
 * `buildFloorMesh` hands back geometry with no material and a tag on every
 * part saying what it stands for. This module reads the tags and paints — and
 * it paints by **role**, not by kind alone: a slab gets the finish its room
 * declares, a railing wall is glass where a partition is plaster, a pane is
 * glass where a door leaf is paint. That is the step `paintByPartKind` in
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
 * too, so a balcony shows a dark rim without anyone modelling one. One detail
 * is not free and is done here: an external wall's outside face is rendered
 * grey, which means finding which side of the wall has no room and splitting
 * the face triangles that look that way into a third material group.
 */

import { Mesh, Vector3, type BufferGeometry, type Group, type Material } from 'three';

import { readPartData } from '../build/scene';

import type { SceneMaterials } from './materials';
import { ensureWhiteVertexColors } from './occlusion';
import { isFinish, type Finish, type PlanOpening, type PlanRoom, type PlanWall } from './plan';

/* -------------------------------------------------------------------------- */
/* Which way is outside.                                                       */
/* -------------------------------------------------------------------------- */

/** A point on the plan, in plan millimetres. */
interface PlanXY {
  readonly x: number;
  readonly y: number;
}

const at = (values: readonly number[], index: number): number => values[index] ?? 0;

/** Ray-casting point-in-polygon on a room outline. */
export function insideOutline(point: PlanXY, outline: readonly (readonly number[])[]): boolean {
  let inside = false;

  for (let i = 0, j = outline.length - 1; i < outline.length; j = i, i += 1) {
    const xi = at(outline[i] ?? [], 0);
    const yi = at(outline[i] ?? [], 1);
    const xj = at(outline[j] ?? [], 0);
    const yj = at(outline[j] ?? [], 1);
    const crosses = yi > point.y !== yj > point.y;
    if (crosses && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * The side of a wall that faces no room at all, as a unit vector on the
 * plan, or `null` when both sides are rooms — a partition.
 *
 * Decided at the wall's midpoint, a hair beyond each face: an external wall
 * has outside on one side and a room on the other, and that is the whole test.
 * A wall with nothing on either side is left alone too.
 */
export function outwardSide(wall: PlanWall, rooms: readonly PlanRoom[]): PlanXY | null {
  const dx = at(wall.end, 0) - at(wall.start, 0);
  const dy = at(wall.end, 1) - at(wall.start, 1);
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return null;
  }

  const normal = { x: -dy / length, y: dx / length };
  const middle = { x: (at(wall.start, 0) + at(wall.end, 0)) / 2, y: (at(wall.start, 1) + at(wall.end, 1)) / 2 };
  const probe = wall.thicknessMm / 2 + 50;
  const sides = [1, -1].map((sign) => ({
    direction: { x: normal.x * sign, y: normal.y * sign },
    point: { x: middle.x + normal.x * sign * probe, y: middle.y + normal.y * sign * probe },
  }));
  const roomed = sides.map((side) => rooms.some((room) => insideOutline(side.point, room.outline)));

  if (roomed[0] === roomed[1]) {
    return null;
  }
  return roomed[0] === true ? sides[1]!.direction : sides[0]!.direction;
}

/**
 * Split a wall's face triangles into those looking outward and the rest, so
 * the outward ones can take a third material.
 *
 * The extruder puts both big faces of a wall in material group 0 and the cut
 * top and reveals in group 1. This walks group 0 triangle by triangle, reads
 * each one's normal, and re-emits the group as runs of `0` (inward) and `2`
 * (outward). Indexed geometry is not what the extruder makes; it is left alone.
 */
export function splitOutwardFaces(geometry: BufferGeometry, outward: PlanXY): void {
  const faces = geometry.groups[0];
  const position = geometry.getAttribute('position');
  if (faces === undefined || geometry.index !== null || position === undefined) {
    return;
  }

  const outwardVector = new Vector3(outward.x, 0, outward.y);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const runs: { start: number; count: number; materialIndex: number }[] = [];

  for (let vertex = faces.start; vertex < faces.start + faces.count; vertex += 3) {
    a.fromBufferAttribute(position, vertex);
    b.fromBufferAttribute(position, vertex + 1);
    c.fromBufferAttribute(position, vertex + 2);
    const normal = b.sub(a).cross(c.sub(a));
    const materialIndex = normal.dot(outwardVector) > 0 ? 2 : 0;
    const last = runs[runs.length - 1];

    if (last !== undefined && last.materialIndex === materialIndex) {
      last.count += 3;
    } else {
      runs.push({ start: vertex, count: 3, materialIndex });
    }
  }

  const rest = geometry.groups.slice(1);
  geometry.clearGroups();
  for (const run of [...runs, ...rest]) {
    geometry.addGroup(run.start, run.count, run.materialIndex);
  }
}

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
    case 'mosaic':
      return materials.mosaicFloor;
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
  const wallsById = new Map(plan.walls.map((wall) => [wall.id, wall]));
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
    // The lit materials multiply by a vertex colour; a built part carries none.
    ensureWhiteVertexColors(object);

    switch (part?.kind) {
      case 'wall': {
        const wall = wallsById.get(part.entityId);
        const isRailing = wall?.kind === 'railing';
        const outward = wall === undefined || isRailing ? null : outwardSide(wall, plan.rooms);

        if (isRailing) {
          object.material = materials.glass;
        } else if (outward === null) {
          object.material = [materials.plaster, materials.cut];
        } else {
          splitOutwardFaces(object.geometry, outward);
          object.material = [materials.plaster, materials.cut, materials.exterior];
        }
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
        // A leaf is painted joinery, like the frame `joinery.ts` puts round it.
        const glazed = isGlazed(openingById.get(part.entityId));
        object.material = glazed ? materials.glass : materials.paint;
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
