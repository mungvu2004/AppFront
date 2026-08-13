import { describe, expect, it } from 'vitest';

import type { LevelId } from '../../spatial/types';
import { millimetres } from '../../units/types';
import {
  DIRECTION_LOCK_STEP_DEG,
  ORTHOGONAL_LOCK_STEP_DEG,
  lockDirection,
  shouldLockDirection,
} from '../constraints';
import {
  MEASUREMENT_LABELS,
  MEASUREMENT_NOTE_PREFIX,
  appendMeasurementNote,
  clearMeasurementNotes,
  createMeasurementNote,
  createMeasurementNoteId,
  elevationOf,
  measureAngle,
  measureChain,
  measureDistance,
  measureHeight,
  measurePolygonArea,
  readMeasurementNoteSequence,
  type MeasurePoint,
  type MeasurementNote,
} from '../measure';

const GROUND_LEVEL: LevelId = 'L-000001ABCD';
const FIRST_LEVEL: LevelId = 'L-000002ABCD';

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

describe('measureDistance', () => {
  it('measures a plan pick with no elevation', () => {
    expect(measureDistance(point(0, 0), point(3000, 4000)).lengthMm).toBe(5000);
  });

  it('measures through the vertical axis as well', () => {
    expect(measureDistance(spacePoint(0, 0, 0), spacePoint(3000, 4000, 12000)).lengthMm).toBe(13000);
  });

  it('treats an absent elevation as the datum', () => {
    expect(measureDistance(point(0, 0), spacePoint(0, 0, 3600)).lengthMm).toBe(3600);
  });

  it('reports zero for two coincident picks', () => {
    expect(measureDistance(point(1200, 800), point(1200, 800)).lengthMm).toBe(0);
  });

  it('does not depend on the order of the two picks', () => {
    const forward = measureDistance(point(0, 0), point(1234, 5678)).lengthMm;
    const backward = measureDistance(point(1234, 5678), point(0, 0)).lengthMm;
    expect(forward).toBe(backward);
  });

  it('keeps the picked points on the result', () => {
    const measurement = measureDistance(point(0, 0), point(48, 21));
    expect(measurement.points).toEqual([point(0, 0), point(48, 21)]);
    expect(measurement.kind).toBe('distance');
  });
});

describe('measureChain', () => {
  it('returns every leg and their total for a chain of four points', () => {
    const measurement = measureChain([
      point(0, 0),
      point(3000, 0),
      point(3000, 4000),
      point(0, 4000),
    ]);

    expect(measurement).not.toBeNull();
    expect(measurement?.segmentsMm).toEqual([3000, 4000, 3000]);
    expect(measurement?.totalMm).toBe(10000);
  });

  it('reports a total that is exactly the sum of the legs it reports', () => {
    const measurement = measureChain([point(0, 0), point(1500, 2200), point(4800, 700)]);
    const sum = (measurement?.segmentsMm ?? []).reduce((total, leg) => total + leg, 0);
    expect(measurement?.totalMm).toBe(sum);
  });

  it('measures a chain that climbs between levels', () => {
    const measurement = measureChain([
      spacePoint(0, 0, 0),
      spacePoint(0, 0, 3600),
      spacePoint(0, 4000, 3600),
    ]);

    expect(measurement?.segmentsMm).toEqual([3600, 4000]);
    expect(measurement?.totalMm).toBe(7600);
  });

  it('refuses a chain of one point', () => {
    expect(measureChain([point(0, 0)])).toBeNull();
  });

  it('refuses an empty chain', () => {
    expect(measureChain([])).toBeNull();
  });
});

describe('measureAngle', () => {
  it('measures a square corner on the plan', () => {
    const measurement = measureAngle(point(1000, 0), point(0, 0), point(0, 1000));
    expect(measurement?.angleDeg).toBe(90);
    expect(measurement?.reflexDeg).toBe(270);
    expect(measurement?.armsMm).toEqual([1000, 1000]);
  });

  it('measures a square corner picked in three dimensions', () => {
    const measurement = measureAngle(
      spacePoint(1000, 0, 0),
      spacePoint(0, 0, 0),
      spacePoint(0, 0, 1000),
    );
    expect(measurement?.angleDeg).toBe(90);
  });

  it('measures a straight run as half a turn', () => {
    const measurement = measureAngle(point(-2000, 0), point(0, 0), point(3000, 0));
    expect(measurement?.angleDeg).toBe(180);
    expect(measurement?.reflexDeg).toBe(180);
  });

  it('measures two arms lying on top of each other as nothing', () => {
    const measurement = measureAngle(point(2000, 0), point(0, 0), point(3000, 0));
    expect(measurement?.angleDeg).toBe(0);
  });

  it('reads the same angle from either side of the corner', () => {
    const clockwise = measureAngle(point(1000, 0), point(0, 0), point(700, 700));
    const anticlockwise = measureAngle(point(700, 700), point(0, 0), point(1000, 0));
    expect(clockwise?.angleDeg).toBe(anticlockwise?.angleDeg);
  });

  it('refuses an arm with no length', () => {
    expect(measureAngle(point(0, 0), point(0, 0), point(1000, 0))).toBeNull();
    expect(measureAngle(point(1000, 0), point(0, 0), point(0, 0))).toBeNull();
  });
});

