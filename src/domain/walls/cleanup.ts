/**
 * Cleaning up traced walls, out loud.
 *
 * A model that reads a scanned plan produces walls that are almost right: a
 * 12 mm stub left where two strokes crossed, a corner that misses by 40 mm, a
 * run that leans 0,7° off horizontal, two segments of the same wall overlapping
 * by 20 mm. None of that is worth a person's attention one item at a time, and
 * all of it breaks the geometry downstream.
 *
 * Three rules shape this module.
 *
 * - **Nothing is silent.** Every single change writes an entry to the log, in
 *   Vietnamese, naming the walls and the measurement that triggered it, and
 *   carrying the walls as they were. A change with no entry would be a change
 *   nobody can review or undo, which is worse than the defect it fixed.
 * - **Running twice changes nothing more.** The four steps repeat until a pass
 *   has nothing left to say, so the answer is a fixed point:
 *   `cleanupWalls(cleanupWalls(x).walls)` returns the same walls and an empty
 *   log. Each step is guarded so it cannot undo the step before it — welding
 *   never leaves a stub, straightening never moves an end that is welded to
 *   something, merging never moves an endpoint at all.
 * - **Thickness is never touched.** `suggestStandardThickness` says what a wall
 *   could round to and stops there. A thickness is a measurement someone took;
 *   rounding it silently would make the drawing disagree with the survey.
 *
 * The steps run in the order the brief fixes them: remove slivers, weld gaps,
 * straighten near-axis runs, merge collinear overlaps.
 */

import { compareNearly, isNearlyZero, nearlyEqualPoint, type PointMm } from '../units/compare';
import { distanceBetween } from '../units/snap';
import {
  degrees,
  millimetres,
  normaliseDegrees,
  radians,
  radiansToDegrees,
  type Degrees,
  type Millimetres,
} from '../units/types';
import type { WallId } from '../spatial/types';
import { resolveJoints } from './joints';
import { mergeWalls, MIN_WALL_LENGTH_MM, overlapAlongLine } from './edit';
import {
  centrelineLength,
  endPoint,
  verticalRangesOverlap,
  WALL_ENDS,
  type Wall,
  type WallEnd,
} from './types';

/* -------------------------------------------------------------------------- */
/* Public types.                                                               */
/* -------------------------------------------------------------------------- */

/** Every threshold the cleanup depends on, in one place. */
export const CLEANUP_THRESHOLDS = {
  /** Runs shorter than this are drawing noise and are removed. */
  sliverLengthMm: MIN_WALL_LENGTH_MM,
  /** Ends closer than this are pulled onto one point. */
  weldGapMm: millimetres(100),
  /** Runs leaning less than this off an axis are straightened onto it. */
  straightenAngleDeg: degrees(1.5),
  /** Collinear runs overlapping less than this become one run. */
  mergeOverlapMm: millimetres(80),
} as const;

/** The standard wall thicknesses a project draws from. */
export const STANDARD_THICKNESSES_MM: readonly Millimetres[] = [100, 150, 200, 220, 300, 400].map(
  (value) => millimetres(value),
);

/** How far off a standard thickness a wall may be and still be worth rounding. */
export const THICKNESS_SUGGESTION_LIMIT_MM: Millimetres = millimetres(15);

/** Which of the four steps made a change. */
export type CleanupStep = 'removeSliver' | 'weldGap' | 'straighten' | 'mergeOverlap';

/** Log entry id, prefixed with `C-`. */
export type CleanupChangeId = `C-${string}`;

/**
 * One reviewable change.
 *
 * `before` and `after` hold the walls on both sides of the change, which is what
 * makes a single entry undoable without replaying the whole cleanup.
 */
export interface CleanupChange {
  readonly id: CleanupChangeId;
  readonly step: CleanupStep;
  /** Which repeat of the four steps produced this entry; the first is 1. */
  readonly pass: number;
  /** Vietnamese sentence naming the walls and the measurement involved. */
  readonly message: string;
  readonly wallIds: readonly WallId[];
  readonly before: readonly Wall[];
  readonly after: readonly Wall[];
  /** Where the walls sat in the list, so undoing a removal restores the order. */
  readonly position: number;
}

/** A thickness that could be rounded, offered to the user and never applied. */
export interface ThicknessSuggestion {
  readonly wallId: WallId;
  readonly currentMm: Millimetres;
  readonly suggestedMm: Millimetres;
  /** How far the wall is from the standard value, always positive. */
  readonly differenceMm: Millimetres;
  /** Vietnamese sentence, phrased as an offer rather than a report. */
  readonly message: string;
}

