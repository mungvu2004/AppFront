import { describe, expect, it } from 'vitest';

import { isValidId } from '../../spatial/ids';
import type {
  Axis,
  Dimension,
  EntityId,
  Furniture,
  LevelId,
  Opening,
  Room,
  Wall,
} from '../../spatial/types';
import { millimetres } from '../../units/types';
import type { Wall as GeometryWall } from '../../walls/types';
import {
  alignFloors,
  ALIGNMENT_WARNING_THRESHOLD_MM,
  applyFloorTransform,
  ceilingElevationMm,
  MAX_CLEAR_HEIGHT_MM,
  MIN_CLEAR_HEIGHT_MM,
  pickBaseFloor,
  transformAxis,
  type FloorPlan,
} from '../alignFloors';
import { copyFloor, floorEntityIds, type FloorContents, type IdFactory } from '../copyFloor';
import { detectAxes, type DetectedAxis } from '../detect';

/* -------------------------------------------------------------------------- */
/* Fixtures: the axis grid.                                                    */
/* -------------------------------------------------------------------------- */

const AXIS_START_MM = 0;
const AXIS_END_MM = 10000;

function axis(
  direction: 'vertical' | 'horizontal',
  coordinateMm: number,
  startMm = AXIS_START_MM,
  endMm = AXIS_END_MM,
): DetectedAxis {
  return {
    direction,
    coordinateMm: millimetres(coordinateMm),
    startMm: millimetres(startMm),
    endMm: millimetres(endMm),
    spreadMm: millimetres(0),
    wallIds: ['W-000001AAAA', 'W-000002AAAA'],
  };
}

function grid(verticalMm: readonly number[], horizontalMm: readonly number[]): DetectedAxis[] {
  return [
    ...verticalMm.map((coordinate) => axis('vertical', coordinate)),
    ...horizontalMm.map((coordinate) => axis('horizontal', coordinate)),
  ];
}

function floor(
  levelId: string,
  name: string,
  floorElevationMm: number,
  clearHeightMm: number,
  axes: readonly DetectedAxis[],
): FloorPlan {
  return {
    levelId: levelId as LevelId,
    name,
    floorElevationMm: millimetres(floorElevationMm),
    clearHeightMm: millimetres(clearHeightMm),
    axes,
  };
}

/**
 * Four storeys of one building, traced from four sheets.
 *
 * The grid is deliberately uneven — 3 600 then 4 800 across, 4 200 then 2 800
 * up — so no quarter turn of it can be mistaken for another. The first floor is
 * the cleanest survey; the second arrived 40 mm sideways with one axis 60 mm
 * out; the third was scanned a quarter turn round; the fourth is square but
 * noisy. Everything left over is under the 150 mm threshold.
 */
const BASE_VERTICAL_MM = [0, 3600, 8400];
const BASE_HORIZONTAL_MM = [0, 4200, 7000];

const SAMPLE_FLOORS: readonly FloorPlan[] = [
  floor('L-000001AAAA', 'Tầng 1', 0, 3000, grid(BASE_VERTICAL_MM, BASE_HORIZONTAL_MM)),
  floor('L-000002AAAA', 'Tầng 2', 3300, 3000, grid([40, 3640, 8500], [-30, 4170, 6970])),
  floor('L-000003AAAA', 'Tầng 3', 6600, 3000, grid([100, 4300, 7100], [50, -3550, -8350])),
  floor('L-000004AAAA', 'Tầng 4', 9900, 3000, grid([0, 3690, 8330], [0, 4290, 6900])),
];

function alignmentOf(levelId: string) {
  const report = alignFloors(SAMPLE_FLOORS);
  const found = report.floors.find((entry) => entry.levelId === levelId);
  if (found === undefined) {
    throw new Error(`No alignment for ${levelId}.`);
  }
  return found;
}

/* -------------------------------------------------------------------------- */
/* Fixtures: a floor to copy.                                                  */
/* -------------------------------------------------------------------------- */

const SOURCE_LEVEL_ID = 'L-000001AAAA' as LevelId;
const TARGET_LEVEL_ID = 'L-000009AAAA' as LevelId;

