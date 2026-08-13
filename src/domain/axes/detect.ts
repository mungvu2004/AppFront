/**
 * Finding the setting-out grid that a set of walls was built on.
 *
 * A technical drawing is not a picture of a building, it is a set of
 * instructions for locating one, and the axes are what make locating possible:
 * a column is not at "x = 14 350", it is on `B-3`. The same grid is what lets
 * two levels be stacked, because floor plans drift against each other by a few
 * millimetres while `B-3` on the second floor is the same `B-3` as below.
 *
 * The grid is almost never drawn on a traced plan, but it is implied by the
 * walls, which is what this module recovers. Two things keep the recovery
 * honest:
 *
 * - **Two walls or no axis.** A single wall on a line is a wall. It is only
 *   when a second one lines up with it that a setting-out intent exists at all,
 *   so `MIN_WALLS_PER_AXIS` is a hard floor and not a tunable. Inventing an axis
 *   per wall would bury the real grid in noise and make the labels meaningless.
 * - **A cluster is never wider than the tolerance.** Walls are grouped against
 *   the first member of their group rather than against their neighbour, so a
 *   long row of walls each 90 mm from the last cannot chain into one axis a
 *   metre wide. `spreadMm` reports what the group actually cost.
 *
 * Walls that lean more than the tolerance across their own run belong to no
 * axis and are dropped rather than straightened; `walls/cleanup.ts` is where a
 * leaning wall gets fixed, and doing it here would hide the problem behind a
 * grid that looks tidy.
 *
 * Every function is pure: the same walls always give the same axes, in the same
 * order, down to the order of the wall ids inside each one.
 */

import type { AxisDirection, WallId } from '../spatial/types';
import { compareNearly, type PointMm } from '../units/compare';
import { millimetres, type Millimetres } from '../units/types';
import type { Wall } from '../walls/types';

export type { PointMm } from '../units/compare';

/**
 * How far apart two wall centrelines may sit and still be one axis.
 *
 * A hundred millimetres is roughly one wall thickness: two walls whose
 * centrelines are that close were set out from the same line, and the gap is
 * the tracer, the render or a change of wall type rather than a second axis.
 */
export const AXIS_ALIGNMENT_THRESHOLD_MM: Millimetres = millimetres(100);

/** Fewest aligned walls that may become an axis. Not a tunable. */
export const MIN_WALLS_PER_AXIS = 2;

/**
 * A candidate axis recovered from the walls, with no label yet.
 *
 * `coordinateMm` is the coordinate the axis is fixed at: `x` for a vertical
 * axis, `y` for a horizontal one. `startMm` and `endMm` measure along the axis
 * instead, covering only the part its walls actually occupy, so an axis is
 * drawn as long as the evidence for it and no longer.
 */
export interface DetectedAxis {
  readonly direction: AxisDirection;
  /** Where the axis sits: `x` when vertical, `y` when horizontal. */
  readonly coordinateMm: Millimetres;
  /** Lower end of the span its walls cover, measured along the axis. */
  readonly startMm: Millimetres;
  /** Upper end of that span. */
  readonly endMm: Millimetres;
  /** How far the member walls disagree; never more than the tolerance. */
  readonly spreadMm: Millimetres;
  /** Members, ordered by coordinate and then by id. Never fewer than two. */
  readonly wallIds: readonly WallId[];
}

/** The axis drawn as a segment on the plan. */
export interface AxisLine {
  readonly start: PointMm;
  readonly end: PointMm;
}

/* -------------------------------------------------------------------------- */
/* Internals.                                                                  */
/* -------------------------------------------------------------------------- */

/** One wall reduced to the axis it could sit on. */
interface AxisRun {
  readonly direction: AxisDirection;
  /** Mean of the two centreline ends across the axis. */
  readonly coordinateMm: number;
  /** Extent along the axis. */
  readonly startMm: number;
  readonly endMm: number;
  readonly wallId: WallId;
}

/**
 * Which axis, if any, one wall votes for.
 *
 * The longer span decides the direction and the shorter one has to be within
 * the tolerance, so a wall that runs 4 m up the sheet while wandering 30 mm
 * sideways votes for a vertical axis, and the same wall wandering 300 mm votes
 * for nothing. A run at 45°, and a wall of no length at all, leave the two spans
 * equal and belong to neither direction.
 */
function axisRunOf(wall: Wall, thresholdMm: Millimetres): AxisRun | null {
  const { start, end } = wall.centreline;
  const spanX = Math.abs(end.x - start.x);
  const spanY = Math.abs(end.y - start.y);
  const shape = compareNearly(spanX, spanY);

  if (shape === 0) {
    return null;
  }

  if (shape < 0) {
    if (compareNearly(spanX, thresholdMm) > 0) {
      return null;
    }
    return {
      direction: 'vertical',
      coordinateMm: (start.x + end.x) / 2,
      startMm: Math.min(start.y, end.y),
      endMm: Math.max(start.y, end.y),
      wallId: wall.id,
    };
  }

  if (compareNearly(spanY, thresholdMm) > 0) {
    return null;
  }
  return {
    direction: 'horizontal',
    coordinateMm: (start.y + end.y) / 2,
    startMm: Math.min(start.x, end.x),
    endMm: Math.max(start.x, end.x),
    wallId: wall.id,
  };
}

