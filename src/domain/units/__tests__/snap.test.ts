import { describe, expect, it } from 'vitest';

import {
  compareNearly,
  DEFAULT_EPSILON,
  isNearlyZero,
  nearlyEqual,
  nearlyEqualAngle,
  nearlyEqualLength,
  nearlyEqualPoint,
  type PointMm,
} from '../compare';
import {
  distanceBetween,
  perpendicularFoot,
  snapAngle,
  SNAP_PRIORITY,
  SNAP_THRESHOLDS,
  snapToGrid,
  snapToTargets,
  type AnchorKind,
  type SnapTarget,
} from '../snap';
import { degrees, millimetres } from '../types';

function point(x: number, y: number): PointMm {
  return { x: millimetres(x), y: millimetres(y) };
}

function anchor(kind: AnchorKind, id: string, x: number, y: number): SnapTarget {
  return { kind, id, position: point(x, y) };
}

function wallRun(id: string, from: PointMm, to: PointMm): SnapTarget {
  return { kind: 'perpendicular', id, segment: { start: from, end: to } };
}

/** Asserts a coordinate without ever comparing two floats for equality. */
function expectPoint(actual: PointMm, expected: PointMm): void {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
}

describe('nearlyEqual', () => {
  it('accepts a difference below the tolerance', () => {
    expect(nearlyEqual(1, 1.0005)).toBe(true);
  });

  it('rejects a difference above the tolerance', () => {
    expect(nearlyEqual(1, 1.002)).toBe(false);
  });

  it('accepts a difference sitting exactly on the tolerance', () => {
    expect(nearlyEqual(1, 1 + DEFAULT_EPSILON)).toBe(true);
  });

  it('honours a tolerance given by the caller', () => {
    expect(nearlyEqual(1, 1.4, 0.5)).toBe(true);
    expect(nearlyEqual(1, 1.4, 0.1)).toBe(false);
  });

  it('treats a negative tolerance as its magnitude', () => {
    expect(nearlyEqual(1, 1.4, -0.5)).toBe(true);
  });

  it('never equates values that are not finite', () => {
    expect(nearlyEqual(Number.NaN, Number.NaN)).toBe(false);
    expect(nearlyEqual(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('survives the classic floating point sum', () => {
    expect(nearlyEqual(0.1 + 0.2, 0.3)).toBe(true);
  });

  it('recognises a value indistinguishable from zero', () => {
    expect(isNearlyZero(0.0001)).toBe(true);
    expect(isNearlyZero(0.01)).toBe(false);
  });

  it('compares lengths as labelled quantities', () => {
    expect(nearlyEqualLength(millimetres(2745), millimetres(2745.0004))).toBe(true);
    expect(nearlyEqualLength(millimetres(2745), millimetres(2745.5))).toBe(false);
  });

  it('orders values while treating near equals as equal', () => {
    expect(compareNearly(1, 2)).toBe(-1);
    expect(compareNearly(2, 1)).toBe(1);
    expect(compareNearly(1, 1.0005)).toBe(0);
  });
});

describe('nearlyEqualPoint', () => {
  it('accepts a corner reached by two different routes', () => {
    expect(nearlyEqualPoint(point(4800, 2400), point(4800.0004, 2399.9997))).toBe(true);
  });

  it('rejects a difference on either axis alone', () => {
    expect(nearlyEqualPoint(point(4800, 2400), point(4800.5, 2400))).toBe(false);
    expect(nearlyEqualPoint(point(4800, 2400), point(4800, 2400.5))).toBe(false);
  });

  it('honours a tolerance given by the caller', () => {
    expect(nearlyEqualPoint(point(0, 0), point(0.4, 0.4), millimetres(0.5))).toBe(true);
  });
});

describe('nearlyEqualAngle', () => {
  it('folds a gap across the full turn', () => {
    expect(nearlyEqualAngle(degrees(359.9995), degrees(0))).toBe(true);
    expect(nearlyEqualAngle(degrees(720), degrees(0))).toBe(true);
  });

  it('still separates genuinely different headings', () => {
    expect(nearlyEqualAngle(degrees(0), degrees(1))).toBe(false);
    expect(nearlyEqualAngle(degrees(90), degrees(270))).toBe(false);
  });
});

describe('snapToGrid', () => {
  it('rounds both axes onto the default 50 mm pitch', () => {
    expectPoint(snapToGrid(point(123, 78)), point(100, 100));
    expectPoint(snapToGrid(point(-123, -78)), point(-100, -100));
  });

  it('takes a pitch from the caller', () => {
    expectPoint(snapToGrid(point(123, 78), millimetres(10)), point(120, 80));
  });

  it('returns the point untouched when switched off', () => {
    const cursor = point(123.4, 67.8);

    expectPoint(snapToGrid(cursor, SNAP_THRESHOLDS.gridStepMm, false), cursor);
  });

  it('leaves an already snapped point where it is', () => {
    const once = snapToGrid(point(123, 78));

    expectPoint(snapToGrid(once), once);
  });

  it('refuses a pitch that is not positive', () => {
    expect(() => snapToGrid(point(10, 10), millimetres(0))).toThrow(RangeError);
  });
});

describe('snapAngle', () => {
  it('rounds onto the default 15 degree pitch', () => {
    expect(snapAngle(degrees(17))).toBeCloseTo(15, 6);
    expect(snapAngle(degrees(23))).toBeCloseTo(30, 6);
    expect(snapAngle(degrees(7))).toBeCloseTo(0, 6);
  });

  it('folds the result into a single turn', () => {
    expect(snapAngle(degrees(358))).toBeCloseTo(0, 6);
    expect(snapAngle(degrees(352))).toBeCloseTo(345, 6);
    expect(snapAngle(degrees(-7))).toBeCloseTo(0, 6);
    expect(snapAngle(degrees(-100))).toBeCloseTo(255, 6);
  });

  it('takes a pitch from the caller', () => {
    expect(snapAngle(degrees(17), degrees(45))).toBeCloseTo(0, 6);
    expect(snapAngle(degrees(30), degrees(45))).toBeCloseTo(45, 6);
  });

  it('returns the angle untouched when switched off', () => {
    expect(snapAngle(degrees(17.4), SNAP_THRESHOLDS.angleStepDeg, false)).toBeCloseTo(17.4, 6);
  });

  it('leaves an already snapped angle where it is', () => {
    expect(snapAngle(snapAngle(degrees(17)))).toBeCloseTo(15, 6);
  });

  it('refuses a pitch that is not positive', () => {
    expect(() => snapAngle(degrees(17), degrees(0))).toThrow(RangeError);
  });
});

describe('perpendicularFoot', () => {
  it('drops onto the wall run', () => {
    const foot = perpendicularFoot(point(20, 30), { start: point(-100, 0), end: point(100, 0) });

    expect(foot).not.toBeNull();
    if (foot !== null) {
      expectPoint(foot, point(20, 0));
    }
  });

  it('gives nothing when the foot falls past the end of the wall', () => {
    expect(perpendicularFoot(point(200, 10), { start: point(-100, 0), end: point(100, 0) })).toBeNull();
  });

  it('gives nothing for a wall run with no length', () => {
    expect(perpendicularFoot(point(20, 30), { start: point(0, 0), end: point(0, 0) })).toBeNull();
  });
});

describe('snapToTargets', () => {
  it('prefers a wall vertex 100 mm away over a grid node 20 mm away', () => {
    const cursor = point(120, 0);
    const vertex = anchor('wallVertex', 'W-001', 20, 0);

    const result = snapToTargets(cursor, [vertex]);

    // The grid node at (100, 0) is five times closer and still loses.
    expect(distanceBetween(cursor, snapToGrid(cursor))).toBeCloseTo(20, 6);
    expect(result.kind).toBe('wallVertex');
    expect(result.targetId).toBe('W-001');
    expect(result.snapped).toBe(true);
    expect(result.distanceMm).toBeCloseTo(100, 6);
    expectPoint(result.point, point(20, 0));
  });

  it('keeps the original coordinates when grid snapping is off and nothing else is in reach', () => {
    const cursor = point(123.4, 67.8);

    const result = snapToTargets(cursor, [], { gridEnabled: false });

    expect(result.snapped).toBe(false);
    expect(result.kind).toBeNull();
    expect(result.targetId).toBeNull();
    expectPoint(result.point, cursor);
  });

  it('keeps the original coordinates when the grid is switched off by kind', () => {
    const cursor = point(123.4, 67.8);

    const result = snapToTargets(cursor, [], { disabledKinds: ['grid'] });

    expect(result.snapped).toBe(false);
    expectPoint(result.point, cursor);
  });

  describe('priority order', () => {
    // Deliberately arranged so that every weaker kind is closer than every
    // stronger one: the winner can only come from the priority rule.
    const cursor = point(20, 0);
    const targets: readonly SnapTarget[] = [
      anchor('wallVertex', 'W-001', 20, -110),
      anchor('intersection', 'X-001', 20, 80),
      anchor('midpoint', 'D-001', 20, -50),
      wallRun('W-002', point(-100, 30), point(100, 30)),
    ];

    it('lists the kinds strongest first', () => {
      expect(SNAP_PRIORITY).toEqual([
        'wallVertex',
        'intersection',
        'midpoint',
        'perpendicular',
        'grid',
      ]);
    });

    it('takes the wall vertex even though it is the furthest', () => {
      const result = snapToTargets(cursor, targets);

      expect(result.kind).toBe('wallVertex');
      expect(result.distanceMm).toBeCloseTo(110, 6);
    });

    it('falls to the intersection once vertices are off', () => {
      const result = snapToTargets(cursor, targets, { disabledKinds: ['wallVertex'] });

      expect(result.kind).toBe('intersection');
      expect(result.distanceMm).toBeCloseTo(80, 6);
    });

    it('falls to the midpoint next', () => {
      const result = snapToTargets(cursor, targets, {
        disabledKinds: ['wallVertex', 'intersection'],
      });

      expect(result.kind).toBe('midpoint');
      expect(result.distanceMm).toBeCloseTo(50, 6);
    });

    it('falls to the perpendicular foot next', () => {
      const result = snapToTargets(cursor, targets, {
        disabledKinds: ['wallVertex', 'intersection', 'midpoint'],
      });

      expect(result.kind).toBe('perpendicular');
      expect(result.targetId).toBe('W-002');
      expectPoint(result.point, point(20, 30));
    });

    it('falls to the grid last', () => {
      const result = snapToTargets(cursor, targets, {
        disabledKinds: ['wallVertex', 'intersection', 'midpoint', 'perpendicular'],
      });

      expect(result.kind).toBe('grid');
      expect(result.targetId).toBeNull();
      expectPoint(result.point, point(0, 0));
    });

    it('keeps the point where it is once every kind is off', () => {
      const result = snapToTargets(cursor, targets, { disabledKinds: SNAP_PRIORITY });

      expect(result.snapped).toBe(false);
      expectPoint(result.point, cursor);
    });
  });

  it('returns exactly one target, never a list', () => {
    const result = snapToTargets(point(0, 0), [
      anchor('wallVertex', 'W-001', 10, 0),
      anchor('wallVertex', 'W-002', 20, 0),
      anchor('intersection', 'X-001', 5, 0),
    ]);

    expect(result.targetId).toBe('W-001');
    expect(Array.isArray(result.point)).toBe(false);
  });

  it('lets distance decide inside one kind', () => {
    const result = snapToTargets(point(0, 0), [
      anchor('wallVertex', 'W-001', 90, 0),
      anchor('wallVertex', 'W-002', 40, 0),
    ]);

    expect(result.targetId).toBe('W-002');
    expect(result.distanceMm).toBeCloseTo(40, 6);
  });

  it('breaks a tie the same way whichever order the targets arrive in', () => {
    const first = anchor('wallVertex', 'W-002', 0, 60);
    const second = anchor('wallVertex', 'W-001', 60, 0);

    const forwards = snapToTargets(point(0, 0), [first, second]);
    const backwards = snapToTargets(point(0, 0), [second, first]);

    expect(forwards.targetId).toBe('W-001');
    expect(backwards.targetId).toBe('W-001');
  });

  it('ignores anything beyond the capture radius', () => {
    const result = snapToTargets(point(0, 0), [anchor('wallVertex', 'W-001', 300, 0)], {
      gridEnabled: false,
    });

    expect(result.snapped).toBe(false);
  });

  it('takes a capture radius from the caller', () => {
    const targets = [anchor('wallVertex', 'W-001', 300, 0)];

    expect(snapToTargets(point(0, 0), targets, { gridEnabled: false }).snapped).toBe(false);
    expect(
      snapToTargets(point(0, 0), targets, { gridEnabled: false, captureRadiusMm: millimetres(400) })
        .snapped,
    ).toBe(true);
  });

  it('will not let a coarse grid drag the cursor across the drawing', () => {
    const result = snapToTargets(point(400, 0), [], { gridStepMm: millimetres(1000) });

    expect(result.snapped).toBe(false);
    expectPoint(result.point, point(400, 0));
  });

  it('ignores a perpendicular whose foot misses the wall', () => {
    const result = snapToTargets(point(200, 10), [wallRun('W-001', point(-100, 0), point(100, 0))], {
      gridEnabled: false,
    });

    expect(result.snapped).toBe(false);
  });

  it('leaves an already snapped point where it is', () => {
    const targets = [anchor('wallVertex', 'W-001', 20, 0)];
    const once = snapToTargets(point(120, 0), targets);
    const twice = snapToTargets(once.point, targets);

    expectPoint(twice.point, once.point);
    expect(twice.kind).toBe('wallVertex');
    expect(twice.distanceMm).toBeCloseTo(0, 6);
  });

  it('gives the same answer every time for the same arguments', () => {
    const targets = [
      anchor('wallVertex', 'W-001', 60, 0),
      anchor('wallVertex', 'W-002', 0, 60),
      anchor('intersection', 'X-001', 5, 5),
    ];

    const runs = [0, 1, 2].map(() => snapToTargets(point(0, 0), targets));

    expect(runs.map((run) => run.targetId)).toEqual(['W-001', 'W-001', 'W-001']);
  });
});
