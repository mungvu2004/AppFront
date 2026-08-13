import { describe, expect, it } from 'vitest';

import type { WallId } from '../../spatial/types';
import type { PointMm } from '../../units/compare';
import { millimetres, type Millimetres } from '../../units/types';
import {
  DEFAULT_JOINT_THRESHOLD_MM,
  resolveJoints,
  resolveWallShapes,
  type WallShape,
} from '../joints';
import {
  assertUsableWall,
  isThicknessInRange,
  MAX_WALL_THICKNESS_MM,
  MIN_WALL_THICKNESS_MM,
  type Wall,
  type WallKind,
} from '../types';

/* -------------------------------------------------------------------------- */
/* Fixtures.                                                                   */
/* -------------------------------------------------------------------------- */

const DEFAULT_THICKNESS_MM: Millimetres = millimetres(200);

function point(x: number, y: number): PointMm {
  return { x: millimetres(x), y: millimetres(y) };
}

interface WallOverrides {
  readonly kind?: WallKind;
  readonly thicknessMm?: Millimetres;
  readonly baseElevationMm?: Millimetres;
  readonly topElevationMm?: Millimetres;
}

function makeWall(id: WallId, from: PointMm, to: PointMm, overrides: WallOverrides = {}): Wall {
  return {
    id,
    kind: overrides.kind ?? 'partition',
    centreline: { start: from, end: to },
    thicknessMm: overrides.thicknessMm ?? DEFAULT_THICKNESS_MM,
    baseElevationMm: overrides.baseElevationMm ?? millimetres(0),
    topElevationMm: overrides.topElevationMm ?? millimetres(3000),
  };
}

/** Two walls meeting at a right angle: the `L` node. */
const CORNER_WALLS: readonly Wall[] = [
  makeWall('W-1', point(0, 0), point(5000, 0)),
  makeWall('W-2', point(5000, 0), point(5000, 4000)),
];

/** A straight run split in two, with a branch: the `T` node. */
const TEE_WALLS: readonly Wall[] = [
  makeWall('W-1', point(0, 0), point(5000, 0)),
  makeWall('W-2', point(5000, 0), point(10000, 0)),
  makeWall('W-3', point(5000, 0), point(5000, 4000)),
];

/** Four arms from one point: the cross node. */
const CROSS_WALLS: readonly Wall[] = [
  makeWall('W-1', point(0, 0), point(4000, 0)),
  makeWall('W-2', point(0, 0), point(0, 4000)),
  makeWall('W-3', point(0, 0), point(-4000, 0)),
  makeWall('W-4', point(0, 0), point(0, -4000)),
];

/** Three arms 120° apart: a `T` node whose middle is a real triangle. */
const FORKED_WALLS: readonly Wall[] = [
  makeWall('W-1', point(0, 0), point(4000, 0)),
  makeWall('W-2', point(0, 0), point(-2000, 3464)),
  makeWall('W-3', point(0, 0), point(-2000, -3464)),
];

/* -------------------------------------------------------------------------- */
/* Geometry helpers used only by the assertions below.                          */
/* -------------------------------------------------------------------------- */

function at<TItem>(items: readonly TItem[], index: number): TItem {
  const count = items.length;
  const item = items[((index % count) + count) % count];
  if (item === undefined) {
    throw new Error(`No item at index ${String(index)}.`);
  }
  return item;
}

/** Twice the signed area; positive when the outline runs counter-clockwise. */
function doubleSignedArea(outline: readonly PointMm[]): number {
  return outline.reduce((total, from, index) => {
    const to = at(outline, index + 1);
    return total + (from.x * to.y - to.x * from.y);
  }, 0);
}

function isStrictlyInside(probe: PointMm, outline: readonly PointMm[]): boolean {
  let inside = false;

  for (let index = 0; index < outline.length; index += 1) {
    const from = at(outline, index);
    const to = at(outline, index + 1);
    if (from.y > probe.y !== to.y > probe.y) {
      const crossingX = from.x + ((probe.y - from.y) / (to.y - from.y)) * (to.x - from.x);
      if (probe.x < crossingX) {
        inside = !inside;
      }
    }
  }

  return inside;
}

