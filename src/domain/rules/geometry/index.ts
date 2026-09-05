/**
 * The first group of rules: the model contradicting itself.
 *
 * Everything here answers one question — can this building exist? Not "is it
 * comfortable", not "does it meet the standards table", but: are two walls in
 * the same place, does a room have a side open to nothing, is there air under a
 * load-bearing wall. A drawing that fails one of these is not a drawing with a
 * problem, it is a drawing of nothing, so every rule in the group is `critical`.
 *
 * **Seven rules, seven functions.** Each check is exported on its own and can be
 * called with a `RuleContext` and nothing else, which is what makes each one
 * testable in isolation and what keeps the registry's dependency map honest:
 * `dependsOn` lists exactly the entity kinds the function reads.
 *
 * **Nothing is reported twice.** The group is drawn so that the seven problems
 * do not overlap, and the boundaries that took thought are these:
 *
 * - `WALL-DANGLING-END` is about a **wall end** joined to nothing;
 *   `ROOM-NOT-CLOSED` is about a **room side** with no wall running along it.
 *   A room can be open along a side whose walls are all perfectly joined, and a
 *   wall can dangle in the middle of a closed room, so neither implies the
 *   other and the two never describe the same defect.
 * - `WALL-OVERLAP` ignores anything meeting at an end. Every corner and every
 *   tee is two walls touching, and reporting those would bury the one pair that
 *   genuinely runs through the other.
 * - `OPENING-OVERLAP` is about two holes claiming one stretch of wall.
 *   An opening hanging off the end of its wall is `OPENING-IN-WALL`'s problem,
 *   in the built-in book, and a door whose span is off the wall is skipped here
 *   rather than reported a second time in a different vocabulary.
 * - `DOOR-SWING-BLOCKED` fires only when **no** face of the door is clear.
 *   The model records which end the leaf is hinged on but not which way it
 *   faces, so a door with one clear side is a door somebody can open, and
 *   guessing which side would produce a warning nobody can act on.
 *
 * Every function is pure and reads only the graph it is handed: no store, no
 * network, no clock. The same plan always gives the same violations, in the
 * order the entities appear in the model.
 *
 * Coordinates in the spatial graph are plain millimetre numbers rather than the
 * branded quantities the `units` module carries, so the geometry below works in
 * plain numbers too, and tolerant comparison goes through `compareNearly` — a
 * bare `===` between two measured values appears nowhere.
 */

import { compareNearly, isNearlyZero } from '../../units/compare';
import type { Furniture, Level, Point, Wall } from '../../spatial/types';
import {
  entitiesInScope,
  findEntity,
  type Rule,
  type RuleContext,
  type RuleFinding,
  type RuleRegistry,
} from '../registry';
import {
  danglingEndText,
  doorSwingBlockedText,
  openingOverlapText,
  roomNotClosedText,
  stairAlignmentText,
  wallCrossingText,
  wallOverlapAlongText,
  wallUnsupportedText,
  type RuleText,
} from './messages';

/* -------------------------------------------------------------------------- */
/* Thresholds.                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * How far apart two wall lines may point and still count as the same line.
 *
 * Five degrees is about the most a hand-traced wall drifts from the one it was
 * meant to duplicate; past that the two are genuinely different runs and the
 * crossing test is the one that applies.
 */
export const PARALLEL_ANGLE_DEG = 5;

/**
 * How close a wall end has to be to count as joined.
 *
 * The same fifty millimetres `walls/joints.ts` welds ends at, so a pair of walls
 * the joint solver treats as meeting is never reported as dangling here.
 */
export const JOINT_TOLERANCE_MM = 50;

/** Shortest shared run worth calling an overlap rather than a rounding error. */
export const MIN_WALL_OVERLAP_MM = 10;

/** How far a wall may sit off a room edge and still be said to close it. */
export const COVERAGE_LATERAL_TOLERANCE_MM = 50;

/** Longest stretch of room outline that may go unwalled without complaint. */
export const MAX_UNCOVERED_EDGE_MM = 50;

/** Share of a load-bearing wall that has to have something under it. */
export const MIN_SUPPORT_SHARE = 0.8;

/** How far a stair may sit off the one below before the core stops lining up. */
export const STAIR_ALIGNMENT_TOLERANCE_MM = 250;

/* -------------------------------------------------------------------------- */
/* What a geometry rule reports.                                               */
/* -------------------------------------------------------------------------- */

