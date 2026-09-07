/**
 * The three numbers at the top of the comparison panel.
 *
 * They are a **measurement, not a verdict**. Nothing here turns a badge green:
 * A5 reserves "verified" for a person's signature, and a floor whose every
 * region sits inside tolerance is still an unreviewed floor. The panel prints
 * these three and waits for someone to press the button.
 *
 * ## Why not `splitOutliers`
 *
 * `units/outliers.ts` already separates a set of samples into the ones that
 * belong and the ones that do not, and it answers a different question.
 * Its threshold is a modified z-score against the median — "which of these
 * samples is statistically odd" — and it moves as the set moves: drop the worst
 * region and the survivors' own spread decides a new boundary. Tolerance does
 * not move. A team lead types 20 mm because 20 mm is what the specification
 * allows, and every region past it is over, however many friends it has. So the
 * comparison here is against a fixed length the caller supplies, and the count
 * that comes out is one an engineer can defend on site.
 *
 * ## Strictly over
 *
 * A region exactly at the tolerance is **within** it: `deviationMm >
 * toleranceMm`, never `>=`. A tolerance is the largest acceptable value, not the
 * smallest unacceptable one, and the difference is not academic — at 21 mm the
 * reviewer's fixture must report 2, not 3.
 */

import { millimetres, type Millimetres } from '../units/types';
import type { DeviationRegion } from './deviation';

/**
 * Decimals kept on the mean.
 *
 * A mean is a division, so it is very often irrational and lands a few ulps away
 * from itself depending on the order the sum was taken in. The same six decimals
 * `measure.ts` keeps on a length, restated because it does not export the
 * figure, so a mean and the lengths it was taken over round the same way and
 * stay comparable side by side.
 */
const RESULT_PRECISION = 1e6;

/** How well the model matches the drawing, in four numbers. */
export interface MatchMetrics {
  /** Mean deviation across every region. */
  readonly meanMm: Millimetres;
  /** The worst single region. */
  readonly maxMm: Millimetres;
  /** How many regions are strictly past the tolerance. */
  readonly overToleranceCount: number;
  /**
   * How many regions there were at all.
   *
   * The caller tells "nothing was measured" from "everything measured zero" by
   * reading this, never by inferring it from a mean of `0`. An empty set has no
   * mean, and the screen prints `'—'` for it rather than `'0 mm'`.
   */
  readonly regionCount: number;
}

function assertTolerance(toleranceMm: Millimetres): void {
  if (!Number.isFinite(toleranceMm) || toleranceMm < 0) {
    throw new RangeError(`Tolerance must be a non-negative length: ${String(toleranceMm)}`);
  }
}

/**
 * How many regions are past the tolerance.
 *
 * Strictly past: see the note at the top of the file.
 *
 * @throws RangeError when the tolerance is not a non-negative finite length.
 */
export function countOverTolerance(
  regions: readonly DeviationRegion[],
  toleranceMm: Millimetres,
): number {
  assertTolerance(toleranceMm);
  return regions.filter((region) => region.deviationMm > toleranceMm).length;
}

/**
 * Reduce a set of regions to the four numbers the panel shows.
 *
 * An empty set reports `millimetres(0)` for both lengths and `0` for both
 * counts. That zero is not a measurement and is not meant to be read as one —
 * `regionCount` is what says whether anything was measured.
 *
 * @throws RangeError when the tolerance is not a non-negative finite length.
 */
export function summariseDeviations(
  regions: readonly DeviationRegion[],
  toleranceMm: Millimetres,
): MatchMetrics {
  assertTolerance(toleranceMm);

  if (regions.length === 0) {
    return {
      meanMm: millimetres(0),
      maxMm: millimetres(0),
      overToleranceCount: 0,
      regionCount: 0,
    };
  }

  const total = regions.reduce<number>((sum, region) => sum + region.deviationMm, 0);
  const worst = regions.reduce<number>(
    (highest, region) => Math.max(highest, region.deviationMm),
    0,
  );

  return {
    meanMm: millimetres(Math.round((total / regions.length) * RESULT_PRECISION) / RESULT_PRECISION),
    maxMm: millimetres(worst),
    overToleranceCount: countOverTolerance(regions, toleranceMm),
    regionCount: regions.length,
  };
}
