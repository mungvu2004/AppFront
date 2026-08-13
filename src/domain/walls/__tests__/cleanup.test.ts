import { describe, expect, it } from 'vitest';

import type { WallId } from '../../spatial/types';
import type { PointMm } from '../../units/compare';
import { degrees, millimetres, type Degrees, type Millimetres } from '../../units/types';
import {
  canUndoCleanupChange,
  cleanupWalls,
  CLEANUP_THRESHOLDS,
  nearestStandardThickness,
  STANDARD_THICKNESSES_MM,
  suggestStandardThickness,
  undoCleanupChange,
  type CleanupChange,
} from '../cleanup';
import { mergeWalls, orientationDifference, overlapAlongLine, splitWall } from '../edit';
import { resolveJoints } from '../joints';
import { centrelineLength, type Wall, type WallKind } from '../types';

/* -------------------------------------------------------------------------- */
/* Fixtures.                                                                   */
/* -------------------------------------------------------------------------- */

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
    thicknessMm: overrides.thicknessMm ?? millimetres(200),
    baseElevationMm: overrides.baseElevationMm ?? millimetres(0),
    topElevationMm: overrides.topElevationMm ?? millimetres(3000),
  };
}

/** Rooms per row and per column of the standard sample plan. */
const SAMPLE_COLUMNS = 4;
const SAMPLE_ROWS = 3;
const SAMPLE_ROOM_WIDTH_MM = 3000;
const SAMPLE_ROOM_DEPTH_MM = 2400;
const SAMPLE_ROOM_PITCH_MM = 5000;

/**
 * The standard sample plan: twelve rooms of four walls, 48 walls in all.
 *
 * Every corner is an exact shared point, every run is on an axis, nothing
 * overlaps and nothing is short — so a cleanup pass has nothing to say about it.
 */
function buildSampleWalls(): readonly Wall[] {
  const walls: Wall[] = [];

  for (let row = 0; row < SAMPLE_ROWS; row += 1) {
    for (let column = 0; column < SAMPLE_COLUMNS; column += 1) {
      const room = row * SAMPLE_COLUMNS + column + 1;
      const left = column * SAMPLE_ROOM_PITCH_MM;
      const bottom = row * SAMPLE_ROOM_PITCH_MM;
      const right = left + SAMPLE_ROOM_WIDTH_MM;
      const top = bottom + SAMPLE_ROOM_DEPTH_MM;
      const corners = [
        point(left, bottom),
        point(right, bottom),
        point(right, top),
        point(left, top),
      ];

      corners.forEach((from, side) => {
        const to = corners[(side + 1) % corners.length];
        if (to === undefined) {
          throw new Error('The sample plan lost a corner.');
        }
        walls.push(makeWall(`W-${String(room)}-${String(side + 1)}`, from, to));
      });
    }
  }

  return walls;
}

const SAMPLE_WALLS = buildSampleWalls();

/**
 * A traced plan with one defect of each kind.
 *
 * `W-1` and `W-2` form a corner that misses by 40 mm; `W-3` is a 12 mm stub left
 * behind by the tracer; `W-4` leans 0,9° off horizontal; `W-5` and `W-6` are one
 * run cut in two with a 20 mm overlap.
 */
const MESSY_WALLS: readonly Wall[] = [
  makeWall('W-1', point(0, 0), point(5000, 0)),
  makeWall('W-2', point(5040, 0), point(5040, 4000)),
  makeWall('W-3', point(9000, 9000), point(9012, 9000)),
  makeWall('W-4', point(0, 12000), point(6000, 12094)),
  makeWall('W-5', point(0, 20000), point(3000, 20000)),
  makeWall('W-6', point(2980, 20000), point(6000, 20000)),
];

function wallById(walls: readonly Wall[], wallId: WallId): Wall {
  const wall = walls.find((candidate) => candidate.id === wallId);
  if (wall === undefined) {
    throw new Error(`No wall ${wallId}.`);
  }
  return wall;
}

function byId(walls: readonly Wall[]): readonly Wall[] {
  return [...walls].sort((first, second) => (first.id < second.id ? -1 : 1));
}

function leanOffAxisDeg(wall: Wall): Degrees {
  const runX = wall.centreline.end.x - wall.centreline.start.x;
  const runY = wall.centreline.end.y - wall.centreline.start.y;
  const bearing = (Math.atan2(runY, runX) * 180) / Math.PI;
  return degrees(Math.abs(bearing - Math.round(bearing / 90) * 90));
}