/**
 * A finding that names every entity involved, not only the one at fault.
 *
 * A geometric defect is almost never about one object: a wall overlaps another
 * wall, a door hits a third wall, a stair misses the stair below. `relatedIds`
 * is that list, subject first, so the interface can highlight the whole set
 * rather than a single code buried in a sentence.
 *
 * The registry's `Violation` carries `entityId`, `message` and `suggestion`;
 * `relatedIds` is available to anything calling these checks directly, and the
 * message names every code in the list, so no caller loses the information.
 */
export interface GeometryFinding extends RuleFinding {
  /** Every entity the defect involves, the subject first. */
  readonly relatedIds: readonly string[];
}

/** A geometry check: pure, read-only, one rule's worth of work. */
export type GeometryCheck = (context: RuleContext) => readonly GeometryFinding[];

function finding(text: RuleText, entityId: string, relatedIds: readonly string[]): GeometryFinding {
  return { entityId, message: text.message, suggestion: text.suggestion, relatedIds };
}

/* -------------------------------------------------------------------------- */
/* Plan geometry.                                                              */
/* -------------------------------------------------------------------------- */

/** A straight run between two plan coordinates, in millimetres. */
interface Line {
  readonly start: Point;
  readonly end: Point;
}

/** A direction of unit length, or `null` for a run with no length. */
interface Direction {
  readonly x: number;
  readonly y: number;
}

/** A stretch of a line, measured from its start. */
interface Interval {
  readonly low: number;
  readonly high: number;
}

function itemAt<TItem>(items: readonly TItem[], index: number): TItem {
  const item = items[index];

  if (item === undefined) {
    throw new RangeError(`Index ${String(index)} falls outside a list of ${String(items.length)}.`);
  }

  return item;
}

function lengthOf(line: Line): number {
  return Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y);
}

function directionOf(line: Line): Direction | null {
  const length = lengthOf(line);

  if (isNearlyZero(length)) {
    return null;
  }

  return { x: (line.end.x - line.start.x) / length, y: (line.end.y - line.start.y) / length };
}

/** How far along a line a point sits, measured from `start`; may leave the run. */
function alongOf(line: Line, point: Point): number {
  const direction = directionOf(line);

  if (direction === null) {
    return 0;
  }

  return (point.x - line.start.x) * direction.x + (point.y - line.start.y) * direction.y;
}

/** How far off a line a point sits; the sign says which side. */
function lateralOf(line: Line, point: Point): number {
  const direction = directionOf(line);

  if (direction === null) {
    return Math.hypot(point.x - line.start.x, point.y - line.start.y);
  }

  return (point.x - line.start.x) * -direction.y + (point.y - line.start.y) * direction.x;
}

function pointAlong(line: Line, distanceMm: number): Point {
  const direction = directionOf(line);

  if (direction === null) {
    return line.start;
  }

  return { x: line.start.x + direction.x * distanceMm, y: line.start.y + direction.y * distanceMm };
}

/** Distance from a point to the nearest place on a run, ends included. */
function distanceToLine(point: Point, line: Line): number {
  const runX = line.end.x - line.start.x;
  const runY = line.end.y - line.start.y;
  const lengthSquared = runX * runX + runY * runY;

  if (isNearlyZero(lengthSquared)) {
    return Math.hypot(point.x - line.start.x, point.y - line.start.y);
  }

  const raw = ((point.x - line.start.x) * runX + (point.y - line.start.y) * runY) / lengthSquared;
  const along = Math.min(1, Math.max(0, raw));

  return Math.hypot(point.x - (line.start.x + along * runX), point.y - (line.start.y + along * runY));
}

/** Where two runs cut each other, or `null` when they do not meet at all. */
function crossingOf(first: Line, second: Line): Point | null {
  const firstRun = { x: first.end.x - first.start.x, y: first.end.y - first.start.y };
  const secondRun = { x: second.end.x - second.start.x, y: second.end.y - second.start.y };
  const denominator = firstRun.x * secondRun.y - firstRun.y * secondRun.x;

  if (isNearlyZero(denominator)) {
    return null;
  }

  const gap = { x: second.start.x - first.start.x, y: second.start.y - first.start.y };
  const alongFirst = (gap.x * secondRun.y - gap.y * secondRun.x) / denominator;
  const alongSecond = (gap.x * firstRun.y - gap.y * firstRun.x) / denominator;

  if (alongFirst < 0 || alongFirst > 1 || alongSecond < 0 || alongSecond > 1) {
    return null;
  }

  return {
    x: first.start.x + alongFirst * firstRun.x,
    y: first.start.y + alongFirst * firstRun.y,
  };
}

/**
 * Where two runs cut through each other rather than merely meeting.
 *
 * A crossing within `endToleranceMm` of any of the four ends is a corner or a
 * tee — the way walls are supposed to join — so it is not a crossing at all.
 */
