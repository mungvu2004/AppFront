import { describe, expect, it } from 'vitest';

import type { PointMm } from '../../units/compare';
import { millimetres, type Millimetres } from '../../units/types';
import type { Wall } from '../../walls/types';
import {
  AXIS_ALIGNMENT_THRESHOLD_MM,
  axisLine,
  detectAxes,
  horizontalAxes,
  MIN_WALLS_PER_AXIS,
  verticalAxes,
  type DetectedAxis,
} from '../detect';
import {
  AXIS_LETTERS,
  buildAxisGrid,
  describeAxisPosition,
  describePoint,
  fromAxisPosition,
  horizontalAxisLabel,
  labelAxes,
  PROJECT_ORIGIN,
  setOrigin,
  toAxisPosition,
  verticalAxisLabel,
  type AxisLabelOverride,
} from '../label';

/* -------------------------------------------------------------------------- */
/* Fixtures.                                                                   */
/* -------------------------------------------------------------------------- */

function point(xMm: number, yMm: number): PointMm {
  return { x: millimetres(xMm), y: millimetres(yMm) };
}

function wall(id: string, start: PointMm, end: PointMm): Wall {
  return {
    id: `W-${id}`,
    kind: 'partition',
    centreline: { start, end },
    thicknessMm: millimetres(100),
    baseElevationMm: millimetres(0),
    topElevationMm: millimetres(3000),
  };
}

/** A wall running up the sheet at `xMm`. */
function verticalWall(id: string, xMm: number, fromYMm: number, toYMm: number): Wall {
  return wall(id, point(xMm, fromYMm), point(xMm, toYMm));
}

/** A wall running across the sheet at `yMm`. */
function horizontalWall(id: string, yMm: number, fromXMm: number, toXMm: number): Wall {
  return wall(id, point(fromXMm, yMm), point(toXMm, yMm));
}

/**
 * A small block: three axes up the sheet at 0, 3600 and 7200, two across it at
 * 0 and 4200. Every line carries two walls, which is the least that counts as a
 * setting-out intent.
 */
const SAMPLE_WALLS: readonly Wall[] = [
  verticalWall('v1a', 0, 0, 4200),
  verticalWall('v1b', 0, 4200, 8400),
  verticalWall('v2a', 3600, 0, 4200),
  verticalWall('v2b', 3600, 4200, 8400),
  verticalWall('v3a', 7200, 0, 4200),
  verticalWall('v3b', 7200, 4200, 8400),
  horizontalWall('h1a', 0, 0, 3600),
  horizontalWall('h1b', 0, 3600, 7200),
  horizontalWall('h2a', 4200, 0, 3600),
  horizontalWall('h2b', 4200, 3600, 7200),
];

/** Coordinates of the axes, in the order they come back. */
function coordinatesOf(axes: readonly DetectedAxis[]): number[] {
  return axes.map((axis) => axis.coordinateMm);
}

/** The axis at `index`, failing loudly when detection produced none. */
function axisAt(axes: readonly DetectedAxis[], index: number): DetectedAxis {
  const axis = axes[index];
  if (axis === undefined) {
    throw new Error(`No axis at index ${String(index)}.`);
  }
  return axis;
}

/** The grid of the sample block, named and pinned to the project origin. */
function sampleGrid() {
  return buildAxisGrid(labelAxes(detectAxes(SAMPLE_WALLS)));
}

/* -------------------------------------------------------------------------- */
/* Detection.                                                                  */
/* -------------------------------------------------------------------------- */