/* -------------------------------------------------------------------------- */
/* splitWall.                                                                   */
/* -------------------------------------------------------------------------- */

describe('splitWall', () => {
  const wall = makeWall('W-1', point(0, 0), point(6000, 0));

  it('cuts a wall in two pieces that share one exact point', () => {
    const outcome = splitWall(wall, point(2000, 0), 'W-2');

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    const [first, second] = outcome.walls;
    expect(first.id).toBe('W-1');
    expect(second.id).toBe('W-2');
    expect(first.centreline.end).toEqual(second.centreline.start);
    expect(centrelineLength(first)).toBeCloseTo(2000, 6);
    expect(centrelineLength(second)).toBeCloseTo(4000, 6);
  });

  it('drops a point beside the wall onto the centreline', () => {
    const outcome = splitWall(wall, point(2000, 350), 'W-2');

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    expect(outcome.walls[0].centreline.end.x).toBeCloseTo(2000, 6);
    expect(outcome.walls[0].centreline.end.y).toBeCloseTo(0, 6);
  });

  it('keeps everything else about the wall', () => {
    const outcome = splitWall(wall, point(2000, 0), 'W-2');

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    for (const piece of outcome.walls) {
      expect(piece.kind).toBe(wall.kind);
      expect(piece.thicknessMm).toBe(wall.thicknessMm);
      expect(piece.baseElevationMm).toBe(wall.baseElevationMm);
      expect(piece.topElevationMm).toBe(wall.topElevationMm);
    }
  });

  it('refuses a point beyond either end', () => {
    expect(splitWall(wall, point(-500, 0), 'W-2')).toEqual({ ok: false, reason: 'pointOffWall' });
    expect(splitWall(wall, point(6500, 0), 'W-2')).toEqual({ ok: false, reason: 'pointOffWall' });
  });

  it('refuses a cut that would leave a stub', () => {
    expect(splitWall(wall, point(20, 0), 'W-2')).toEqual({ ok: false, reason: 'pieceTooShort' });
    expect(splitWall(wall, point(5990, 0), 'W-2')).toEqual({ ok: false, reason: 'pieceTooShort' });
  });

  it('never writes to the wall it was given', () => {
    const original = JSON.stringify(wall);

    splitWall(wall, point(2000, 0), 'W-2');

    expect(JSON.stringify(wall)).toBe(original);
  });
});

/* -------------------------------------------------------------------------- */
/* mergeWalls.                                                                  */
/* -------------------------------------------------------------------------- */

describe('mergeWalls', () => {
  const left = makeWall('W-1', point(0, 0), point(3000, 0));
  const right = makeWall('W-2', point(2980, 0), point(6000, 0));

  it('joins two runs into the span between their outer ends', () => {
    const outcome = mergeWalls(left, right);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    expect(outcome.wall.centreline.start).toEqual(point(0, 0));
    expect(outcome.wall.centreline.end).toEqual(point(6000, 0));
    expect(outcome.removedId).toBe('W-1');
    expect(outcome.wall.id).toBe('W-2');
  });

  it('gives the same answer whichever way round the walls come', () => {
    expect(mergeWalls(left, right)).toEqual(mergeWalls(right, left));
  });

  it('joins runs drawn in opposite directions', () => {
    const reversed = makeWall('W-2', point(6000, 0), point(2980, 0));

    expect(mergeWalls(left, reversed).ok).toBe(true);
  });

  it('refuses two kinds of wall', () => {
    const other = makeWall('W-2', point(2980, 0), point(6000, 0), { kind: 'loadBearing' });

    expect(mergeWalls(left, other)).toEqual({ ok: false, reason: 'kindMismatch' });
  });

  it('refuses two thicknesses', () => {
    const other = makeWall('W-2', point(2980, 0), point(6000, 0), {
      thicknessMm: millimetres(300),
    });

    expect(mergeWalls(left, other)).toEqual({ ok: false, reason: 'thicknessMismatch' });
  });

  it('refuses walls sitting at different heights', () => {
    const other = makeWall('W-2', point(2980, 0), point(6000, 0), {
      baseElevationMm: millimetres(3000),
      topElevationMm: millimetres(6000),
    });

    expect(mergeWalls(left, other)).toEqual({ ok: false, reason: 'elevationMismatch' });
  });

  it('accepts a lean just under two degrees and refuses one just over', () => {
    const under = makeWall('W-2', point(2980, 0), point(6000, 104));
    const over = makeWall('W-2', point(2980, 0), point(6000, 112));

    expect(orientationDifference(left, under)).toBeLessThan(2);
    expect(orientationDifference(left, over)).toBeGreaterThan(2);
    expect(mergeWalls(left, under).ok).toBe(true);
    expect(mergeWalls(left, over)).toEqual({ ok: false, reason: 'angleTooWide' });
  });

  it('refuses a parallel run too far off the line', () => {
    const parallel = makeWall('W-2', point(2980, 400), point(6000, 400));

    expect(mergeWalls(left, parallel)).toEqual({ ok: false, reason: 'tooFarApart' });
  });

  it('refuses a wall merged with itself', () => {
    expect(mergeWalls(left, left)).toEqual({ ok: false, reason: 'sameWall' });
  });

  it('absorbs a short run that sits inside a longer one', () => {
    const inside = makeWall('W-2', point(1000, 0), point(1060, 0));
    const outcome = mergeWalls(left, inside);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    expect(outcome.wall.centreline).toEqual(left.centreline);
    expect(outcome.removedId).toBe('W-2');
  });

  it('never writes to the walls it was given', () => {
    const before = JSON.stringify([left, right]);

    mergeWalls(left, right);

    expect(JSON.stringify([left, right])).toBe(before);
  });
});