function properCrossingOf(first: Line, second: Line, endToleranceMm: number): Point | null {
  const at = crossingOf(first, second);

  if (at === null) {
    return null;
  }

  const ends = [first.start, first.end, second.start, second.end];

  for (const end of ends) {
    if (compareNearly(Math.hypot(at.x - end.x, at.y - end.y), endToleranceMm) <= 0) {
      return null;
    }
  }

  return at;
}

/** Closest approach between two runs; zero when they meet. */
function distanceBetweenLines(first: Line, second: Line): number {
  if (crossingOf(first, second) !== null) {
    return 0;
  }

  return Math.min(
    distanceToLine(first.start, second),
    distanceToLine(first.end, second),
    distanceToLine(second.start, first),
    distanceToLine(second.end, first),
  );
}

/** The angle between two lines, within `[0, 90]`; direction of travel ignored. */
function angleBetween(first: Line, second: Line): number {
  const firstDirection = directionOf(first);
  const secondDirection = directionOf(second);

  if (firstDirection === null || secondDirection === null) {
    return 0;
  }

  const firstDeg = (Math.atan2(firstDirection.y, firstDirection.x) * 180) / Math.PI;
  const secondDeg = (Math.atan2(secondDirection.y, secondDirection.x) * 180) / Math.PI;
  const gap = Math.abs(firstDeg - secondDeg) % 180;

  return gap > 90 ? 180 - gap : gap;
}

/** Where `other` sits along `line`'s axis, low end first. */
function spanOn(line: Line, other: Line): Interval {
  const first = alongOf(line, other.start);
  const second = alongOf(line, other.end);

  return { low: Math.min(first, second), high: Math.max(first, second) };
}

/** How much of `line` the other run covers; negative when they are apart. */
function overlapAlong(line: Line, other: Line): number {
  const span = spanOn(line, other);

  return Math.min(lengthOf(line), span.high) - Math.max(0, span.low);
}

/** Merge overlapping stretches into the fewest that describe the same cover. */
function mergeIntervals(intervals: readonly Interval[]): Interval[] {
  const sorted = [...intervals].sort((first, second) => first.low - second.low);
  const merged: Interval[] = [];

  for (const interval of sorted) {
    const last = merged[merged.length - 1];

    if (last === undefined || compareNearly(interval.low, last.high) > 0) {
      merged.push(interval);
      continue;
    }

    merged[merged.length - 1] = { low: last.low, high: Math.max(last.high, interval.high) };
  }

  return merged;
}

/** The stretches of `[0, length]` that the covered intervals leave out. */
function gapsIn(covered: readonly Interval[], lengthMm: number): Interval[] {
  const gaps: Interval[] = [];
  let cursor = 0;

  for (const interval of mergeIntervals(covered)) {
    if (compareNearly(interval.low, cursor) > 0) {
      gaps.push({ low: cursor, high: Math.min(interval.low, lengthMm) });
    }

    cursor = Math.max(cursor, interval.high);

    if (compareNearly(cursor, lengthMm) >= 0) {
      return gaps;
    }
  }

  if (compareNearly(cursor, lengthMm) < 0) {
    gaps.push({ low: cursor, high: lengthMm });
  }

  return gaps;
}

/** Walls with a centreline worth measuring; a collapsed one is integrity's job. */
function usableWalls(walls: readonly Wall[]): Wall[] {
  return walls.filter((wall) => !isNearlyZero(lengthOf(wall.centreline)));
}

/** Group entities by the level they sit on, keeping model order within a level. */
function groupByLevel<TEntity extends { readonly levelId: string }>(
  entities: readonly TEntity[],
): Map<string, TEntity[]> {
  const grouped = new Map<string, TEntity[]>();

  for (const entity of entities) {
    const bucket = grouped.get(entity.levelId);

    if (bucket === undefined) {
      grouped.set(entity.levelId, [entity]);
    } else {
      bucket.push(entity);
    }
  }

  return grouped;
}

/** Levels bottom to top; the order the storeys are actually stacked in. */
function stackedLevels(context: RuleContext): Level[] {
  return entitiesInScope(context, 'level').sort((first, second) => first.order - second.order);
}

/* -------------------------------------------------------------------------- */
/* 1 — WALL-OVERLAP.                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Two walls occupying the same ground.
 *
 * Two shapes of the same defect, and both are checked here because to a builder
 * they are one problem — a wall where another wall already is:
 *
 * - **Along the line.** Near-parallel runs whose bodies touch sideways and that
 *   share more than a sliver of their length. This is what a duplicate traced
 *   wall looks like, and what a wall dragged onto its neighbour becomes.
 * - **Through it.** Runs at an angle whose centrelines cut each other away from
 *   every end. Walls are allowed to meet — that is a corner or a tee — but one
 *   passing through the middle of another means neither was ever split.
 *
 * Each pair is looked at once, and reported against the wall the model lists
 * first, so a QC list never shows the same overlap from both sides.
 */
