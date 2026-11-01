/**
 * Which openings serve a room — a pure walk over ids already on the graph.
 *
 * `Room` carries `wallIds`, `Wall` carries `openingIds`, `Opening` carries a
 * `kind`; the count of doors and windows a room has is not a stored field, it is
 * a walk over the level's walls → `wall.openingIds` → `opening.kind`, kept
 * where the opening sits on the room's outline (see `openingsOfRoom`).
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
import { chordWalls, pointAtArcLength } from './arc';
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
  // Tường cong: `offsetMm` đo dọc cung (AppBack `arc.py`).
  if (wall.curveOffsetMm) {
    const { start, end } = wall.centreline;
    return pointAtArcLength(start, end, wall.curveOffsetMm, opening.offsetMm + opening.widthMm / 2).point;
  }
  return pointAlong(wall.centreline, opening.offsetMm + opening.widthMm / 2);
}

/**
 * Is this opening on the stretch of wall that bounds this room?
 *
 * The outline may be traced on either face of the wall or on its centreline,
 * so half the host wall's thickness always counts, never less than the fixed
 * tolerance above.
 */
function opensOnto(at: Point, room: Room, wall: Wall): boolean {
  const toleranceMm = Math.max(OPENING_ON_OUTLINE_TOLERANCE_MM, wall.thicknessMm / 2);

  return compareNearly(distanceToOutline(at, room.outline), toleranceMm) <= 0;
}

/* -------------------------------------------------------------------------- */
/* Public functions.                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The openings — doors and windows alike — cut into the walls that bound a
 * room.
 *
 * Walks every wall handed in on the room's level — not only the room's own
 * `wallIds` — and keeps each opening whose centre sits on the room's outline.
 * The detector splits walls at doors, so the piece that hosts a door is often
 * missing from `wallIds`; trusting that list alone reported rooms with a real
 * door as having none. Each of a wall's `openingIds` is looked up in
 * `openings`; an id that resolves to nothing
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
  const seen = new Set<string>();
  // The room's own walls first so their openings keep coming back first.
  const listed = room.wallIds.flatMap((wallId) => wallsById.get(wallId) ?? []);
  const listedIds = new Set<string>(room.wallIds);
  const others = walls.filter((wall) => !listedIds.has(wall.id) && wall.levelId === room.levelId);

  for (const wall of [...listed, ...others]) {
    for (const openingId of wall.openingIds) {
      const opening = openingsById.get(openingId);

      if (opening === undefined || seen.has(opening.id)) {
        continue;
      }

      if (opensOnto(openingCentre(wall, opening), room, wall)) {
        seen.add(opening.id);
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

/* -------------------------------------------------------------------------- */
/* Open passages: a wall-less stretch of outline people walk through.          */
/* -------------------------------------------------------------------------- */

/** Narrowest wall-less stretch of a room's outline a person still walks through. */
export const OPEN_PASSAGE_MIN_MM = 600;

/** How far past the gap a wall must stand for the gap to face an enclosed space. */
export const ENCLOSED_AREA_REACH_MM = 12000;

const GAP_SAMPLE_STEP_MM = 50;

/** One wall-less stretch of a room's outline. */
export interface OpenGap {
  /** Middle of the stretch. */
  readonly at: Point;
  readonly lengthMm: number;
}

/** Does a wall run along this point of the outline edge (parallel, close, within its length)? */
function isWalledAt(point: Point, edge: Point, walls: readonly Wall[]): boolean {
  return walls.some((wall) => {
    const { start, end } = wall.centreline;
    const runX = end.x - start.x;
    const runY = end.y - start.y;
    const length = Math.hypot(runX, runY);

    if (isNearlyZero(length)) {
      return false;
    }

    // Parallel only: a wall meeting the edge at a corner does not close the edge.
    if (Math.abs(runX * edge.y - runY * edge.x) / length > 0.17) {
      return false;
    }

    const along = ((point.x - start.x) * runX + (point.y - start.y) * runY) / (length * length);

    if (along < -0.001 || along > 1.001) {
      return false;
    }

    const across = Math.abs((point.x - start.x) * runY - (point.y - start.y) * runX) / length;

    return across <= Math.max(250, wall.thicknessMm / 2);
  });
}

