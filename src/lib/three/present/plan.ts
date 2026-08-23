/**
 * The plan a presentation is built from — the product's model plus the three
 * things a cutaway needs that a survey does not record.
 *
 * Walls, openings and rooms are the same shapes `src/domain` describes, written
 * the way a JSON file writes them (numbers, arrays, no branded types). On top of
 * that a presentation plan carries:
 *
 * - a **finish** per room, which decides the floor texture;
 * - a **furniture** list, each item a catalogue variant with a size, a centre and
 *   a compass facing, and optionally a `.glb` to stand in for the procedural piece;
 * - which rooms get a **ceiling light**, and how high it hangs.
 *
 * This file is the schema and the conversions into the domain, nothing more: no
 * three.js objects, no DOM, so a plan can be validated in a test that renders
 * nothing. Every other module in `present/` reads a plan only through these
 * types, which is what lets any house be fed in as data without touching code.
 */

import type { Opening } from '@/domain/openings/types';
import type { LevelId, OpeningId, RoomId, SwingDirection, WallId } from '@/domain/spatial/types';
import { millimetres } from '@/domain/units/types';
import type { Wall, WallKind } from '@/domain/walls/types';

import type { BuildableLevel, BuildableRoom } from '../build/floor';
import { toSceneLength } from '../build/scene';

/* -------------------------------------------------------------------------- */
/* Schema.                                                                     */
/* -------------------------------------------------------------------------- */

/** What a room's slab is finished in; decides which drawn texture it gets. */
export type Finish = 'wood' | 'tile' | 'mosaic' | 'decking';

/** Every finish, in the order the catalogue lists them. */
export const FINISHES: readonly Finish[] = ['wood', 'tile', 'mosaic', 'decking'];

/** Where the front of a piece points on the plan; north is `+y` on the drawing. */
export type Facing = 'north' | 'east' | 'south' | 'west';

/** Every facing, in compass order. */
export const FACINGS: readonly Facing[] = ['north', 'east', 'south', 'west'];

export interface PlanLevel {
  readonly id: string;
  readonly elevationMm: number;
  readonly heightMm: number;
}

export interface PlanWall {
  readonly id: string;
  readonly levelId: string;
  readonly kind: string;
  readonly thicknessMm: number;
  /** A wall lower than its storey — a balustrade. Absent means storey height. */
  readonly heightMm?: number;
  readonly start: readonly number[];
  readonly end: readonly number[];
}

export interface PlanOpening {
  readonly id: string;
  readonly wallId: string;
  readonly kind: string;
  readonly relativePosition: number;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly sillHeightMm: number;
  readonly swing: string;
  /**
   * Which way a hinged door stands open in the cutaway — the compass point the
   * leaf's free edge moves towards. Absent, the leaf opens to whichever side the
   * hinge rule picks first. Ignored for anything that is not a hinged door.
   */
  readonly opensTowards?: string;
}

export interface PlanRoom {
  readonly id: string;
  readonly levelId: string;
  readonly finish: string;
  readonly outline: readonly (readonly number[])[];
}

/** One furniture entry: a catalogue variant, sized, placed and turned. */
export interface PlanFurniture {
  readonly id: string;
  /** The storey it stands on. Absent means the plan's first level. */
  readonly levelId?: string;
  readonly variant: string;
  readonly centreMm: readonly number[];
  /** Width × depth × height. */
  readonly sizeMm: readonly number[];
  readonly facing: string;
  /**
   * How far above the floor the piece's base sits: a vase on a table, a picture
   * on a wall, a hood under the ceiling. Absent means standing on the floor.
   */
  readonly liftMm?: number;
  /**
   * A `.glb` to stand in place of the procedural piece, when one exists.
   * Absent, unreachable or broken, the procedural piece stays — see `assets.ts`.
   */
  readonly modelUrl?: string;
}

export interface PlanCeilingLights {
  readonly heightMm: number;
  /** Rooms that get one downlight at their centre. */
  readonly roomIds: readonly string[];
  /** Extra downlights at named plan points — a long room needs more than its centre. */
  readonly positionsMm?: readonly (readonly number[])[];
}

/** The whole drawing. Extra JSON fields such as a comment or a name are ignored. */
export interface PresentationPlan {
  readonly levels: readonly PlanLevel[];
  readonly walls: readonly PlanWall[];
  readonly openings: readonly PlanOpening[];
  readonly rooms: readonly PlanRoom[];
  readonly furniture: readonly PlanFurniture[];
  readonly ceilingLights: PlanCeilingLights;
}

/* -------------------------------------------------------------------------- */
/* Scene-unit shapes.                                                          */
/* -------------------------------------------------------------------------- */