export const checkWallOverlap: GeometryCheck = (context) => {
  const walls = usableWalls(entitiesInScope(context, 'wall'));
  const findings: GeometryFinding[] = [];

  for (let index = 0; index < walls.length; index += 1) {
    const wall = itemAt(walls, index);

    for (let other = index + 1; other < walls.length; other += 1) {
      const secondWall = itemAt(walls, other);

      if (compareNearly(angleBetween(wall.centreline, secondWall.centreline), PARALLEL_ANGLE_DEG) <= 0) {
        const bodiesMm = (wall.thicknessMm + secondWall.thicknessMm) / 2;

        if (
          compareNearly(distanceBetweenLines(wall.centreline, secondWall.centreline), bodiesMm) > 0
        ) {
          continue;
        }

        const overlapMm = overlapAlong(wall.centreline, secondWall.centreline);

        if (compareNearly(overlapMm, MIN_WALL_OVERLAP_MM) <= 0) {
          continue;
        }

        findings.push(
          finding(
            wallOverlapAlongText({ wallId: wall.id, otherWallId: secondWall.id, overlapMm }),
            wall.id,
            [wall.id, secondWall.id],
          ),
        );

        continue;
      }

      const at = properCrossingOf(wall.centreline, secondWall.centreline, JOINT_TOLERANCE_MM);

      if (at === null) {
        continue;
      }

      findings.push(
        finding(wallCrossingText({ wallId: wall.id, otherWallId: secondWall.id, at }), wall.id, [
          wall.id,
          secondWall.id,
        ]),
      );
    }
  }

  return findings;
};

/* -------------------------------------------------------------------------- */
/* 2 — WALL-DANGLING-END.                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A wall end holding on to nothing.
 *
 * An end counts as joined when it reaches the **face** of any other wall on the
 * level, which covers both ways walls meet: end to end at a corner, and end
 * against a side at a tee. Measuring to the face rather than to the centreline
 * is what stops a thick wall being called dangling because its neighbour's
 * centreline is half a thickness away.
 *
 * Both ends of every wall are checked, so a free-standing run is reported twice
 * — once per loose end — because they are two places a person has to go and
 * two separate things to draw.
 */
export const checkDanglingWallEnds: GeometryCheck = (context) => {
  const walls = usableWalls(entitiesInScope(context, 'wall'));
  const findings: GeometryFinding[] = [];

  for (const wall of walls) {
    for (const end of ['start', 'end'] as const) {
      const at = wall.centreline[end];
      let nearestGapMm: number | null = null;
      let nearestWallId: string | null = null;
      let joined = false;

      for (const other of walls) {
        if (other.id === wall.id) {
          continue;
        }

        const faceGapMm = Math.max(
          0,
          distanceToLine(at, other.centreline) - other.thicknessMm / 2,
        );

        if (compareNearly(faceGapMm, JOINT_TOLERANCE_MM) <= 0) {
          joined = true;
          break;
        }

        if (nearestGapMm === null || faceGapMm < nearestGapMm) {
          nearestGapMm = faceGapMm;
          nearestWallId = other.id;
        }
      }

      if (joined) {
        continue;
      }

      findings.push(
        finding(
          danglingEndText({
            wallId: wall.id,
            at,
            nearestGapMm,
            nearestWallId,
            toleranceMm: JOINT_TOLERANCE_MM,
          }),
          wall.id,
          nearestWallId === null ? [wall.id] : [wall.id, nearestWallId],
        ),
      );
    }
  }

  return findings;
};

/* -------------------------------------------------------------------------- */
/* 3 — ROOM-NOT-CLOSED.                                                        */
/* -------------------------------------------------------------------------- */

/**
 * A room with a side open to nothing.
 *
 * Every edge of the outline is asked the same question: is there a wall running
 * along this, close enough that the wall's body covers it? Walls that qualify
 * hand back the stretch of the edge they cover, the stretches are merged, and
 * whatever is left over is a gap the room is not sealed along.
 *
 * A wall only counts when **both** its ends sit within its own half-thickness of
 * the edge's line, so a wall that merely crosses the edge — a partition tee'ing
 * into it — cannot be mistaken for one that closes it.
 *
 * Reported once per room, with the total open length and the longest single
 * gap, because that is one trip for the person fixing it. Outlines with fewer
 * than three vertices are left to `spatial/integrity.ts`, which already says so
 * in plainer words.
 */
