import { describe, expect, it } from 'vitest';

import type { DetectedAxis } from '../../axes/detect';
import type { WallId } from '../../spatial/types';
import { millimetresPerPixel, scaleFromRatio } from '../../units/scale';
import { degrees, millimetres } from '../../units/types';
import { compareDrawingToModel, type DeviationRegion } from '../deviation';
import { countOverTolerance, summariseDeviations } from '../metrics';
import { createOverlayTransform } from '../transform';

/**
 * The reviewer's set, settled and not ours to change.
 *
 * Fourteen regions summing to 112 mm, so the mean is exactly 8; the worst is
 * 41; three are past 20 mm and none past 50. The two threshold figures are the
 * screen's acceptance criterion — "change the tolerance from 20 to 50 and the
 * count falls to zero" — and 21 mm is the strict-comparison boundary: 21 is not
 * over 21, so the answer there is 2 and not 3.
 */
const REVIEWER_DEVIATIONS_MM: readonly number[] = [
  41, 25, 21, 5, 4, 3, 3, 2, 2, 2, 1, 1, 1, 1,
];

function wallId(index: number): WallId {
  return `W-${String(index).padStart(4, '0')}`;
}

function region(deviationMm: number, index: number): DeviationRegion {
  return {
    id: `overlay-deviation-vertical-${wallId(index)}`,
    reference: String(index + 1),
    fromMm: { x: millimetres(deviationMm), y: millimetres(0) },
    toMm: { x: millimetres(0), y: millimetres(0) },
    deviationMm: millimetres(deviationMm),
    subjectIds: [wallId(index)],
  };
}

const REVIEWER_REGIONS: readonly DeviationRegion[] = REVIEWER_DEVIATIONS_MM.map(region);

describe("the reviewer's set", () => {
  it('averages 8 mm', () => {
    expect(summariseDeviations(REVIEWER_REGIONS, millimetres(20)).meanMm).toBe(8);
  });

  it('peaks at 41 mm', () => {
    expect(summariseDeviations(REVIEWER_REGIONS, millimetres(20)).maxMm).toBe(41);
  });

  it('puts three regions past a 20 mm tolerance', () => {
    expect(summariseDeviations(REVIEWER_REGIONS, millimetres(20)).overToleranceCount).toBe(3);
  });

  it('counts fourteen regions whatever the tolerance', () => {
    expect(summariseDeviations(REVIEWER_REGIONS, millimetres(20)).regionCount).toBe(14);
    expect(summariseDeviations(REVIEWER_REGIONS, millimetres(50)).regionCount).toBe(14);
  });

  it('puts none past 50 mm, which is the screen’s acceptance criterion', () => {
    expect(countOverTolerance(REVIEWER_REGIONS, millimetres(50))).toBe(0);
  });

  it('puts two past 21 mm, because "over" is strict', () => {
    expect(countOverTolerance(REVIEWER_REGIONS, millimetres(21))).toBe(2);
  });

  it('leaves the mean and the worst untouched when only the tolerance moves', () => {
    const tight = summariseDeviations(REVIEWER_REGIONS, millimetres(20));
    const relaxed = summariseDeviations(REVIEWER_REGIONS, millimetres(50));

    expect(relaxed.meanMm).toBe(tight.meanMm);
    expect(relaxed.maxMm).toBe(tight.maxMm);
    expect(relaxed.overToleranceCount).toBe(0);
  });
});

describe("the reviewer's set, measured rather than declared", () => {
  /**
   * The same fourteen figures, but arrived at through the whole pipeline: a scan
   * placed on the model, its axes paired with the model's, each gap measured by
   * `measureDistance`. If the three numbers only ever came out of hand-written
   * regions they would prove the summariser and nothing else.
   */
  const AXIS_SPACING_MM = 5000;

  const modelAxes: readonly DetectedAxis[] = REVIEWER_DEVIATIONS_MM.map((_, index) => ({
    direction: 'vertical' as const,
    coordinateMm: millimetres(index * AXIS_SPACING_MM),
    startMm: millimetres(0),
    endMm: millimetres(4000),
    spreadMm: millimetres(0),
    wallIds: [wallId(index * 2), wallId(index * 2 + 1)],
  }));

  const drawingAxes: readonly DetectedAxis[] = REVIEWER_DEVIATIONS_MM.map(
    (deviationMm, index) => ({
      direction: 'vertical' as const,
      coordinateMm: millimetres(index * AXIS_SPACING_MM + deviationMm),
      startMm: millimetres(0),
      endMm: millimetres(4000),
      spreadMm: millimetres(0),
      wallIds: [wallId(100 + index)],
    }),
  );

  const measured = compareDrawingToModel({
    drawingAxes,
    modelAxes,
    transform: createOverlayTransform({
      scale: scaleFromRatio(millimetresPerPixel(1)),
      rotationDeg: degrees(0),
      originMm: { x: millimetres(0), y: millimetres(0) },
    }),
  });

  it('recovers the fourteen deviations, worst first', () => {
    expect(measured.map((found) => found.deviationMm)).toEqual([
      41, 25, 21, 5, 4, 3, 3, 2, 2, 2, 1, 1, 1, 1,
    ]);
  });

  it('reaches the same three numbers the panel prints', () => {
    const metrics = summariseDeviations(measured, millimetres(20));

    expect(metrics.meanMm).toBe(8);
    expect(metrics.maxMm).toBe(41);
    expect(metrics.overToleranceCount).toBe(3);
    expect(metrics.regionCount).toBe(14);
  });

  it('falls to zero over regions when the tolerance relaxes to 50 mm', () => {
    expect(countOverTolerance(measured, millimetres(50))).toBe(0);
  });
});

describe('summariseDeviations', () => {
  it('reports an empty set as zero without pretending zero is a measurement', () => {
    const metrics = summariseDeviations([], millimetres(20));

    expect(metrics.meanMm).toBe(0);
    expect(metrics.maxMm).toBe(0);
    expect(metrics.overToleranceCount).toBe(0);
    expect(metrics.regionCount).toBe(0);
  });

  it('rounds a mean that does not divide evenly onto the domain’s own grid', () => {
    const metrics = summariseDeviations([region(1, 0), region(1, 1), region(2, 2)], millimetres(20));

    expect(metrics.meanMm).toBeCloseTo(1.333333, 6);
  });

  it('rejects a negative tolerance', () => {
    expect(() => summariseDeviations(REVIEWER_REGIONS, millimetres(-1))).toThrow(RangeError);
  });

  it('rejects a tolerance that is not finite', () => {
    expect(() =>
      summariseDeviations(REVIEWER_REGIONS, Number.POSITIVE_INFINITY as never),
    ).toThrow(RangeError);
  });
});

describe('countOverTolerance', () => {
  it('treats a region sitting exactly on the tolerance as within it', () => {
    expect(countOverTolerance([region(20, 0)], millimetres(20))).toBe(0);
    expect(countOverTolerance([region(20.001, 0)], millimetres(20))).toBe(1);
  });

  it('counts nothing in an empty set', () => {
    expect(countOverTolerance([], millimetres(20))).toBe(0);
  });

  it('counts every region at a tolerance of zero, except the ones sitting on it', () => {
    expect(countOverTolerance([region(0, 0), region(1, 1)], millimetres(0))).toBe(1);
  });

  it('rejects a negative tolerance', () => {
    expect(() => countOverTolerance(REVIEWER_REGIONS, millimetres(-1))).toThrow(RangeError);
  });
});