const SAMPLE_WALLS: readonly Wall[] = [
  {
    id: 'W-000001AAAA',
    levelId: SOURCE_LEVEL_ID,
    centreline: { start: { x: 0, y: 0 }, end: { x: 5000, y: 0 } },
    thicknessMm: 200,
    heightMm: 3000,
    kind: 'loadBearing',
    openingIds: ['D-000001AAAA'],
    confidence: 0.9,
    source: 'ai',
    reviewed: true,
  },
  {
    id: 'W-000002AAAA',
    levelId: SOURCE_LEVEL_ID,
    centreline: { start: { x: 5000, y: 0 }, end: { x: 5000, y: 4000 } },
    thicknessMm: 100,
    heightMm: 3000,
    kind: 'partition',
    openingIds: ['D-000002AAAA'],
    confidence: 0.8,
    source: 'human',
    reviewed: true,
  },
];

const SAMPLE_OPENINGS: readonly Opening[] = [
  {
    id: 'D-000001AAAA',
    wallId: 'W-000001AAAA',
    kind: 'door',
    offsetMm: 1000,
    widthMm: 900,
    heightMm: 2200,
    sillHeightMm: 0,
    swing: 'left',
    confidence: 0.9,
    source: 'ai',
    reviewed: true,
  },
  {
    id: 'D-000002AAAA',
    wallId: 'W-000002AAAA',
    kind: 'window',
    offsetMm: 1500,
    widthMm: 1200,
    heightMm: 1400,
    sillHeightMm: 900,
    swing: 'fixed',
    confidence: 0.7,
    source: 'ai',
    reviewed: false,
  },
];

const SAMPLE_ROOMS: readonly Room[] = [
  {
    id: 'R-000001AAAA',
    levelId: SOURCE_LEVEL_ID,
    name: 'Phòng khách',
    usage: 'livingRoom',
    outline: [
      { x: 0, y: 0 },
      { x: 5000, y: 0 },
      { x: 5000, y: 4000 },
      { x: 0, y: 4000 },
    ],
    areaM2: 20,
    wallIds: ['W-000001AAAA', 'W-000002AAAA'],
    confidence: 0.85,
    source: 'ai',
    reviewed: true,
  },
];

const SAMPLE_FURNITURE: readonly Furniture[] = [
  {
    id: 'F-000001AAAA',
    levelId: SOURCE_LEVEL_ID,
    roomId: 'R-000001AAAA',
    kind: 'table',
    centre: { x: 2500, y: 2000 },
    boundingBox: { min: { x: 2000, y: 1600 }, max: { x: 3000, y: 2400 } },
    rotationDeg: 0,
    confidence: 0.6,
    source: 'ai',
    reviewed: false,
  },
];

const SAMPLE_AXES: readonly Axis[] = [
  {
    id: 'A-000001AAAA',
    levelId: SOURCE_LEVEL_ID,
    label: '1',
    direction: 'vertical',
    line: { start: { x: 0, y: 0 }, end: { x: 0, y: 4000 } },
    confidence: 1,
    source: 'human',
    reviewed: true,
  },
  {
    id: 'A-000002AAAA',
    levelId: SOURCE_LEVEL_ID,
    label: 'A',
    direction: 'horizontal',
    line: { start: { x: 0, y: 0 }, end: { x: 5000, y: 0 } },
    confidence: 1,
    source: 'human',
    reviewed: true,
  },
];

const SAMPLE_DIMENSIONS: readonly Dimension[] = [
  {
    id: 'M-000001AAAA',
    levelId: SOURCE_LEVEL_ID,
    kind: 'linear',
    referenceIds: ['W-000001AAAA', 'W-000002AAAA'],
    line: { start: { x: 0, y: -500 }, end: { x: 5000, y: -500 } },
    valueMm: 5000,
    confidence: 0.9,
    source: 'ai',
    reviewed: true,
  },
  {
    id: 'M-000002AAAA',
    levelId: SOURCE_LEVEL_ID,
    kind: 'linear',
    referenceIds: ['F-000001AAAA'],
    line: { start: { x: 2000, y: 1600 }, end: { x: 3000, y: 1600 } },
    valueMm: 1000,
    overrideValueMm: 1005,
    confidence: 0.5,
    source: 'ai',
    reviewed: false,
  },
];