export const checkRoomClosure: GeometryCheck = (context) => {
  const rooms = entitiesInScope(context, 'room');
  const walls = usableWalls(entitiesInScope(context, 'wall'));
  const findings: GeometryFinding[] = [];

  for (const room of rooms) {
    if (room.outline.length < 3) {
      continue;
    }

    let perimeterMm = 0;
    let uncoveredMm = 0;
    let gapCount = 0;
    let worstGapMm = 0;
    let worstGapAt: Point = itemAt(room.outline, 0);
    const guiltyWallIds = new Set<string>();

    for (let index = 0; index < room.outline.length; index += 1) {
      const edge: Line = {
        start: itemAt(room.outline, index),
        end: itemAt(room.outline, (index + 1) % room.outline.length),
      };
      const edgeLengthMm = lengthOf(edge);

      if (isNearlyZero(edgeLengthMm)) {
        continue;
      }

      perimeterMm += edgeLengthMm;

      const covered: Interval[] = [];

      for (const wall of walls) {
        if (compareNearly(angleBetween(edge, wall.centreline), PARALLEL_ANGLE_DEG) > 0) {
          continue;
        }

        const reachMm = wall.thicknessMm / 2 + COVERAGE_LATERAL_TOLERANCE_MM;
        const startOff = Math.abs(lateralOf(edge, wall.centreline.start));
        const endOff = Math.abs(lateralOf(edge, wall.centreline.end));

        if (compareNearly(startOff, reachMm) > 0 || compareNearly(endOff, reachMm) > 0) {
          continue;
        }

        const span = spanOn(edge, wall.centreline);
        const low = Math.max(0, span.low);
        const high = Math.min(edgeLengthMm, span.high);

        if (compareNearly(high, low) > 0) {
          covered.push({ low, high });
          guiltyWallIds.add(wall.id);
        }
      }

      for (const gap of gapsIn(covered, edgeLengthMm)) {
        const gapMm = gap.high - gap.low;

        if (compareNearly(gapMm, MAX_UNCOVERED_EDGE_MM) <= 0) {
          continue;
        }

        uncoveredMm += gapMm;
        gapCount += 1;

        if (gapMm > worstGapMm) {
          worstGapMm = gapMm;
          worstGapAt = pointAlong(edge, (gap.low + gap.high) / 2);
        }
      }
    }

    if (gapCount === 0) {
      continue;
    }

    findings.push(
      finding(
        roomNotClosedText({
          roomId: room.id,
          roomName: room.name,
          uncoveredMm,
          perimeterMm,
          gapCount,
          worstGapAt,
          worstGapMm,
        }),
        room.id,
        // The room's own walls first, then any other wall found running along it.
        [...new Set<string>([room.id, ...room.wallIds, ...guiltyWallIds])],
      ),
    );
  }

  return findings;
};

/* -------------------------------------------------------------------------- */
/* 4 — DOOR-SWING-BLOCKED.                                                     */
/* -------------------------------------------------------------------------- */

/** Where the leaf is hinged, measured along the host centreline. */
function hingePositionsMm(offsetMm: number, widthMm: number, swing: string): number[] {
  if (swing === 'left') {
    return [offsetMm];
  }

  if (swing === 'right') {
    return [offsetMm + widthMm];
  }

  return [offsetMm, offsetMm + widthMm];
}

/**
 * A door with nowhere to open.
 *
 * The leaf, fully open, stands square to its host wall at the hinge and reaches
 * one leaf-width out. Both faces of the wall are tried, and both ends for a
 * double door; if any of them is clear the door works and nothing is reported.
 * Only when every face is obstructed — a door in a cupboard shallower than its
 * own leaf, a door facing a wall closer than it is wide — has the drawing
 * described a door that cannot be opened.
 *
 * The report carries the deepest clear space any face offers, so the person
 * reading it can see straight away whether the fix is a narrower leaf or a
 * different door.
 *
 * Doors that slide or are fixed have no leaf to swing. Doors whose span already
 * runs off the end of their wall are skipped: that is `OPENING-IN-WALL`'s
 * finding, and a swing computed from a hinge that is not on the wall would be
 * arithmetic about nothing.
 */