describe('measurePolygonArea', () => {
  it('measures the standard floor plate', () => {
    const measurement = measurePolygonArea([
      point(0, 0),
      point(20000, 0),
      point(20000, 12430),
      point(0, 12430),
    ]);

    expect(measurement?.areaMm2).toBe(248_600_000);
    expect(measurement?.areaM2).toBe(248.6);
    expect(measurement?.perimeterMm).toBe(64860);
  });

  it('gives the same area whichever way round the ring was drawn', () => {
    const clockwise = measurePolygonArea([point(0, 0), point(0, 4000), point(3000, 4000)]);
    const anticlockwise = measurePolygonArea([point(0, 0), point(3000, 4000), point(0, 4000)]);
    expect(clockwise?.areaMm2).toBe(anticlockwise?.areaMm2);
    expect(clockwise?.areaMm2).toBe(6_000_000);
  });

  it('measures a ring lifted off the datum without shrinking it', () => {
    const measurement = measurePolygonArea([
      spacePoint(0, 0, 3600),
      spacePoint(20000, 0, 3600),
      spacePoint(20000, 12430, 3600),
      spacePoint(0, 12430, 3600),
    ]);

    expect(measurement?.areaM2).toBe(248.6);
  });

  it('measures a ring standing on its edge at its true size', () => {
    const measurement = measurePolygonArea([
      spacePoint(0, 0, 0),
      spacePoint(4000, 0, 0),
      spacePoint(4000, 0, 3000),
      spacePoint(0, 0, 3000),
    ]);

    expect(measurement?.areaMm2).toBe(12_000_000);
  });

  it('measures three points in a row as no area', () => {
    expect(measurePolygonArea([point(0, 0), point(1000, 0), point(2000, 0)])?.areaMm2).toBe(0);
  });

  it('refuses a ring of two points', () => {
    expect(measurePolygonArea([point(0, 0), point(1000, 0)])).toBeNull();
  });
});

describe('measureHeight', () => {
  it('measures a floor-to-floor rise', () => {
    const measurement = measureHeight(spacePoint(0, 0, 0), spacePoint(0, 0, 3600));
    expect(measurement.heightMm).toBe(3600);
    expect(measurement.riseMm).toBe(3600);
    expect(measurement.planDistanceMm).toBe(0);
  });

  it('signs a drop and reports the same height', () => {
    const measurement = measureHeight(spacePoint(0, 0, 3600), spacePoint(0, 0, 0));
    expect(measurement.heightMm).toBe(3600);
    expect(measurement.riseMm).toBe(-3600);
  });

  it('ignores how far apart the picks are on the floor but reports that gap', () => {
    const measurement = measureHeight(spacePoint(0, 0, 0), spacePoint(3000, 4000, 2400));
    expect(measurement.heightMm).toBe(2400);
    expect(measurement.planDistanceMm).toBe(5000);
  });

  it('reads two plan picks as level with each other', () => {
    const measurement = measureHeight(point(0, 0), point(4000, 0));
    expect(measurement.heightMm).toBe(0);
    expect(measurement.riseMm).toBe(0);
  });
});

describe('shouldLockDirection', () => {
  it('locks while Shift is held', () => {
    expect(shouldLockDirection({ shiftKey: true })).toBe(true);
  });

  it('does not lock otherwise', () => {
    expect(shouldLockDirection({ shiftKey: false })).toBe(false);
  });
});