const TYPICAL_FLOOR: FloorContents = {
  levelId: SOURCE_LEVEL_ID,
  walls: SAMPLE_WALLS,
  openings: SAMPLE_OPENINGS,
  rooms: SAMPLE_ROOMS,
  furniture: SAMPLE_FURNITURE,
  axes: SAMPLE_AXES,
  dimensions: SAMPLE_DIMENSIONS,
};

/** Objects on the source floor: 2 walls, 2 openings, 1 room, 1 item, 2 axes, 2 dimensions. */
const TYPICAL_FLOOR_COUNT = 10;

/* -------------------------------------------------------------------------- */
/* Aligning the sample stack.                                                  */
/* -------------------------------------------------------------------------- */

describe('the four sample storeys', () => {
  it('lines every one of them up to under 150 mm, with nothing to report', () => {
    const report = alignFloors(SAMPLE_FLOORS);

    expect(report.issues).toEqual([]);
    for (const entry of report.floors) {
      expect(entry.maxResidualMm).toBeLessThan(ALIGNMENT_WARNING_THRESHOLD_MM);
    }
  });

  it('takes the lowest of the equally well surveyed floors as the base', () => {
    expect(alignFloors(SAMPLE_FLOORS).baseLevelId).toBe('L-000001AAAA');
  });

  it('leaves the base floor exactly where it is', () => {
    const base = alignmentOf('L-000001AAAA');

    expect(base.isBase).toBe(true);
    expect(base.transform).toEqual({
      rotationDeg: 0,
      translationMm: { x: 0, y: 0 },
      scale: 1,
    });
    expect(base.maxResidualMm).toBe(0);
  });

  it('slides the second floor back the 40 mm it drifted', () => {
    const second = alignmentOf('L-000002AAAA');

    expect(second.transform.rotationDeg).toBe(0);
    expect(second.transform.translationMm).toEqual({ x: -40, y: 30 });
    expect(second.matchedAxisCount).toBe(6);
    expect(second.maxResidualMm).toBe(60);
  });

  it('turns the third floor back the quarter turn it was scanned at', () => {
    const third = alignmentOf('L-000003AAAA');

    expect(third.transform.rotationDeg).toBe(90);
    expect(third.transform.translationMm).toEqual({ x: 50, y: -100 });
    expect(third.maxResidualMm).toBe(0);
  });

  it('accepts the noisy fourth floor where it stands', () => {
    const fourth = alignmentOf('L-000004AAAA');

    expect(fourth.transform.rotationDeg).toBe(0);
    expect(fourth.transform.translationMm).toEqual({ x: 0, y: 0 });
    expect(fourth.maxResidualMm).toBe(100);
  });

  it('puts the aligned axes of every floor onto the base grid', () => {
    const third = alignmentOf('L-000003AAAA');
    const verticalMm = third.alignedAxes
      .filter((entry) => entry.direction === 'vertical')
      .map((entry) => entry.coordinateMm)
      .sort((first, second) => first - second);

    expect(verticalMm).toEqual(BASE_VERTICAL_MM);
  });

  it('returns the floors in the order they were given', () => {
    const report = alignFloors(SAMPLE_FLOORS);

    expect(report.floors.map((entry) => entry.levelId)).toEqual(
      SAMPLE_FLOORS.map((entry) => entry.levelId),
    );
  });

  it('never stretches a floor to make it fit', () => {
    const report = alignFloors(SAMPLE_FLOORS);

    expect(report.floors.every((entry) => entry.transform.scale === 1)).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Floors that do not fit.                                                     */
/* -------------------------------------------------------------------------- */

describe('a floor that does not line up', () => {
  /**
   * A floor whose middle axis sits 400 mm from where the base floor puts it.
   * No translation can absorb that: sliding the floor to meet the middle axis
   * only moves the outer two the same 400 mm the other way.
   */
  const DRIFTED: readonly FloorPlan[] = [
    SAMPLE_FLOORS[0] as FloorPlan,
    floor('L-000002AAAA', 'Tầng 2', 3300, 3000, grid([0, 4000, 8400], BASE_HORIZONTAL_MM)),
  ];

  it('is reported with its name and the millimetres', () => {
    const [issue] = alignFloors(DRIFTED).issues;

    expect(issue?.kind).toBe('alignment');
    expect(issue?.levelId).toBe('L-000002AAAA');
    expect(issue?.severity).toBe('attention');
    expect(issue?.amountMm).toBe(400);
    expect(issue?.message).toContain('Tầng 2');
    expect(issue?.message).toContain('400 mm');
    expect(issue?.message).toContain('150 mm');
  });

  it('is still placed as well as it can be, and never scaled', () => {
    const report = alignFloors(DRIFTED);
    const second = report.floors[1];

    expect(second?.transform.scale).toBe(1);
    expect(second?.maxResidualMm).toBe(400);
  });

  it('says nothing when the residual sits exactly on the threshold', () => {
    const onThreshold: readonly FloorPlan[] = [
      SAMPLE_FLOORS[0] as FloorPlan,
      floor('L-000002AAAA', 'Tầng 2', 3300, 3000, grid([0, 3750, 8400], BASE_HORIZONTAL_MM)),
    ];

    expect(alignFloors(onThreshold).floors[1]?.maxResidualMm).toBe(ALIGNMENT_WARNING_THRESHOLD_MM);
    expect(alignFloors(onThreshold).issues).toEqual([]);
  });

  it('takes a wider threshold from the caller', () => {
    expect(alignFloors(DRIFTED, { warningThresholdMm: millimetres(500) }).issues).toEqual([]);
  });
});

describe('a floor with nothing to align by', () => {
  const NO_AXES: readonly FloorPlan[] = [
    SAMPLE_FLOORS[0] as FloorPlan,
    floor('L-000002AAAA', 'Tầng 2', 3300, 3000, []),
  ];

  it('is reported as unalignable rather than moved on a guess', () => {
    const [issue] = alignFloors(NO_AXES).issues;

    expect(issue?.kind).toBe('unalignable');
    expect(issue?.message).toContain('Tầng 2');
    expect(issue?.message).toContain('0 trục');
  });

  it('is left exactly where it is', () => {
    const second = alignFloors(NO_AXES).floors[1];

    expect(second?.transform.translationMm).toEqual({ x: 0, y: 0 });
    expect(second?.matchedAxisCount).toBe(0);
  });

  it('is reported when one axis is not evidence enough either', () => {
    const oneAxis: readonly FloorPlan[] = [
      SAMPLE_FLOORS[0] as FloorPlan,
      floor('L-000002AAAA', 'Tầng 2', 3300, 3000, [axis('vertical', 40)]),
    ];

    expect(alignFloors(oneAxis).issues[0]?.kind).toBe('unalignable');
  });
});

/* -------------------------------------------------------------------------- */
/* Choosing the base floor.                                                    */
/* -------------------------------------------------------------------------- */

describe('which floor everything else is matched to', () => {
  it('is the one carrying the most axes', () => {
    const sparse = floor('L-000001AAAA', 'Tầng 1', 0, 3000, grid([0, 3600], []));
    const rich = floor('L-000002AAAA', 'Tầng 2', 3300, 3000, grid(BASE_VERTICAL_MM, BASE_HORIZONTAL_MM));

    expect(pickBaseFloor([sparse, rich])?.levelId).toBe('L-000002AAAA');
  });

  it('is the lowest of them when they carry the same', () => {
    const upper = floor('L-000002AAAA', 'Tầng 2', 3300, 3000, grid(BASE_VERTICAL_MM, []));
    const lower = floor('L-000001AAAA', 'Tầng 1', 0, 3000, grid(BASE_VERTICAL_MM, []));

    expect(pickBaseFloor([upper, lower])?.levelId).toBe('L-000001AAAA');
  });

  it('is nothing at all when there are no floors', () => {
    const report = alignFloors([]);

    expect(pickBaseFloor([])).toBeNull();
    expect(report.baseLevelId).toBeNull();
    expect(report.floors).toEqual([]);
  });

  it('is whichever floor the caller names', () => {
    const report = alignFloors(SAMPLE_FLOORS, { baseLevelId: 'L-000003AAAA' as LevelId });

    expect(report.baseLevelId).toBe('L-000003AAAA');
    expect(report.floors[2]?.isBase).toBe(true);
  });

  it('falls back to the best surveyed floor when the named one is not there', () => {
    const report = alignFloors(SAMPLE_FLOORS, { baseLevelId: 'L-999999ZZZZ' as LevelId });

    expect(report.baseLevelId).toBe('L-000001AAAA');
  });
});

/* -------------------------------------------------------------------------- */
/* Moving a floor.                                                             */
/* -------------------------------------------------------------------------- */

describe('moving plan geometry with its floor', () => {
  it('turns a point a quarter at a time about the origin', () => {
    const transform = {
      rotationDeg: 90,
      translationMm: { x: millimetres(0), y: millimetres(0) },
      scale: 1,
    } as const;

    expect(applyFloorTransform({ x: millimetres(1000), y: millimetres(0) }, transform)).toEqual({
      x: 0,
      y: 1000,
    });
  });

  it('rotates before it translates', () => {
    const transform = {
      rotationDeg: 180,
      translationMm: { x: millimetres(100), y: millimetres(200) },
      scale: 1,
    } as const;

    expect(applyFloorTransform({ x: millimetres(1000), y: millimetres(1000) }, transform)).toEqual({
      x: -900,
      y: -800,
    });
  });

  it('turns a vertical axis into a horizontal one, span and all', () => {
    const turned = transformAxis(axis('vertical', 3600, 0, 10000), {
      rotationDeg: 90,
      translationMm: { x: millimetres(0), y: millimetres(0) },
      scale: 1,
    });

    expect(turned.direction).toBe('horizontal');
    expect(turned.coordinateMm).toBe(3600);
    expect(turned.startMm).toBe(-10000);
    expect(turned.endMm).toBe(0);
  });

  it('keeps the walls an axis was found from', () => {
    const turned = transformAxis(axis('horizontal', 4200), {
      rotationDeg: 270,
      translationMm: { x: millimetres(0), y: millimetres(0) },
      scale: 1,
    });

    expect(turned.wallIds).toEqual(['W-000001AAAA', 'W-000002AAAA']);
  });
});

/* -------------------------------------------------------------------------- */
/* The vertical stack.                                                         */
/* -------------------------------------------------------------------------- */

describe('storey heights', () => {
  function stackWith(clearHeightMm: number): readonly FloorPlan[] {
    return [floor('L-000001AAAA', 'Tầng 1', 0, clearHeightMm, grid(BASE_VERTICAL_MM, []))];
  }

  it('accepts a normal storey', () => {
    expect(alignFloors(stackWith(3000)).issues).toEqual([]);
  });

  it('accepts both ends of the range', () => {
    expect(alignFloors(stackWith(MIN_CLEAR_HEIGHT_MM)).issues).toEqual([]);
    expect(alignFloors(stackWith(MAX_CLEAR_HEIGHT_MM)).issues).toEqual([]);
  });

  it('refuses a storey too low to stand up in', () => {
    const [issue] = alignFloors(stackWith(2200)).issues;

    expect(issue?.kind).toBe('clearHeight');
    expect(issue?.severity).toBe('violation');
    expect(issue?.amountMm).toBe(200);
    expect(issue?.message).toContain('Tầng 1');
    expect(issue?.message).toContain('2,200 m');
  });

  it('refuses a storey so tall it is a void', () => {
    const [issue] = alignFloors(stackWith(6500)).issues;

    expect(issue?.kind).toBe('clearHeight');
    expect(issue?.amountMm).toBe(500);
    expect(issue?.message).toContain('6,500 m');
  });

  it('measures the ceiling from the floor level plus the clear height', () => {
    expect(ceilingElevationMm(floor('L-000001AAAA', 'Tầng 1', 3300, 3000, []))).toBe(6300);
  });
});

describe('storeys sharing the same air', () => {
  const OVERLAPPING: readonly FloorPlan[] = [
    floor('L-000001AAAA', 'Tầng 1', 0, 3000, grid(BASE_VERTICAL_MM, [])),
    floor('L-000002AAAA', 'Tầng 2', 2800, 3000, grid(BASE_VERTICAL_MM, [])),
  ];

  it('are a violation, named in both directions', () => {
    const issue = alignFloors(OVERLAPPING).issues.find((entry) => entry.kind === 'overlap');

    expect(issue?.severity).toBe('violation');
    expect(issue?.levelId).toBe('L-000002AAAA');
    expect(issue?.relatedLevelId).toBe('L-000001AAAA');
    expect(issue?.amountMm).toBe(200);
    expect(issue?.message).toContain('Tầng 2');
    expect(issue?.message).toContain('Tầng 1');
    expect(issue?.message).toContain('200 mm');
  });

  it('are not reported when one storey starts exactly where the last one ends', () => {
    const touching: readonly FloorPlan[] = [
      floor('L-000001AAAA', 'Tầng 1', 0, 3000, grid(BASE_VERTICAL_MM, [])),
      floor('L-000002AAAA', 'Tầng 2', 3000, 3000, grid(BASE_VERTICAL_MM, [])),
    ];

    expect(alignFloors(touching).issues).toEqual([]);
  });

  it('are found however the floors were ordered in the list', () => {
    const reversed = [...OVERLAPPING].reverse();

    expect(alignFloors(reversed).issues.some((entry) => entry.kind === 'overlap')).toBe(true);
  });

  it('are reported once per pair, not once per floor above', () => {
    const three: readonly FloorPlan[] = [
      floor('L-000001AAAA', 'Tầng 1', 0, 3000, grid(BASE_VERTICAL_MM, [])),
      floor('L-000002AAAA', 'Tầng 2', 2800, 3000, grid(BASE_VERTICAL_MM, [])),
      floor('L-000003AAAA', 'Tầng 3', 5600, 3000, grid(BASE_VERTICAL_MM, [])),
    ];

    expect(alignFloors(three).issues.filter((entry) => entry.kind === 'overlap')).toHaveLength(2);
  });
});

/* -------------------------------------------------------------------------- */
/* Alignment on axes that came from real walls.                                */
/* -------------------------------------------------------------------------- */

describe('alignment over axes recovered from walls', () => {
  function geometryWall(id: string, xMm: number, fromYMm: number, toYMm: number): GeometryWall {
    return {
      id: `W-${id}`,
      kind: 'partition',
      centreline: {
        start: { x: millimetres(xMm), y: millimetres(fromYMm) },
        end: { x: millimetres(xMm), y: millimetres(toYMm) },
      },
      thicknessMm: millimetres(100),
      baseElevationMm: millimetres(0),
      topElevationMm: millimetres(3000),
    };
  }

  it('slides a traced floor back onto the one below', () => {
    const lower = detectAxes([
      geometryWall('a1', 0, 0, 4000),
      geometryWall('a2', 0, 4000, 8000),
      geometryWall('b1', 3600, 0, 4000),
      geometryWall('b2', 3600, 4000, 8000),
    ]);
    const upper = detectAxes([
      geometryWall('c1', 220, 0, 4000),
      geometryWall('c2', 220, 4000, 8000),
      geometryWall('d1', 3820, 0, 4000),
      geometryWall('d2', 3820, 4000, 8000),
    ]);

    const report = alignFloors([
      floor('L-000001AAAA', 'Tầng 1', 0, 3000, lower),
      floor('L-000002AAAA', 'Tầng 2', 3300, 3000, upper),
    ]);

    expect(report.floors[1]?.transform.translationMm).toEqual({ x: -220, y: 0 });
    expect(report.floors[1]?.maxResidualMm).toBe(0);
    expect(report.issues).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* Duplicating a typical floor.                                                */
/* -------------------------------------------------------------------------- */

describe('copying a typical floor', () => {
  it('brings every object across', () => {
    const result = copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID);

    expect(result.contents.walls).toHaveLength(2);
    expect(result.contents.openings).toHaveLength(2);
    expect(result.contents.rooms).toHaveLength(1);
    expect(result.contents.furniture).toHaveLength(1);
    expect(result.contents.axes).toHaveLength(2);
    expect(result.contents.dimensions).toHaveLength(2);
    expect(result.copiedCount).toBe(TYPICAL_FLOOR_COUNT);
    expect(result.droppedSourceIds).toEqual([]);
  });

  it('reuses no id from the floor it copied', () => {
    const result = copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID);
    const sourceIds = new Set<EntityId>(floorEntityIds(TYPICAL_FLOOR));
    const copiedIds = floorEntityIds(result.contents);

    expect(copiedIds).toHaveLength(TYPICAL_FLOOR_COUNT);
    expect(copiedIds.filter((id) => sourceIds.has(id))).toEqual([]);
  });

  it('gives every copied object an id of its own', () => {
    const copiedIds = floorEntityIds(copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID).contents);

    expect(new Set(copiedIds).size).toBe(copiedIds.length);
  });

  it('mints ids the graph recognises', () => {
    const copiedIds = floorEntityIds(copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID).contents);

    expect(copiedIds.every((id) => isValidId(id))).toBe(true);
  });

  it('puts everything on the target level', () => {
    const { contents } = copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID);

    expect(contents.levelId).toBe(TARGET_LEVEL_ID);
    expect(contents.walls.every((wall) => wall.levelId === TARGET_LEVEL_ID)).toBe(true);
    expect(contents.rooms.every((room) => room.levelId === TARGET_LEVEL_ID)).toBe(true);
    expect(contents.furniture.every((item) => item.levelId === TARGET_LEVEL_ID)).toBe(true);
    expect(contents.axes.every((entry) => entry.levelId === TARGET_LEVEL_ID)).toBe(true);
    expect(contents.dimensions.every((entry) => entry.levelId === TARGET_LEVEL_ID)).toBe(true);
  });

  it('returns the same copy every time it is asked', () => {
    const first = copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID);
    const second = copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID);

    expect(floorEntityIds(second.contents)).toEqual(floorEntityIds(first.contents));
    expect(second.contents).toEqual(first.contents);
  });

  it('refuses to copy a floor onto itself', () => {
    expect(() => copyFloor(TYPICAL_FLOOR, SOURCE_LEVEL_ID)).toThrow(RangeError);
  });
});

describe('what the copied objects point at', () => {
  it('points an opening at the copied wall it is cut into', () => {
    const { contents, idMap } = copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID);

    expect(contents.openings[0]?.wallId).toBe(idMap.get('W-000001AAAA'));
    expect(contents.openings[1]?.wallId).toBe(idMap.get('W-000002AAAA'));
  });

  it('points a wall back at its copied openings', () => {
    const { contents, idMap } = copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID);

    expect(contents.walls[0]?.openingIds).toEqual([idMap.get('D-000001AAAA')]);
  });

  it('points a room at the copied walls that bound it', () => {
    const { contents, idMap } = copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID);

    expect(contents.rooms[0]?.wallIds).toEqual([
      idMap.get('W-000001AAAA'),
      idMap.get('W-000002AAAA'),
    ]);
  });

  it('points furniture at the copied room it stands in', () => {
    const { contents, idMap } = copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID);

    expect(contents.furniture[0]?.roomId).toBe(idMap.get('R-000001AAAA'));
  });

  it('points a dimension at the copied objects it measures', () => {
    const { contents, idMap } = copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID);

    expect(contents.dimensions[0]?.referenceIds).toEqual([
      idMap.get('W-000001AAAA'),
      idMap.get('W-000002AAAA'),
    ]);
  });

  it('leaves no reference pointing back at the floor below', () => {
    const { contents } = copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID);
    const sourceIds = new Set<EntityId>(floorEntityIds(TYPICAL_FLOOR));
    const references: EntityId[] = [
      ...contents.walls.flatMap((wall) => [...wall.openingIds]),
      ...contents.openings.map((opening) => opening.wallId),
      ...contents.rooms.flatMap((room) => [...room.wallIds]),
      ...contents.dimensions.flatMap((entry) => [...entry.referenceIds]),
    ];

    expect(references.filter((id) => sourceIds.has(id))).toEqual([]);
  });
});

