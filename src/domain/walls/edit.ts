/**
 * Editing walls one or two at a time.
 *
 * Two operations sit under every wall edit a person can make: cutting one wall
 * in two, and welding two into one. Both are pure and both refuse rather than
 * improvise — the answer to "these two walls do not belong together" is a reason
 * the interface can show, not a best guess that quietly moves someone's plan.
 *
 * Merging is deliberately narrow. Two runs only become one when they are the
 * same kind, the same thickness, sit at the same height and point within two
 * degrees of each other; anything looser and a cleanup pass would start fusing a
 * partition into a load-bearing wall, or a 100 mm screen into a 300 mm one, and
 * the drawing would no longer describe the building.
 *
 * The merged centreline keeps the two outermost endpoints **exactly as they
 * were**. Nothing is re-projected, so an end welded to a node stays welded, and
 * a cleanup pass that merges cannot open a gap somewhere else.
 */

import { compareNearly, nearlyEqualLength, type PointMm } from '../units/compare';
import { distanceBetween, perpendicularFoot } from '../units/snap';
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
import { assertUsableWall, centrelineLength, type Wall } from './types';

/** Shortest run the model treats as a wall; below this it is drawing noise. */
export const MIN_WALL_LENGTH_MM: Millimetres = millimetres(30);

/** Widest angle between two runs that may still be merged. */
export const MAX_MERGE_ANGLE_DEG: Degrees = degrees(2);

/** Why a split was refused. */
export type SplitRefusal = 'pointOffWall' | 'pieceTooShort';

/** Outcome of cutting a wall in two. */
export type SplitWallResult =
  | { readonly ok: true; readonly walls: readonly [Wall, Wall] }
  | { readonly ok: false; readonly reason: SplitRefusal };

/** Why a merge was refused. */
export type MergeRefusal =
  | 'sameWall'
  | 'kindMismatch'
  | 'thicknessMismatch'
  | 'elevationMismatch'
  | 'angleTooWide'
  | 'tooFarApart';

/** Outcome of welding two walls into one. */
export type MergeWallsResult =
  | { readonly ok: true; readonly wall: Wall; readonly removedId: WallId }
  | { readonly ok: false; readonly reason: MergeRefusal };

export interface SplitWallOptions {
  /** Shortest piece the cut may leave on either side. */
  readonly minPieceLengthMm?: Millimetres;
}

export interface MergeWallsOptions {
  readonly maxAngleDeg?: Degrees;
  /**
   * How far the merged line may stray from the walls it replaces.
   *
   * Defaults to half the wall thickness, which is the distance at which the
   * merged section stops covering the junction it swallowed.
   */
  readonly maxStrayMm?: Millimetres;
}

/** A dimensionless direction; unit length by construction. */
interface Vector {
  readonly x: number;
  readonly y: number;
}

/** A line, as a point on it and the direction along it. */
interface Axis {
  readonly origin: PointMm;
  readonly direction: Vector;
}

function unitDirection(from: PointMm, to: PointMm): Vector {
  const runX = to.x - from.x;
  const runY = to.y - from.y;
  const length = Math.hypot(runX, runY);
  return { x: runX / length, y: runY / length };
}

function axisOf(wall: Wall): Axis {
  return {
    origin: wall.centreline.start,
    direction: unitDirection(wall.centreline.start, wall.centreline.end),
  };
}

/** How far along the axis a point sits; negative behind the origin. */
function projectOnAxis(axis: Axis, point: PointMm): number {
  return (point.x - axis.origin.x) * axis.direction.x + (point.y - axis.origin.y) * axis.direction.y;
}

/** How far off the axis a point sits, on either side. */
function offAxisDistance(axis: Axis, point: PointMm): Millimetres {
  const across =
    (point.x - axis.origin.x) * -axis.direction.y + (point.y - axis.origin.y) * axis.direction.x;
  return millimetres(Math.abs(across));
}

/** The direction a wall runs in, within `[0, 360)`. */
export function wallBearing(wall: Wall): Degrees {
  const direction = unitDirection(wall.centreline.start, wall.centreline.end);
  return normaliseDegrees(radiansToDegrees(radians(Math.atan2(direction.y, direction.x))));
}

/**
 * The angle between two wall lines, within `[0, 90]`.
 *
 * Direction of travel is ignored: a wall drawn right-to-left describes the same
 * line as one drawn left-to-right, and an AI tracer picks either.
 */
export function orientationDifference(first: Wall, second: Wall): Degrees {
  const gap = Math.abs(wallBearing(first) - wallBearing(second)) % 180;
  return degrees(gap > 90 ? 180 - gap : gap);
}

/**
 * Cut a wall in two at a point.
 *
 * The point is dropped onto the centreline first, so the two pieces share one
 * exact vertex and no crack is left between them. A point that misses the wall,
 * or a cut that would leave a stub shorter than `minPieceLengthMm`, is refused
 * with a reason instead of being nudged into place.
 *
 * The first piece keeps the original id; the second needs one, which the caller
 * supplies — minting an id here would make the function impure and its result
 * unrepeatable.
 *
 * @throws RangeError when the wall is unusable.
 */
