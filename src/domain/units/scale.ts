/**
 * Recovering the drawing scale from OCR readings.
 *
 * A scanned plan is just pixels: nothing in the image says how big anything is.
 * The only evidence available is the dimension strings OCR managed to read —
 * each one pairs a pixel distance measured on the image with the real length
 * printed next to it. Every such pair implies a scale, and the job here is to
 * turn a noisy pile of them into one ratio plus an honest statement of how much
 * it can be trusted.
 *
 * Two rules are structural rather than advisory:
 * - a `Scale` only exists on the `inferred` branch of `ScaleInference`, so a
 *   caller physically cannot apply a scale that failed its checks;
 * - pixels, millimetres and the ratio between them are separate labelled types,
 *   so no conversion can be applied in the wrong direction.
 *
 * Everything is pure: arrays in, values out, no file or network access.
 */

import { splitOutliers, median } from './outliers';
import { millimetres, type Millimetres, type Quantity } from './types';
import { MAX_WALL_THICKNESS_MM } from '../rules/registry';

/** A distance measured on the image, in pixels. */
export type Pixels = Quantity<'px'>;

/** A drawing scale: how many millimetres one pixel of the image is worth. */
export type MillimetresPerPixel = Quantity<'mm/px'>;

/**
 * Every threshold the inference depends on, in one place so a change is a
 * single edit and a review can see the whole policy at a glance.
 */
export const SCALE_THRESHOLDS = {
  /** Modified z-score beyond which a sample is treated as an OCR failure. */
  outlierRejection: 3,
  /** Below this many usable samples the scale must be set by hand. */
  minimumSampleCount: 3,
  /** Below this confidence the scale must not be applied automatically. */
  minimumConfidence: 0.6,
  /** Sample count at which the count no longer holds confidence back. */
  confidentSampleCount: 5,
  /** Relative spread of the kept samples at which confidence reaches zero. */
  relativeSpreadLimit: 0.05,
  /** Share of the confidence governed by how many samples survived. */
  sampleCountWeight: 0.5,
  /** Relative gap between two levels' scales that is worth a warning. */
  levelAgreementLimit: 0.02,
  /**
   * Below this many millimetres per pixel, the image is claiming resolution
   * no real scan or camera delivers: 1 mm/px means a single pixel already
   * resolves a millimetre, finer than any plan this system reads. A ratio
   * under this points at a bad reading, not a sharper drawing.
   */
  minMillimetresPerPixel: 1,
  /**
   * Above this many millimetres per pixel, a single pixel already swallows
   * more than the thinnest wall this system has to find: the standing-brick
   * wall `quality/thresholds.ts` is anchored on (110 mm) would draw narrower
   * than half a pixel at 200 mm/px, so two such walls a pixel apart could
   * not be told apart at all.
   */
  maxMillimetresPerPixel: 200,
  /**
   * Relative gap between a scale set by hand and the one the AI estimated
   * for the same drawing, past which the difference is worth a warning —
   * the same role `levelAgreementLimit` plays between two levels, but here
   * the second side is the AI's own suggestion rather than another level.
   */
  aiDeviationLimit: 0.15,
} as const;

/** Decimals kept on confidence and percentages so results compare cleanly. */
const RESULT_PRECISION = 1e6;