describe('what a copy carries and what it does not', () => {
  it('is never copied as reviewed', () => {
    const { contents } = copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID);
    const everyObject = [
      ...contents.walls,
      ...contents.openings,
      ...contents.rooms,
      ...contents.furniture,
      ...contents.axes,
      ...contents.dimensions,
    ];

    expect(everyObject.every((entry) => entry.reviewed === false)).toBe(true);
  });

  it('keeps where the geometry originally came from', () => {
    const { contents } = copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID);

    expect(contents.walls[0]?.source).toBe('ai');
    expect(contents.walls[1]?.source).toBe('human');
    expect(contents.walls[0]?.confidence).toBe(0.9);
  });

  it('keeps the axis labels, so B-3 upstairs is B-3 downstairs', () => {
    const { contents } = copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID);

    expect(contents.axes.map((entry) => entry.label)).toEqual(['1', 'A']);
  });

  it('keeps a dimension the user typed over', () => {
    const { contents } = copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID);

    expect(contents.dimensions[1]?.overrideValueMm).toBe(1005);
    expect(contents.dimensions[0]?.overrideValueMm).toBeUndefined();
  });

  it('clones the geometry instead of sharing it with the floor below', () => {
    const { contents } = copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID);
    const copiedCentreline = contents.walls[0]?.centreline;

    expect(copiedCentreline).toEqual(SAMPLE_WALLS[0]?.centreline);
    expect(copiedCentreline).not.toBe(SAMPLE_WALLS[0]?.centreline);
    expect(contents.rooms[0]?.outline[0]).not.toBe(SAMPLE_ROOMS[0]?.outline[0]);
    expect(contents.furniture[0]?.boundingBox).not.toBe(SAMPLE_FURNITURE[0]?.boundingBox);
  });

  it('does not touch the floor it copied', () => {
    copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID);

    expect(SAMPLE_WALLS[0]?.levelId).toBe(SOURCE_LEVEL_ID);
    expect(SAMPLE_WALLS[0]?.reviewed).toBe(true);
  });
});