describe('lockDirection', () => {
  it('pulls a point three degrees off horizontal back onto horizontal', () => {
    const strayAngle = (3 / 180) * Math.PI;
    const stray = point(5000 * Math.cos(strayAngle), 5000 * Math.sin(strayAngle));

    const result = lockDirection(point(0, 0), stray);

    expect(result.locked).toBe(true);
    expect(result.direction).toBe('horizontal');
    expect(result.headingDeg).toBe(0);
    expect(result.point.y).toBe(0);
    expect(result.point.x).toBeCloseTo(5000 * Math.cos(strayAngle), 6);
  });

  it('pulls a point three degrees off vertical back onto vertical', () => {
    const strayAngle = ((90 - 3) / 180) * Math.PI;
    const stray = point(5000 * Math.cos(strayAngle), 5000 * Math.sin(strayAngle));

    const result = lockDirection(point(0, 0), stray);

    expect(result.direction).toBe('vertical');
    expect(result.headingDeg).toBe(90);
    expect(result.point.x).toBe(0);
  });

  it('locks a point near the diagonal onto exactly forty-five degrees', () => {
    const result = lockDirection(point(0, 0), point(1000, 900));

    expect(result.direction).toBe('diagonal');
    expect(result.headingDeg).toBe(45);
    expect(result.point.x).toBeCloseTo(result.point.y, 6);
  });

  it('keeps the point where it is when it already lies on a heading', () => {
    const anchor = point(1000, 2000);
    const onHeading = point(6000, 2000);

    const result = lockDirection(anchor, onHeading);

    expectPoint(result.point, onHeading);
    expect(result.correctionMm).toBe(0);
  });

  it('reports how far the point had to move', () => {
    const result = lockDirection(point(0, 0), point(5000, 300));
    expect(result.correctionMm).toBe(300);
  });

  it('locks the far heading rather than reflecting the point', () => {
    const result = lockDirection(point(0, 0), point(-5000, 300));

    expect(result.headingDeg).toBe(180);
    expect(result.point.x).toBe(-5000);
    expect(result.point.y).toBe(0);
  });

  it('leaves the point untouched when the lock is off', () => {
    const stray = point(5000, 300);
    const result = lockDirection(point(0, 0), stray, { enabled: false });

    expect(result.locked).toBe(false);
    expect(result.direction).toBeNull();
    expect(result.headingDeg).toBeNull();
    expect(result.point).toBe(stray);
  });

  it('drops the diagonals when only the two axes are allowed', () => {
    const result = lockDirection(point(0, 0), point(1000, 900), { allowDiagonal: false });

    expect(result.direction).toBe('horizontal');
    expect(result.point.y).toBe(0);
  });

  it('locks the elevation plane so a vertical measurement changes level only', () => {
    const result = lockDirection(spacePoint(0, 0, 0), spacePoint(120, 0, 3600), { plane: 'xz' });

    expect(result.direction).toBe('vertical');
    expect(result.point.x).toBe(0);
    expect(elevationOf(result.point)).toBe(3600);
  });

  it('locks the other elevation plane the same way', () => {
    const result = lockDirection(spacePoint(0, 0, 0), spacePoint(0, 4000, 90), { plane: 'yz' });

    expect(result.direction).toBe('horizontal');
    expect(result.point.y).toBe(4000);
    expect(elevationOf(result.point)).toBe(0);
  });

  it('keeps a plan measurement in the plane of its anchor', () => {
    const result = lockDirection(spacePoint(0, 0, 3600), spacePoint(5000, 40, 3900));
    expect(elevationOf(result.point)).toBe(3600);
  });

  it('leaves a plan pick without an elevation', () => {
    const result = lockDirection(point(0, 0), point(5000, 300));
    expect(result.point.z).toBeUndefined();
  });

  it('has no heading to lock to while the point sits on the anchor', () => {
    const result = lockDirection(point(1000, 1000), point(1000, 1000));

    expect(result.locked).toBe(false);
    expect(result.direction).toBeNull();
    expect(result.correctionMm).toBe(0);
  });

  it('steps by forty-five degrees, or by ninety without the diagonals', () => {
    expect(DIRECTION_LOCK_STEP_DEG).toBe(45);
    expect(ORTHOGONAL_LOCK_STEP_DEG).toBe(90);
  });

  it('measures a locked chain leg at its projected length', () => {
    const anchor = point(0, 0);
    const locked = lockDirection(anchor, point(5000, 300));
    expect(measureDistance(anchor, locked.point).lengthMm).toBe(5000);
  });
});