/** What the cleanup did, and what it only suggests. */
export interface CleanupResult {
  readonly walls: readonly Wall[];
  readonly log: readonly CleanupChange[];
  /** Never applied to `walls`; the user decides. */
  readonly thicknessSuggestions: readonly ThicknessSuggestion[];
}

export interface CleanupOptions {
  readonly sliverLengthMm?: Millimetres;
  readonly weldGapMm?: Millimetres;
  readonly straightenAngleDeg?: Degrees;
  readonly mergeOverlapMm?: Millimetres;
}

/* -------------------------------------------------------------------------- */
/* Internals.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Repeats of the four steps before the cleanup gives up.
 *
 * Every logged change strictly shrinks the plan — a wall disappears, two end
 * positions become one, or a run stops being off-axis — so the loop always
 * settles, in practice within two passes. The cap only exists so a defect here
 * cannot spin the app.
 */
const MAX_PASSES = 16;

/** The four axis directions, in the order bearings are rounded onto them. */
const AXIS_DIRECTIONS: readonly { readonly x: number; readonly y: number }[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];

const QUARTER_TURN_DEG = 90;

/** A change before it is given an id and a pass number. */
interface PendingChange {
  readonly step: CleanupStep;
  readonly message: string;
  readonly wallIds: readonly WallId[];
  readonly before: readonly Wall[];
  readonly after: readonly Wall[];
  readonly position: number;
}

interface StepOutcome {
  readonly walls: readonly Wall[];
  readonly changes: readonly PendingChange[];
}

interface EndPosition {
  readonly wall: Wall;
  readonly end: WallEnd;
  readonly point: PointMm;
}

function atIndex<TItem>(items: readonly TItem[], index: number): TItem {
  const item = items[index];
  if (item === undefined) {
    throw new RangeError(`Index ${String(index)} falls outside a list of ${String(items.length)} items.`);
  }
  return item;
}

function otherEnd(end: WallEnd): WallEnd {
  return end === 'start' ? 'end' : 'start';
}

function endKey(wallId: WallId, end: WallEnd): string {
  return `${wallId}.${end}`;
}

function collectEnds(walls: readonly Wall[]): readonly EndPosition[] {
  return walls.flatMap((wall) => WALL_ENDS.map((end) => ({ wall, end, point: endPoint(wall, end) })));
}

/** A length with the Vietnamese decimal comma; whole values keep no decimal. */
function formatLength(valueMm: Millimetres): string {
  const rounded = Math.round(valueMm * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',');
  return `${text} mm`;
}

/** An angle with the Vietnamese decimal comma, always positive. */
function formatAngle(valueDeg: Degrees): string {
  return `${Math.abs(valueDeg).toFixed(1).replace('.', ',')}°`;
}

function formatWallList(wallIds: readonly WallId[]): string {
  return [...wallIds].sort().join(', ');
}

/**
 * Every wall end that shares a place with another wall's end.
 *
 * Read straight off `resolveJoints`, so "shares a place" means exactly what it
 * means everywhere else in the module: within the threshold, and on walls that
 * occupy some common height.
 */
function clusteredEndKeys(walls: readonly Wall[], gapMm: Millimetres): ReadonlySet<string> {
  const { joints, unresolved } = resolveJoints(walls, gapMm);
  const keys = new Set<string>();

  for (const members of [
    ...joints.map((joint) => joint.members),
    ...unresolved.map((cluster) => cluster.members),
  ]) {
    for (const member of members) {
      keys.add(endKey(member.wallId, member.end));
    }
  }

  return keys;
}

/* -------------------------------------------------------------------------- */
/* Step 1 — remove slivers.                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Drop runs too short to be a wall.
 *
 * This goes first because everything after it assumes a wall has a direction:
 * a run of a few millimetres has one only in the arithmetic sense.
 */
function removeSlivers(walls: readonly Wall[], limitMm: Millimetres): StepOutcome {
  const kept: Wall[] = [];
  const changes: PendingChange[] = [];

  walls.forEach((wall, index) => {
    const lengthMm = centrelineLength(wall);

    if (compareNearly(lengthMm, limitMm) < 0) {
      changes.push({
        step: 'removeSliver',
        message: `Đã xoá tường ${wall.id} chỉ dài ${formatLength(lengthMm)}, ngắn hơn ${formatLength(limitMm)}.`,
        wallIds: [wall.id],
        before: [wall],
        after: [],
        position: index,
      });
    } else {
      kept.push(wall);
    }
  });

  return { walls: kept, changes };
}

