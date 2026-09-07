import { describe, expect, it } from 'vitest';

import { nearlyEqual, nearlyEqualPoint, type PointMm } from '../../units/compare';
import { millimetresPerPixel, pixels, scaleFromRatio, type Scale } from '../../units/scale';
import { degrees, millimetres } from '../../units/types';
import {
  createOverlayTransform,
  imagePixelToModelMm,
  modelMmToImagePixel,
  type OverlayTransform,
  type PointPx,
} from '../transform';

function mm(x: number, y: number): PointMm {
  return { x: millimetres(x), y: millimetres(y) };
}

function px(x: number, y: number): PointPx {
  return { x: pixels(x), y: pixels(y) };
}

function transform(ratio: number, rotationDeg: number, origin: PointMm): OverlayTransform {
  return createOverlayTransform({
    scale: scaleFromRatio(millimetresPerPixel(ratio)),
    rotationDeg: degrees(rotationDeg),
    originMm: origin,
  });
}

/** Asserts a pixel coordinate without ever comparing two floats for equality. */
function expectPixel(actual: PointPx, expected: PointPx): void {
  expect(nearlyEqual(actual.x, expected.x)).toBe(true);
  expect(nearlyEqual(actual.y, expected.y)).toBe(true);
}

describe('createOverlayTransform', () => {
  it('carries the ratio of the M-02 scale through unchanged', () => {
    const built = transform(12.5, 0, mm(0, 0));

    expect(built.scale).toBe(12.5);
  });

  it('folds the angle into a single turn so two spellings of one placement agree', () => {
    expect(transform(1, -90, mm(0, 0)).rotationDeg).toBe(270);
    expect(transform(1, 450, mm(0, 0)).rotationDeg).toBe(90);
  });

  it('keeps an angle that is not a quarter turn, because a photographed sheet is not', () => {
    expect(transform(1, 1.5, mm(0, 0)).rotationDeg).toBeCloseTo(1.5, 6);
  });

  it('rejects a scale that is not a positive ratio', () => {
    const zeroRatio: Scale = {
      millimetresPerPixel: millimetresPerPixel(0),
      pixelsToMillimetres: () => millimetres(0),
      millimetresToPixels: () => pixels(0),
    };

    expect(() =>
      createOverlayTransform({
        scale: zeroRatio,
        rotationDeg: degrees(0),
        originMm: mm(0, 0),
      }),
    ).toThrow(RangeError);
  });

  it('rejects an origin that is not a finite length', () => {
    expect(() => transform(1, 0, { x: millimetres(0), y: Number.NaN as never })).toThrow(RangeError);
  });

  it('rejects an angle that is not finite', () => {
    expect(() => transform(1, Number.POSITIVE_INFINITY, mm(0, 0))).toThrow(RangeError);
  });
});

describe('imagePixelToModelMm', () => {
  it('is the identity for a 1 mm/px scan with no rotation at the origin', () => {
    const placed = imagePixelToModelMm(transform(1, 0, mm(0, 0)), px(300, 400));

    expect(nearlyEqualPoint(placed, mm(300, 400))).toBe(true);
  });

  it('multiplies by the scale before anything else', () => {
    const placed = imagePixelToModelMm(transform(4, 0, mm(0, 0)), px(300, 400));

    expect(nearlyEqualPoint(placed, mm(1200, 1600))).toBe(true);
  });

  it('rotates anticlockwise about the image origin', () => {
    const placed = imagePixelToModelMm(transform(1, 90, mm(0, 0)), px(1000, 0));

    expect(nearlyEqualPoint(placed, mm(0, 1000))).toBe(true);
  });

  it('moves the rotated image to where its origin belongs', () => {
    const placed = imagePixelToModelMm(transform(2, 180, mm(5000, 7000)), px(100, 50));

    expect(nearlyEqualPoint(placed, mm(4800, 6900))).toBe(true);
  });

  it('leaves the image origin sitting exactly on the transform origin', () => {
    const placed = imagePixelToModelMm(transform(3.25, 37, mm(1234, -567)), px(0, 0));

    expect(nearlyEqualPoint(placed, mm(1234, -567))).toBe(true);
  });

  it('preserves distance up to the scale, so the sheet is never stretched', () => {
    const placed = transform(2.5, 23, mm(900, -400));
    const first = imagePixelToModelMm(placed, px(0, 0));
    const second = imagePixelToModelMm(placed, px(300, 400));

    expect(Math.hypot(second.x - first.x, second.y - first.y)).toBeCloseTo(500 * 2.5, 6);
  });
});

describe('modelMmToImagePixel', () => {
  it('undoes the translation, the rotation and the scale', () => {
    const placed = modelMmToImagePixel(transform(2, 180, mm(5000, 7000)), mm(4800, 6900));

    expectPixel(placed, px(100, 50));
  });

  it('reports the image origin as pixel zero', () => {
    const placed = modelMmToImagePixel(transform(3.25, 37, mm(1234, -567)), mm(1234, -567));

    expectPixel(placed, px(0, 0));
  });
});

describe('the two conversions are exact inverses', () => {
  const placements: readonly (readonly [number, number, PointMm])[] = [
    [1, 0, mm(0, 0)],
    [12.5, 90, mm(0, 0)],
    [0.75, 180, mm(-2400, 900)],
    [3.4, 270, mm(15000, 15000)],
    [2.125, 1.5, mm(1234.5, -678.25)],
    [7.5, 213.75, mm(-9000, 4321)],
  ];

  const points: readonly PointPx[] = [px(0, 0), px(1, 0), px(0, 1), px(1920, 1080), px(-640, 480)];

  it('round-trips a pixel back onto itself', () => {
    for (const [ratio, rotationDeg, origin] of placements) {
      const placed = transform(ratio, rotationDeg, origin);
      for (const point of points) {
        expectPixel(modelMmToImagePixel(placed, imagePixelToModelMm(placed, point)), point);
      }
    }
  });

  it('round-trips a model coordinate back onto itself', () => {
    const coordinates: readonly PointMm[] = [
      mm(0, 0),
      mm(248600, 0),
      mm(-3200, 18400),
      mm(1.5, -2.25),
    ];

    for (const [ratio, rotationDeg, origin] of placements) {
      const placed = transform(ratio, rotationDeg, origin);
      for (const coordinate of coordinates) {
        const back = imagePixelToModelMm(placed, modelMmToImagePixel(placed, coordinate));
        expect(nearlyEqualPoint(back, coordinate)).toBe(true);
      }
    }
  });
});