describe('recovering axes from walls', () => {
  it('finds every line the sample block was set out on', () => {
    const axes = detectAxes(SAMPLE_WALLS);

    expect(coordinatesOf(verticalAxes(axes))).toEqual([0, 3600, 7200]);
    expect(coordinatesOf(horizontalAxes(axes))).toEqual([0, 4200]);
  });

  it('returns the axes by rising coordinate whatever order the walls arrive in', () => {
    const shuffled = [...SAMPLE_WALLS].reverse();
    const axes = detectAxes(shuffled);

    expect(coordinatesOf(verticalAxes(axes))).toEqual([0, 3600, 7200]);
    expect(coordinatesOf(horizontalAxes(axes))).toEqual([0, 4200]);
  });

  it('lists the vertical axes before the horizontal ones', () => {
    const directions = detectAxes(SAMPLE_WALLS).map((axis) => axis.direction);

    expect(directions).toEqual([
      'vertical',
      'vertical',
      'vertical',
      'horizontal',
      'horizontal',
    ]);
  });

  it('records which walls each axis was found from', () => {
    const first = axisAt(verticalAxes(detectAxes(SAMPLE_WALLS)), 0);

    expect(first.wallIds).toEqual(['W-v1a', 'W-v1b']);
  });

  it('spans only the part of the sheet its walls cover', () => {
    const first = axisAt(verticalAxes(detectAxes(SAMPLE_WALLS)), 0);

    expect(first.startMm).toBe(0);
    expect(first.endMm).toBe(8400);
    expect(axisLine(first)).toEqual({
      start: { x: 0, y: 0 },
      end: { x: 0, y: 8400 },
    });
  });

  it('draws a horizontal axis across the sheet, not up it', () => {
    const first = axisAt(horizontalAxes(detectAxes(SAMPLE_WALLS)), 0);

    expect(axisLine(first)).toEqual({
      start: { x: 0, y: 0 },
      end: { x: 7200, y: 0 },
    });
  });
});

describe('what does not become an axis', () => {
  it('refuses to build one from a single wall', () => {
    const axes = detectAxes([verticalWall('lonely', 10800, 0, 4200)]);

    expect(axes).toEqual([]);
    expect(MIN_WALLS_PER_AXIS).toBe(2);
  });

  it('leaves a lone wall out of a plan that has real axes', () => {
    const axes = detectAxes([...SAMPLE_WALLS, verticalWall('lonely', 10800, 0, 4200)]);

    expect(coordinatesOf(verticalAxes(axes))).toEqual([0, 3600, 7200]);
  });

  it('does not let the same wall listed twice stand in for two', () => {
    const twice = verticalWall('twice', 10800, 0, 4200);
    const axes = detectAxes([twice, twice]);

    expect(axes).toEqual([]);
  });

  it('drops a diagonal wall, which sets out neither direction', () => {
    const axes = detectAxes([
      wall('d1', point(0, 0), point(3000, 3000)),
      wall('d2', point(100, 0), point(3100, 3000)),
    ]);

    expect(axes).toEqual([]);
  });

  it('drops a wall that leans further than the tolerance across its own run', () => {
    const axes = detectAxes([
      wall('leaning', point(0, 0), point(150, 4000)),
      verticalWall('straight', 0, 4000, 8000),
    ]);

    expect(axes).toEqual([]);
  });

  it('keeps a wall that leans less than the tolerance, at its mean coordinate', () => {
    const axes = detectAxes([
      wall('leaning', point(0, 0), point(50, 4000)),
      verticalWall('straight', 0, 4000, 8000),
    ]);

    expect(coordinatesOf(axes)).toEqual([12.5]);
  });
});

