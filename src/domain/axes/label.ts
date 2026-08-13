/**
 * Naming the axes, and reading a position off them.
 *
 * The naming convention is not a style choice, it is what a site engineer reads
 * off a tape: vertical axes are numbered `1, 2, 3…` from the left, horizontal
 * axes are lettered `A, B, C…` from the bottom up, and a location is quoted as
 * a letter, a number and an offset — `B-3 lệch 250 mm`. Get the direction of
 * either sequence wrong and every dimension taken from the drawing is wrong.
 *
 * `I` and `O` are missing from the letters on purpose. Handwritten on site,
 * photographed, or printed small, an `I` is a `1` and an `O` is a `0`; the
 * whole industry drops both rather than argue about the typeface. The alphabet
 * here is therefore 24 letters, and after `Z` it carries on `AA, AB, AC…`, so
 * no grid can ever run out of names or grow one containing the two.
 *
 * Two rules govern where a name comes from:
 *
 * - **A user's label always wins.** Generated names are a convenience; the
 *   moment a person names an axis, that name is the axis's name, and it stays
 *   put even if the geometry around it shifts. The generator then steps over
 *   that name so no two axes can end up called the same thing.
 * - **The origin never changes the reference.** `setOrigin` pins the grid to a
 *   point so that plain coordinates can be quoted the way a survey quotes them,
 *   but which axis you are near and how far off it you are do not depend on
 *   where the origin is. Moving it re-reads the coordinates and leaves `B-3`
 *   as `B-3`, which is exactly what makes the grid usable for stacking levels.
 *
 * Every function is pure and every conversion is reversible: `fromAxisPosition`
 * undoes `toAxisPosition` exactly, in both directions of the plan.
 */

import type { AxisDirection } from '../spatial/types';
import { compareNearly, isNearlyZero, type PointMm } from '../units/compare';
import { millimetres, type Millimetres } from '../units/types';
import { AXIS_ALIGNMENT_THRESHOLD_MM, type DetectedAxis } from './detect';

export type { PointMm } from '../units/compare';

/**
 * The letters used for horizontal axes, without `I` and `O`.
 *
 * Twenty-four letters, in order, so `AXIS_LETTERS[0]` is the bottom-most axis.
 */
export const AXIS_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/** Letters the convention refuses, so a screen can say why. */
export const EXCLUDED_AXIS_LETTERS: readonly string[] = ['I', 'O'];

/** An axis with a name on it, and a record of who named it. */
export interface LabelledAxis {
  readonly axis: DetectedAxis;
  readonly label: string;
  /** `user` when a person named it; only then may it be shown as approved. */
  readonly source: 'user' | 'generated';
}

/**
 * A name a person put on an axis.
 *
 * The axis is identified by where it sits rather than by an index, because an
 * index shifts the moment detection finds one more wall and the name would
 * silently jump to a different line.
 */
export interface AxisLabelOverride {
  readonly direction: AxisDirection;
  /** Where the named axis sits: `x` when vertical, `y` when horizontal. */
  readonly coordinateMm: Millimetres;
  readonly label: string;
}

/** The point the grid is pinned to, in absolute plan coordinates. */
export interface AxisOrigin {
  readonly point: PointMm;
}

/** The origin every project starts with, until someone moves it. */
export const PROJECT_ORIGIN: AxisOrigin = {
  point: { x: millimetres(0), y: millimetres(0) },
};

/** A named grid, with the point it is pinned to. */
export interface AxisGrid {
  readonly origin: AxisOrigin;
  /** Vertical axes, by rising `x`; their labels are the numbers. */
  readonly vertical: readonly LabelledAxis[];
  /** Horizontal axes, by rising `y`; their labels are the letters. */
  readonly horizontal: readonly LabelledAxis[];
}

/**
 * Where a point sits on the grid.
 *
 * The offsets are signed and measured from the nearest axis in each direction:
 * positive `x` to the right, positive `y` upwards. A direction with no axis at
 * all reports a `null` label and a zero offset — there is nothing to be offset
 * from — and only the coordinates relative to the origin carry the position.
 */
export interface AxisPosition {
  /** Number of the nearest vertical axis, or `null` when there is none. */
  readonly verticalLabel: string | null;
  /** Letter of the nearest horizontal axis, or `null` when there is none. */
  readonly horizontalLabel: string | null;
  /** Signed distance from that vertical axis. */
  readonly offsetXMm: Millimetres;
  /** Signed distance from that horizontal axis. */
  readonly offsetYMm: Millimetres;
  /** Coordinates measured from the origin. */
  readonly localXMm: Millimetres;
  readonly localYMm: Millimetres;
}

/* -------------------------------------------------------------------------- */
/* Generating names.                                                           */
/* -------------------------------------------------------------------------- */

function assertIndex(index: number): void {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new RangeError(`Axis index must be a non-negative integer: ${String(index)}`);
  }
}

/**
 * Name of the vertical axis at `index`, counting from the left.
 *
 * @throws RangeError when the index is not a non-negative integer.
 */
export function verticalAxisLabel(index: number): string {
  assertIndex(index);
  return String(index + 1);
}