function distanceToSegment(probe: PointMm, from: PointMm, to: PointMm): number {
  const runX = to.x - from.x;
  const runY = to.y - from.y;
  const lengthSquared = runX * runX + runY * runY;
  if (lengthSquared === 0) {
    return Math.hypot(probe.x - from.x, probe.y - from.y);
  }
  const raw = ((probe.x - from.x) * runX + (probe.y - from.y) * runY) / lengthSquared;
  const along = Math.min(1, Math.max(0, raw));
  return Math.hypot(probe.x - (from.x + along * runX), probe.y - (from.y + along * runY));
}

function distanceToOutline(probe: PointMm, outline: readonly PointMm[]): number {
  return outline.reduce(
    (nearest, from, index) => Math.min(nearest, distanceToSegment(probe, from, at(outline, index + 1))),
    Number.POSITIVE_INFINITY,
  );
}

/** How many wall footprints hold this point, edges excluded. */
function coverageOf(probe: PointMm, shapes: readonly WallShape[]): number {
  return shapes.filter((shape) => isStrictlyInside(probe, shape.outline)).length;
}

/** Points on an edge belong to neither side, so they are left out of the count. */
function sitsOnAnEdge(probe: PointMm, shapes: readonly WallShape[]): boolean {
  return shapes.some((shape) => distanceToOutline(probe, shape.outline) < 0.5);
}

/** A polar spray of probes, offset so none of them lands on an axis. */
function probesAround(centre: PointMm, radiusMm: number): readonly PointMm[] {
  const rings = 6;
  const spokes = 37;
  const probes: PointMm[] = [];

  for (let ring = 1; ring <= rings; ring += 1) {
    const radius = (radiusMm * ring) / rings;
    for (let spoke = 0; spoke < spokes; spoke += 1) {
      const angle = (2 * Math.PI * (spoke + 0.31)) / spokes;
      probes.push(point(centre.x + radius * Math.cos(angle), centre.y + radius * Math.sin(angle)));
    }
  }

  return probes;
}

/** A grid of probes over a square, offset so none of them lands on a corner. */
function probesOver(centre: PointMm, halfSizeMm: number): readonly PointMm[] {
  const step = 13.7;
  const probes: PointMm[] = [];

  for (let x = centre.x - halfSizeMm; x <= centre.x + halfSizeMm; x += step) {
    for (let y = centre.y - halfSizeMm; y <= centre.y + halfSizeMm; y += step) {
      probes.push(point(x + 0.37, y + 0.11));
    }
  }

  return probes;
}

/** Every probe near the node must be inside some wall: no crack is left open. */
function expectNoGapAround(shapes: readonly WallShape[], centre: PointMm, radiusMm: number): void {
  const uncovered = probesAround(centre, radiusMm).filter(
    (probe) => !sitsOnAnEdge(probe, shapes) && coverageOf(probe, shapes) === 0,
  );

  expect(uncovered).toEqual([]);
}

/** No probe may be inside two walls at once: the node is covered exactly once. */
function expectNoOverlapAround(shapes: readonly WallShape[], centre: PointMm, halfSizeMm: number): void {
  const doubled = probesOver(centre, halfSizeMm).filter(
    (probe) => !sitsOnAnEdge(probe, shapes) && coverageOf(probe, shapes) > 1,
  );

  expect(doubled).toEqual([]);
}

function outlineOf(shapes: readonly WallShape[], wallId: WallId): readonly PointMm[] {
  const shape = shapes.find((candidate) => candidate.wallId === wallId);
  if (shape === undefined) {
    throw new Error(`No shape for wall ${wallId}.`);
  }
  return shape.outline;
}

function expectOutline(actual: readonly PointMm[], expected: readonly (readonly [number, number])[]): void {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((vertex, index) => {
    const [x, y] = at(expected, index);
    expect(vertex.x).toBeCloseTo(x, 6);
    expect(vertex.y).toBeCloseTo(y, 6);
  });
}

