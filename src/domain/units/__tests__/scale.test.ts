import { describe, expect, it } from 'vitest';

import { median, medianAbsoluteDeviation, splitOutliers } from '../outliers';
import {
  classifyScaleRange,
  compareLevelScales,
  compareScaleToAiEstimate,
  createScale,
  inferScale,
  inferWallThicknessFromScale,
  millimetresPerPixel,
  pixels,
  SCALE_THRESHOLDS,
  scaleFromRatio,
  type LevelScale,
  type ScaleMeasurement,
} from '../scale';
import { millimetres, roundMeasurement } from '../types';
import { MAX_WALL_THICKNESS_MM } from '../../rules/registry';

/** The drawing used throughout: 4800 mm of wall measured as 400 px. */
const TARGET_RATIO = 12;

function measurement(id: string, pixelLength: number, realLength: number): ScaleMeasurement {
  return {
    id,
    pixelLength: pixels(pixelLength),
    realLength: millimetres(realLength),
  };
}

/**
 * Ten dimension strings read off one sheet. Eight agree on 12 mm/px to within a
 * fifth of a percent; `M-009` matched its text to the wrong line and `M-010`
 * lost a digit, so both are wrong by more than threefold.
 */
const TEN_READINGS: readonly ScaleMeasurement[] = [
  measurement('M-001', 400, 4800),
  measurement('M-002', 200, 2402),
  measurement('M-003', 350, 4193),
  measurement('M-004', 500, 6010),
  measurement('M-005', 250, 2995),
  measurement('M-006', 600, 7212),
  measurement('M-007', 300, 3600),
  measurement('M-008', 450, 5405),
  measurement('M-009', 120, 4800),
  measurement('M-010', 800, 2400),
];

describe('createScale', () => {
  it('converts both ways from one measured pair', () => {
    const scale = createScale({ pixelLength: pixels(400), realLength: millimetres(4800) });

    expect(scale.millimetresPerPixel).toBe(TARGET_RATIO);
    expect(scale.pixelsToMillimetres(pixels(400))).toBe(4800);
    expect(scale.millimetresToPixels(millimetres(4800))).toBe(400);
  });

  it('round trips a length through both conversions', () => {
    const scale = createScale({ pixelLength: pixels(400), realLength: millimetres(4800) });
    const original = millimetres(2745);

    const returned = scale.pixelsToMillimetres(scale.millimetresToPixels(original));

    expect(roundMeasurement(returned)).toBe(2745);
  });

  it('refuses a degenerate pair', () => {
    expect(() => createScale({ pixelLength: pixels(0), realLength: millimetres(4800) })).toThrow(
      RangeError,
    );
    expect(() => createScale({ pixelLength: pixels(400), realLength: millimetres(-1) })).toThrow(
      RangeError,
    );
    expect(() => scaleFromRatio(millimetresPerPixel(0))).toThrow(RangeError);
  });
});