/**
 * Name of the horizontal axis at `index`, counting from the bottom.
 *
 * Past `Z` the letters carry a place the way a spreadsheet column does, over
 * the 24-letter alphabet: `Z`, `AA`, `AB`. Because the alphabet itself has no
 * `I` and no `O`, no name of any length can contain either.
 *
 * @throws RangeError when the index is not a non-negative integer.
 */
export function horizontalAxisLabel(index: number): string {
  assertIndex(index);
  const base = AXIS_LETTERS.length;
  let remaining = index + 1;
  let label = '';
  while (remaining > 0) {
    const position = (remaining - 1) % base;
    label = `${AXIS_LETTERS.charAt(position)}${label}`;
    remaining = Math.floor((remaining - 1) / base);
  }
  return label;
}

/** The name an axis of this direction would get at `index`. */
export function axisLabelAt(direction: AxisDirection, index: number): string {
  return direction === 'vertical' ? verticalAxisLabel(index) : horizontalAxisLabel(index);
}

/* -------------------------------------------------------------------------- */
/* Labelling a set of axes.                                                    */
/* -------------------------------------------------------------------------- */

function byCoordinate(first: DetectedAxis, second: DetectedAxis): number {
  return compareNearly(first.coordinateMm, second.coordinateMm);
}

function inDirection(
  axes: readonly DetectedAxis[],
  direction: AxisDirection,
): readonly DetectedAxis[] {
  return [...axes.filter((axis) => axis.direction === direction)].sort(byCoordinate);
}

/**
 * The override this axis should take, if any.
 *
 * The nearest unclaimed override within the tolerance wins, and claiming it
 * removes it from the pool, so one name can never land on two axes and two
 * names can never land on one.
 */