/* -------------------------------------------------------------------------- */
/* Step 2 — weld gaps.                                                          */
/* -------------------------------------------------------------------------- */

/** One group of ends that should become a single point. */
interface WeldTarget {
  readonly position: PointMm;
  readonly members: readonly { readonly wallId: WallId; readonly end: WallEnd }[];
}

function withMovedEnd(wall: Wall, end: WallEnd, point: PointMm): Wall {
  return {
    ...wall,
    centreline:
      end === 'start'
        ? { start: point, end: wall.centreline.end }
        : { start: wall.centreline.start, end: point },
  };
}

/**
 * Pull ends that nearly meet onto one point.
 *
 * A group is welded only when every wall in it survives the move: pulling an end
 * across a short wall would leave a stub that step 1 has already ruled out, and
 * the cleanup would then disagree with itself. Groups holding both ends of one
 * wall are left alone for the same reason — welding them would collapse the wall
 * to nothing.
 */
function weldGaps(walls: readonly Wall[], gapMm: Millimetres, sliverMm: Millimetres): StepOutcome {
  const { joints, unresolved } = resolveJoints(walls, gapMm);
  const targets: WeldTarget[] = [
    ...joints.map((joint) => ({ position: joint.position, members: joint.members })),
    ...unresolved
      .filter((cluster) => cluster.reason === 'tooManyEnds')
      .map((cluster) => ({ position: cluster.position, members: cluster.members })),
  ];

  let current: readonly Wall[] = walls;
  const changes: PendingChange[] = [];

  for (const target of targets) {
    const indexed = target.members.map((member) => ({
      member,
      index: current.findIndex((wall) => wall.id === member.wallId),
    }));

    if (indexed.some((entry) => entry.index < 0)) {
      continue;
    }

    const moves = indexed
      .map((entry) => ({ ...entry, wall: atIndex(current, entry.index) }))
      .filter((entry) => !nearlyEqualPoint(endPoint(entry.wall, entry.member.end), target.position));

    if (moves.length === 0) {
      continue;
    }

    const wouldLeaveStub = moves.some(
      (entry) =>
        compareNearly(
          distanceBetween(target.position, endPoint(entry.wall, otherEnd(entry.member.end))),
          sliverMm,
        ) < 0,
    );

    if (wouldLeaveStub) {
      continue;
    }

    const before = moves.map((entry) => entry.wall);
    const after = moves.map((entry) => withMovedEnd(entry.wall, entry.member.end, target.position));
    const shifted = [...current];
    moves.forEach((entry, order) => {
      shifted[entry.index] = atIndex(after, order);
    });

    // The gap a person sees on the drawing is between the ends themselves, not
    // between an end and the point they are all about to move to.
    const memberPoints = indexed.map((entry) =>
      endPoint(atIndex(current, entry.index), entry.member.end),
    );
    const widestGapMm = millimetres(
      Math.max(
        ...memberPoints.flatMap((one) => memberPoints.map((other) => distanceBetween(one, other))),
      ),
    );

    changes.push({
      step: 'weldGap',
      message:
        `Đã hàn ${String(target.members.length)} đầu tường lệch nhau tới ` +
        `${formatLength(widestGapMm)} về một điểm chung: ` +
        `${formatWallList(target.members.map((member) => member.wallId))}.`,
      wallIds: before.map((wall) => wall.id),
      before,
      after,
      position: Math.min(...moves.map((entry) => entry.index)),
    });

    current = shifted;
  }

  return { walls: current, changes };
}

/* -------------------------------------------------------------------------- */
/* Step 3 — straighten near-axis runs.                                          */
/* -------------------------------------------------------------------------- */

/** How far a bearing leans off the nearest axis, within `[-45, 45]`. */
function leanOffAxis(bearingDeg: Degrees): { readonly quarter: number; readonly leanDeg: Degrees } {
  const quarter = Math.round(bearingDeg / QUARTER_TURN_DEG);
  return { quarter, leanDeg: degrees(bearingDeg - quarter * QUARTER_TURN_DEG) };
}

function bearingBetween(from: PointMm, to: PointMm): Degrees {
  return normaliseDegrees(radiansToDegrees(radians(Math.atan2(to.y - from.y, to.x - from.x))));
}

/**
 * Would moving an end to this point create a join that was not there before?
 *
 * Straightening must not hand work back to the welding step, or the two would
 * take turns undoing each other and the cleanup would never settle.
 */