describe('how close is one line', () => {
  it('reads two walls within the tolerance as one axis, at their mean', () => {
    const axes = detectAxes([
      verticalWall('a', 0, 0, 4000),
      verticalWall('b', 80, 0, 4000),
    ]);

    expect(coordinatesOf(axes)).toEqual([40]);
    expect(axes[0]?.spreadMm).toBe(80);
  });

  it('keeps two walls further apart than the tolerance on separate axes', () => {
    const axes = detectAxes([
      verticalWall('a1', 0, 0, 4000),
      verticalWall('a2', 0, 4000, 8000),
      verticalWall('b1', 150, 0, 4000),
      verticalWall('b2', 150, 4000, 8000),
    ]);

    expect(coordinatesOf(axes)).toEqual([0, 150]);
  });

  it('never chains a group wider than the tolerance', () => {
    const axes = detectAxes([
      verticalWall('a', 0, 0, 4000),
      verticalWall('b', 90, 0, 4000),
      verticalWall('c', 180, 0, 4000),
    ]);

    expect(axes).toHaveLength(1);
    expect(axes[0]?.wallIds).toEqual(['W-a', 'W-b']);
    expect(axes[0]?.spreadMm).toBeLessThanOrEqual(AXIS_ALIGNMENT_THRESHOLD_MM);
  });

  it('groups more loosely when the caller widens the tolerance', () => {
    const walls = [
      verticalWall('a1', 0, 0, 4000),
      verticalWall('a2', 0, 4000, 8000),
      verticalWall('b1', 150, 0, 4000),
      verticalWall('b2', 150, 4000, 8000),
    ];

    expect(coordinatesOf(detectAxes(walls, millimetres(200)))).toEqual([75]);
  });

  it('rejects a tolerance that is not a length', () => {
    expect(() => detectAxes(SAMPLE_WALLS, millimetres(-1))).toThrow(RangeError);
  });
});

/* -------------------------------------------------------------------------- */
/* Naming.                                                                     */
/* -------------------------------------------------------------------------- */