describe('overlapAlongLine', () => {
  it('measures how far two runs cover each other', () => {
    const left = makeWall('W-1', point(0, 0), point(3000, 0));
    const right = makeWall('W-2', point(2980, 0), point(6000, 0));

    expect(overlapAlongLine(left, right)).toBeCloseTo(20, 6);
  });

  it('goes negative when the runs stop short of each other', () => {
    const left = makeWall('W-1', point(0, 0), point(3000, 0));
    const right = makeWall('W-2', point(3060, 0), point(6000, 0));

    expect(overlapAlongLine(left, right)).toBeCloseTo(-60, 6);
  });
});

/* -------------------------------------------------------------------------- */
/* The four steps.                                                              */
/* -------------------------------------------------------------------------- */

const STEP_ORDER: readonly CleanupChange['step'][] = [
  'removeSliver',
  'weldGap',
  'straighten',
  'mergeOverlap',
];

function changeAbout(
  log: readonly CleanupChange[],
  step: CleanupChange['step'],
  wallId: WallId,
): CleanupChange {
  const change = log.find(
    (candidate) => candidate.step === step && candidate.wallIds.includes(wallId),
  );
  if (change === undefined) {
    throw new Error(`The log has no ${step} entry about ${wallId}.`);
  }
  return change;
}