function assertFinite(value: number, quantity: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Not a finite ${quantity} value: ${String(value)}`);
  }
}

/** Tag a raw number as pixels. The one gate where an untyped value enters. */
export function pixels(value: number): Pixels {
  assertFinite(value, 'pixel');
  return value as Pixels;
}

/** Tag a raw number as millimetres per pixel. */
export function millimetresPerPixel(value: number): MillimetresPerPixel {
  assertFinite(value, 'millimetre per pixel');
  return value as MillimetresPerPixel;
}

function roundResult(value: number): number {
  return Math.round(value * RESULT_PRECISION) / RESULT_PRECISION;
}

/** A drawing scale together with its two conversions. */
export interface Scale {
  readonly millimetresPerPixel: MillimetresPerPixel;
  /** Convert a distance measured on the image into a real length. */
  readonly pixelsToMillimetres: (value: Pixels) => Millimetres;
  /** Convert a real length into a distance on the image. */
  readonly millimetresToPixels: (value: Millimetres) => Pixels;
}

/** One dimension string OCR read: a pixel distance and the length it labels. */
export interface ScaleMeasurement {
  /** Identifies the reading so a rejected one can be shown to the user. */
  readonly id: string;
  readonly pixelLength: Pixels;
  readonly realLength: Millimetres;
}

/** Why a scale may not be applied on its own. */
export type ManualCalibrationReason = 'tooFewSamples' | 'lowConfidence';

interface ScaleInferenceBase {
  /** How much the result can be trusted, within `[0, 1]`. */
  readonly confidence: number;
  /** How many samples survived outlier rejection and fed the result. */
  readonly sampleCount: number;
  /** Ids of the readings thrown away, either unusable or too far out. */
  readonly rejectedIds: readonly string[];
  /**
   * The ratio the samples point at, even when it may not be applied. Offer it
   * as a starting point for manual calibration, never as a result.
   */
  readonly suggestedMillimetresPerPixel: MillimetresPerPixel | null;
}

/** Outcome of reading a scale off a set of measurements. */
export type ScaleInference =
  | (ScaleInferenceBase & { readonly status: 'inferred'; readonly scale: Scale })
  | (ScaleInferenceBase & {
      readonly status: 'needsManualCalibration';
      readonly reason: ManualCalibrationReason;
    });

/** Build a scale from a ratio that is already known. */
export function scaleFromRatio(ratio: MillimetresPerPixel): Scale {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    throw new RangeError(`Scale must be a positive ratio: ${String(ratio)}`);
  }
  return {
    millimetresPerPixel: ratio,
    pixelsToMillimetres: (value: Pixels): Millimetres => millimetres(value * ratio),
    millimetresToPixels: (value: Millimetres): Pixels => pixels(value / ratio),
  };
}

/** Build a scale from one measured pair: a pixel distance and its real length. */
export function createScale(input: {
  readonly pixelLength: Pixels;
  readonly realLength: Millimetres;
}): Scale {
  if (!Number.isFinite(input.pixelLength) || input.pixelLength <= 0) {
    throw new RangeError(`Pixel length must be positive: ${String(input.pixelLength)}`);
  }
  if (!Number.isFinite(input.realLength) || input.realLength <= 0) {
    throw new RangeError(`Real length must be positive: ${String(input.realLength)}`);
  }
  return scaleFromRatio(millimetresPerPixel(input.realLength / input.pixelLength));
}

/** A reading is usable only if both of its lengths are real positive numbers. */
function isUsable(measurement: ScaleMeasurement): boolean {
  return (
    Number.isFinite(measurement.pixelLength) &&
    measurement.pixelLength > 0 &&
    Number.isFinite(measurement.realLength) &&
    measurement.realLength > 0
  );
}

/**
 * Confidence in a set of surviving samples, within `[0, 1]`.
 *
 * Two things erode it, and both have to be good for the result to be usable:
 * how tightly the samples agree (their spread relative to the median) and how
 * many of them there are. A handful of samples that agree perfectly is still
 * worth less than many that do, so the count holds back part of the score.
 */
function computeConfidence(samples: readonly number[], centre: number): number {
  if (samples.length === 0 || centre <= 0) {
    return 0;
  }
  const spread = median(samples.map((value) => Math.abs(value - centre))) ?? 0;
  const relativeSpread = spread / centre;
  const spreadScore = Math.max(0, 1 - relativeSpread / SCALE_THRESHOLDS.relativeSpreadLimit);
  const countScore = Math.min(1, samples.length / SCALE_THRESHOLDS.confidentSampleCount);
  const weight = SCALE_THRESHOLDS.sampleCountWeight;
  return roundResult(spreadScore * (1 - weight + weight * countScore));
}

/**
 * Work out the drawing scale from the dimension strings OCR read.
 *
 * Each measurement gives one candidate ratio; the wildly wrong ones are dropped
 * by median absolute deviation, and the median of what remains is the answer.
 * The result carries a scale only when at least
 * `SCALE_THRESHOLDS.minimumSampleCount` samples survived and confidence reached
 * `SCALE_THRESHOLDS.minimumConfidence`; otherwise it asks for manual
 * calibration and merely suggests a ratio.
 */
export function inferScale(measurements: readonly ScaleMeasurement[]): ScaleInference {
  const usable = measurements.filter(isUsable);
  const unusableIds = measurements.filter((entry) => !isUsable(entry)).map((entry) => entry.id);

  const ratios = usable.map((entry) => entry.realLength / entry.pixelLength);
  const split = splitOutliers(ratios, SCALE_THRESHOLDS.outlierRejection);

  const rejectedIds = [
    ...unusableIds,
    ...split.rejectedIndices
      .map((index) => usable[index])
      .filter((entry): entry is ScaleMeasurement => entry !== undefined)
      .map((entry) => entry.id),
  ];
  const keptRatios = split.keptIndices
    .map((index) => ratios[index])
    .filter((ratio): ratio is number => ratio !== undefined);
  const centre = median(keptRatios);
  const confidence = centre === null ? 0 : computeConfidence(keptRatios, centre);

  const base: ScaleInferenceBase = {
    confidence,
    sampleCount: keptRatios.length,
    rejectedIds,
    suggestedMillimetresPerPixel:
      centre === null || centre <= 0 ? null : millimetresPerPixel(centre),
  };

  if (centre === null || centre <= 0 || keptRatios.length < SCALE_THRESHOLDS.minimumSampleCount) {
    return { ...base, status: 'needsManualCalibration', reason: 'tooFewSamples' };
  }
  if (confidence < SCALE_THRESHOLDS.minimumConfidence) {
    return { ...base, status: 'needsManualCalibration', reason: 'lowConfidence' };
  }
  return { ...base, status: 'inferred', scale: scaleFromRatio(millimetresPerPixel(centre)) };
}

/** The scale worked out for one level of the building. */
export interface LevelScale {
  readonly levelId: string;
  /** Shown to the user inside the warning, so it is the level's real name. */
  readonly levelName: string;
  readonly millimetresPerPixel: MillimetresPerPixel;
}

/** A disagreement between two levels that a person should look at. */
export interface LevelScaleWarning {
  readonly firstLevelId: string;
  readonly secondLevelId: string;
  readonly firstLevelName: string;
  readonly secondLevelName: string;
  /** Gap between the two scales, relative to their average. */
  readonly relativeDifference: number;
  /** Ready-to-show Vietnamese sentence naming both levels. */
  readonly message: string;
}

/** Percentage with one decimal and a Vietnamese decimal comma. */
function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1).replace('.', ',')}%`;
}