describe('the naming convention', () => {
  it('numbers the vertical axes from the left', () => {
    const named = labelAxes(verticalAxes(detectAxes(SAMPLE_WALLS)));

    expect(named.map((axis) => axis.label)).toEqual(['1', '2', '3']);
    expect(named.map((axis) => axis.axis.coordinateMm)).toEqual([0, 3600, 7200]);
  });

  it('letters the horizontal axes from the bottom up', () => {
    const named = labelAxes(horizontalAxes(detectAxes(SAMPLE_WALLS)));

    expect(named.map((axis) => axis.label)).toEqual(['A', 'B']);
    expect(named.map((axis) => axis.axis.coordinateMm)).toEqual([0, 4200]);
  });

  it('marks a name it made up as generated', () => {
    const named = labelAxes(detectAxes(SAMPLE_WALLS));

    expect(named.every((axis) => axis.source === 'generated')).toBe(true);
  });

  it('leaves out the letters that read as digits', () => {
    expect(AXIS_LETTERS).not.toContain('I');
    expect(AXIS_LETTERS).not.toContain('O');
    expect(AXIS_LETTERS).toHaveLength(24);
  });

  it('steps over I and O in the sequence', () => {
    const letters = Array.from({ length: 24 }, (_unused, index) => horizontalAxisLabel(index));

    expect(letters.slice(0, 9)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J']);
    expect(letters[12]).toBe('N');
    expect(letters[13]).toBe('P');
    expect(letters[23]).toBe('Z');
  });

  it('carries a place past Z without ever writing I or O', () => {
    expect(horizontalAxisLabel(24)).toBe('AA');
    expect(horizontalAxisLabel(25)).toBe('AB');
    expect(horizontalAxisLabel(47)).toBe('AZ');
    expect(horizontalAxisLabel(48)).toBe('BA');
  });

  it('names thirty axes in order with no I and no O anywhere', () => {
    const walls: Wall[] = [];
    for (let index = 0; index < 30; index += 1) {
      const y = index * 1200;
      walls.push(horizontalWall(`row${index}a`, y, 0, 3000));
      walls.push(horizontalWall(`row${index}b`, y, 3000, 6000));
    }

    const labels = labelAxes(detectAxes(walls)).map((axis) => axis.label);

    expect(labels).toHaveLength(30);
    expect(labels[0]).toBe('A');
    expect(labels[24]).toBe('AA');
    expect(labels[29]).toBe('AF');
    expect(labels.some((label) => label.includes('I') || label.includes('O'))).toBe(false);
  });

  it('numbers columns from one, not from zero', () => {
    expect(verticalAxisLabel(0)).toBe('1');
    expect(verticalAxisLabel(9)).toBe('10');
  });

  it('rejects an index that is not a position in a sequence', () => {
    expect(() => verticalAxisLabel(-1)).toThrow(RangeError);
    expect(() => horizontalAxisLabel(1.5)).toThrow(RangeError);
  });
});

describe('a name a person put on', () => {
  const overrides: readonly AxisLabelOverride[] = [
    { direction: 'vertical', coordinateMm: millimetres(3600), label: "1'" },
  ];

  it('wins over the generated one', () => {
    const named = labelAxes(detectAxes(SAMPLE_WALLS), overrides);

    expect(named[1]?.axis.coordinateMm).toBe(3600);
    expect(named[1]?.label).toBe("1'");
    expect(named[1]?.source).toBe('user');
  });

  it('does not consume a number the other axes were going to use', () => {
    const named = labelAxes(detectAxes(SAMPLE_WALLS), overrides);

    expect(named.slice(0, 3).map((axis) => axis.label)).toEqual(['1', "1'", '2']);
  });

  it('makes the generator step over a name it has taken', () => {
    const named = labelAxes(detectAxes(SAMPLE_WALLS), [
      { direction: 'vertical', coordinateMm: millimetres(7200), label: '1' },
    ]);

    expect(named.slice(0, 3).map((axis) => axis.label)).toEqual(['2', '3', '1']);
  });

  it('sticks to the axis nearest the coordinate it was put at', () => {
    const named = labelAxes(detectAxes(SAMPLE_WALLS), [
      { direction: 'vertical', coordinateMm: millimetres(7250), label: 'Trục biên' },
    ]);

    expect(named[2]?.label).toBe('Trục biên');
    expect(named[2]?.axis.coordinateMm).toBe(7200);
  });

  it('ignores a name put too far from any axis', () => {
    const named = labelAxes(detectAxes(SAMPLE_WALLS), [
      { direction: 'vertical', coordinateMm: millimetres(20000), label: 'Trục biên' },
    ]);

    expect(named.map((axis) => axis.source)).not.toContain('user');
  });

  it('ignores a name that is only whitespace', () => {
    const named = labelAxes(detectAxes(SAMPLE_WALLS), [
      { direction: 'vertical', coordinateMm: millimetres(3600), label: '   ' },
    ]);

    expect(named.slice(0, 3).map((axis) => axis.label)).toEqual(['1', '2', '3']);
  });

  it('never lets one name land on two axes', () => {
    const named = labelAxes(detectAxes(SAMPLE_WALLS), [
      { direction: 'vertical', coordinateMm: millimetres(3600), label: 'X1' },
    ]);

    expect(named.filter((axis) => axis.label === 'X1')).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------------- */
/* The origin, and reading a position off the grid.                            */
/* -------------------------------------------------------------------------- */

describe('quoting a position against the grid', () => {
  it('reads a point on a crossing as the crossing', () => {
    const grid = sampleGrid();

    expect(describePoint(point(7200, 4200), grid)).toBe('B-3');
  });

  it('reads a point off one axis the way it is said on site', () => {
    const grid = sampleGrid();

    expect(describePoint(point(7450, 4200), grid)).toBe('B-3 lệch 250 mm');
  });

  it('names both directions when the point is off both axes', () => {
    const grid = sampleGrid();

    expect(describePoint(point(7450, 4320), grid)).toBe('B-3 lệch X 250 mm và Y 120 mm');
  });

  it('quotes the nearest axis, so the offset stays small', () => {
    const grid = sampleGrid();
    const position = toAxisPosition(point(3400, 0), grid);

    expect(position.verticalLabel).toBe('2');
    expect(position.offsetXMm).toBe(-200);
  });

  it('writes a fraction of a millimetre with a comma', () => {
    const grid = sampleGrid();

    expect(describePoint(point(7200.5, 4200), grid)).toBe('B-3 lệch 0,5 mm');
  });

  it('says so when the plan has no axes at all', () => {
    const grid = buildAxisGrid([]);
    const position = toAxisPosition(point(1000, 2000), grid);

    expect(position.verticalLabel).toBeNull();
    expect(position.horizontalLabel).toBeNull();
    expect(describeAxisPosition(position)).toBe('Chưa có trục, X 1000 mm, Y 2000 mm');
  });
});

describe('converting between absolute coordinates and the grid', () => {
  const PLAN_POINTS: readonly PointMm[] = [
    point(0, 0),
    point(7450, 4320),
    point(3400, -250),
    point(-500, 8400),
    point(10800, 12000),
  ];

  it('puts a position back exactly where it came from', () => {
    const grid = sampleGrid();

    for (const original of PLAN_POINTS) {
      expect(fromAxisPosition(toAxisPosition(original, grid), grid)).toEqual(original);
    }
  });

  it('round trips just as exactly once the origin has moved', () => {
    const grid = buildAxisGrid(labelAxes(detectAxes(SAMPLE_WALLS)), setOrigin(point(3600, 4200)));

    for (const original of PLAN_POINTS) {
      expect(fromAxisPosition(toAxisPosition(original, grid), grid)).toEqual(original);
    }
  });

  it('round trips through a grid that has no axes in either direction', () => {
    const grid = buildAxisGrid([], setOrigin(point(1000, -2000)));

    for (const original of PLAN_POINTS) {
      expect(fromAxisPosition(toAxisPosition(original, grid), grid)).toEqual(original);
    }
  });

  it('builds an absolute point from a label and an offset', () => {
    const grid = sampleGrid();

    const rebuilt = fromAxisPosition(
      {
        verticalLabel: '3',
        horizontalLabel: 'B',
        offsetXMm: millimetres(250),
        offsetYMm: millimetres(0),
        localXMm: millimetres(0),
        localYMm: millimetres(0),
      },
      grid,
    );

    expect(rebuilt).toEqual(point(7450, 4200));
  });

  it('refuses to place a position quoted against an axis that does not exist', () => {
    const grid = sampleGrid();
    const position = toAxisPosition(point(7450, 4200), grid);

    expect(fromAxisPosition({ ...position, verticalLabel: '7' }, grid)).toBeNull();
  });
});

describe('what moving the origin does and does not change', () => {
  it('leaves the axis a point is quoted against untouched', () => {
    const axes = labelAxes(detectAxes(SAMPLE_WALLS));
    const atZero = toAxisPosition(point(7450, 4200), buildAxisGrid(axes, PROJECT_ORIGIN));
    const moved = toAxisPosition(
      point(7450, 4200),
      buildAxisGrid(axes, setOrigin(point(3600, 4200))),
    );

    expect(moved.verticalLabel).toBe(atZero.verticalLabel);
    expect(moved.horizontalLabel).toBe(atZero.horizontalLabel);
    expect(moved.offsetXMm).toBe(atZero.offsetXMm);
    expect(moved.offsetYMm).toBe(atZero.offsetYMm);
  });

  it('re-reads the plain coordinates from the new point', () => {
    const axes = labelAxes(detectAxes(SAMPLE_WALLS));
    const moved = toAxisPosition(
      point(7450, 4200),
      buildAxisGrid(axes, setOrigin(point(3600, 4200))),
    );

    expect(moved.localXMm).toBe(3850);
    expect(moved.localYMm).toBe(0);
  });

  it('starts at zero until someone moves it', () => {
    expect(PROJECT_ORIGIN.point).toEqual(point(0, 0));
  });

  it('rejects an origin that is not a pair of lengths', () => {
    const broken: PointMm = { x: millimetres(0), y: Number.NaN as Millimetres };

    expect(() => setOrigin(broken)).toThrow(RangeError);
  });
});