describe('inferScale', () => {
  it('finds the scale from ten readings and drops the two bad ones', () => {
    const result = inferScale(TEN_READINGS);

    expect(result.status).toBe('inferred');
    expect(result.sampleCount).toBe(8);
    expect(result.rejectedIds).toEqual(['M-009', 'M-010']);
    if (result.status === 'inferred') {
      // The eight survivors straddle 12 mm/px, so their median is 12,005 —
      // within a twentieth of a percent of the ratio the sheet was drawn at.
      expect(result.scale.millimetresPerPixel).toBeCloseTo(TARGET_RATIO, 1);
      const measured = result.scale.pixelsToMillimetres(pixels(400));
      expect(Math.abs(measured - 4800) / 4800).toBeLessThan(0.001);
    }
  });

  it('reports high confidence when the readings agree', () => {
    const result = inferScale(TEN_READINGS);

    expect(result.confidence).toBeGreaterThan(SCALE_THRESHOLDS.minimumConfidence);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('asks for manual calibration with only two readings', () => {
    const result = inferScale([measurement('M-001', 400, 4800), measurement('M-002', 200, 2400)]);

    expect(result.status).toBe('needsManualCalibration');
    if (result.status === 'needsManualCalibration') {
      expect(result.reason).toBe('tooFewSamples');
    }
    expect(result.sampleCount).toBe(2);
    expect(result.suggestedMillimetresPerPixel).toBe(TARGET_RATIO);
  });

  it('exposes no scale to apply when calibration is needed', () => {
    const result = inferScale([measurement('M-001', 400, 4800)]);

    expect(result).not.toHaveProperty('scale');
  });

  it('asks for manual calibration when readings disagree too much', () => {
    const result = inferScale([
      measurement('M-001', 400, 4000),
      measurement('M-002', 400, 4400),
      measurement('M-003', 400, 4800),
      measurement('M-004', 400, 5200),
      measurement('M-005', 400, 5600),
    ]);

    expect(result.status).toBe('needsManualCalibration');
    if (result.status === 'needsManualCalibration') {
      expect(result.reason).toBe('lowConfidence');
    }
    expect(result.sampleCount).toBe(5);
    expect(result.confidence).toBeLessThan(SCALE_THRESHOLDS.minimumConfidence);
    expect(result.suggestedMillimetresPerPixel).toBe(TARGET_RATIO);
  });

  it('throws away readings that are not measurable at all', () => {
    const result = inferScale([
      measurement('M-001', 400, 4800),
      measurement('M-002', 200, 2400),
      measurement('M-003', 300, 3600),
      measurement('M-004', 0, 3600),
      measurement('M-005', 250, 0),
    ]);

    expect(result.rejectedIds).toEqual(['M-004', 'M-005']);
    expect(result.sampleCount).toBe(3);
    expect(result.status).toBe('inferred');
  });

  it('handles an empty list without throwing', () => {
    const result = inferScale([]);

    expect(result.status).toBe('needsManualCalibration');
    expect(result.sampleCount).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.suggestedMillimetresPerPixel).toBeNull();
  });
});

describe('compareLevelScales', () => {
  function level(levelId: string, levelName: string, ratio: number): LevelScale {
    return { levelId, levelName, millimetresPerPixel: millimetresPerPixel(ratio) };
  }

  it('stays silent while the levels agree within the limit', () => {
    const warnings = compareLevelScales([
      level('L-001', 'Tầng trệt', 12),
      level('L-002', 'Tầng 2', 12.1),
      level('L-003', 'Tầng 3', 11.95),
    ]);

    expect(warnings).toEqual([]);
  });

  it('warns in Vietnamese and names both levels', () => {
    const warnings = compareLevelScales([
      level('L-001', 'Tầng trệt', 12),
      level('L-002', 'Tầng 2', 12.5),
    ]);

    expect(warnings).toHaveLength(1);
    const [warning] = warnings;
    expect(warning?.firstLevelName).toBe('Tầng trệt');
    expect(warning?.secondLevelName).toBe('Tầng 2');
    expect(warning?.message).toContain('Tầng trệt');
    expect(warning?.message).toContain('Tầng 2');
    expect(warning?.message).toBe(
      'Tỉ lệ của Tầng trệt lệch 4,1% so với Tầng 2; ngưỡng cho phép là 2,0%.',
    );
  });

  it('compares every pair, not only neighbours', () => {
    const warnings = compareLevelScales([
      level('L-001', 'Tầng trệt', 12),
      level('L-002', 'Tầng 2', 12.1),
      level('L-003', 'Tầng 3', 15),
    ]);

    expect(warnings.map((entry) => [entry.firstLevelId, entry.secondLevelId])).toEqual([
      ['L-001', 'L-003'],
      ['L-002', 'L-003'],
    ]);
  });

  it('measures the gap the same way whichever level comes first', () => {
    const forwards = compareLevelScales([
      level('L-001', 'Tầng trệt', 12),
      level('L-002', 'Tầng 2', 15),
    ]);
    const backwards = compareLevelScales([
      level('L-002', 'Tầng 2', 15),
      level('L-001', 'Tầng trệt', 12),
    ]);

    expect(forwards[0]?.relativeDifference).toBe(backwards[0]?.relativeDifference);
  });

  it('says nothing about a single level', () => {
    expect(compareLevelScales([level('L-001', 'Tầng trệt', 12)])).toEqual([]);
  });
});

describe('classifyScaleRange', () => {
  it('accepts a ratio inside the documented 1-200 mm/px range', () => {
    expect(classifyScaleRange(millimetresPerPixel(1))).toBe('inRange');
    expect(classifyScaleRange(millimetresPerPixel(12))).toBe('inRange');
    expect(classifyScaleRange(millimetresPerPixel(200))).toBe('inRange');
  });

  it('flags a ratio finer than the range as below it', () => {
    expect(classifyScaleRange(millimetresPerPixel(0.5))).toBe('belowRange');
  });

  it('flags a ratio coarser than the range as above it', () => {
    expect(classifyScaleRange(millimetresPerPixel(250))).toBe('aboveRange');
  });
});

describe('compareScaleToAiEstimate', () => {
  it('reports a positive deviation when the manual ratio reads bigger', () => {
    const result = compareScaleToAiEstimate(millimetresPerPixel(12.3), millimetresPerPixel(12));

    expect(result.relativeDeviation).toBeCloseTo(0.025, 6);
    expect(result.exceedsLimit).toBe(false);
  });

  it('reports a negative deviation when the manual ratio reads smaller', () => {
    const result = compareScaleToAiEstimate(millimetresPerPixel(9), millimetresPerPixel(12));

    expect(result.relativeDeviation).toBeCloseTo(-0.25, 6);
    expect(result.exceedsLimit).toBe(true);
  });

  it('flags a deviation once it passes the 15% threshold', () => {
    const belowLimit = compareScaleToAiEstimate(
      millimetresPerPixel(13.7),
      millimetresPerPixel(12),
    );
    const aboveLimit = compareScaleToAiEstimate(
      millimetresPerPixel(13.9),
      millimetresPerPixel(12),
    );

    expect(belowLimit.exceedsLimit).toBe(false);
    expect(aboveLimit.exceedsLimit).toBe(true);
  });

  it('never marks a comparison against another estimate as verified', () => {
    const result = compareScaleToAiEstimate(millimetresPerPixel(12), millimetresPerPixel(12));

    expect(result).not.toHaveProperty('verified');
  });

  it('reports no deviation when the AI estimate is degenerate rather than dividing by it', () => {
    const result = compareScaleToAiEstimate(millimetresPerPixel(12), millimetresPerPixel(0));

    expect(result).toEqual({ relativeDeviation: 0, exceedsLimit: false });
  });
});

describe('inferWallThicknessFromScale', () => {
  it('says a scale is fine when it implies an ordinary wall', () => {
    const result = inferWallThicknessFromScale(millimetresPerPixel(12), pixels(10));

    expect(result.thicknessMm).toBe(120);
    expect(result.implausible).toBe(false);
  });

  it('stays plausible exactly at the ceiling', () => {
    const result = inferWallThicknessFromScale(millimetresPerPixel(40), pixels(10));

    expect(result.thicknessMm).toBe(MAX_WALL_THICKNESS_MM);
    expect(result.implausible).toBe(false);
  });

  it('flags the example from the spec: 250 mm/px implies a wall about 3 m thick', () => {
    // 12 px is the width the 1/270 anchor (quality/thresholds.ts:19-20) implies
    // for a reference wall on a plan scanned at roughly 3,240 px short edge —
    // above the recommended 2,000 px minimum, and a plausible scan size.
    const result = inferWallThicknessFromScale(millimetresPerPixel(250), pixels(12));

    expect(result.thicknessMm).toBe(3000);
    expect(result.implausible).toBe(true);
  });
});

describe('outliers', () => {
  it('takes the middle value of an odd count', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('averages the middle two of an even count', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('has no median for an empty list', () => {
    expect(median([])).toBeNull();
  });

  it('measures spread with the median absolute deviation', () => {
    expect(medianAbsoluteDeviation([10, 12, 14], 12)).toBe(2);
  });

  it('keeps everything when the samples agree exactly', () => {
    const split = splitOutliers([12, 12, 12, 12], SCALE_THRESHOLDS.outlierRejection);

    expect(split.keptIndices).toEqual([0, 1, 2, 3]);
    expect(split.rejectedIndices).toEqual([]);
  });

  it('still catches a stray sample when the rest are identical', () => {
    const split = splitOutliers([12, 12, 12, 40], SCALE_THRESHOLDS.outlierRejection);

    expect(split.keptIndices).toEqual([0, 1, 2]);
    expect(split.rejectedIndices).toEqual([3]);
  });

  it('reports positions so a rejected sample can be traced back', () => {
    const split = splitOutliers([12, 40, 12.1, 3, 11.9], SCALE_THRESHOLDS.outlierRejection);

    expect(split.rejectedIndices).toEqual([1, 3]);
  });

  it('refuses a threshold that is not positive', () => {
    expect(() => splitOutliers([1, 2, 3], 0)).toThrow(RangeError);
    expect(() => splitOutliers([1, 2, 3], Number.NaN)).toThrow(RangeError);
  });
});