describe('copying only part of a floor', () => {
  it('leaves the furniture behind when asked, and says so', () => {
    const result = copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID, { includeFurniture: false });

    expect(result.contents.furniture).toEqual([]);
    expect(result.droppedSourceIds).toContain('F-000001AAAA');
  });

  it('drops a dimension that has lost what it measured', () => {
    const result = copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID, { includeFurniture: false });

    expect(result.contents.dimensions).toHaveLength(1);
    expect(result.droppedSourceIds).toContain('M-000002AAAA');
    expect(result.copiedCount).toBe(TYPICAL_FLOOR_COUNT - 2);
  });

  it('empties the opening list of a wall whose openings stayed behind', () => {
    const result = copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID, { includeOpenings: false });

    expect(result.contents.openings).toEqual([]);
    expect(result.contents.walls.every((wall) => wall.openingIds.length === 0)).toBe(true);
  });

  it('keeps a room whose walls came across even when the rooms are switched off', () => {
    const result = copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID, { includeRooms: false });

    expect(result.contents.rooms).toEqual([]);
    expect(result.contents.furniture[0]?.roomId).toBeUndefined();
  });

  it('leaves the axes behind when asked', () => {
    const result = copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID, { includeAxes: false });

    expect(result.contents.axes).toEqual([]);
    expect(result.droppedSourceIds).toContain('A-000001AAAA');
  });
});