function wouldMeetAnotherWall(
  point: PointMm,
  wall: Wall,
  walls: readonly Wall[],
  gapMm: Millimetres,
): boolean {
  return collectEnds(walls).some(
    (candidate) =>
      candidate.wall.id !== wall.id &&
      verticalRangesOverlap(candidate.wall, wall) &&
      compareNearly(distanceBetween(point, candidate.point), gapMm) < 0,
  );
}

/**
 * Turn runs that lean slightly onto the axis they were meant to follow.
 *
 * Only an end that is free to move is moved: the wall turns about the end that
 * is welded to something, so no join is broken. A wall welded at both ends is
 * left leaning, because straightening it would drag another wall with it.
 */
function straightenWalls(
  walls: readonly Wall[],
  limitDeg: Degrees,
  gapMm: Millimetres,
): StepOutcome {
  const clustered = clusteredEndKeys(walls, gapMm);
  const current = [...walls];
  const changes: PendingChange[] = [];

  for (let index = 0; index < current.length; index += 1) {
    const wall = atIndex(current, index);
    const endIsFree = !clustered.has(endKey(wall.id, 'end'));
    const startIsFree = !clustered.has(endKey(wall.id, 'start'));

    if (!endIsFree && !startIsFree) {
      continue;
    }

    const anchorEnd: WallEnd = endIsFree ? 'start' : 'end';
    const movingEnd = otherEnd(anchorEnd);
    const anchor = endPoint(wall, anchorEnd);
    const moving = endPoint(wall, movingEnd);
    const { quarter, leanDeg } = leanOffAxis(bearingBetween(anchor, moving));

    if (isNearlyZero(leanDeg) || compareNearly(Math.abs(leanDeg), limitDeg) >= 0) {
      continue;
    }

    const axis = atIndex(AXIS_DIRECTIONS, ((quarter % 4) + 4) % 4);
    const lengthMm = centrelineLength(wall);
    const target: PointMm = {
      x: millimetres(anchor.x + axis.x * lengthMm),
      y: millimetres(anchor.y + axis.y * lengthMm),
    };

    if (wouldMeetAnotherWall(target, wall, current, gapMm)) {
      continue;
    }

    const straightened = withMovedEnd(wall, movingEnd, target);
    current[index] = straightened;

    changes.push({
      step: 'straighten',
      message:
        `Đã nắn tường ${wall.id} đang lệch ${formatAngle(leanDeg)} về đúng phương ` +
        `${axis.y === 0 ? 'ngang' : 'dọc'}.`,
      wallIds: [wall.id],
      before: [wall],
      after: [straightened],
      position: index,
    });
  }

  return { walls: current, changes };
}

/* -------------------------------------------------------------------------- */
/* Step 4 — merge collinear overlaps.                                           */
/* -------------------------------------------------------------------------- */

/** Do these two runs meet at a point they both hold exactly? */
function shareAnEnd(first: Wall, second: Wall): boolean {
  return WALL_ENDS.some((end) =>
    WALL_ENDS.some((otherSide) =>
      nearlyEqualPoint(endPoint(first, end), endPoint(second, otherSide)),
    ),
  );
}

/**
 * Does a third wall end on the stretch these two would give up?
 *
 * Two collinear runs meeting a branch are a `T` node, and the branch only stays
 * trimmed while the run is two walls. Only the ends that the merge swallows are
 * checked — the outer ends survive it untouched, so whatever they are welded to
 * is none of the merge's business.
 */
function branchSitsBetween(
  first: Wall,
  second: Wall,
  merged: Wall,
  walls: readonly Wall[],
  gapMm: Millimetres,
): boolean {
  const pairIds = new Set<WallId>([first.id, second.id]);
  const swallowed = new Set(
    [first, second].flatMap((wall) =>
      WALL_ENDS.filter(
        (end) =>
          !nearlyEqualPoint(endPoint(wall, end), merged.centreline.start) &&
          !nearlyEqualPoint(endPoint(wall, end), merged.centreline.end),
      ).map((end) => endKey(wall.id, end)),
    ),
  );

  const { joints, unresolved } = resolveJoints(walls, gapMm);

  return [...joints.map((joint) => joint.members), ...unresolved.map((cluster) => cluster.members)]
    .filter((members) => members.some((member) => swallowed.has(endKey(member.wallId, member.end))))
    .some((members) => members.some((member) => !pairIds.has(member.wallId)));
}