/* -------------------------------------------------------------------------- */
/* Thickness and other rejected input.                                          */
/* -------------------------------------------------------------------------- */

describe('isThicknessInRange', () => {
  it('accepts both ends of the allowed range', () => {
    expect(isThicknessInRange(MIN_WALL_THICKNESS_MM)).toBe(true);
    expect(isThicknessInRange(MAX_WALL_THICKNESS_MM)).toBe(true);
  });

  it('rejects a thickness under the minimum', () => {
    expect(isThicknessInRange(millimetres(59))).toBe(false);
  });

  it('rejects a thickness over the maximum', () => {
    expect(isThicknessInRange(millimetres(601))).toBe(false);
  });
});

describe('assertUsableWall', () => {
  it('accepts a wall at the thin end of the range', () => {
    const wall = makeWall('W-1', point(0, 0), point(1000, 0), { thicknessMm: MIN_WALL_THICKNESS_MM });

    expect(() => assertUsableWall(wall)).not.toThrow();
  });

  it('rejects a thickness outside the range and names the wall', () => {
    const wall = makeWall('W-9', point(0, 0), point(1000, 0), { thicknessMm: millimetres(40) });

    expect(() => assertUsableWall(wall)).toThrow(RangeError);
    expect(() => assertUsableWall(wall)).toThrow(/W-9/);
  });

  it('rejects a centreline of zero length', () => {
    const wall = makeWall('W-1', point(2000, 2000), point(2000, 2000));

    expect(() => assertUsableWall(wall)).toThrow(RangeError);
  });

  it('rejects a top that is not above the base', () => {
    const wall = makeWall('W-1', point(0, 0), point(1000, 0), {
      baseElevationMm: millimetres(3000),
      topElevationMm: millimetres(3000),
    });

    expect(() => assertUsableWall(wall)).toThrow(RangeError);
  });

  it('leaves an out-of-range thickness untouched instead of clamping it', () => {
    const wall = makeWall('W-1', point(0, 0), point(1000, 0), { thicknessMm: millimetres(1200) });

    expect(() => resolveJoints([wall])).toThrow(RangeError);
    expect(wall.thicknessMm).toBe(1200);
  });
});

describe('resolveJoints, rejected input', () => {
  it('refuses a wall whose thickness is out of range', () => {
    const walls = [
      makeWall('W-1', point(0, 0), point(5000, 0), { thicknessMm: millimetres(50) }),
      makeWall('W-2', point(5000, 0), point(5000, 4000)),
    ];

    expect(() => resolveJoints(walls)).toThrow(RangeError);
    expect(() => resolveWallShapes(walls)).toThrow(RangeError);
  });

  it('refuses a threshold that is not a positive length', () => {
    expect(() => resolveJoints(CORNER_WALLS, millimetres(0))).toThrow(RangeError);
    expect(() => resolveJoints(CORNER_WALLS, millimetres(-50))).toThrow(RangeError);
  });

  it('refuses two walls sharing an id', () => {
    const walls = [
      makeWall('W-1', point(0, 0), point(5000, 0)),
      makeWall('W-1', point(5000, 0), point(5000, 4000)),
    ];

    expect(() => resolveJoints(walls)).toThrow(/W-1/);
  });
});

/* -------------------------------------------------------------------------- */
/* Which ends get welded.                                                       */
/* -------------------------------------------------------------------------- */

