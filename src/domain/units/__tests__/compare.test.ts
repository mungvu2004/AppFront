import { describe, expect, it } from 'vitest';

import { RELATIVE_POSITION_EPSILON } from '../../openings/types';
import {
  compareLengthToMeasured,
  compareNearly,
  DEFAULT_EPSILON,
  DIMENSIONLESS_EPSILON,
  isNearlyZero,
} from '../compare';
import { SCALE_THRESHOLDS } from '../scale';
import { millimetres } from '../types';

describe('compareLengthToMeasured', () => {
  it('matches the "Đọc kích thước OCR" example: 4.800 mm read against 4.812 mm measured', () => {
    const result = compareLengthToMeasured(millimetres(4800), millimetres(4812));

    // (4800 - 4812) / 4812 ≈ -0,2494%, which is the "lệch 0,25%" the screen
    // spec shows once rounded to two decimal places for display.
    expect(result.relativeDeviation).toBeCloseTo(-0.002494, 6);
    expect(result.exceedsLimit).toBe(false);
  });

  it('stays under the limit at a 1,5% gap', () => {
    const result = compareLengthToMeasured(millimetres(1015), millimetres(1000));

    expect(result.relativeDeviation).toBeCloseTo(0.015, 6);
    expect(result.exceedsLimit).toBe(false);
  });

  it('passes the limit at a 2,5% gap', () => {
    const result = compareLengthToMeasured(millimetres(1025), millimetres(1000));

    expect(result.relativeDeviation).toBeCloseTo(0.025, 6);
    expect(result.exceedsLimit).toBe(true);
  });

  it('reports a positive deviation when the read value is bigger', () => {
    const result = compareLengthToMeasured(millimetres(1100), millimetres(1000));

    expect(result.relativeDeviation).toBeGreaterThan(0);
  });

  it('reports a negative deviation when the read value is smaller', () => {
    const result = compareLengthToMeasured(millimetres(900), millimetres(1000));

    expect(result.relativeDeviation).toBeLessThan(0);
  });

  it('reports no deviation when the two values are equal', () => {
    const result = compareLengthToMeasured(millimetres(4800), millimetres(4800));

    expect(result).toEqual({ relativeDeviation: 0, exceedsLimit: false });
  });

  it('reports no deviation when the measured value is zero, rather than dividing by it', () => {
    const result = compareLengthToMeasured(millimetres(4800), millimetres(0));

    expect(result).toEqual({ relativeDeviation: 0, exceedsLimit: false });
  });

  it('reports no deviation when the measured value is negative', () => {
    const result = compareLengthToMeasured(millimetres(4800), millimetres(-10));

    expect(result).toEqual({ relativeDeviation: 0, exceedsLimit: false });
  });

  it('never marks a comparison against re-measured geometry as verified', () => {
    const result = compareLengthToMeasured(millimetres(4800), millimetres(4812));

    expect(result).not.toHaveProperty('verified');
  });

  it('shares its threshold with compareLevelScales rather than a threshold of its own', () => {
    const justBelow = compareLengthToMeasured(
      millimetres(1000 * (1 + SCALE_THRESHOLDS.levelAgreementLimit) - 1),
      millimetres(1000),
    );
    const justAbove = compareLengthToMeasured(
      millimetres(1000 * (1 + SCALE_THRESHOLDS.levelAgreementLimit) + 1),
      millimetres(1000),
    );

    expect(justBelow.exceedsLimit).toBe(false);
    expect(justAbove.exceedsLimit).toBe(true);
  });
});

describe('DIMENSIONLESS_EPSILON', () => {
  it('is far tighter than the length tolerance it exists to replace', () => {
    expect(DIMENSIONLESS_EPSILON).toBeLessThan(DEFAULT_EPSILON);
    // A millimetre of tolerance read as a fraction of a ten metre wall is a
    // centimetre of slack; this one is under a micrometre on the same wall.
    expect(DIMENSIONLESS_EPSILON * 10000).toBeLessThan(0.001);
  });

  it('separates two fractions a few millimetres apart on a long wall', () => {
    // 5 mm out of 10 m, as a fraction.
    expect(compareNearly(0.5, 0.5005, DIMENSIONLESS_EPSILON)).toBe(-1);
    expect(compareNearly(0.5, 0.5005)).toBe(0);
  });

  it('still swallows the last few ulps of a division', () => {
    const drifted = 0.1 + 0.2 - 0.3;

    expect(isNearlyZero(drifted, DIMENSIONLESS_EPSILON)).toBe(true);
  });

  it('is the number `RELATIVE_POSITION_EPSILON` names', () => {
    expect(RELATIVE_POSITION_EPSILON).toBe(DIMENSIONLESS_EPSILON);
  });
});