/**
 * Fold collinear runs that overlap slightly into one run.
 *
 * The overlap is measured after welding, which is why runs that merely touch
 * count too: a pair overlapping by 20 mm has its inner ends 20 mm apart, so step
 * two has already pulled them onto one point by the time this step looks. A wide
 * overlap is left alone — that is two different walls, and a person should say
 * which one is real. Where a branch ends between the two runs, the pair stays
 * split, because the branch needs the node to stay trimmed.
 */
function mergeOverlaps(
  walls: readonly Wall[],
  overlapLimitMm: Millimetres,
  gapMm: Millimetres,
): StepOutcome {
  let current = [...walls];
  const changes: PendingChange[] = [];
  let merged = true;

  while (merged) {
    merged = false;

    for (let index = 0; index < current.length && !merged; index += 1) {
      for (let other = index + 1; other < current.length && !merged; other += 1) {
        const first = atIndex(current, index);
        const second = atIndex(current, other);
        const overlapMm = overlapAlongLine(first, second);

        // Ending at the same projection is not the same as ending at the same
        // place: two runs a hand's width apart sideways meet nowhere, and folding
        // them together would flatten a real step in the wall.
        if (!shareAnEnd(first, second) && compareNearly(overlapMm, 0) <= 0) {
          continue;
        }
        if (compareNearly(overlapMm, overlapLimitMm) >= 0) {
          continue;
        }

        const outcome = mergeWalls(first, second);
        if (!outcome.ok) {
          continue;
        }
        if (branchSitsBetween(first, second, outcome.wall, current, gapMm)) {
          continue;
        }

        const keptIndex = outcome.wall.id === first.id ? index : other;
        const droppedIndex = outcome.wall.id === first.id ? other : index;

        changes.push({
          step: 'mergeOverlap',
          message:
            `Đã gộp tường ${outcome.removedId} vào ${outcome.wall.id} vì thẳng hàng và ` +
            (isNearlyZero(overlapMm)
              ? 'nối tiếp nhau tại một điểm.'
              : `chồng nhau ${formatLength(overlapMm)}.`),
          wallIds: [first.id, second.id],
          before: [first, second],
          after: [outcome.wall],
          position: Math.min(index, other),
        });

        current = current
          .map((wall, position) => (position === keptIndex ? outcome.wall : wall))
          .filter((_, position) => position !== droppedIndex);
        merged = true;
      }
    }
  }

  return { walls: current, changes };
}

/* -------------------------------------------------------------------------- */
/* Public functions.                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The standard thickness a measurement is closest to, or `null` when it is
 * already standard or too far from any of them to be a rounding error.
 */
export function nearestStandardThickness(
  thicknessMm: Millimetres,
  limitMm: Millimetres = THICKNESS_SUGGESTION_LIMIT_MM,
): Millimetres | null {
  const ranked = STANDARD_THICKNESSES_MM.map((standard) => ({
    standard,
    gapMm: Math.abs(standard - thicknessMm),
  })).reduce((nearest, candidate) => {
    if (compareNearly(candidate.gapMm, nearest.gapMm) !== 0) {
      return candidate.gapMm < nearest.gapMm ? candidate : nearest;
    }
    return candidate.standard < nearest.standard ? candidate : nearest;
  });

  if (isNearlyZero(ranked.gapMm) || compareNearly(ranked.gapMm, limitMm) >= 0) {
    return null;
  }

  return ranked.standard;
}

/**
 * Offer to round wall thicknesses onto the standard set.
 *
 * This only ever returns sentences. Nothing here writes to a wall, and
 * `cleanupWalls` keeps the suggestions well away from the walls it returns: a
 * thickness is a measured value, and rounding one is the user's call, made one
 * wall at a time.
 */
export function suggestStandardThickness(
  walls: readonly Wall[],
  limitMm: Millimetres = THICKNESS_SUGGESTION_LIMIT_MM,
): readonly ThicknessSuggestion[] {
  const suggestions: ThicknessSuggestion[] = [];

  for (const wall of walls) {
    const suggestedMm = nearestStandardThickness(wall.thicknessMm, limitMm);

    if (suggestedMm === null) {
      continue;
    }

    const differenceMm = millimetres(Math.abs(suggestedMm - wall.thicknessMm));
    suggestions.push({
      wallId: wall.id,
      currentMm: wall.thicknessMm,
      suggestedMm,
      differenceMm,
      message:
        `Có thể đưa độ dày tường ${wall.id} từ ${formatLength(wall.thicknessMm)} về chuẩn ` +
        `${formatLength(suggestedMm)}, lệch ${formatLength(differenceMm)}.`,
    });
  }

  return suggestions;
}