describe('cleanupWalls, step by step', () => {
  const result = cleanupWalls(MESSY_WALLS);

  it('runs the four steps in the order the brief fixes', () => {
    const ranks = result.log.map((change) => ({
      pass: change.pass,
      rank: STEP_ORDER.indexOf(change.step),
    }));

    expect(ranks.every((entry) => entry.rank >= 0)).toBe(true);
    ranks.forEach((entry, index) => {
      const previous = ranks[index - 1];
      if (previous !== undefined && previous.pass === entry.pass) {
        expect(entry.rank).toBeGreaterThanOrEqual(previous.rank);
      }
    });
  });

  it('removes the stub and says how long it was', () => {
    const change = changeAbout(result.log, 'removeSliver', 'W-3');

    expect(change.wallIds).toEqual(['W-3']);
    expect(change.message).toBe('Đã xoá tường W-3 chỉ dài 12 mm, ngắn hơn 30 mm.');
    expect(result.walls.some((wall) => wall.id === 'W-3')).toBe(false);
  });

  it('welds the corner that missed by 40 mm onto one point', () => {
    const change = changeAbout(result.log, 'weldGap', 'W-1');

    expect(change.message).toBe(
      'Đã hàn 2 đầu tường lệch nhau tới 40 mm về một điểm chung: W-1, W-2.',
    );
    expect(wallById(result.walls, 'W-1').centreline.end).toEqual(
      wallById(result.walls, 'W-2').centreline.start,
    );
    expect(resolveJoints(result.walls).joints).toHaveLength(1);
  });

  it('straightens the leaning run onto the horizontal', () => {
    const change = changeAbout(result.log, 'straighten', 'W-4');

    expect(change.message).toBe('Đã nắn tường W-4 đang lệch 0,9° về đúng phương ngang.');
    expect(wallById(result.walls, 'W-4').centreline.end.y).toBeCloseTo(12000, 6);
    expect(centrelineLength(wallById(result.walls, 'W-4'))).toBeCloseTo(
      centrelineLength(wallById(MESSY_WALLS, 'W-4')),
      6,
    );
  });

  it('squares the wall that welding tilted, and says so', () => {
    const change = changeAbout(result.log, 'straighten', 'W-2');

    expect(change.message).toBe('Đã nắn tường W-2 đang lệch 0,3° về đúng phương dọc.');
    expect(wallById(result.walls, 'W-2').centreline.start.x).toBeCloseTo(
      wallById(result.walls, 'W-2').centreline.end.x,
      6,
    );
  });

  it('merges the two halves that were traced with a 20 mm overlap', () => {
    const change = changeAbout(result.log, 'mergeOverlap', 'W-5');

    expect(change.message).toBe(
      'Đã gộp tường W-5 vào W-6 vì thẳng hàng và nối tiếp nhau tại một điểm.',
    );
    expect(result.walls.some((wall) => wall.id === 'W-5')).toBe(false);
    expect(wallById(result.walls, 'W-6').centreline).toEqual({
      start: point(0, 20000),
      end: point(6000, 20000),
    });
  });

  it('leaves the walls it did not touch exactly as they were', () => {
    expect(wallById(result.walls, 'W-1').thicknessMm).toBe(millimetres(200));
    expect(wallById(result.walls, 'W-1').centreline.start).toEqual(point(0, 0));
  });

  it('never writes to the walls it was given', () => {
    const before = JSON.stringify(MESSY_WALLS);

    cleanupWalls(MESSY_WALLS);

    expect(JSON.stringify(MESSY_WALLS)).toBe(before);
  });
});

/* -------------------------------------------------------------------------- */
/* What the cleanup refuses to do.                                              */
/* -------------------------------------------------------------------------- */