/**
 * Order runs the way the grouping walks them.
 *
 * The id breaks a tie so that two walls on exactly the same line always land in
 * the same order, whatever order the caller listed them in.
 */
function byCoordinateThenId(first: AxisRun, second: AxisRun): number {
  const byCoordinate = compareNearly(first.coordinateMm, second.coordinateMm);
  if (byCoordinate !== 0) {
    return byCoordinate;
  }
  if (first.wallId === second.wallId) {
    return 0;
  }
  return first.wallId < second.wallId ? -1 : 1;
}

/**
 * Group runs into clusters no wider than the tolerance.
 *
 * Each run is measured against the **first** member of the open cluster, not
 * the previous one. Chaining off the neighbour would let a hundred walls, each
 * one tolerance apart, collapse into a single axis spanning ten metres.
 */
function clusterRuns(runs: readonly AxisRun[], thresholdMm: Millimetres): AxisRun[][] {
  const sorted = [...runs].sort(byCoordinateThenId);
  const clusters: AxisRun[][] = [];

  for (const run of sorted) {
    const current = clusters[clusters.length - 1];
    const first = current?.[0];
    if (
      current !== undefined &&
      first !== undefined &&
      compareNearly(run.coordinateMm - first.coordinateMm, thresholdMm) <= 0
    ) {
      current.push(run);
    } else {
      clusters.push([run]);
    }
  }

  return clusters;
}

/** Turn one cluster into the axis it stands for. */
function toAxis(cluster: readonly AxisRun[], direction: AxisDirection): DetectedAxis {
  const coordinates = cluster.map((run) => run.coordinateMm);
  const total = coordinates.reduce((sum, coordinate) => sum + coordinate, 0);

  return {
    direction,
    coordinateMm: millimetres(total / cluster.length),
    startMm: millimetres(Math.min(...cluster.map((run) => run.startMm))),
    endMm: millimetres(Math.max(...cluster.map((run) => run.endMm))),
    spreadMm: millimetres(Math.max(...coordinates) - Math.min(...coordinates)),
    wallIds: cluster.map((run) => run.wallId),
  };
}

/* -------------------------------------------------------------------------- */
/* Public functions.                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Recover the setting-out axes from a set of walls.
 *
 * Walls are sorted into the two directions, grouped by the coordinate they are
 * fixed at, and every group holding at least `MIN_WALLS_PER_AXIS` walls becomes
 * an axis. Groups of one are discarded: a lone wall is not evidence of a grid.
 *
 * The result lists the vertical axes first by rising `x`, then the horizontal
 * ones by rising `y` — the order the labels are handed out in. A wall repeated
 * in the input is counted once, so a duplicated id can never conjure an axis on
 * its own.
 *
 * @throws RangeError when the tolerance is not a finite, non-negative length.
 */
export function detectAxes(
  walls: readonly Wall[],
  thresholdMm: Millimetres = AXIS_ALIGNMENT_THRESHOLD_MM,
): readonly DetectedAxis[] {
  if (!Number.isFinite(thresholdMm) || thresholdMm < 0) {
    throw new RangeError(`Axis tolerance must be a non-negative length: ${String(thresholdMm)}`);
  }

  const seen = new Set<WallId>();
  const runs: AxisRun[] = [];

  for (const wall of walls) {
    if (seen.has(wall.id)) {
      continue;
    }
    seen.add(wall.id);
    const run = axisRunOf(wall, thresholdMm);
    if (run !== null) {
      runs.push(run);
    }
  }

  const build = (direction: AxisDirection): DetectedAxis[] =>
    clusterRuns(
      runs.filter((run) => run.direction === direction),
      thresholdMm,
    )
      .filter((cluster) => cluster.length >= MIN_WALLS_PER_AXIS)
      .map((cluster) => toAxis(cluster, direction));

  return [...build('vertical'), ...build('horizontal')];
}

/** The vertical axes, by rising `x`. */
export function verticalAxes(axes: readonly DetectedAxis[]): readonly DetectedAxis[] {
  return axes.filter((axis) => axis.direction === 'vertical');
}

/** The horizontal axes, by rising `y`. */
export function horizontalAxes(axes: readonly DetectedAxis[]): readonly DetectedAxis[] {
  return axes.filter((axis) => axis.direction === 'horizontal');
}

/**
 * The axis as a segment, running from its lower end to its upper end.
 *
 * The segment covers the walls the axis was found from and is not extended to
 * the edge of the sheet; how far a grid line is drawn past its evidence is a
 * drawing decision, not a geometric one.
 */
export function axisLine(axis: DetectedAxis): AxisLine {
  if (axis.direction === 'vertical') {
    return {
      start: { x: axis.coordinateMm, y: axis.startMm },
      end: { x: axis.coordinateMm, y: axis.endMm },
    };
  }
  return {
    start: { x: axis.startMm, y: axis.coordinateMm },
    end: { x: axis.endMm, y: axis.coordinateMm },
  };
}