function claimOverride(
  axis: DetectedAxis,
  overrides: readonly AxisLabelOverride[],
  claimed: Set<number>,
  toleranceMm: Millimetres,
): string | null {
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  overrides.forEach((override, index) => {
    if (claimed.has(index) || override.direction !== axis.direction) {
      return;
    }
    if (override.label.trim().length === 0) {
      return;
    }
    const distance = Math.abs(override.coordinateMm - axis.coordinateMm);
    if (compareNearly(distance, toleranceMm) > 0) {
      return;
    }
    if (compareNearly(distance, bestDistance) < 0) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  const winner = bestIndex < 0 ? undefined : overrides[bestIndex];
  if (winner === undefined) {
    return null;
  }
  claimed.add(bestIndex);
  return winner.label.trim();
}

/**
 * Put a name on every axis.
 *
 * User names are settled first, across both directions, so the generator knows
 * every name already spoken for before it hands out its own. The generated
 * sequence itself never leaves a gap: an axis a person named does not consume a
 * number, and a number a person has taken is stepped over.
 *
 * The result is ordered the way `detectAxes` orders its output — vertical axes
 * by rising `x`, then horizontal axes by rising `y`.
 */
export function labelAxes(
  axes: readonly DetectedAxis[],
  overrides: readonly AxisLabelOverride[] = [],
  toleranceMm: Millimetres = AXIS_ALIGNMENT_THRESHOLD_MM,
): readonly LabelledAxis[] {
  const vertical = inDirection(axes, 'vertical');
  const horizontal = inDirection(axes, 'horizontal');

  const claimed = new Set<number>();
  const named = new Map<DetectedAxis, string>();
  for (const axis of [...vertical, ...horizontal]) {
    const label = claimOverride(axis, overrides, claimed, toleranceMm);
    if (label !== null) {
      named.set(axis, label);
    }
  }
  const taken = new Set(named.values());

  const label = (ordered: readonly DetectedAxis[], direction: AxisDirection): LabelledAxis[] => {
    let index = 0;
    return ordered.map((axis) => {
      const chosen = named.get(axis);
      if (chosen !== undefined) {
        return { axis, label: chosen, source: 'user' };
      }
      let generated = axisLabelAt(direction, index);
      index += 1;
      while (taken.has(generated)) {
        generated = axisLabelAt(direction, index);
        index += 1;
      }
      return { axis, label: generated, source: 'generated' };
    });
  };

  return [...label(vertical, 'vertical'), ...label(horizontal, 'horizontal')];
}

/* -------------------------------------------------------------------------- */
/* The origin, and reading a position off the grid.                            */
/* -------------------------------------------------------------------------- */

/**
 * Pin the grid to a point.
 *
 * The point is the `±0,000` of the plan: the corner, column or benchmark every
 * plain coordinate is quoted from. It does not move the axes and does not
 * change which axis a position references — see the note at the top of the
 * file.
 *
 * @throws RangeError when either coordinate is not a finite length.
 */
export function setOrigin(point: PointMm): AxisOrigin {
  return { point: { x: millimetres(point.x), y: millimetres(point.y) } };
}

/** Assemble a named grid, splitting the axes by direction. */
export function buildAxisGrid(
  axes: readonly LabelledAxis[],
  origin: AxisOrigin = PROJECT_ORIGIN,
): AxisGrid {
  const inOrder = (direction: AxisDirection): LabelledAxis[] =>
    axes
      .filter((labelled) => labelled.axis.direction === direction)
      .sort((first, second) => byCoordinate(first.axis, second.axis));

  return { origin, vertical: inOrder('vertical'), horizontal: inOrder('horizontal') };
}

/**
 * The axis a coordinate should be quoted against.
 *
 * The nearest one, so the offset is as small as the grid allows. Two axes
 * equally far away resolve to the lower-coordinate one, because the list is in
 * rising order and the comparison keeps the incumbent on a tie.
 */
function nearestAxis(
  axes: readonly LabelledAxis[],
  coordinateMm: number,
): LabelledAxis | undefined {
  let best: LabelledAxis | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const labelled of axes) {
    const distance = Math.abs(coordinateMm - labelled.axis.coordinateMm);
    if (compareNearly(distance, bestDistance) < 0) {
      best = labelled;
      bestDistance = distance;
    }
  }

  return best;
}

/** Read an absolute plan coordinate as a position on the grid. */
export function toAxisPosition(point: PointMm, grid: AxisGrid): AxisPosition {
  const vertical = nearestAxis(grid.vertical, point.x);
  const horizontal = nearestAxis(grid.horizontal, point.y);

  return {
    verticalLabel: vertical?.label ?? null,
    horizontalLabel: horizontal?.label ?? null,
    offsetXMm: millimetres(vertical === undefined ? 0 : point.x - vertical.axis.coordinateMm),
    offsetYMm: millimetres(horizontal === undefined ? 0 : point.y - horizontal.axis.coordinateMm),
    localXMm: millimetres(point.x - grid.origin.point.x),
    localYMm: millimetres(point.y - grid.origin.point.y),
  };
}

function resolveCoordinate(
  axes: readonly LabelledAxis[],
  label: string | null,
  offsetMm: Millimetres,
  fallbackMm: number,
): number | null {
  if (label === null) {
    return fallbackMm;
  }
  const found = axes.find((labelled) => labelled.label === label);
  return found === undefined ? null : found.axis.coordinateMm + offsetMm;
}

/**
 * Put a grid position back into absolute plan coordinates.
 *
 * `null` when a label names no axis on this grid: a position quoted against
 * axis `7` of a drawing that has six is not a position, and guessing the
 * nearest one would put a column somewhere nobody asked for.
 *
 * A direction with no axis falls back to the coordinate measured from the
 * origin, which is what `toAxisPosition` recorded, so the round trip is exact
 * whether or not the grid covers both directions.
 */
export function fromAxisPosition(position: AxisPosition, grid: AxisGrid): PointMm | null {
  const x = resolveCoordinate(
    grid.vertical,
    position.verticalLabel,
    position.offsetXMm,
    grid.origin.point.x + position.localXMm,
  );
  const y = resolveCoordinate(
    grid.horizontal,
    position.horizontalLabel,
    position.offsetYMm,
    grid.origin.point.y + position.localYMm,
  );

  if (x === null || y === null) {
    return null;
  }
  return { x: millimetres(x), y: millimetres(y) };
}

/* -------------------------------------------------------------------------- */
/* Reading a position out loud.                                                */
/* -------------------------------------------------------------------------- */

/** Decimals kept in a spoken length; a hundredth of a millimetre is plenty. */
const SPOKEN_PRECISION = 100;

/** A length written the way the rest of the interface writes one. */
function lengthText(value: number): string {
  const rounded = Math.round(value * SPOKEN_PRECISION) / SPOKEN_PRECISION;
  return String(rounded === 0 ? 0 : rounded).replace('.', ',');
}

/**
 * Say where a position is, the way it would be said on site.
 *
 * `B-3` when it sits on the crossing, `B-3 lệch 250 mm` when it is off one of
 * the two axes — no direction is named because only one can be meant — and
 * `B-3 lệch X 250 mm và Y 120 mm` when it is off both. A grid with no axis in
 * one direction quotes only the label it has; a grid with none at all falls
 * back to the coordinates measured from the origin.
 */
export function describeAxisPosition(position: AxisPosition): string {
  const labels: string[] = [];
  if (position.horizontalLabel !== null) {
    labels.push(position.horizontalLabel);
  }
  if (position.verticalLabel !== null) {
    labels.push(position.verticalLabel);
  }

  if (labels.length === 0) {
    return `Chưa có trục, X ${lengthText(position.localXMm)} mm, Y ${lengthText(position.localYMm)} mm`;
  }

  const name = labels.join('-');
  const offX = !isNearlyZero(position.offsetXMm);
  const offY = !isNearlyZero(position.offsetYMm);

  if (!offX && !offY) {
    return name;
  }
  if (offX && offY) {
    return (
      `${name} lệch X ${lengthText(position.offsetXMm)} mm ` +
      `và Y ${lengthText(position.offsetYMm)} mm`
    );
  }
  return `${name} lệch ${lengthText(offX ? position.offsetXMm : position.offsetYMm)} mm`;
}

/** Say where an absolute plan coordinate is, on this grid. */
export function describePoint(point: PointMm, grid: AxisGrid): string {
  return describeAxisPosition(toAxisPosition(point, grid));
}
