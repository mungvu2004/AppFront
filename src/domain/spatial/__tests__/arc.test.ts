/** @vitest-environment node */
/**
 * Cung tường: cùng con số với `packages/domain/spatial/arc.py` của AppBack (dây (0,0)→(2000,0), n = (0, 1)).
 */

import { describe, expect, it } from 'vitest';

import { arcApex, arcPoints, nearestOnWall, pointAtArcLength, wallLength } from '../arc';

const START = { x: 0, y: 0 };
const END = { x: 2000, y: 0 };

describe('arcPoints', () => {
  it.each([400, -400, 1000, 30])('keeps the ends, lies on one circle, apex gives sagitta %d back', (sagitta) => {
    const points = arcPoints(START, END, sagitta);
    expect(points[0]).toBe(START);
    expect(points.at(-1)).toBe(END);
    expect(points.length % 2).toBe(1);
    const apex = points[(points.length - 1) / 2];
    expect(apex?.x).toBeCloseTo(1000);
    expect(apex?.y).toBeCloseTo(-sagitta);
    const radius = 2000 ** 2 / (8 * Math.abs(sagitta)) + Math.abs(sagitta) / 2;
    const centreY = (radius - Math.abs(sagitta)) * Math.sign(sagitta);
    for (const point of points) expect(Math.hypot(point.x - 1000, point.y - centreY)).toBeCloseTo(radius);
  });

  it('a half circle (sagitta = L/2) is split into chords of at most 10°', () => {
    expect(arcPoints(START, END, 1000)).toHaveLength(19);
  });

  it('straight or empty is just the ends', () => {
    expect(arcPoints(START, END, 0)).toEqual([START, END]);
    expect(arcPoints(START, END, undefined)).toEqual([START, END]);
    expect(arcPoints(START, START, 300)).toEqual([START, START]);
  });

  it('a left offset is the parallel face: straight shifts along n, curved changes the radius', () => {
    expect(arcPoints(START, END, 0, 10, 100)).toEqual([
      { x: 0, y: 100 },
      { x: 2000, y: 100 },
    ]);
    // Sagitta 1000: centre (1000, 0), radius 1000; the left face (towards the centre) is radius 900.
    for (const point of arcPoints(START, END, 1000, 10, 100)) {
      expect(Math.hypot(point.x - 1000, point.y)).toBeCloseTo(900);
    }
  });
});

describe('wallLength / arcApex', () => {
  it('is the chord when straight and the arc when curved', () => {
    expect(wallLength(START, END, undefined)).toBe(2000);
    expect(wallLength(START, END, 1000)).toBeCloseTo(Math.PI * 1000);
  });

  it('puts the apex at mid − s·n', () => {
    expect(arcApex(START, END, undefined)).toEqual({ x: 1000, y: 0 });
    const apex = arcApex(START, END, -400);
    expect(apex.x).toBeCloseTo(1000);
    expect(apex.y).toBeCloseTo(400);
  });
});

describe('pointAtArcLength', () => {
  it('walks the chord when straight', () => {
    expect(pointAtArcLength(START, END, 0, 500)).toEqual({ point: { x: 500, y: 0 }, tangent: { x: 1, y: 0 } });
  });

  it('walks the arc when curved, with the direction of travel', () => {
    const quarter = pointAtArcLength(START, END, 1000, (Math.PI * 1000) / 2);
    expect(quarter.point.x).toBeCloseTo(1000);
    expect(quarter.point.y).toBeCloseTo(-1000);
    expect(quarter.tangent.x).toBeCloseTo(1);
    expect(quarter.tangent.y).toBeCloseTo(0);
    const atStart = pointAtArcLength(START, END, 1000, 0);
    expect(atStart.tangent.x).toBeCloseTo(0);
    expect(atStart.tangent.y).toBeCloseTo(-1);
  });
});

describe('nearestOnWall', () => {
  it('is the clamped foot on the chord when straight', () => {
    expect(nearestOnWall(START, END, undefined, { x: 500, y: 300 })).toEqual({
      point: { x: 500, y: 0 },
      distance: 300,
      along: 500,
    });
    expect(nearestOnWall(START, END, undefined, { x: -300, y: 400 }).distance).toBe(500);
  });

  it('is exact on the arc inside its span', () => {
    // Half circle centre (1000, 0) radius 1000 bulging to −y; the probe (1000, −1500) sits 500 beyond the apex.
    const near = nearestOnWall(START, END, 1000, { x: 1000, y: -1500 });
    expect(near.distance).toBeCloseTo(500);
    expect(near.point.y).toBeCloseTo(-1000);
    expect(near.along).toBeCloseTo((Math.PI * 1000) / 2);
    // From the centre side: (1000, −200) is 800 inside the arc.
    expect(nearestOnWall(START, END, 1000, { x: 1000, y: -200 }).distance).toBeCloseTo(800);
  });

  it('falls back to the nearer end outside the swept angle', () => {
    // Shallow arc (sagitta 200): a probe far above the chord points away from the arc's span.
    const near = nearestOnWall(START, END, 200, { x: 2100, y: 1000 });
    expect(near.point).toBe(END);
    expect(near.distance).toBeCloseTo(Math.hypot(100, 1000));
  });
});