/**
 * Compare the scales found for each level and report the pairs that disagree.
 *
 * Levels of one building are drawn at the same scale, so a gap wider than
 * `SCALE_THRESHOLDS.levelAgreementLimit` means a sheet was scanned at a
 * different size or a dimension string was misread. Every pair is compared, and
 * the difference is taken relative to the average of the two so the warning
 * does not depend on which level is named first.
 */
export function compareLevelScales(levels: readonly LevelScale[]): readonly LevelScaleWarning[] {
  const warnings: LevelScaleWarning[] = [];

  for (let index = 0; index < levels.length; index += 1) {
    for (let other = index + 1; other < levels.length; other += 1) {
      const first = levels[index];
      const second = levels[other];
      if (first === undefined || second === undefined) {
        continue;
      }
      const average = (first.millimetresPerPixel + second.millimetresPerPixel) / 2;
      if (average <= 0) {
        continue;
      }
      const relativeDifference = roundResult(
        Math.abs(first.millimetresPerPixel - second.millimetresPerPixel) / average,
      );
      if (relativeDifference <= SCALE_THRESHOLDS.levelAgreementLimit) {
        continue;
      }
      warnings.push({
        firstLevelId: first.levelId,
        secondLevelId: second.levelId,
        firstLevelName: first.levelName,
        secondLevelName: second.levelName,
        relativeDifference,
        message:
          `Tỉ lệ của ${first.levelName} lệch ${formatPercent(relativeDifference)} ` +
          `so với ${second.levelName}; ngưỡng cho phép là ` +
          `${formatPercent(SCALE_THRESHOLDS.levelAgreementLimit)}.`,
      });
    }
  }

  return warnings;
}