/** Does a ray from `from` along `direction` (unit) cross a wall centreline within `reachMm`? */
function rayHitsWall(
  from: Point,
  direction: Point,
  walls: readonly Wall[],
  reachMm: number,
): boolean {
  return walls.some((wall) => {
    const { start, end } = wall.centreline;
    const runX = end.x - start.x;
    const runY = end.y - start.y;
    const cross = direction.x * runY - direction.y * runX;

    if (isNearlyZero(cross)) {
      return false;
    }

    const offX = start.x - from.x;
    const offY = start.y - from.y;
    const distance = (offX * runY - offY * runX) / cross;
    const along = (offX * direction.y - offY * direction.x) / cross;

    return distance > 1 && distance <= reachMm && along >= 0 && along <= 1;
  });
}

/**
 * Every door-wide stretch of the room's outline with no wall on it that faces an
 * enclosed space — another room, or a hall nobody drew as a room — rather than
 * the outdoors.
 *
 * Real case (r4 H-01, "phòng ngủ 01"): the bedroom's top edge runs 1,1 m along
 * an unlabelled lobby with no wall at all; the room is entered through that gap.
 * ROOM-NO-DOOR, ROOM-NOT-CLOSED and ESCAPE-DISTANCE all ask this one question,
 * so they all ask it here.
 *
 * "Enclosed" is read as: walking straight out of the gap, a wall stands within
 * `ENCLOSED_AREA_REACH_MM`. ponytail: a ray, not a flood fill; the far wall of a
 * U-shaped footprint also reads as enclosed. Switch to a footprint test once the
 * pipeline marks envelope walls.
 */
export function openGapsOfRoom(room: Room, walls: readonly Wall[]): OpenGap[] {
  const outline = room.outline;
  // Tường cong phủ cạnh phòng (đã lấy mẫu theo cung) bằng từng dây cung.
  const levelWalls = chordWalls(walls.filter((wall) => wall.levelId === room.levelId));
  const gaps: OpenGap[] = [];

  // A room with no wall attached is not a room with a gap; it is not drawn yet.
  if (room.wallIds.length === 0 || outline.length < 3) {
    return gaps;
  }

  // Shoelace sign: positive means the inside lies to the left of every edge.
  let twiceArea = 0;

  outline.forEach((point, index) => {
    const next = outline[(index + 1) % outline.length] ?? point;
    twiceArea += point.x * next.y - next.x * point.y;
  });

  const outwardSign = twiceArea > 0 ? 1 : -1;

  outline.forEach((start, index) => {
    const end = outline[(index + 1) % outline.length];

    if (end === undefined) {
      return;
    }

    const length = distanceBetween(start, end);

    if (length < OPEN_PASSAGE_MIN_MM) {
      return;
    }

    const edge = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
    const outward = { x: edge.y * outwardSign, y: -edge.x * outwardSign };
    let openFrom = -1;

    const close = (at: number): void => {
      const gapMm = at - openFrom;

      if (openFrom >= 0 && gapMm >= OPEN_PASSAGE_MIN_MM) {
        const mid = pointAlong({ start, end }, openFrom + gapMm / 2);

        if (rayHitsWall(mid, outward, levelWalls, ENCLOSED_AREA_REACH_MM)) {
          gaps.push({ at: mid, lengthMm: gapMm });
        }
      }

      openFrom = -1;
    };

    for (let at = 0; at <= length; at += GAP_SAMPLE_STEP_MM) {
      const point = pointAlong({ start, end }, at);

      if (isWalledAt(point, edge, levelWalls)) {
        close(at);
      } else if (openFrom < 0) {
        openFrom = at;
      }
    }

    close(length);
  });

  return gaps;
}
