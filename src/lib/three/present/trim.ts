/**
 * Trim: the small pieces of joinery a building has where one surface meets another.
 *
 * `joinery.ts` makes the openings legible; this makes the *walls* legible.
 * A plastered wall that meets a floor with nothing between them reads as a
 * model; a wall with a skirting at its foot, a cornice under its cut, a sill
 * under its window and a threshold across its sliding door reads as a room.
 * Each is a box or two in paint, built along the wall's run and only on the
 * sides that face a room — an outside face gets nothing, and a balustrade
 * gets a kerb where its floor ends rather than a skirting.
 *
 * The floor gets one thing too: a dark strip along every roomed wall base,
 * fading into the room. It is the ambient occlusion the baked vertex
 * colours cannot give a slab whose only vertices are its corners, laid as a
 * decal the way a contact shadow is.
 *
 * Everything here is derived from the plan — wall runs, thicknesses, which
 * side is a room, where the doors cut the run — so no part of it is placed by
 * hand.
 */

import { Group, Mesh, PlaneGeometry, type Object3D } from 'three';

import { millimetres } from '@/domain/units/types';

import { toSceneLength } from '../build/scene';

import { type DressingPlan, outwardSide, insideOutline } from './dressing';
import { wallRun, type WallRun } from './joinery';
import type { SceneMaterials } from './materials';
import { box } from './pieces/primitives';
import { heightAbove, type PlanLevel, type PlanOpening, type PlanWall } from './plan';

/* -------------------------------------------------------------------------- */
/* Constants.                                                                  */
/* -------------------------------------------------------------------------- */

/** The skirting board: how tall, and how far it stands proud of the plaster. */
const SKIRTING_HEIGHT = 0.1;
const SKIRTING_PROUD = 0.012;

/** The cornice under the cut: a thin band, a hair prouder than the skirting. */
const CORNICE_HEIGHT = 0.05;
const CORNICE_PROUD = 0.016;

/** A window sill: the board's thickness, and how far it reaches into the room past the frame. */
const SILL_THICKNESS = 0.035;
const SILL_REACH = 0.09;
const SILL_OVERHANG = 0.08;

/** A sliding door's threshold: a low metal strip across the opening. */
const THRESHOLD_HEIGHT = 0.015;
const THRESHOLD_PROUD = 0.01;

/** The kerb under a balustrade, where a balcony floor ends. */
const KERB_HEIGHT = 0.04;
const KERB_DEPTH = 0.08;

/** The dark strip the floor gets along a wall, and how far it reaches into the room. */
const FLOOR_SHADE_REACH = 0.3;
const FLOOR_SHADE_LIFT = 0.003;

/** A run shorter than this between two doors gets no skirting. */
const MIN_RUN = 0.05;

/* -------------------------------------------------------------------------- */
/* Where the rooms are.                                                        */
/* -------------------------------------------------------------------------- */

/** A point on the plan, in plan millimetres. */
interface PlanXY {
  readonly x: number;
  readonly y: number;
}

/**
 * The sides of a wall that face a room, as signs on the wall's left-hand
 * normal: `+1` is the side the normal points to, `-1` the other. Two for a
 * partition, one for an external wall, none for a wall in the open.
 */
export function roomedSides(wall: PlanWall, plan: DressingPlan): readonly number[] {
  const outward = outwardSide(wall, plan.rooms);
  const run = wallRun(wall);
  // The left-hand normal of the run on the plan: (-dy, dx) for a run along (dx, dy).
  const left: PlanXY = { x: -run.along.z, y: run.along.x };

  if (outward !== null) {
    return [outward.x * left.x + outward.y * left.y > 0 ? -1 : 1];
  }

  // Both or neither: probe one side to tell a partition from a wall in the open.
  const middle = {
    x: ((wall.start[0] ?? 0) + (wall.end[0] ?? 0)) / 2 + left.x * (wall.thicknessMm / 2 + 50),
    y: ((wall.start[1] ?? 0) + (wall.end[1] ?? 0)) / 2 + left.y * (wall.thicknessMm / 2 + 50),
  };
  return plan.rooms.some((room) => insideOutline(middle, room.outline)) ? [1, -1] : [];
}