export const checkDoorSwing: GeometryCheck = (context) => {
  const openings = entitiesInScope(context, 'opening');
  const walls = usableWalls(entitiesInScope(context, 'wall'));
  const findings: GeometryFinding[] = [];

  for (const opening of openings) {
    if (opening.kind !== 'door' || opening.swing === 'sliding' || opening.swing === 'fixed') {
      continue;
    }

    const host = findEntity(context, 'wall', opening.wallId);

    if (host === null) {
      continue;
    }

    const direction = directionOf(host.centreline);

    if (direction === null) {
      continue;
    }

    const hostLengthMm = lengthOf(host.centreline);

    if (
      compareNearly(opening.offsetMm, 0) < 0 ||
      compareNearly(opening.offsetMm + opening.widthMm, hostLengthMm) > 0
    ) {
      continue;
    }

    const leafMm = opening.swing === 'double' ? opening.widthMm / 2 : opening.widthMm;

    if (compareNearly(leafMm, 0) <= 0) {
      continue;
    }

    const normal = { x: -direction.y, y: direction.x };
    const blocking = new Set<string>();
    let bestClearanceMm = 0;
    let anyFaceClear = false;

    for (const hingeMm of hingePositionsMm(opening.offsetMm, opening.widthMm, opening.swing)) {
      const hinge = pointAlong(host.centreline, hingeMm);

      for (const side of [1, -1]) {
        const leaf: Line = {
          start: hinge,
          end: {
            x: hinge.x + side * normal.x * leafMm,
            y: hinge.y + side * normal.y * leafMm,
          },
        };

        let clearanceMm = leafMm;
        let hitAnything = false;

        for (const wall of walls) {
          if (wall.id === host.id) {
            continue;
          }

          if (compareNearly(distanceBetweenLines(leaf, wall.centreline), wall.thicknessMm / 2) > 0) {
            continue;
          }

          hitAnything = true;
          blocking.add(wall.id);
          clearanceMm = Math.min(
            clearanceMm,
            Math.max(0, distanceToLine(hinge, wall.centreline) - wall.thicknessMm / 2),
          );
        }

        if (!hitAnything) {
          anyFaceClear = true;
          break;
        }

        bestClearanceMm = Math.max(bestClearanceMm, clearanceMm);
      }

      if (anyFaceClear) {
        break;
      }
    }

    if (anyFaceClear) {
      continue;
    }

    // Model order, not insertion order, so the sentence reads the same each run.
    const blockingWallIds = walls.filter((wall) => blocking.has(wall.id)).map((wall) => wall.id);

    findings.push(
      finding(
        doorSwingBlockedText({
          openingId: opening.id,
          hostWallId: host.id,
          blockingWallIds,
          leafMm,
          bestClearanceMm,
        }),
        opening.id,
        [opening.id, host.id, ...blockingWallIds],
      ),
    );
  }

  return findings;
};

/* -------------------------------------------------------------------------- */
/* 5 — OPENING-OVERLAP.                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Two holes cut in the same stretch of wall.
 *
 * Openings are stored as an offset and a width along their host centreline, so
 * the whole test is an interval overlap; no geometry is needed and the wall
 * itself is never read, which is why the rule depends on openings alone.
 *
 * Touching exactly — one opening starting where the last one stops — is not an
 * overlap. It is a mullion, and it is drawn that way on purpose.
 *
 * Each pair is reported once, against the opening the model lists first.
 */
export const checkOpeningOverlap: GeometryCheck = (context) => {
  const openings = entitiesInScope(context, 'opening');
  const byWall = new Map<string, typeof openings>();

  for (const opening of openings) {
    const bucket = byWall.get(opening.wallId);

    if (bucket === undefined) {
      byWall.set(opening.wallId, [opening]);
    } else {
      bucket.push(opening);
    }
  }

  const findings: GeometryFinding[] = [];

  for (const [wallId, hosted] of byWall) {
    for (let index = 0; index < hosted.length; index += 1) {
      const opening = itemAt(hosted, index);

      for (let other = index + 1; other < hosted.length; other += 1) {
        const secondOpening = itemAt(hosted, other);
        const fromMm = Math.max(opening.offsetMm, secondOpening.offsetMm);
        const toMm = Math.min(
          opening.offsetMm + opening.widthMm,
          secondOpening.offsetMm + secondOpening.widthMm,
        );
        const overlapMm = toMm - fromMm;

        if (compareNearly(overlapMm, 0) <= 0) {
          continue;
        }

        findings.push(
          finding(
            openingOverlapText({
              openingId: opening.id,
              otherOpeningId: secondOpening.id,
              wallId,
              overlapMm,
              fromMm,
              toMm,
            }),
            opening.id,
            [opening.id, secondOpening.id, wallId],
          ),
        );
      }
    }
  }

  return findings;
};

