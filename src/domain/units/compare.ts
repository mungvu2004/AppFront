/**
 * Tolerant comparison of measured values.
 *
 * Two coordinates that a person drew as "the same corner" are never the same
 * float: they arrive from OCR, from a projection, from a rotation, each step
 * leaving a few ulps behind. Comparing them with `===` therefore answers a
 * question nobody asked. Every equality test on a measured number in this
 * domain goes through one of the predicates below, and `===` between two floats
 * appears nowhere.
 *
 * The tolerance is **absolute**, not relative. Coordinates are millimetres
 * inside a building, so they are bounded by a few tens of metres; an absolute
 * epsilon behaves the same near the origin and far from it, whereas a relative
 * one would call `0` and `1e-9` different while calling `1e6` and `1e6 + 1` the
 * same. A micrometre is far below anything a drawing can express and far above
 * the noise the arithmetic introduces.
 */

import { degrees, DEGREES_PER_TURN, millimetres, type Degrees, type Millimetres } from './types';
import { SCALE_THRESHOLDS } from './scale';

/** Default tolerance for measured values: one micrometre, in millimetres. */
export const DEFAULT_EPSILON = 0.001;

/** The same tolerance, labelled as a length. */
export const DEFAULT_EPSILON_MM: Millimetres = millimetres(DEFAULT_EPSILON);

/** Default tolerance for angles, in degrees. */
export const DEFAULT_EPSILON_DEG: Degrees = degrees(DEFAULT_EPSILON);

/** Half a turn, the point past which an angle gap folds back the other way. */
const HALF_TURN = DEGREES_PER_TURN / 2;

/**
 * A point on the floor plan, in millimetres.
 *
 * Declared here rather than in `types.ts` because `nearlyEqualPoint` needs it
 * and `snap.ts` imports this module; the spatial graph keeps its own `Point`,
 * whose coordinates are plain numbers.
 */
export interface PointMm {
  readonly x: Millimetres;
  readonly y: Millimetres;
}

/**
 * Are two numbers the same measurement?
 *
 * Values that are not finite are never equal, including to themselves: a
 * measurement that failed to produce a number cannot match anything.
 */
export function nearlyEqual(first: number, second: number, epsilon = DEFAULT_EPSILON): boolean {
  if (!Number.isFinite(first) || !Number.isFinite(second)) {
    return false;
  }
  return Math.abs(first - second) <= Math.abs(epsilon);
}

/** Is a measured value indistinguishable from zero? */
export function isNearlyZero(value: number, epsilon = DEFAULT_EPSILON): boolean {
  return nearlyEqual(value, 0, epsilon);
}

/**
 * Order two measured values, treating anything within the tolerance as equal.
 *
 * This is what makes a choice between candidates repeatable: sorting on raw
 * floats lets a difference of one ulp decide the winner, so two runs of the
 * same computation can disagree.
 */
export function compareNearly(first: number, second: number, epsilon = DEFAULT_EPSILON): -1 | 0 | 1 {
  if (nearlyEqual(first, second, epsilon)) {
    return 0;
  }
  return first < second ? -1 : 1;
}

/** Are two lengths the same, within tolerance? */
export function nearlyEqualLength(
  first: Millimetres,
  second: Millimetres,
  epsilon: Millimetres = DEFAULT_EPSILON_MM,
): boolean {
  return nearlyEqual(first, second, epsilon);
}

/** Are two plan coordinates the same point, within tolerance on both axes? */
export function nearlyEqualPoint(
  first: PointMm,
  second: PointMm,
  epsilon: Millimetres = DEFAULT_EPSILON_MM,
): boolean {
  return nearlyEqual(first.x, second.x, epsilon) && nearlyEqual(first.y, second.y, epsilon);
}

/**
 * Are two angles the same direction, within tolerance?
 *
 * The gap is folded into `[-180, 180)` first, so `359,9995°` and `0°` are the
 * same heading rather than a full turn apart.
 */
export function nearlyEqualAngle(
  first: Degrees,
  second: Degrees,
  epsilon: Degrees = DEFAULT_EPSILON_DEG,
): boolean {
  if (!Number.isFinite(first) || !Number.isFinite(second)) {
    return false;
  }
  const raw = (first - second) % DEGREES_PER_TURN;
  const gap = ((raw + DEGREES_PER_TURN + HALF_TURN) % DEGREES_PER_TURN) - HALF_TURN;
  return Math.abs(gap) <= Math.abs(epsilon);
}

/**
 * Decimals kept on a deviation, matching `scale.ts`'s own `RESULT_PRECISION`
 * (not exported, so restated here) so a length deviation and a scale
 * deviation round the same way and stay comparable side by side.
 */
const RESULT_PRECISION = 1e6;

function roundResult(value: number): number {
  return Math.round(value * RESULT_PRECISION) / RESULT_PRECISION;
}

/** Deviation between a length read off a dimension string and the same length re-measured from geometry. */
export interface LengthDeviation {
  /** Signed relative deviation: positive when the read value is bigger than the measured one. */
  readonly relativeDeviation: number;
  /** Whether the deviation passed the notice threshold, compared by magnitude. */
  readonly exceedsLimit: boolean;
}

/**
 * Compare a length OCR read off a dimension string against the same length
 * re-measured from the drawing's geometry.
 *
 * `measuredValue` is the denominator: the geometry re-measured from the plan
 * is the reference a reading is checked against. That is different from
 * `compareLevelScales`, whose two sides are peers and so divides by their
 * average — worth spelling out here because it is the one choice a later
 * reader is likely to question. The deviation keeps its sign, for the same
 * reason as `compareScaleToAiEstimate`: which side drifted is what the
 * person reading it needs to know, so `exceedsLimit` alone would throw that
 * away. The threshold is `SCALE_THRESHOLDS.levelAgreementLimit`, reused
 * rather than restated, since a reading-vs-geometry gap and a level-vs-level
 * gap are judged against the same 2% bar. Like `compareScaleToAiEstimate`,
 * this never sets a "verified" flag (A5): it is one automatic comparison,
 * not a reviewer's decision.
 */
export function compareLengthToMeasured(
  readValue: Millimetres,
  measuredValue: Millimetres,
): LengthDeviation {
  if (measuredValue <= 0) {
    return { relativeDeviation: 0, exceedsLimit: false };
  }
  const relativeDeviation = roundResult((readValue - measuredValue) / measuredValue);
  return {
    relativeDeviation,
    exceedsLimit: Math.abs(relativeDeviation) > SCALE_THRESHOLDS.levelAgreementLimit,
  };
}
