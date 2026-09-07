import { describe, expect, it } from 'vitest';

import { millimetresPerPixel, pixels, scaleFromRatio } from '../../units/scale';
import { degrees, millimetres } from '../../units/types';
import {
  compareDrawingToModel,
  countOverTolerance,
  createOverlayTransform,
  imagePixelToModelMm,
  modelMmToImagePixel,
  summariseDeviations,
} from '..';

/**
 * The barrel is what `overlayComparisonGateway.ts` imports, so the names on it
 * are as much a contract as the shapes behind them. A rename that only fixed the
 * three modules would leave the gateway importing something that no longer
 * exists, and nothing else in this folder would notice.
 */
describe('the public surface', () => {
  it('offers the whole pipeline through one entry point', () => {
    const transform = createOverlayTransform({
      scale: scaleFromRatio(millimetresPerPixel(1)),
      rotationDeg: degrees(0),
      originMm: { x: millimetres(0), y: millimetres(0) },
    });

    const regions = compareDrawingToModel({
      drawingAxes: [
        {
          direction: 'vertical',
          coordinateMm: millimetres(1041),
          startMm: millimetres(0),
          endMm: millimetres(4000),
          spreadMm: millimetres(0),
          wallIds: ['W-0009'],
        },
      ],
      modelAxes: [
        {
          direction: 'vertical',
          coordinateMm: millimetres(1000),
          startMm: millimetres(0),
          endMm: millimetres(4000),
          spreadMm: millimetres(0),
          wallIds: ['W-0001', 'W-0002'],
        },
      ],
      transform,
    });

    expect(summariseDeviations(regions, millimetres(20))).toEqual({
      meanMm: 41,
      maxMm: 41,
      overToleranceCount: 1,
      regionCount: 1,
    });
    expect(countOverTolerance(regions, millimetres(50))).toBe(0);
    const corner = { x: pixels(320), y: pixels(240) };
    expect(modelMmToImagePixel(transform, imagePixelToModelMm(transform, corner))).toEqual(corner);
  });
});