/** Where a scale ratio falls relative to the range this system can read. */
export type ScaleRangeStatus = 'inRange' | 'belowRange' | 'aboveRange';

/**
 * Classify a scale ratio against `SCALE_THRESHOLDS.minMillimetresPerPixel`
 * and `.maxMillimetresPerPixel`.
 *
 * Returns a classification rather than throwing: a ratio outside the range is
 * something to warn a person about, not something that blocks them — they may
 * be mid-calibration and about to correct it.
 */
export function classifyScaleRange(ratio: MillimetresPerPixel): ScaleRangeStatus {
  if (ratio < SCALE_THRESHOLDS.minMillimetresPerPixel) {
    return 'belowRange';
  }
  if (ratio > SCALE_THRESHOLDS.maxMillimetresPerPixel) {
    return 'aboveRange';
  }
  return 'inRange';
}

/** How a manually set scale compares with the AI's own estimate. */
export interface ScaleAiDeviation {
  /** Signed relative gap: positive when the manual ratio reads bigger. */
  readonly relativeDeviation: number;
  readonly exceedsLimit: boolean;
}

/**
 * Compare a scale a person set by hand against the one the AI estimated for
 * the same drawing.
 *
 * The deviation keeps its sign so a caller can show "+2,4%" rather than just
 * "2,4%" — which of the two ratios drifted matters to the person reading it.
 * The result never marks itself as verified (A5): that colour belongs to a
 * human reviewer's own decision, and this is one automatic estimate compared
 * against another.
 */
export function compareScaleToAiEstimate(
  manualRatio: MillimetresPerPixel,
  aiEstimatedRatio: MillimetresPerPixel,
): ScaleAiDeviation {
  if (aiEstimatedRatio <= 0) {
    return { relativeDeviation: 0, exceedsLimit: false };
  }
  const relativeDeviation = roundResult((manualRatio - aiEstimatedRatio) / aiEstimatedRatio);
  return {
    relativeDeviation,
    exceedsLimit: Math.abs(relativeDeviation) > SCALE_THRESHOLDS.aiDeviationLimit,
  };
}

/** A wall thickness implied by a scale, plus whether it is worth doubting. */
export interface ImpliedWallThickness {
  readonly thicknessMm: Millimetres;
  readonly implausible: boolean;
}

/**
 * What a scale implies about a reference wall drawn `referenceWallWidthPx`
 * pixels wide.
 *
 * A caller derives `referenceWallWidthPx` from the 1/270 anchor in
 * `quality/thresholds.ts` — the fraction of a short paper edge a 110 mm wall
 * occupies at 1:100 — applied to the drawing's actual resolution. A scale
 * that is simply wrong turns that same stroke into a wall far thicker than
 * any real one, and `MAX_WALL_THICKNESS_MM` (`domain/rules/registry.ts`), the
 * ceiling the rule book already enforces on drawn geometry, is reused here
 * rather than restated as a second threshold.
 */
export function inferWallThicknessFromScale(
  ratio: MillimetresPerPixel,
  referenceWallWidthPx: Pixels,
): ImpliedWallThickness {
  const thicknessMm = millimetres(referenceWallWidthPx * ratio);
  return {
    thicknessMm,
    implausible: thicknessMm > MAX_WALL_THICKNESS_MM,
  };
}