describe('resolveJoints, welding ends', () => {
  it('welds two ends that sit under the threshold apart', () => {
    const walls = [
      makeWall('W-1', point(0, 0), point(5000, 0)),
      makeWall('W-2', point(5030, 0), point(5030, 4000)),
    ];

    const { joints, unresolved } = resolveJoints(walls);

    expect(unresolved).toEqual([]);
    expect(joints).toHaveLength(1);
    expect(at(joints, 0).kind).toBe('corner');
    expect(at(joints, 0).position.x).toBeCloseTo(5015, 6);
    expect(at(joints, 0).position.y).toBeCloseTo(0, 6);
  });

  it('leaves two ends 60 mm apart unwelded', () => {
    const walls = [
      makeWall('W-1', point(0, 0), point(5000, 0)),
      makeWall('W-2', point(5060, 0), point(5060, 4000)),
    ];

    const { joints, unresolved } = resolveJoints(walls);

    expect(joints).toEqual([]);
    expect(unresolved).toEqual([]);
  });

  it('leaves two ends exactly on the threshold unwelded', () => {
    const walls = [
      makeWall('W-1', point(0, 0), point(5000, 0)),
      makeWall('W-2', point(5000 + DEFAULT_JOINT_THRESHOLD_MM, 0), point(5050, 4000)),
    ];

    expect(resolveJoints(walls).joints).toEqual([]);
  });

  it('honours a threshold given by the caller', () => {
    const walls = [
      makeWall('W-1', point(0, 0), point(5000, 0)),
      makeWall('W-2', point(5060, 0), point(5060, 4000)),
    ];

    expect(resolveJoints(walls, millimetres(100)).joints).toHaveLength(1);
  });

  it('never welds walls that share no height', () => {
    const walls = [
      makeWall('W-1', point(0, 0), point(5000, 0), {
        baseElevationMm: millimetres(0),
        topElevationMm: millimetres(3000),
      }),
      makeWall('W-2', point(5000, 0), point(5000, 4000), {
        baseElevationMm: millimetres(3000),
        topElevationMm: millimetres(6000),
      }),
    ];

    expect(resolveJoints(walls).joints).toEqual([]);
  });

  it('welds walls that share only part of their height', () => {
    const walls = [
      makeWall('W-1', point(0, 0), point(5000, 0), {
        baseElevationMm: millimetres(0),
        topElevationMm: millimetres(3000),
      }),
      makeWall('W-2', point(5000, 0), point(5000, 4000), {
        baseElevationMm: millimetres(1000),
        topElevationMm: millimetres(6000),
      }),
    ];

    expect(resolveJoints(walls).joints).toHaveLength(1);
  });

  it('reads three ends as a tee and four as a cross', () => {
    expect(at(resolveJoints(TEE_WALLS).joints, 0).kind).toBe('tee');
    expect(at(resolveJoints(CROSS_WALLS).joints, 0).kind).toBe('cross');
  });

  it('lists the members counter-clockwise by bearing', () => {
    const { joints } = resolveJoints(TEE_WALLS);

    expect(at(joints, 0).members.map((member) => member.wallId)).toEqual(['W-2', 'W-3', 'W-1']);
    expect(at(joints, 0).members.map((member) => member.bearingDeg)).toEqual([0, 90, 180]);
  });

  it('builds an id from its members, so the same node keeps the same id', () => {
    const forward = resolveJoints(CORNER_WALLS);
    const reversed = resolveJoints([...CORNER_WALLS].reverse());

    expect(at(forward.joints, 0).id).toBe('J-W-1.end+W-2.start');
    expect(at(reversed.joints, 0).id).toBe(at(forward.joints, 0).id);
  });

  it('reports five ends in one place instead of forcing them into a node', () => {
    const walls = [
      ...CROSS_WALLS,
      makeWall('W-5', point(0, 0), point(3000, 3000)),
    ];

    const { joints, unresolved } = resolveJoints(walls);

    expect(joints).toEqual([]);
    expect(unresolved).toHaveLength(1);
    expect(at(unresolved, 0).reason).toBe('tooManyEnds');
    expect(at(unresolved, 0).members).toHaveLength(5);
  });

  it('reports a wall short enough to weld to itself instead of welding it', () => {
    const walls = [
      makeWall('W-1', point(0, 0), point(5000, 0)),
      makeWall('W-2', point(5000, 0), point(5000, 40)),
    ];

    const { joints, unresolved } = resolveJoints(walls);

    expect(joints).toEqual([]);
    expect(unresolved).toHaveLength(1);
    expect(at(unresolved, 0).reason).toBe('selfJoin');
  });

  it('gives the middle of a node to the load-bearing wall', () => {
    const walls = [
      makeWall('W-1', point(0, 0), point(5000, 0)),
      makeWall('W-2', point(5000, 0), point(10000, 0)),
      makeWall('W-3', point(5000, 0), point(5000, 4000), { kind: 'loadBearing' }),
    ];

    expect(at(resolveJoints(walls).joints, 0).primaryWallId).toBe('W-3');
  });

  it('gives the middle of a node to the thicker wall when the kinds match', () => {
    const walls = [
      makeWall('W-1', point(0, 0), point(5000, 0)),
      makeWall('W-2', point(5000, 0), point(10000, 0)),
      makeWall('W-3', point(5000, 0), point(5000, 4000), { thicknessMm: millimetres(400) }),
    ];

    expect(at(resolveJoints(walls).joints, 0).primaryWallId).toBe('W-3');
  });

  it('prefers the wall that runs straight through when kind and thickness match', () => {
    expect(at(resolveJoints(TEE_WALLS).joints, 0).primaryWallId).toBe('W-1');
  });

  it('reads the same nodes whatever order the walls arrive in', () => {
    const forward = resolveJoints(TEE_WALLS);
    const shuffled = resolveJoints([
      at(TEE_WALLS, 2),
      at(TEE_WALLS, 0),
      at(TEE_WALLS, 1),
    ]);

    expect(shuffled).toEqual(forward);
  });

  it('never writes to the walls it was given', () => {
    const walls = TEE_WALLS.map((wall) => ({ ...wall, centreline: { ...wall.centreline } }));
    const before = JSON.stringify(walls);

    resolveJoints(walls);
    resolveWallShapes(walls);

    expect(JSON.stringify(walls)).toBe(before);
  });

  it('never writes to a frozen input', () => {
    const walls = TEE_WALLS.map((wall) => Object.freeze({ ...wall }));

    expect(() => resolveWallShapes(Object.freeze(walls))).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/* The footprint of each wall.                                                  */
/* -------------------------------------------------------------------------- */

describe('resolveWallShapes, a wall on its own', () => {
  it('keeps a plain rectangle with square ends', () => {
    const { shapes } = resolveWallShapes([makeWall('W-1', point(0, 0), point(5000, 0))]);

    expectOutline(outlineOf(shapes, 'W-1'), [
      [5000, -100],
      [5000, 100],
      [0, 100],
      [0, -100],
    ]);
    expect(at(shapes, 0).startJointId).toBeNull();
    expect(at(shapes, 0).endJointId).toBeNull();
  });

  it('returns the outlines in the order the walls were given', () => {
    const { shapes } = resolveWallShapes(TEE_WALLS);

    expect(shapes.map((shape) => shape.wallId)).toEqual(['W-1', 'W-2', 'W-3']);
  });

  it('leaves ends 60 mm apart square, so nothing is welded by accident', () => {
    const walls = [
      makeWall('W-1', point(0, 0), point(5000, 0)),
      makeWall('W-2', point(5060, 0), point(5060, 4000)),
    ];

    const { shapes } = resolveWallShapes(walls);

    expectOutline(outlineOf(shapes, 'W-1'), [
      [5000, -100],
      [5000, 100],
      [0, 100],
      [0, -100],
    ]);
    expect(at(shapes, 0).endJointId).toBeNull();
  });
});

describe('resolveWallShapes, the L node', () => {
  const { shapes, joints } = resolveWallShapes(CORNER_WALLS);

  it('mitres both walls onto one shared edge', () => {
    expectOutline(outlineOf(shapes, 'W-1'), [
      [5100, -100],
      [4900, 100],
      [0, 100],
      [0, -100],
    ]);
    expectOutline(outlineOf(shapes, 'W-2'), [
      [5100, 4000],
      [4900, 4000],
      [4900, 100],
      [5100, -100],
    ]);
  });

  it('leaves no gap and no overlap at the corner', () => {
    expectNoGapAround(shapes, at(joints, 0).position, 80);
    expectNoOverlapAround(shapes, at(joints, 0).position, 600);
  });

  it('names the node on both walls', () => {
    expect(shapes.map((shape) => shape.endJointId ?? shape.startJointId)).toEqual([
      at(joints, 0).id,
      at(joints, 0).id,
    ]);
  });
});

describe('resolveWallShapes, the T node', () => {
  const { shapes, joints } = resolveWallShapes(TEE_WALLS);

  it('trims the branch onto the face of the run', () => {
    expectOutline(outlineOf(shapes, 'W-3'), [
      [5100, 4000],
      [4900, 4000],
      [4900, 100],
      [5100, 100],
    ]);
  });

  it('splits the run between the two walls that carry it', () => {
    expectOutline(outlineOf(shapes, 'W-1'), [
      [5000, -100],
      [5100, 100],
      [0, 100],
      [0, -100],
    ]);
    expectOutline(outlineOf(shapes, 'W-2'), [
      [10000, -100],
      [10000, 100],
      [5100, 100],
      [5000, -100],
    ]);
  });

  it('leaves no gap and no overlap at the node', () => {
    expectNoGapAround(shapes, at(joints, 0).position, 80);
    expectNoOverlapAround(shapes, at(joints, 0).position, 600);
  });
});

describe('resolveWallShapes, the cross node', () => {
  const { shapes, joints } = resolveWallShapes(CROSS_WALLS);

  it('runs the owning wall through the middle and butts the others onto it', () => {
    expectOutline(outlineOf(shapes, 'W-1'), [
      [4000, -100],
      [4000, 100],
      [-100, 100],
      [-100, -100],
    ]);
    expectOutline(outlineOf(shapes, 'W-2'), [
      [100, 4000],
      [-100, 4000],
      [-100, 100],
      [100, 100],
    ]);
    expectOutline(outlineOf(shapes, 'W-3'), [
      [-4000, 100],
      [-4000, -100],
      [-100, -100],
      [-100, 100],
    ]);
    expectOutline(outlineOf(shapes, 'W-4'), [
      [-100, -4000],
      [100, -4000],
      [100, -100],
      [-100, -100],
    ]);
  });

  it('leaves no gap and no overlap at the node', () => {
    expectNoGapAround(shapes, at(joints, 0).position, 80);
    expectNoOverlapAround(shapes, at(joints, 0).position, 600);
  });
});

describe('resolveWallShapes, a node with a middle of its own', () => {
  const { shapes, joints } = resolveWallShapes(FORKED_WALLS);

  it('gives the owning wall the extra vertices the middle needs', () => {
    expect(outlineOf(shapes, 'W-1')).toHaveLength(5);
  });

  it('leaves no gap and no overlap where three arms meet at 120°', () => {
    expectNoGapAround(shapes, at(joints, 0).position, 80);
    expectNoOverlapAround(shapes, at(joints, 0).position, 600);
  });
});

describe('resolveWallShapes, invariants across every node', () => {
  const scenarios: readonly (readonly [string, readonly Wall[]])[] = [
    ['corner', CORNER_WALLS],
    ['tee', TEE_WALLS],
    ['cross', CROSS_WALLS],
    ['fork', FORKED_WALLS],
  ];

  it.each(scenarios)('keeps at least four vertices per wall: %s', (_name, walls) => {
    for (const shape of resolveWallShapes(walls).shapes) {
      expect(shape.outline.length).toBeGreaterThanOrEqual(4);
    }
  });

  it.each(scenarios)('lists every outline counter-clockwise: %s', (_name, walls) => {
    for (const shape of resolveWallShapes(walls).shapes) {
      expect(doubleSignedArea(shape.outline)).toBeGreaterThan(0);
    }
  });

  it.each(scenarios)('repeats no vertex within an outline: %s', (_name, walls) => {
    for (const shape of resolveWallShapes(walls).shapes) {
      const keys = shape.outline.map((vertex) => `${vertex.x.toFixed(6)}:${vertex.y.toFixed(6)}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});