/* -------------------------------------------------------------------------- */
/* 6 — WALL-UNSUPPORTED.                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A load-bearing wall with air underneath.
 *
 * Every load-bearing wall above the bottom storey is measured against the
 * load-bearing walls on the storey directly below: those running the same way,
 * close enough sideways that the two bodies touch, hand back the stretch of the
 * upper wall they stand under. Those stretches are merged — two short walls
 * below can jointly carry one long wall above — and the share that is left
 * unsupported is what the rule judges.
 *
 * A partition below carries nothing, so it is not counted as support. Nor is a
 * beam, because the model has no beams: a wall genuinely carried on one is
 * reported here, and a person marks it reviewed. That is the right way round —
 * silence about a wall standing on nothing is the expensive mistake.
 */
export const checkLoadBearingSupport: GeometryCheck = (context) => {
  const levels = stackedLevels(context);
  const wallsByLevel = groupByLevel(usableWalls(entitiesInScope(context, 'wall')));
  const findings: GeometryFinding[] = [];

  for (let index = 1; index < levels.length; index += 1) {
    const level = itemAt(levels, index);
    const levelBelow = itemAt(levels, index - 1);
    const supports = (wallsByLevel.get(levelBelow.id) ?? []).filter(
      (wall) => wall.kind === 'loadBearing',
    );

    for (const wall of wallsByLevel.get(level.id) ?? []) {
      if (wall.kind !== 'loadBearing') {
        continue;
      }

      const wallLengthMm = lengthOf(wall.centreline);
      const covered: Interval[] = [];
      let bestSupportWallId: string | null = null;
      let bestSupportMm = 0;

      for (const support of supports) {
        if (compareNearly(angleBetween(wall.centreline, support.centreline), PARALLEL_ANGLE_DEG) > 0) {
          continue;
        }

        const bodiesMm = (wall.thicknessMm + support.thicknessMm) / 2;

        if (compareNearly(distanceBetweenLines(wall.centreline, support.centreline), bodiesMm) > 0) {
          continue;
        }

        const span = spanOn(wall.centreline, support.centreline);
        const low = Math.max(0, span.low);
        const high = Math.min(wallLengthMm, span.high);

        if (compareNearly(high, low) <= 0) {
          continue;
        }

        covered.push({ low, high });

        if (high - low > bestSupportMm) {
          bestSupportMm = high - low;
          bestSupportWallId = support.id;
        }
      }

      const supportedMm = mergeIntervals(covered).reduce(
        (total, interval) => total + (interval.high - interval.low),
        0,
      );
      const supportedShare = supportedMm / wallLengthMm;

      if (compareNearly(supportedShare, MIN_SUPPORT_SHARE) >= 0) {
        continue;
      }

      findings.push(
        finding(
          wallUnsupportedText({
            wallId: wall.id,
            levelName: level.name,
            levelBelowName: levelBelow.name,
            wallLengthMm,
            supportedShare,
            bestSupportWallId,
            requiredShare: MIN_SUPPORT_SHARE,
          }),
          wall.id,
          bestSupportWallId === null ? [wall.id, level.id] : [wall.id, bestSupportWallId, level.id],
        ),
      );
    }
  }

  return findings;
};

/* -------------------------------------------------------------------------- */
/* 7 — STAIR-ALIGNMENT.                                                        */
/* -------------------------------------------------------------------------- */

/** Stairs on one level, in model order. */
function stairsOf(items: readonly Furniture[]): Furniture[] {
  return items.filter((item) => item.kind === 'stair');
}

/**
 * A stair that misses the one below it.
 *
 * A stair is not a piece of furniture that happens to repeat on each floor: it
 * is one shaft cut through the building, and the flights have to stand over each
 * other or the hole in the slab is in the wrong place. Each stair above the
 * bottom storey is matched to the nearest stair on the storey below, and the
 * distance between the two centres is what the rule judges.
 *
 * A storey below with no stair at all is left alone. That is a missing stair,
 * not a misaligned one, and reporting it here would put the wrong sentence — and
 * the wrong fix — in front of the person reading the list.
 */
