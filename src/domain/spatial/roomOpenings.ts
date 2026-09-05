/**
 * Which openings serve a room — a pure walk over ids already on the graph.
 *
 * `Room` carries `wallIds`, `Wall` carries `openingIds`, `Opening` carries a
 * `kind`; the count of doors and windows a room has is not a stored field, it
 * is this three-hop walk: `room.wallIds` → `wall.openingIds` → `opening.kind`.
 * Two call sites need exactly that walk — the function-rule group in
 * `src/domain/rules/function` (`ROOM-NO-DOOR`, `ROOM-NO-WINDOW`, …) and the
 * PropertyInspector screen, which shows a room's door/window counts on a panel
 * that has no `RuleContext` to hand — so it is written once, here, rather than
 * once per caller.
 *
 * **Confirmed behaviour, not a bug: an opening cut into a wall shared by two
 * rooms is counted for BOTH rooms.** Naming a wall in `wallIds` is not what
 * decides ownership of a hole in it — a corridor and six rooms can all list
 * the same long wall, and a door near one end of it opens onto exactly one of
 * them. `opensOnto` below tests where the opening actually sits against each
 * room's own outline, so a door on a genuinely shared partition passes that
 * test for both rooms on either side of it, and both are right to say the
 * door is theirs.
 *
 * The geometry helpers below (`distanceToOutline`, `opensOnto`, `pointAlong`,
 * …) restate, rather than import, the private ones `src/domain/rules/function`
 * keeps for its own escape-route search: that module already depends on this
 * one for `Room`/`Wall`/`Opening`, so the other direction would be an import
 * cycle, and `pnpm cycles` is one of the seven gates in `pnpm verify`. Same
 * reasoning as `toWallViewModel` restating `WALL_KIND_LABELS` instead of
 * importing the command layer's copy.
 *
 * Every function here is pure: no argument is written to, and the same
 * room/walls/openings always give the same answer.
 */

import { compareNearly, isNearlyZero } from '../units/compare';
import type { Opening, Point, Room, Wall } from './types';

/* -------------------------------------------------------------------------- */
/* Geometry: is this opening actually on this room's boundary?                 */
/* -------------------------------------------------------------------------- */

interface Line {
  readonly start: Point;
  readonly end: Point;
}

function distanceBetween(first: Point, second: Point): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

/** Distance from a point to the nearest place on a run, ends included. */
function distanceToLine(point: Point, line: Line): number {
  const runX = line.end.x - line.start.x;
  const runY = line.end.y - line.start.y;
  const lengthSquared = runX * runX + runY * runY;

  if (isNearlyZero(lengthSquared)) {
    return distanceBetween(point, line.start);
  }

  const raw = ((point.x - line.start.x) * runX + (point.y - line.start.y) * runY) / lengthSquared;
  const along = Math.min(1, Math.max(0, raw));

  return Math.hypot(point.x - (line.start.x + along * runX), point.y - (line.start.y + along * runY));
}

/** The point a given distance along a run, measured from its start. */
function pointAlong(line: Line, distanceMm: number): Point {
  const length = Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y);

  if (isNearlyZero(length)) {
    return line.start;
  }

  return {
    x: line.start.x + ((line.end.x - line.start.x) / length) * distanceMm,
    y: line.start.y + ((line.end.y - line.start.y) / length) * distanceMm,
  };
}

/**
 * How far an opening may sit from a room's outline and still be that room's.
 *
 * A quarter of a metre covers the thickest wall's half section with slack for
 * an outline traced a little off the centreline.
 */
const OPENING_ON_OUTLINE_TOLERANCE_MM = 250;

/** Distance from a point to the nearest edge of a closed outline. */
function distanceToOutline(point: Point, outline: readonly Point[]): number {
  if (outline.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  if (outline.length === 1) {
    const only = outline[0];

    return only === undefined ? Number.POSITIVE_INFINITY : distanceBetween(point, only);
  }

  let smallest = Number.POSITIVE_INFINITY;

  for (let index = 0; index < outline.length; index += 1) {
    const start = outline[index];
    const end = outline[(index + 1) % outline.length];

    if (start === undefined || end === undefined) {
      continue;
    }

    smallest = Math.min(smallest, distanceToLine(point, { start, end }));
  }

  return smallest;
}

/** Where the middle of an opening sits on the plan. */
function openingCentre(wall: Wall, opening: Opening): Point {
  return pointAlong(wall.centreline, opening.offsetMm + opening.widthMm / 2);
}

/** Is this opening on the stretch of wall that bounds this room? */
function opensOnto(at: Point, room: Room): boolean {
  return compareNearly(distanceToOutline(at, room.outline), OPENING_ON_OUTLINE_TOLERANCE_MM) <= 0;
}

/* -------------------------------------------------------------------------- */
/* Public functions.                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The openings — doors and windows alike — cut into the walls that bound a
 * room.
 *
 * Takes the room's own `wallIds` and looks each one up in `walls`, then each
 * of that wall's `openingIds` up in `openings`; an id that resolves to nothing
 * in the arrays handed in is skipped rather than treated as an error, since a
 * caller may well be working from a graph slice. `walls`/`openings` need not
 * be the whole graph — passing just the entities a screen already has on hand
 * is enough.
 *
 * Not filtered by kind: a caller wanting only doors or only windows filters
 * the result, or reaches for {@link countOpeningsByKind} for a tally of both.
 * See the module docblock for why the same opening can legitimately appear in
 * the result for two different rooms.
 */
export function openingsOfRoom(
  room: Room,
  walls: readonly Wall[],
  openings: readonly Opening[],
): readonly Opening[] {
  const wallsById = new Map(walls.map((wall) => [wall.id, wall] as const));
  const openingsById = new Map(openings.map((opening) => [opening.id, opening] as const));
  const found: Opening[] = [];

  for (const wallId of room.wallIds) {
    const wall = wallsById.get(wallId);

    if (wall === undefined) {
      continue;
    }

    for (const openingId of wall.openingIds) {
      const opening = openingsById.get(openingId);

      if (opening === undefined) {
        continue;
      }

      if (opensOnto(openingCentre(wall, opening), room)) {
        found.push(opening);
      }
    }
  }

  return found;
}

/** How many doors and how many windows are in a list of openings. */
export interface OpeningCountsByKind {
  readonly doorCount: number;
  readonly windowCount: number;
}

/**
 * Tally a list of openings by kind.
 *
 * Reads only `Opening.kind`; pair it with {@link openingsOfRoom} to count one
 * room's doors and windows, as `roomOpeningCountsOf` in
 * `propertyInspectorGateway.ts` does.
 */
export function countOpeningsByKind(openings: readonly Opening[]): OpeningCountsByKind {
  let doorCount = 0;
  let windowCount = 0;

  for (const opening of openings) {
    if (opening.kind === 'door') {
      doorCount += 1;
    } else {
      windowCount += 1;
    }
  }

  return { doorCount, windowCount };
}