describe('measurement note ids', () => {
  it('pads the sequence so the codes sort as they were made', () => {
    expect(createMeasurementNoteId(1)).toBe(`${MEASUREMENT_NOTE_PREFIX}-0001`);
    expect(createMeasurementNoteId(48)).toBe(`${MEASUREMENT_NOTE_PREFIX}-0048`);
    expect(createMeasurementNoteId(12345)).toBe(`${MEASUREMENT_NOTE_PREFIX}-12345`);
  });

  it('refuses a sequence that is not a counting number', () => {
    expect(() => createMeasurementNoteId(0)).toThrow(RangeError);
    expect(() => createMeasurementNoteId(-1)).toThrow(RangeError);
    expect(() => createMeasurementNoteId(1.5)).toThrow(RangeError);
  });

  it('reads the sequence back out of an id', () => {
    expect(readMeasurementNoteSequence('MS-0021')).toBe(21);
  });

  it('reads nothing out of an id from the spatial graph', () => {
    expect(readMeasurementNoteSequence('M-000001ABCD')).toBeNull();
    expect(readMeasurementNoteSequence('MS-')).toBeNull();
    expect(readMeasurementNoteSequence('')).toBeNull();
  });
});

describe('measurement notes', () => {
  const distance = measureDistance(point(0, 0), point(3000, 4000));

  it('saves a measurement with its code, its Vietnamese name and its level', () => {
    const note = createMeasurementNote(distance, { levelId: GROUND_LEVEL, sequence: 1 });

    expect(note.id).toBe('MS-0001');
    expect(note.label).toBe(MEASUREMENT_LABELS.distance);
    expect(note.levelId).toBe(GROUND_LEVEL);
    expect(note.measurement).toBe(distance);
  });

  it('names each kind of measurement in Vietnamese', () => {
    const chain = measureChain([point(0, 0), point(1000, 0), point(1000, 1000)]);
    const angle = measureAngle(point(1000, 0), point(0, 0), point(0, 1000));
    const area = measurePolygonArea([point(0, 0), point(1000, 0), point(1000, 1000)]);
    const height = measureHeight(spacePoint(0, 0, 0), spacePoint(0, 0, 3600));

    if (chain === null || angle === null || area === null) {
      throw new Error('The sample measurements are all valid by construction.');
    }

    const notes = [chain, angle, area, height].map((measurement, index) =>
      createMeasurementNote(measurement, { levelId: GROUND_LEVEL, sequence: index + 1 }),
    );

    expect(notes.map((note) => note.label)).toEqual([
      MEASUREMENT_LABELS.chain,
      MEASUREMENT_LABELS.angle,
      MEASUREMENT_LABELS.area,
      MEASUREMENT_LABELS.height,
    ]);
  });

  it('takes a name of its own when one is given', () => {
    const note = createMeasurementNote(distance, {
      levelId: GROUND_LEVEL,
      sequence: 2,
      label: 'Kiểm tra lại trục A',
    });

    expect(note.label).toBe('Kiểm tra lại trục A');
  });

  it('gives the same note for the same arguments every time', () => {
    const first = createMeasurementNote(distance, { levelId: GROUND_LEVEL, sequence: 4 });
    const second = createMeasurementNote(distance, { levelId: GROUND_LEVEL, sequence: 4 });
    expect(first).toEqual(second);
  });

  it('numbers appended notes one after another', () => {
    const afterFirst = appendMeasurementNote([], distance, { levelId: GROUND_LEVEL });
    const afterSecond = appendMeasurementNote(afterFirst, distance, { levelId: FIRST_LEVEL });

    expect(afterSecond.map((note) => note.id)).toEqual(['MS-0001', 'MS-0002']);
    expect(afterSecond.map((note) => note.levelId)).toEqual([GROUND_LEVEL, FIRST_LEVEL]);
  });

  it('does not touch the list it was given', () => {
    const before: readonly MeasurementNote[] = [];
    const after = appendMeasurementNote(before, distance, { levelId: GROUND_LEVEL });

    expect(before).toHaveLength(0);
    expect(after).toHaveLength(1);
  });

  it('never reuses a code after a note was deleted', () => {
    const three = [1, 2, 3].map((sequence) =>
      createMeasurementNote(distance, { levelId: GROUND_LEVEL, sequence }),
    );
    const withoutTheLast = three.slice(0, 2);
    const reopened = appendMeasurementNote(three.slice(1), distance, { levelId: GROUND_LEVEL });

    expect(withoutTheLast.map((note) => note.id)).toEqual(['MS-0001', 'MS-0002']);
    expect(reopened.map((note) => note.id)).toEqual(['MS-0002', 'MS-0003', 'MS-0004']);
  });

  it('throws every saved measurement away at once', () => {
    const saved = appendMeasurementNote([], distance, { levelId: GROUND_LEVEL });
    expect(saved).toHaveLength(1);
    expect(clearMeasurementNotes()).toHaveLength(0);
  });
});