/** A size in scene units, width × depth × height. */
export interface SceneSize {
  readonly w: number;
  readonly d: number;
  readonly h: number;
}

/** A point on the plan in scene units: `x` across, `z` deep. */
export interface ScenePoint {
  readonly x: number;
  readonly z: number;
}

/* -------------------------------------------------------------------------- */
/* Conversions.                                                                */
/* -------------------------------------------------------------------------- */

const at = (values: readonly number[], index: number): number => values[index] ?? 0;

export function toBuildableLevel(level: PlanLevel): BuildableLevel {
  return {
    id: level.id as LevelId,
    elevationMm: millimetres(level.elevationMm),
    heightMm: millimetres(level.heightMm),
  };
}

/**
 * A JSON wall as `@/domain/walls` describes one.
 *
 * `baseElevationMm` and `topElevationMm` are absolute heights rather than a
 * height above the storey, which is why the level has to be looked up here
 * rather than left to the builder.
 */
export function toDomainWall(wall: PlanWall, level: PlanLevel): Wall {
  return {
    id: wall.id as WallId,
    kind: wall.kind as WallKind,
    centreline: {
      start: { x: millimetres(at(wall.start, 0)), y: millimetres(at(wall.start, 1)) },
      end: { x: millimetres(at(wall.end, 0)), y: millimetres(at(wall.end, 1)) },
    },
    thicknessMm: millimetres(wall.thicknessMm),
    baseElevationMm: millimetres(level.elevationMm),
    topElevationMm: millimetres(level.elevationMm + (wall.heightMm ?? level.heightMm)),
  };
}

export function toDomainOpening(opening: PlanOpening): Opening {
  return {
    id: opening.id as OpeningId,
    wallId: opening.wallId as WallId,
    kind: opening.kind as Opening['kind'],
    relativePosition: opening.relativePosition,
    widthMm: millimetres(opening.widthMm),
    heightMm: millimetres(opening.heightMm),
    sillHeightMm: millimetres(opening.sillHeightMm),
    swing: opening.swing as SwingDirection,
  } as Opening;
}

export function toBuildableRoom(room: PlanRoom): BuildableRoom {
  return {
    id: room.id as RoomId,
    outline: room.outline.map((corner) => ({
      x: millimetres(at(corner, 0)),
      y: millimetres(at(corner, 1)),
    })),
  };
}

/** The middle of a room outline, in scene units — where its ceiling light hangs. */
export function roomCentre(room: PlanRoom): ScenePoint {
  const count = Math.max(1, room.outline.length);
  const sum = room.outline.reduce(
    (total, corner) => ({ x: total.x + at(corner, 0), y: total.y + at(corner, 1) }),
    { x: 0, y: 0 },
  );

  return {
    x: toSceneLength(millimetres(sum.x / count)),
    z: toSceneLength(millimetres(sum.y / count)),
  };
}

/** A furniture entry's size in scene units. */
export function furnitureSize(entry: PlanFurniture): SceneSize {
  return {
    w: toSceneLength(millimetres(at(entry.sizeMm, 0))),
    d: toSceneLength(millimetres(at(entry.sizeMm, 1))),
    h: toSceneLength(millimetres(at(entry.sizeMm, 2))),
  };
}

/** A furniture entry's centre in scene units. */
export function furnitureCentre(entry: PlanFurniture): ScenePoint {
  return {
    x: toSceneLength(millimetres(at(entry.centreMm, 0))),
    z: toSceneLength(millimetres(at(entry.centreMm, 1))),
  };
}

/** How far above the floor a furniture entry's base sits, in scene units. */
export function furnitureLift(entry: PlanFurniture): number {
  return toSceneLength(millimetres(entry.liftMm ?? 0));
}

/** A plan point in scene units. */
export function planPoint(pointMm: readonly number[]): ScenePoint {
  return {
    x: toSceneLength(millimetres(at(pointMm, 0))),
    z: toSceneLength(millimetres(at(pointMm, 1))),
  };
}

/** The unit vector a facing points along, on the scene's floor plane. */
export function facingVector(facing: Facing): ScenePoint {
  switch (facing) {
    case 'north':
      return { x: 0, z: 1 };
    case 'east':
      return { x: 1, z: 0 };
    case 'south':
      return { x: 0, z: -1 };
    case 'west':
      return { x: -1, z: 0 };
  }
}

/** A height above the project datum for a storey, in scene units. */
export function heightAbove(level: PlanLevel, heightMm: number): number {
  return toSceneLength(millimetres(level.elevationMm + heightMm));
}

export function isFinish(value: string): value is Finish {
  return (FINISHES as readonly string[]).includes(value);
}

export function isFacing(value: string): value is Facing {
  return (FACINGS as readonly string[]).includes(value);
}