/** The stretches of a wall's run not cut by a door, as `[from, to]` along it. */
export function skirtingRuns(run: WallRun, openings: readonly PlanOpening[]): readonly (readonly [number, number])[] {
  const cuts = openings
    .filter((opening) => opening.sillHeightMm === 0)
    .map((opening) => {
      const centre = opening.relativePosition * run.length;
      const half = toSceneLength(millimetres(opening.widthMm)) / 2;
      return [centre - half, centre + half] as const;
    })
    .sort((left, right) => left[0] - right[0]);

  const runs: (readonly [number, number])[] = [];
  let from = 0;
  for (const [cutFrom, cutTo] of cuts) {
    if (cutFrom - from >= MIN_RUN) {
      runs.push([from, cutFrom]);
    }
    from = Math.max(from, cutTo);
  }
  if (run.length - from >= MIN_RUN) {
    runs.push([from, run.length]);
  }
  return runs;
}

/* -------------------------------------------------------------------------- */
/* The pieces.                                                                 */
/* -------------------------------------------------------------------------- */

/** A group standing at the wall's start, turned along its run, so parts are built in `x` along and `z` across. */
function alongWall(run: WallRun): Group {
  const group = new Group();
  group.position.copy(run.start);
  group.rotation.y = run.turn;
  return group;
}

/**
 * A dark strip on the floor along one side of a wall, darkest at the wall.
 * The decal's alpha runs top to bottom; laid flat and turned so its top edge
 * meets the wall, the dark edge is at the plaster and the clear edge in the room.
 */
function floorShade(run: WallRun, from: number, to: number, side: number, floor: number, materials: SceneMaterials): Mesh | null {
  if (materials.edgeShade === null) {
    return null;
  }

  const strip = new Mesh(new PlaneGeometry(to - from, FLOOR_SHADE_REACH), materials.edgeShade);
  // Laid flat, the plane's top edge points to local -z; the room is on the
  // `side` of z, so the strip is spun round when the wall is on its +z.
  strip.rotation.set(-Math.PI / 2, 0, side < 0 ? Math.PI : 0);
  strip.position.set((from + to) / 2, floor + FLOOR_SHADE_LIFT, side * (run.thickness / 2 + FLOOR_SHADE_REACH / 2));
  strip.renderOrder = 1;
  strip.castShadow = false;
  strip.receiveShadow = false;
  return strip;
}

/** What `fitTrim` added to the storey. */
export interface TrimReport {
  readonly added: readonly Object3D[];
}

/**
 * Skirtings, cornices, sills, thresholds and kerbs for every wall of a
 * storey, plus the floor's dark strip along each roomed wall base. Every
 * group is added to the storey and listed, so the caller can batch it.
 */
export function fitTrim(storey: Group, plan: DressingPlan, level: PlanLevel, materials: SceneMaterials): TrimReport {
  const floor = heightAbove(level, 0);
  const added: Object3D[] = [];

  for (const wall of plan.walls) {
    const run = wallRun(wall);
    if (run.length === 0) {
      continue;
    }
    const group = alongWall(run);
    const openings = plan.openings.filter((opening) => opening.wallId === wall.id);

    if (wall.kind === 'railing') {
      group.add(box(run.length, KERB_HEIGHT, KERB_DEPTH, materials.paint, run.length / 2, floor));
      storey.add(group);
      added.push(group);
      continue;
    }

    const top = heightAbove(level, wall.heightMm ?? level.heightMm);
    const sides = roomedSides(wall, plan);
    /** A painted band along the wall face: the skirting's and the cornice's one shape. */
    const band = (from: number, to: number, height: number, proud: number, base: number, side: number): void => {
      group.add(box(to - from, height, proud, materials.paint, (from + to) / 2, base, side * (run.thickness + proud) / 2));
    };
    for (const side of sides) {
      for (const [from, to] of skirtingRuns(run, openings)) {
        band(from, to, SKIRTING_HEIGHT, SKIRTING_PROUD, floor, side);
        const shade = floorShade(run, from, to, side, floor, materials);
        if (shade !== null) {
          group.add(shade);
        }
      }
      band(0, run.length, CORNICE_HEIGHT, CORNICE_PROUD, top - CORNICE_HEIGHT, side);

      for (const opening of openings) {
        const centre = opening.relativePosition * run.length;
        const width = toSceneLength(millimetres(opening.widthMm));
        if (opening.sillHeightMm > 0) {
          const sill = heightAbove(level, opening.sillHeightMm);
          const reach = run.thickness / 2 + SILL_REACH;
          group.add(
            box(width + SILL_OVERHANG * 2, SILL_THICKNESS, reach, materials.paint, centre, sill - SILL_THICKNESS, side * (reach / 2)),
          );
        } else if (opening.swing === 'sliding' && side === sides[0]) {
          group.add(box(width, THRESHOLD_HEIGHT, run.thickness + THRESHOLD_PROUD * 2, materials.metal, centre, floor));
        }
      }
    }

    storey.add(group);
    added.push(group);
  }

  return { added };
}