export function splitWall(
  wall: Wall,
  at: PointMm,
  secondId: WallId,
  options: SplitWallOptions = {},
): SplitWallResult {
  assertUsableWall(wall);

  const minPieceLengthMm = options.minPieceLengthMm ?? MIN_WALL_LENGTH_MM;
  const cut = perpendicularFoot(at, wall.centreline);

  if (cut === null) {
    return { ok: false, reason: 'pointOffWall' };
  }

  if (
    compareNearly(distanceBetween(wall.centreline.start, cut), minPieceLengthMm) < 0 ||
    compareNearly(distanceBetween(cut, wall.centreline.end), minPieceLengthMm) < 0
  ) {
    return { ok: false, reason: 'pieceTooShort' };
  }

  return {
    ok: true,
    walls: [
      { ...wall, centreline: { start: wall.centreline.start, end: cut } },
      { ...wall, id: secondId, centreline: { start: cut, end: wall.centreline.end } },
    ],
  };
}

/** The wall the merged run is measured from: the longer one, then the lower id. */
function chooseAnchor(first: Wall, second: Wall): Wall {
  const byLength = compareNearly(centrelineLength(first), centrelineLength(second));
  if (byLength !== 0) {
    return byLength > 0 ? first : second;
  }
  return first.id <= second.id ? first : second;
}

/**
 * Weld two walls into one.
 *
 * Only walls that describe the same run are merged: same kind, same thickness,
 * same vertical band, and within `maxAngleDeg` of each other. Everything else
 * comes back as a refusal naming the rule that stopped it.
 *
 * The result runs between the two outermost endpoints, taken verbatim, and keeps
 * the id of the longer wall. Swapping the arguments gives the same answer.
 *
 * The last check is on the result rather than the inputs: the junction the merge
 * swallows has to stay inside the merged section, or the new wall would no
 * longer cover the corner the two old ones did. Two parallel runs a metre apart
 * fail it however well their directions agree.
 *
 * @throws RangeError when either wall is unusable.
 */
export function mergeWalls(
  first: Wall,
  second: Wall,
  options: MergeWallsOptions = {},
): MergeWallsResult {
  assertUsableWall(first);
  assertUsableWall(second);

  if (first.id === second.id) {
    return { ok: false, reason: 'sameWall' };
  }
  if (first.kind !== second.kind) {
    return { ok: false, reason: 'kindMismatch' };
  }
  if (!nearlyEqualLength(first.thicknessMm, second.thicknessMm)) {
    return { ok: false, reason: 'thicknessMismatch' };
  }
  if (
    !nearlyEqualLength(first.baseElevationMm, second.baseElevationMm) ||
    !nearlyEqualLength(first.topElevationMm, second.topElevationMm)
  ) {
    return { ok: false, reason: 'elevationMismatch' };
  }

  const maxAngleDeg = options.maxAngleDeg ?? MAX_MERGE_ANGLE_DEG;
  if (compareNearly(orientationDifference(first, second), maxAngleDeg) >= 0) {
    return { ok: false, reason: 'angleTooWide' };
  }

  const anchor = chooseAnchor(first, second);
  const other = anchor === first ? second : first;
  const axis = axisOf(anchor);

  const corners = [
    anchor.centreline.start,
    anchor.centreline.end,
    other.centreline.start,
    other.centreline.end,
  ];
  const ranked = corners.map((point) => ({ point, along: projectOnAxis(axis, point) }));
  const start = ranked.reduce((lowest, candidate) =>
    candidate.along < lowest.along ? candidate : lowest,
  );
  const end = ranked.reduce((highest, candidate) =>
    candidate.along > highest.along ? candidate : highest,
  );

  const mergedAxis: Axis = {
    origin: start.point,
    direction: unitDirection(start.point, end.point),
  };
  const strayMm = millimetres(
    Math.max(...corners.map((corner) => offAxisDistance(mergedAxis, corner))),
  );
  const maxStrayMm = options.maxStrayMm ?? millimetres(anchor.thicknessMm / 2);

  if (compareNearly(strayMm, maxStrayMm) > 0) {
    return { ok: false, reason: 'tooFarApart' };
  }

  return {
    ok: true,
    wall: { ...anchor, centreline: { start: start.point, end: end.point } },
    removedId: other.id,
  };
}

/** How far the two runs overlap along their shared line; negative when apart. */
export function overlapAlongLine(first: Wall, second: Wall): Millimetres {
  const axis = axisOf(chooseAnchor(first, second));
  const spanOf = (wall: Wall): { readonly low: number; readonly high: number } => {
    const one = projectOnAxis(axis, wall.centreline.start);
    const other = projectOnAxis(axis, wall.centreline.end);
    return { low: Math.min(one, other), high: Math.max(one, other) };
  };

  const firstSpan = spanOf(first);
  const secondSpan = spanOf(second);

  return millimetres(
    Math.min(firstSpan.high, secondSpan.high) - Math.max(firstSpan.low, secondSpan.low),
  );
}
