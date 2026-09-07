import { describe, expect, it } from 'vitest';

import type { DetectedAxis } from '../../axes/detect';
import type { AxisDirection, WallId } from '../../spatial/types';
import { nearlyEqualPoint, type PointMm } from '../../units/compare';
import { millimetresPerPixel, scaleFromRatio } from '../../units/scale';
import { degrees, millimetres } from '../../units/types';
import { compareDrawingToModel } from '../deviation';
import { createOverlayTransform, type OverlayTransform } from '../transform';

function mm(x: number, y: number): PointMm {
  return { x: millimetres(x), y: millimetres(y) };
}

function wallId(index: number): WallId {
  return `W-${String(index).padStart(4, '0')}`;
}

function axis(
  coordinate: number,
  wallIds: readonly WallId[],
  direction: AxisDirection = 'vertical',
): DetectedAxis {
  return {
    direction,
    coordinateMm: millimetres(coordinate),
    startMm: millimetres(0),
    endMm: millimetres(4000),
    spreadMm: millimetres(0),
    wallIds,
  };
}

/** A scan at 1 mm per pixel, square to the model, with its corner on the origin. */
function placedSquare(ratio = 1): OverlayTransform {
  return createOverlayTransform({
    scale: scaleFromRatio(millimetresPerPixel(ratio)),
    rotationDeg: degrees(0),
    originMm: mm(0, 0),
  });
}

describe('compareDrawingToModel', () => {
  it('measures the gap left between a drawing axis and the model axis it names', () => {
    const regions = compareDrawingToModel({
      drawingAxes: [axis(1041, [wallId(9)])],
      modelAxes: [axis(1000, [wallId(1), wallId(2)])],
      transform: placedSquare(),
    });

    expect(regions).toHaveLength(1);
    expect(regions[0]?.deviationMm).toBe(41);
  });

  it('keeps the two ends of the segment it measured, so the screen can draw it', () => {
    const regions = compareDrawingToModel({
      drawingAxes: [axis(1041, [wallId(9)])],
      modelAxes: [axis(1000, [wallId(1), wallId(2)])],
      transform: placedSquare(),
    });

    expect(nearlyEqualPoint(regions[0]?.fromMm ?? mm(0, 0), mm(1041, 2000))).toBe(true);
    expect(nearlyEqualPoint(regions[0]?.toMm ?? mm(0, 0), mm(1000, 2000))).toBe(true);
  });

  it('reports a deviation as a length, never as a signed offset', () => {
    const regions = compareDrawingToModel({
      drawingAxes: [axis(959, [wallId(9)])],
      modelAxes: [axis(1000, [wallId(1), wallId(2)])],
      transform: placedSquare(),
    });

    expect(regions[0]?.deviationMm).toBe(41);
  });

  it('measures a horizontal axis across its own direction', () => {
    const regions = compareDrawingToModel({
      drawingAxes: [axis(2025, [wallId(9)], 'horizontal')],
      modelAxes: [axis(2000, [wallId(1), wallId(2)], 'horizontal')],
      transform: placedSquare(),
    });

    expect(regions[0]?.deviationMm).toBe(25);
    expect(nearlyEqualPoint(regions[0]?.toMm ?? mm(0, 0), mm(2000, 2000))).toBe(true);
  });

  it('places the drawing through the transform before measuring anything', () => {
    const regions = compareDrawingToModel({
      // 520,5 px at 2 mm/px lands on 1041 mm, the same place as the 1 mm/px case.
      drawingAxes: [axis(520.5, [wallId(9)])],
      modelAxes: [axis(1000, [wallId(1), wallId(2)])],
      transform: placedSquare(2),
    });

    expect(regions[0]?.deviationMm).toBe(41);
  });

  it('quotes the axis code the grid generates, capitals intact', () => {
    const regions = compareDrawingToModel({
      drawingAxes: [axis(2005, [wallId(9)], 'horizontal')],
      modelAxes: [axis(2000, [wallId(1), wallId(2)], 'horizontal')],
      transform: placedSquare(),
    });

    expect(regions[0]?.reference).toBe('A');
  });

  it('quotes the name a person gave the axis instead of the generated one', () => {
    const regions = compareDrawingToModel({
      drawingAxes: [axis(1005, [wallId(9)])],
      modelAxes: [axis(1000, [wallId(1), wallId(2)])],
      transform: placedSquare(),
      labelOverrides: [
        { direction: 'vertical', coordinateMm: millimetres(1000), label: 'A-3' },
      ],
    });

    expect(regions[0]?.reference).toBe('A-3');
  });

  it('names the walls the deviation moves', () => {
    const regions = compareDrawingToModel({
      drawingAxes: [axis(1005, [wallId(9)])],
      modelAxes: [axis(1000, [wallId(1), wallId(2)])],
      transform: placedSquare(),
    });

    expect(regions[0]?.subjectIds).toEqual([wallId(1), wallId(2)]);
  });

  it('gives a region an id built from what it is about, not from where it landed', () => {
    const regions = compareDrawingToModel({
      drawingAxes: [axis(1005, [wallId(9)])],
      modelAxes: [axis(1000, [wallId(1), wallId(2)])],
      transform: placedSquare(),
    });

    expect(regions[0]?.id).toBe(`overlay-deviation-vertical-${wallId(1)}`);
  });

  it('pairs each drawing axis with the nearest model axis running the same way', () => {
    const regions = compareDrawingToModel({
      drawingAxes: [axis(6003, [wallId(8)]), axis(1002, [wallId(9)])],
      modelAxes: [axis(1000, [wallId(1), wallId(2)]), axis(6000, [wallId(3), wallId(4)])],
      transform: placedSquare(),
    });

    expect(regions.map((region) => region.reference)).toEqual(['2', '1']);
    expect(regions.map((region) => region.deviationMm)).toEqual([3, 2]);
  });

  it('never lets two drawing axes claim one model axis', () => {
    const regions = compareDrawingToModel({
      drawingAxes: [axis(1002, [wallId(8)]), axis(1004, [wallId(9)])],
      modelAxes: [axis(1000, [wallId(1), wallId(2)]), axis(6000, [wallId(3), wallId(4)])],
      transform: placedSquare(),
    });

    expect(regions).toHaveLength(2);
    expect(new Set(regions.map((region) => region.id)).size).toBe(2);
  });

  it('never pairs across directions', () => {
    const regions = compareDrawingToModel({
      drawingAxes: [axis(1002, [wallId(9)])],
      modelAxes: [axis(1000, [wallId(1), wallId(2)], 'horizontal')],
      transform: placedSquare(),
    });

    expect(regions).toEqual([]);
  });

  it('produces nothing for a drawing axis the model has no partner for', () => {
    const regions = compareDrawingToModel({
      drawingAxes: [axis(1002, [wallId(8)]), axis(6004, [wallId(9)])],
      modelAxes: [axis(1000, [wallId(1), wallId(2)])],
      transform: placedSquare(),
    });

    expect(regions).toHaveLength(1);
    expect(regions[0]?.deviationMm).toBe(2);
  });

  it('produces nothing at all when the model has no axes', () => {
    const regions = compareDrawingToModel({
      drawingAxes: [axis(1002, [wallId(9)])],
      modelAxes: [],
      transform: placedSquare(),
    });

    expect(regions).toEqual([]);
  });

  it('produces nothing for a model axis with no member walls to point at', () => {
    const regions = compareDrawingToModel({
      drawingAxes: [axis(1002, [wallId(9)])],
      modelAxes: [axis(1000, [])],
      transform: placedSquare(),
    });

    expect(regions).toEqual([]);
  });

  it('reads the same input the same way twice', () => {
    const input = {
      drawingAxes: [axis(1002, [wallId(8)]), axis(6003, [wallId(9)])],
      modelAxes: [axis(1000, [wallId(1), wallId(2)]), axis(6000, [wallId(3), wallId(4)])],
      transform: placedSquare(),
    };

    expect(compareDrawingToModel(input)).toEqual(compareDrawingToModel(input));
  });
});