export const checkStairAlignment: GeometryCheck = (context) => {
  const levels = stackedLevels(context);
  const furnitureByLevel = groupByLevel(entitiesInScope(context, 'furniture'));
  const findings: GeometryFinding[] = [];

  for (let index = 1; index < levels.length; index += 1) {
    const level = itemAt(levels, index);
    const levelBelow = itemAt(levels, index - 1);
    const stairsBelow = stairsOf(furnitureByLevel.get(levelBelow.id) ?? []);

    if (stairsBelow.length === 0) {
      continue;
    }

    for (const stair of stairsOf(furnitureByLevel.get(level.id) ?? [])) {
      let nearest = itemAt(stairsBelow, 0);
      let offsetMm = Math.hypot(stair.centre.x - nearest.centre.x, stair.centre.y - nearest.centre.y);

      for (const candidate of stairsBelow) {
        const distanceMm = Math.hypot(
          stair.centre.x - candidate.centre.x,
          stair.centre.y - candidate.centre.y,
        );

        if (distanceMm < offsetMm) {
          offsetMm = distanceMm;
          nearest = candidate;
        }
      }

      if (compareNearly(offsetMm, STAIR_ALIGNMENT_TOLERANCE_MM) <= 0) {
        continue;
      }

      findings.push(
        finding(
          stairAlignmentText({
            stairId: stair.id,
            stairBelowId: nearest.id,
            levelName: level.name,
            levelBelowName: levelBelow.name,
            offsetMm,
            toleranceMm: STAIR_ALIGNMENT_TOLERANCE_MM,
            at: stair.centre,
            belowAt: nearest.centre,
          }),
          stair.id,
          [stair.id, nearest.id, level.id],
        ),
      );
    }
  }

  return findings;
};

/* -------------------------------------------------------------------------- */
/* The rules.                                                                  */
/* -------------------------------------------------------------------------- */

/** `dependsOn` lists exactly the entity kinds each check reads — no more. */
export const wallOverlapRule: Rule = {
  code: 'WALL-OVERLAP',
  name: 'không có hai tường chồng lên nhau',
  group: 'geometry',
  severity: 'critical',
  scope: 'level',
  dependsOn: ['wall'],
  check: checkWallOverlap,
};

export const danglingWallEndRule: Rule = {
  code: 'WALL-DANGLING-END',
  name: 'đầu tường nào cũng nối vào tường khác',
  group: 'geometry',
  severity: 'critical',
  scope: 'level',
  dependsOn: ['wall'],
  check: checkDanglingWallEnds,
};

export const roomClosureRule: Rule = {
  code: 'ROOM-NOT-CLOSED',
  name: 'đường bao phòng kín bằng tường',
  group: 'geometry',
  severity: 'critical',
  scope: 'level',
  dependsOn: ['room', 'wall'],
  check: checkRoomClosure,
};

export const doorSwingRule: Rule = {
  code: 'DOOR-SWING-BLOCKED',
  name: 'cửa đi có chỗ để mở cánh',
  group: 'circulation',
  severity: 'critical',
  scope: 'level',
  dependsOn: ['opening', 'wall'],
  check: checkDoorSwing,
};

export const openingOverlapRule: Rule = {
  code: 'OPENING-OVERLAP',
  name: 'không có hai lỗ mở chồng nhau trên một tường',
  group: 'geometry',
  severity: 'critical',
  scope: 'level',
  dependsOn: ['opening'],
  check: checkOpeningOverlap,
};

export const loadBearingSupportRule: Rule = {
  code: 'WALL-UNSUPPORTED',
  name: 'tường chịu lực có điểm tựa ở tầng dưới',
  group: 'geometry',
  severity: 'critical',
  scope: 'building',
  dependsOn: ['wall', 'level'],
  check: checkLoadBearingSupport,
};

export const stairAlignmentRule: Rule = {
  code: 'STAIR-ALIGNMENT',
  name: 'cầu thang thẳng trục giữa các tầng',
  group: 'geometry',
  severity: 'critical',
  scope: 'building',
  dependsOn: ['furniture', 'level'],
  check: checkStairAlignment,
};

/**
 * The seven, in the order a QC list reads them.
 *
 * Walls first, because a wall that is wrong makes everything standing on it
 * wrong; then what is cut into them; then the two that only make sense with the
 * whole stack in view.
 */
export const GEOMETRY_RULES: readonly Rule[] = [
  wallOverlapRule,
  danglingWallEndRule,
  roomClosureRule,
  doorSwingRule,
  openingOverlapRule,
  loadBearingSupportRule,
  stairAlignmentRule,
];

/**
 * Put the seven in a rule book.
 *
 * Registering the same rules twice is a no-op rather than an error, because a
 * module reloaded by the dev server should not take the QC screen down with it;
 * a **different** rule claiming one of these codes still throws, which is the
 * clash worth hearing about.
 *
 * The registry is a required argument on purpose. It used to default to the
 * shared one, which made this function look like the way the application got
 * these rules — and it was not, because nothing called it. The shared book now
 * comes assembled from `rules/defaults`; this function is for a caller building
 * a narrower book deliberately.
 */
export function registerGeometryRules(registry: RuleRegistry): void {
  for (const rule of GEOMETRY_RULES) {
    if (registry.get(rule.code) === rule) {
      continue;
    }

    registry.register(rule);
  }
}