/**
 * Run the four cleanup steps until the plan stops changing.
 *
 * Order matters and is fixed: slivers go first so every later step works on runs
 * that have a direction; welding comes before straightening so straightening
 * knows which ends it may move; merging comes last so it sees runs that are
 * already welded and straight.
 *
 * The walls that come back are a fixed point — running the cleanup on them again
 * returns them unchanged with an empty log — and the input is never written to.
 *
 * @throws RangeError when a wall that survives the first step is unusable, for
 * example a thickness outside 60–600 mm. Nothing is repaired to get around it.
 * @throws Error when two walls share an id, or when the passes fail to settle.
 */
export function cleanupWalls(walls: readonly Wall[], options: CleanupOptions = {}): CleanupResult {
  const sliverLengthMm = options.sliverLengthMm ?? CLEANUP_THRESHOLDS.sliverLengthMm;
  const weldGapMm = options.weldGapMm ?? CLEANUP_THRESHOLDS.weldGapMm;
  const straightenAngleDeg = options.straightenAngleDeg ?? CLEANUP_THRESHOLDS.straightenAngleDeg;
  const mergeOverlapMm = options.mergeOverlapMm ?? CLEANUP_THRESHOLDS.mergeOverlapMm;

  let current: readonly Wall[] = walls;
  const log: CleanupChange[] = [];

  for (let pass = 1; pass <= MAX_PASSES; pass += 1) {
    // Each step reads the walls the step before it produced, so the order the
    // brief fixes is the order the data actually flows through.
    const slivers = removeSlivers(current, sliverLengthMm);
    current = slivers.walls;

    const welded = weldGaps(current, weldGapMm, sliverLengthMm);
    current = welded.walls;

    const straightened = straightenWalls(current, straightenAngleDeg, weldGapMm);
    current = straightened.walls;

    const mergedRuns = mergeOverlaps(current, mergeOverlapMm, weldGapMm);
    current = mergedRuns.walls;

    const passChanges = [
      ...slivers.changes,
      ...welded.changes,
      ...straightened.changes,
      ...mergedRuns.changes,
    ];

    if (passChanges.length === 0) {
      return {
        walls: current,
        log,
        thicknessSuggestions: suggestStandardThickness(current),
      };
    }

    for (const change of passChanges) {
      log.push({ ...change, id: `C-${String(log.length + 1)}`, pass });
    }
  }

  throw new Error(
    `Wall cleanup did not settle after ${String(MAX_PASSES)} passes; the plan needs a person.`,
  );
}

/** Are these the same wall, down to the geometry? */
function isSameWall(first: Wall, second: Wall): boolean {
  return (
    first.id === second.id &&
    first.kind === second.kind &&
    nearlyEqualPoint(first.centreline.start, second.centreline.start) &&
    nearlyEqualPoint(first.centreline.end, second.centreline.end) &&
    compareNearly(first.thicknessMm, second.thicknessMm) === 0 &&
    compareNearly(first.baseElevationMm, second.baseElevationMm) === 0 &&
    compareNearly(first.topElevationMm, second.topElevationMm) === 0
  );
}

/**
 * Can this entry still be undone?
 *
 * Only while the walls it produced are still there, untouched. A later entry may
 * have changed one of them, and putting the old walls back over the top of that
 * would silently drop the later change.
 */
export function canUndoCleanupChange(walls: readonly Wall[], change: CleanupChange): boolean {
  return change.after.every((produced) =>
    walls.some((candidate) => isSameWall(candidate, produced)),
  );
}

/**
 * Put one entry back the way it was.
 *
 * Returns `null` when the entry can no longer be undone on its own, so a caller
 * can grey the button out rather than guess. Undoing the whole log means walking
 * it backwards, newest first.
 */
export function undoCleanupChange(
  walls: readonly Wall[],
  change: CleanupChange,
): readonly Wall[] | null {
  if (!canUndoCleanupChange(walls, change)) {
    return null;
  }

  const producedIds = new Set(change.after.map((wall) => wall.id));
  const firstProduced = walls.findIndex((wall) => producedIds.has(wall.id));
  const remaining = walls.filter((wall) => !producedIds.has(wall.id));
  const insertAt =
    firstProduced >= 0 ? firstProduced : Math.min(change.position, remaining.length);

  return [...remaining.slice(0, insertAt), ...change.before, ...remaining.slice(insertAt)];
}