describe('ordering', () => {
  it('puts the worst region first', () => {
    const regions = compareDrawingToModel({
      drawingAxes: [axis(1002, [wallId(7)]), axis(6041, [wallId(8)]), axis(11021, [wallId(9)])],
      modelAxes: [
        axis(1000, [wallId(1), wallId(2)]),
        axis(6000, [wallId(3), wallId(4)]),
        axis(11000, [wallId(5), wallId(6)]),
      ],
      transform: placedSquare(),
    });

    expect(regions.map((region) => region.deviationMm)).toEqual([41, 21, 2]);
  });

  it('breaks a tie on the id, so equal regions never swap between two renders', () => {
    const regions = compareDrawingToModel({
      drawingAxes: [axis(11001, [wallId(7)]), axis(1001, [wallId(8)]), axis(6001, [wallId(9)])],
      modelAxes: [
        axis(11000, [wallId(5), wallId(6)]),
        axis(1000, [wallId(1), wallId(2)]),
        axis(6000, [wallId(3), wallId(4)]),
      ],
      transform: placedSquare(),
    });

    expect(regions.map((region) => region.deviationMm)).toEqual([1, 1, 1]);
    expect(regions.map((region) => region.id)).toEqual([
      `overlay-deviation-vertical-${wallId(1)}`,
      `overlay-deviation-vertical-${wallId(3)}`,
      `overlay-deviation-vertical-${wallId(5)}`,
    ]);
  });
});
