/**
 * Robust statistics for samples read off a drawing.
 *
 * OCR gets dimension strings wrong in a very particular way: most readings are
 * within a fraction of a percent of each other, and the few failures are wrong
 * by an order of magnitude — a dimension string matched to the wrong line, or a
 * digit dropped. A mean and a standard deviation are dragged around by exactly
 * that kind of failure, so the median absolute deviation is used instead: it
 * stays put until more than half the samples are wrong.
 *
 * The functions here are unitless on purpose — they operate on ratios, not on
 * lengths — and they report **indices** rather than values, so the caller can
 * map a rejected sample back to the dimension string it came from.
 */

/**
 * Scales the median absolute deviation onto the standard deviation of a normal
 * distribution, which is what makes the threshold comparable to "how many sigma
 * away". This is a constant of the method, not a tunable threshold.
 */
const MAD_TO_SIGMA = 0.6745;

/** The same correction for the mean absolute deviation, used as a fallback. */
const MEAN_DEVIATION_TO_SIGMA = 1.2533;

/** How a set of samples splits into the trustworthy ones and the rest. */
export interface OutlierSplit {
  /** Indices of the samples to keep, in their original order. */
  readonly keptIndices: readonly number[];
  /** Indices of the samples that sit too far from the middle. */
  readonly rejectedIndices: readonly number[];
  /** Median of all samples, or `null` when there were none. */
  readonly median: number | null;
  /** Median absolute deviation of all samples; `0` when they agree exactly. */
  readonly absoluteDeviation: number;
}

/** Middle value of the samples; the mean of the middle two when even. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle];
  if (upper === undefined) {
    return null;
  }
  if (sorted.length % 2 === 1) {
    return upper;
  }
  const lower = sorted[middle - 1];
  return lower === undefined ? upper : (lower + upper) / 2;
}

/** Median of the distances to the median: the robust spread of the samples. */
export function medianAbsoluteDeviation(values: readonly number[], centre: number): number {
  return median(values.map((value) => Math.abs(value - centre))) ?? 0;
}

/** Mean of the distances to the median, used when the robust spread is zero. */
function meanAbsoluteDeviation(values: readonly number[], centre: number): number {
  if (values.length === 0) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + Math.abs(value - centre), 0);
  return total / values.length;
}

/**
 * Split samples into those close to the median and those too far from it.
 *
 * A sample is rejected when its modified z-score — its distance to the median,
 * divided by the median absolute deviation — exceeds `threshold`.
 *
 * Two degenerate cases are handled explicitly:
 * - the deviation is zero because most samples are identical: the mean absolute
 *   deviation takes over, so a single disagreeing sample is still caught;
 * - every sample is identical: nothing is rejected.
 *
 * @throws RangeError when the threshold is not a positive finite number.
 */
export function splitOutliers(values: readonly number[], threshold: number): OutlierSplit {
  if (!Number.isFinite(threshold) || threshold <= 0) {
    throw new RangeError(`Outlier threshold must be positive: ${String(threshold)}`);
  }

  const centre = median(values);
  if (centre === null) {
    return { keptIndices: [], rejectedIndices: [], median: null, absoluteDeviation: 0 };
  }

  const absoluteDeviation = medianAbsoluteDeviation(values, centre);
  const fallbackDeviation =
    absoluteDeviation > 0 ? 0 : meanAbsoluteDeviation(values, centre) * MEAN_DEVIATION_TO_SIGMA;
  const spread = absoluteDeviation > 0 ? absoluteDeviation / MAD_TO_SIGMA : fallbackDeviation;

  const keptIndices: number[] = [];
  const rejectedIndices: number[] = [];
  values.forEach((value, index) => {
    const distance = Math.abs(value - centre);
    // With no spread at all every sample is identical, so nothing can be an
    // outlier; `distance` is then zero for all of them anyway.
    const withinThreshold = spread > 0 ? distance / spread <= threshold : distance === 0;
    if (withinThreshold) {
      keptIndices.push(index);
    } else {
      rejectedIndices.push(index);
    }
  });

  return { keptIndices, rejectedIndices, median: centre, absoluteDeviation };
}
