import { describe, expect, it } from 'vitest';

import type { LevelId } from '../../spatial/types';
import { millimetres } from '../../units/types';
import {
  MEASUREMENT_LABELS,
  createMeasurementNote,
  elevationOf,
  measureDistance,
  measurePointToPlane,
  type MeasurePoint,
  type Measurement,
} from '../measure';

const GROUND_LEVEL: LevelId = 'L-000001ABCD';

/** The floor: the plane through the datum, facing up. */
const UP = { x: 0, y: 0, z: 1 };

function point(x: number, y: number): MeasurePoint {
  return { x: millimetres(x), y: millimetres(y) };
}

function spacePoint(x: number, y: number, z: number): MeasurePoint {
  return { x: millimetres(x), y: millimetres(y), z: millimetres(z) };
}

/** Asserts a coordinate without ever comparing two floats for equality. */
function expectPoint(actual: MeasurePoint, expected: MeasurePoint): void {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
  expect(elevationOf(actual)).toBeCloseTo(elevationOf(expected), 6);
}

describe('measurePointToPlane', () => {
  it('measures the clearance from a point up to the floor it stands over', () => {
    const found = measurePointToPlane(spacePoint(0, 0, 3600), spacePoint(0, 0, 0), UP);

    expect(found?.kind).toBe('perpendicular');
    expect(found?.lengthMm).toBe(3600);
  });

  it('drops the foot of the perpendicular straight onto the plane', () => {
    const found = measurePointToPlane(spacePoint(1200, -800, 3600), spacePoint(0, 0, 0), UP);

    expect(found).not.toBeNull();
    expectPoint(found?.points[1] as MeasurePoint, spacePoint(1200, -800, 0));
  });

  it('keeps the picked point first, so the drawing knows which end is which', () => {
    const picked = spacePoint(1200, -800, 3600);
    const found = measurePointToPlane(picked, spacePoint(0, 0, 0), UP);

    expect(found?.points[0]).toBe(picked);
  });

  it('reports zero for a point sitting exactly on the plane', () => {
    const onThePlane = spacePoint(4500, 2500, 0);
    const found = measurePointToPlane(onThePlane, spacePoint(0, 0, 0), UP);

    expect(found?.lengthMm).toBe(0);
    expectPoint(found?.points[1] as MeasurePoint, onThePlane);
  });

  it('reads the same distance either side of the plane, and never a negative one', () => {
    const above = measurePointToPlane(spacePoint(0, 0, 1200), spacePoint(0, 0, 0), UP);
    const below = measurePointToPlane(spacePoint(0, 0, -1200), spacePoint(0, 0, 0), UP);

    expect(above?.lengthMm).toBe(1200);
    expect(below?.lengthMm).toBe(1200);
  });

  it('says which side the point stood on through the foot, not through the sign', () => {
    const below = measurePointToPlane(spacePoint(0, 0, -1200), spacePoint(0, 0, 2000), UP);

    expect(below).not.toBeNull();
    expectPoint(below?.points[1] as MeasurePoint, spacePoint(0, 0, 2000));
  });

  it('answers the same wherever on the surface the plane was picked', () => {
    const from = spacePoint(1200, -800, 3600);
    const nearby = measurePointToPlane(from, spacePoint(0, 0, 0), UP);
    const metresAway = measurePointToPlane(from, spacePoint(-9000, 15000, 0), UP);

    expect(nearby?.lengthMm).toBe(metresAway?.lengthMm);
  });

  it('measures square to a wall that is not square to the axes', () => {
    // The plane through the datum whose normal leans 45° between +x and +y.
    const found = measurePointToPlane(point(1000, 0), point(0, 0), { x: 1, y: 1, z: 0 });

    expect(found?.lengthMm).toBeCloseTo(Math.SQRT1_2 * 1000, 5);
    expectPoint(found?.points[1] as MeasurePoint, point(500, -500));
  });

  it('takes a normal of any length, because a fitted plane hands back no unit vector', () => {
    const unit = measurePointToPlane(spacePoint(0, 0, 3600), spacePoint(0, 0, 0), UP);
    const long = measurePointToPlane(spacePoint(0, 0, 3600), spacePoint(0, 0, 0), {
      x: 0,
      y: 0,
      z: 42,
    });

    expect(long?.lengthMm).toBe(unit?.lengthMm);
  });

  it('treats an absent elevation as the datum, exactly as a plan pick is meant to', () => {
    const found = measurePointToPlane(point(0, 2500), spacePoint(0, 0, 0), { x: 0, y: 1, z: 0 });

    expect(found?.lengthMm).toBe(2500);
  });

  it('reports a length the two returned points actually stand apart', () => {
    const found = measurePointToPlane(spacePoint(1200, -800, 3600), spacePoint(0, 0, 900), {
      x: 1,
      y: 2,
      z: 3,
    });

    expect(found).not.toBeNull();
    const [from, foot] = found?.points as readonly [MeasurePoint, MeasurePoint];
    expect(found?.lengthMm).toBeCloseTo(measureDistance(from, foot).lengthMm, 5);
  });

  it('has no answer for a normal of no length, because that names no plane', () => {
    expect(measurePointToPlane(spacePoint(0, 0, 3600), spacePoint(0, 0, 0), { x: 0, y: 0, z: 0 })).toBeNull();
  });

  it('has no answer for a normal too short to point anywhere', () => {
    expect(
      measurePointToPlane(spacePoint(0, 0, 3600), spacePoint(0, 0, 0), {
        x: 0,
        y: 0,
        z: 1e-9,
      }),
    ).toBeNull();
  });

  it('rounds the length the same way every other length in the module is rounded', () => {
    const found = measurePointToPlane(spacePoint(0, 0, 3000), spacePoint(0, 0, 0), {
      x: 1,
      y: 1,
      z: 1,
    });

    // 3000 / sqrt(3) is irrational, and the shared rounding is what cuts it to a
    // millionth of a millimetre instead of leaving the tail of the division on it.
    expect(found?.lengthMm).toBe(1732.050808);
  });

  it('is one of the measurements a note can be saved from', () => {
    const found = measurePointToPlane(spacePoint(0, 0, 3600), spacePoint(0, 0, 0), UP);

    expect(found).not.toBeNull();
    const measurement: Measurement = found as Measurement;
    const note = createMeasurementNote(measurement, { levelId: GROUND_LEVEL, sequence: 1 });

    expect(note.label).toBe(MEASUREMENT_LABELS.perpendicular);
  });

  it('names itself in Vietnamese, in sentence case like every other kind', () => {
    expect(MEASUREMENT_LABELS.perpendicular).toBe('Khoảng cách vuông góc tới bề mặt');
  });
});