describe('cleanupWalls, what it leaves alone', () => {
  it('leaves a gap of 120 mm open', () => {
    const walls = [
      makeWall('W-1', point(0, 0), point(5000, 0)),
      makeWall('W-2', point(5120, 0), point(5120, 4000)),
    ];

    expect(cleanupWalls(walls).log).toEqual([]);
  });

  it('leaves a lean of 2 degrees alone', () => {
    const walls = [makeWall('W-1', point(0, 0), point(6000, 210))];

    expect(leanOffAxisDeg(wallById(walls, 'W-1'))).toBeGreaterThan(
      CLEANUP_THRESHOLDS.straightenAngleDeg,
    );
    expect(cleanupWalls(walls).log).toEqual([]);
  });

  it('leaves a wide overlap for a person to look at', () => {
    const walls = [
      makeWall('W-1', point(0, 0), point(3000, 0)),
      makeWall('W-2', point(2800, 0), point(6000, 0)),
    ];

    expect(overlapAlongLine(wallById(walls, 'W-1'), wallById(walls, 'W-2'))).toBeCloseTo(200, 6);
    expect(cleanupWalls(walls).log).toEqual([]);
    expect(cleanupWalls(walls).walls).toHaveLength(2);
  });

  it('leaves the two halves of a run apart when a branch meets them', () => {
    const walls = [
      makeWall('W-1', point(0, 0), point(5020, 0)),
      makeWall('W-2', point(5000, 0), point(10000, 0)),
      makeWall('W-3', point(5010, 0), point(5010, 4000)),
    ];

    const result = cleanupWalls(walls);

    expect(result.walls).toHaveLength(3);
    expect(result.log.every((change) => change.step !== 'mergeOverlap')).toBe(true);
    expect(resolveJoints(result.walls).joints.map((joint) => joint.kind)).toEqual(['tee']);
  });

  it('never welds an end across a wall short enough to collapse', () => {
    const walls = [
      makeWall('W-1', point(0, 0), point(5000, 0)),
      makeWall('W-2', point(5000, 0), point(5000, 60)),
      makeWall('W-3', point(5000, 95), point(9000, 95)),
    ];

    const result = cleanupWalls(walls);

    expect(result.walls).toHaveLength(3);
    expect(centrelineLength(wallById(result.walls, 'W-2'))).toBeCloseTo(60, 6);
  });

  it('will not straighten a run that is welded at both ends', () => {
    const walls = [
      makeWall('W-1', point(0, 0), point(0, 4000)),
      makeWall('W-2', point(0, 4000), point(6000, 4094)),
      makeWall('W-3', point(6000, 4094), point(6000, 9000)),
    ];

    const result = cleanupWalls(walls);

    expect(result.log.every((change) => change.step !== 'straighten')).toBe(true);
    expect(wallById(result.walls, 'W-2').centreline).toEqual(wallById(walls, 'W-2').centreline);
  });

  it('refuses a thickness outside the allowed range rather than repairing it', () => {
    const walls = [makeWall('W-1', point(0, 0), point(5000, 0), { thicknessMm: millimetres(45) })];

    expect(() => cleanupWalls(walls)).toThrow(RangeError);
  });

  it('never changes a thickness, however close to a standard value it is', () => {
    const walls = [makeWall('W-1', point(0, 0), point(5000, 0), { thicknessMm: millimetres(205) })];

    const result = cleanupWalls(walls);

    expect(wallById(result.walls, 'W-1').thicknessMm).toBe(millimetres(205));
    expect(result.log).toEqual([]);
    expect(result.thicknessSuggestions).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------------- */
/* The two properties the brief insists on.                                     */
/* -------------------------------------------------------------------------- */

describe('cleanupWalls, running it twice', () => {
  const scenarios: readonly (readonly [string, readonly Wall[]])[] = [
    ['the messy plan', MESSY_WALLS],
    ['the sample plan', SAMPLE_WALLS],
    [
      'a chain of near misses',
      [
        makeWall('W-1', point(0, 0), point(4000, 0)),
        makeWall('W-2', point(4060, 30), point(4060, 4000)),
        makeWall('W-3', point(4090, 60), point(8000, 75)),
        makeWall('W-4', point(8000, 75), point(8000, 4000)),
      ],
    ],
    [
      'a run cut into four leaning pieces',
      [
        makeWall('W-1', point(0, 0), point(3000, 40)),
        makeWall('W-2', point(2980, 40), point(6000, 40)),
        makeWall('W-3', point(6000, 40), point(9000, 20)),
        makeWall('W-4', point(8940, 20), point(12000, 20)),
      ],
    ],
  ];

  it.each(scenarios)('settles after one run: %s', (_name, walls) => {
    const once = cleanupWalls(walls);
    const twice = cleanupWalls(once.walls);

    expect(twice.log).toEqual([]);
    expect(twice.walls).toEqual(once.walls);
  });

  it.each(scenarios)('logs every change it made: %s', (_name, walls) => {
    const result = cleanupWalls(walls);
    const restored = result.log.reduceRight<readonly Wall[] | null>(
      (current, change) => (current === null ? null : undoCleanupChange(current, change)),
      result.walls,
    );

    expect(restored).not.toBeNull();
    expect(byId(restored ?? [])).toEqual(byId(walls));
  });

  it.each(scenarios)('numbers the log without gaps: %s', (_name, walls) => {
    const { log } = cleanupWalls(walls);

    expect(log.map((change) => change.id)).toEqual(
      log.map((_change, index) => `C-${String(index + 1)}`),
    );
    expect(log.every((change) => change.pass >= 1)).toBe(true);
  });
});

describe('cleanupWalls, the standard sample plan', () => {
  it('holds 48 walls before and after', () => {
    expect(SAMPLE_WALLS).toHaveLength(48);
    expect(cleanupWalls(SAMPLE_WALLS).walls).toHaveLength(48);
  });

  it('has nothing to report about a plan that is already clean', () => {
    const result = cleanupWalls(SAMPLE_WALLS);

    expect(result.log).toEqual([]);
    expect(result.thicknessSuggestions).toEqual([]);
    expect(result.walls).toEqual(SAMPLE_WALLS);
  });
});

/* -------------------------------------------------------------------------- */
/* Undoing one entry at a time.                                                 */
/* -------------------------------------------------------------------------- */

describe('undoCleanupChange', () => {
  const result = cleanupWalls(MESSY_WALLS);

  it('puts a removed wall back where it was', () => {
    const change = changeAbout(result.log, 'removeSliver', 'W-3');
    const restored = undoCleanupChange(result.walls, change);

    expect(restored).not.toBeNull();
    expect(restored?.some((wall) => wall.id === 'W-3')).toBe(true);
    expect(restored?.[change.position]).toEqual(wallById(MESSY_WALLS, 'W-3'));
  });

  it('puts the last change to a welded end back', () => {
    const change = changeAbout(result.log, 'straighten', 'W-2');
    const restored = undoCleanupChange(result.walls, change) ?? [];

    expect(wallById(restored, 'W-2').centreline).toEqual(change.before[0]?.centreline);
    expect(canUndoCleanupChange(restored, change)).toBe(false);
  });

  it('splits a merged wall back into the two it came from', () => {
    const change = changeAbout(result.log, 'mergeOverlap', 'W-5');
    const restored = undoCleanupChange(result.walls, change) ?? [];

    expect(restored).toHaveLength(result.walls.length + 1);
    expect(wallById(restored, 'W-5').centreline.end).toEqual(
      wallById(restored, 'W-6').centreline.start,
    );
    expect(wallById(restored, 'W-5').centreline.start).toEqual(point(0, 20000));
    expect(wallById(restored, 'W-6').centreline.end).toEqual(point(6000, 20000));
  });

  it('refuses an entry whose result is no longer there', () => {
    const change = changeAbout(result.log, 'weldGap', 'W-1');
    const withoutIt = result.walls.filter((wall) => wall.id !== 'W-1');

    expect(canUndoCleanupChange(withoutIt, change)).toBe(false);
    expect(undoCleanupChange(withoutIt, change)).toBeNull();
  });

  it('refuses an entry a later one has already built on', () => {
    const welded = changeAbout(result.log, 'weldGap', 'W-1');

    expect(canUndoCleanupChange(result.walls, welded)).toBe(false);
  });

  it('never writes to the walls it was given', () => {
    const change = changeAbout(result.log, 'removeSliver', 'W-3');
    const before = JSON.stringify(result.walls);

    undoCleanupChange(result.walls, change);

    expect(JSON.stringify(result.walls)).toBe(before);
  });
});

/* -------------------------------------------------------------------------- */
/* Thickness: suggested, never applied.                                         */
/* -------------------------------------------------------------------------- */

describe('nearestStandardThickness', () => {
  it('rounds a measurement onto the nearest standard value', () => {
    expect(nearestStandardThickness(millimetres(205))).toBe(millimetres(200));
    expect(nearestStandardThickness(millimetres(213))).toBe(millimetres(220));
    expect(nearestStandardThickness(millimetres(392))).toBe(millimetres(400));
  });

  it('says nothing about a thickness that is already standard', () => {
    for (const standard of STANDARD_THICKNESSES_MM) {
      expect(nearestStandardThickness(standard)).toBeNull();
    }
  });

  it('says nothing about a measurement 15 mm or further out', () => {
    expect(nearestStandardThickness(millimetres(235))).toBeNull();
    expect(nearestStandardThickness(millimetres(185))).toBeNull();
    expect(nearestStandardThickness(millimetres(260))).toBeNull();
  });

  it('takes a limit from the caller', () => {
    expect(nearestStandardThickness(millimetres(235), millimetres(20))).toBe(millimetres(220));
  });
});

describe('suggestStandardThickness', () => {
  it('offers the rounding in Vietnamese and leaves the wall alone', () => {
    const walls = [makeWall('W-1', point(0, 0), point(5000, 0), { thicknessMm: millimetres(206) })];
    const [suggestion] = suggestStandardThickness(walls);

    expect(suggestion?.message).toBe(
      'Có thể đưa độ dày tường W-1 từ 206 mm về chuẩn 200 mm, lệch 6 mm.',
    );
    expect(suggestion?.suggestedMm).toBe(millimetres(200));
    expect(suggestion?.differenceMm).toBe(millimetres(6));
    expect(wallById(walls, 'W-1').thicknessMm).toBe(millimetres(206));
  });

  it('says nothing about walls that are already standard', () => {
    expect(suggestStandardThickness(SAMPLE_WALLS)).toEqual([]);
  });

  it('offers one suggestion per wall that needs one', () => {
    const walls = [
      makeWall('W-1', point(0, 0), point(5000, 0), { thicknessMm: millimetres(206) }),
      makeWall('W-2', point(0, 500), point(5000, 500), { thicknessMm: millimetres(200) }),
      makeWall('W-3', point(0, 1000), point(5000, 1000), { thicknessMm: millimetres(148) }),
    ];

    expect(suggestStandardThickness(walls).map((suggestion) => suggestion.wallId)).toEqual([
      'W-1',
      'W-3',
    ]);
  });
});