describe('minting the new ids', () => {
  it('uses the factory the caller injects', () => {
    let counter = 0;
    const createId: IdFactory = (kind, sourceId) => {
      counter += 1;
      const body = String(counter).padStart(6, '0');
      return `${sourceId.slice(0, 1)}-${body}ZZZZ` as EntityId;
    };

    const result = copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID, { createId });

    expect(counter).toBe(TYPICAL_FLOOR_COUNT);
    expect(result.contents.walls[0]?.id).toBe('W-000001ZZZZ');
  });

  it('refuses a factory that hands back an id already in use', () => {
    const createId: IdFactory = (_kind, sourceId) => sourceId;

    expect(() => copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID, { createId })).toThrow(/already in use/);
  });

  it('refuses a factory that hands back an id of the wrong kind', () => {
    const createId: IdFactory = () => 'R-999999ZZZZ' as EntityId;

    expect(() => copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID, { createId })).toThrow(/not a valid/);
  });

  it('steers clear of ids the caller says are in use elsewhere', () => {
    const plain = copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID);
    const firstWallId = plain.contents.walls[0]?.id ?? '';
    const guarded = copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID, { reservedIds: [firstWallId] });

    expect(guarded.contents.walls[0]?.id).not.toBe(firstWallId);
    expect(isValidId(guarded.contents.walls[0]?.id ?? '')).toBe(true);
  });

  it('maps every source id to exactly one copied id', () => {
    const { idMap } = copyFloor(TYPICAL_FLOOR, TARGET_LEVEL_ID);

    expect(idMap.size).toBe(TYPICAL_FLOOR_COUNT);
    expect(new Set(idMap.values()).size).toBe(TYPICAL_FLOOR_COUNT);
  });
});
