import { describe, expect, it } from 'vitest';

import {
  SAMPLE_BUILDING,
  SAMPLE_ROOM_COUNT,
  SAMPLE_TOTAL_AREA_M2,
} from '../../spatial/__fixtures__/sampleBuilding';
import type { WallId } from '../../spatial/types';
import type { PointMm } from '../../units/compare';
import { millimetres, SQUARE_MILLIMETRES_PER_SQUARE_METRE } from '../../units/types';
import type { Wall } from '../../walls/types';
import { detectRooms } from '../detect';
import {
  AREA_DECIMALS,
  computeArea,
  computeCentroid,
  computeLargestInnerRectangle,
  computePerimeter,
  explainArea,
  explainRoom,
  outlineContains,
  signedAreaMm2,
  totalArea,
} from '../area';

/* -------------------------------------------------------------------------- */
/* Fixtures.                                                                   */
/* -------------------------------------------------------------------------- */

function point(x: number, y: number): PointMm {
  return { x: millimetres(x), y: millimetres(y) };
}

function rectangle(widthMm: number, depthMm: number): readonly PointMm[] {
  return [point(0, 0), point(widthMm, 0), point(widthMm, depthMm), point(0, depthMm)];
}

/**
 * An L: a 6000 × 4000 room with a 2000 × 1500 bite out of the north-east.
 *
 * 24,00 m² less 3,00 m² leaves 21,00 m², which no bounding box would give.
 */
const L_SHAPED_ROOM: readonly PointMm[] = [
  point(0, 0),
  point(6000, 0),
  point(6000, 2500),
  point(4000, 2500),
  point(4000, 4000),
  point(0, 4000),
];

/**
 * A U: the same 6000 × 4000 room with a 2000 × 3000 slot up the middle.
 *
 * 24,00 m² less 6,00 m² leaves 18,00 m². The slot is what puts the centre of
 * area outside the floor, which is the case a label has to survive.
 */
const U_SHAPED_ROOM: readonly PointMm[] = [
  point(0, 0),
  point(6000, 0),
  point(6000, 4000),
  point(4000, 4000),
  point(4000, 1000),
  point(2000, 1000),
  point(2000, 4000),
  point(0, 4000),
];

/**
 * The fourteen rooms of the standard sample building, as outlines.
 *
 * The width is fixed and the depth follows from the standard area, so each
 * outline measures exactly what the sample schedule says it does: thirteen of
 * 17,00 m² and one of 27,60 m². Both depths come out a whole number of
 * millimetres, which the first test checks rather than assumes.
 */
const SAMPLE_ROOM_WIDTH_MM = 4000;

function createSampleRoomOutlines(): readonly (readonly PointMm[])[] {
  return SAMPLE_BUILDING.rooms.map((room, index) => {
    const targetMm2 = Math.round(room.areaM2 * SQUARE_MILLIMETRES_PER_SQUARE_METRE);
    const depthMm = targetMm2 / SAMPLE_ROOM_WIDTH_MM;
    const left = index * SAMPLE_ROOM_WIDTH_MM;

    return [
      point(left, 0),
      point(left + SAMPLE_ROOM_WIDTH_MM, 0),
      point(left + SAMPLE_ROOM_WIDTH_MM, depthMm),
      point(left, depthMm),
    ];
  });
}

const SAMPLE_ROOM_OUTLINES = createSampleRoomOutlines();

/** Reads a Vietnamese-formatted number back, for checking the explanation. */
function parseVietnameseNumber(text: string): number {
  return Number(text.replace(/\./gu, '').replace(',', '.'));
}

/* -------------------------------------------------------------------------- */
/* Tests.                                                                      */
/* -------------------------------------------------------------------------- */

describe('the standard sample schedule', () => {
  it('is fourteen rooms, each on the millimetre grid', () => {
    expect(SAMPLE_ROOM_OUTLINES).toHaveLength(SAMPLE_ROOM_COUNT);

    for (const outline of SAMPLE_ROOM_OUTLINES) {
      for (const corner of outline) {
        expect(Number.isInteger(corner.x)).toBe(true);
        expect(Number.isInteger(corner.y)).toBe(true);
      }
    }
  });

  it('measures each room back to the area the schedule declares', () => {
    SAMPLE_BUILDING.rooms.forEach((room, index) => {
      expect(computeArea(SAMPLE_ROOM_OUTLINES[index] ?? [])).toBe(room.areaM2);
    });
  });

  it('adds up to exactly 248 600 000 mm², with nothing lost on the way', () => {
    const totalMm2 = SAMPLE_ROOM_OUTLINES.reduce(
      (sum, outline) => sum + signedAreaMm2(outline),
      0,
    );

    // Whole millimetres give whole cross products, so this is an exact integer
    // rather than a figure that happens to be close to one.
    expect(Number.isInteger(totalMm2)).toBe(true);
    expect(totalMm2).toBe(248_600_000);
  });

  it('totals exactly 248,60 m²', () => {
    expect(totalArea(SAMPLE_ROOM_OUTLINES)).toBe(SAMPLE_TOTAL_AREA_M2);
    expect(totalArea(SAMPLE_ROOM_OUTLINES)).toBe(248.6);
  });

  it('totals the same whether the rooms are listed forwards or backwards', () => {
    expect(totalArea([...SAMPLE_ROOM_OUTLINES].reverse())).toBe(SAMPLE_TOTAL_AREA_M2);
  });
});

describe('the shoelace sum', () => {
  it('measures a plain rectangle', () => {
    expect(computeArea(rectangle(5000, 4000))).toBe(20);
  });

  it('gives the same area whichever way round the corners are listed', () => {
    const clockwise = [...rectangle(5000, 4000)].reverse();

    expect(computeArea(clockwise)).toBe(computeArea(rectangle(5000, 4000)));
  });

  it('keeps the sign, so an outside boundary can still be told apart', () => {
    expect(signedAreaMm2(rectangle(5000, 4000))).toBe(20_000_000);
    expect(signedAreaMm2([...rectangle(5000, 4000)].reverse())).toBe(-20_000_000);
  });

  it('holds up on a concave outline, where a bounding box would not', () => {
    expect(computeArea(L_SHAPED_ROOM)).toBe(21);
    expect(computeArea(U_SHAPED_ROOM)).toBe(18);
  });

  it('measures a concave outline the same as its parts measured separately', () => {
    // The L is a 6000 × 2500 band with a 4000 × 1500 block on top of it.
    const band = 6000 * 2500;
    const block = 4000 * 1500;

    expect(signedAreaMm2(L_SHAPED_ROOM)).toBe(band + block);
  });

  it('measures a shape that encloses nothing as nothing', () => {
    expect(computeArea([point(0, 0), point(1000, 0)])).toBe(0);
    expect(computeArea([])).toBe(0);
  });

  it('refuses coordinates too large to add up exactly', () => {
    const huge = 1e9;

    expect(() => computeArea(rectangle(huge, huge))).toThrow(RangeError);
  });

  it('leaves the outline it was given untouched', () => {
    const before = JSON.stringify(L_SHAPED_ROOM);
    computeArea(L_SHAPED_ROOM);
    computeCentroid(L_SHAPED_ROOM);
    computeLargestInnerRectangle(L_SHAPED_ROOM);

    expect(JSON.stringify(L_SHAPED_ROOM)).toBe(before);
  });
});

describe('rounding once, at the end', () => {
  /** 125 × 100 mm is 12 500 mm², which is 0,0125 m² — right on a half. */
  const SLIVER: readonly PointMm[] = rectangle(125, 100);

  it('rounds a half away from zero', () => {
    expect(computeArea(SLIVER)).toBe(0.01);
  });

  it('does not round the rooms before adding them up', () => {
    const three = [SLIVER, SLIVER, SLIVER];
    const roundedThenAdded = three.reduce((sum, outline) => sum + computeArea(outline), 0);

    // Rounding first loses a hundredth; the whole point of `totalArea` is that
    // it adds the square millimetres and rounds the total instead.
    expect(roundedThenAdded).toBeCloseTo(0.03, 10);
    expect(totalArea(three)).toBe(0.04);
  });

  it('publishes two decimals and no more', () => {
    const area = computeArea(rectangle(3333, 3333));

    expect(AREA_DECIMALS).toBe(2);
    expect(Math.round(area * 100)).toBe(area * 100);
  });

  it('never hands back a negative zero', () => {
    expect(Object.is(computeArea([point(0, 0), point(1000, 0), point(2000, 0)]), 0)).toBe(true);
  });
});

describe('the perimeter', () => {
  it('closes back to the first corner', () => {
    expect(computePerimeter(rectangle(5000, 4000))).toBe(18_000);
  });

  it('follows a concave outline round every step', () => {
    expect(computePerimeter(L_SHAPED_ROOM)).toBe(20_000);
    expect(computePerimeter(U_SHAPED_ROOM)).toBe(26_000);
  });

  it('is zero for a shape with nothing to walk round', () => {
    expect(computePerimeter([])).toBe(0);
    expect(computePerimeter([point(0, 0)])).toBe(0);
  });
});

describe('the centre of area', () => {
  it('sits in the middle of a rectangle', () => {
    const centroid = computeCentroid(rectangle(5000, 4000));

    expect(centroid.x).toBeCloseTo(2500, 9);
    expect(centroid.y).toBeCloseTo(2000, 9);
  });

  it('is the balance point of the floor, not the average of the corners', () => {
    const centroid = computeCentroid(L_SHAPED_ROOM);

    expect(centroid.x).toBeCloseTo(2714.285714, 6);
    expect(centroid.y).toBeCloseTo(1821.428571, 6);
    // The corners average somewhere else entirely.
    expect(centroid.x).not.toBeCloseTo(20_000 / 6, 3);
  });

  it('can fall outside the room, which is why it cannot hold the label', () => {
    const centroid = computeCentroid(U_SHAPED_ROOM);

    expect(centroid.x).toBeCloseTo(3000, 6);
    expect(outlineContains(U_SHAPED_ROOM, centroid)).toBe(false);
  });

  it('falls back to the corner average when there is no area at all', () => {
    const flat = [point(0, 0), point(1000, 0), point(2000, 0)];

    expect(computeCentroid(flat).x).toBeCloseTo(1000, 9);
  });
});

describe('the box the label goes in', () => {
  it('is the whole of a rectangular room', () => {
    const box = computeLargestInnerRectangle(rectangle(5000, 4000));

    expect(box?.min).toEqual(point(0, 0));
    expect(box?.max).toEqual(point(5000, 4000));
    expect(box?.areaM2).toBe(20);
  });

  it('takes the larger leg of an L rather than the wider band', () => {
    const box = computeLargestInnerRectangle(L_SHAPED_ROOM);

    expect(box?.widthMm).toBe(4000);
    expect(box?.heightMm).toBe(4000);
    expect(box?.areaM2).toBe(16);
  });

  it('always lands somewhere the label can actually be drawn', () => {
    for (const outline of [L_SHAPED_ROOM, U_SHAPED_ROOM, rectangle(5000, 4000)]) {
      const box = computeLargestInnerRectangle(outline);
      const centre = point(
        ((box?.min.x ?? 0) + (box?.max.x ?? 0)) / 2,
        ((box?.min.y ?? 0) + (box?.max.y ?? 0)) / 2,
      );

      expect(outlineContains(outline, centre)).toBe(true);
    }
  });

  it('picks the same one of two equal legs every run', () => {
    // Both legs of the U are 2000 × 4000; the tie goes to the one nearest the
    // origin, so the label never jumps sides between runs.
    const box = computeLargestInnerRectangle(U_SHAPED_ROOM);

    expect(box?.min).toEqual(point(0, 0));
    expect(box?.max).toEqual(point(2000, 4000));
    expect(box?.areaM2).toBe(8);
  });

  it('stays inside a room with a sloping wall', () => {
    const splayed = [point(0, 0), point(6000, 0), point(4000, 4000), point(0, 4000)];
    const box = computeLargestInnerRectangle(splayed);

    expect(box).not.toBeNull();
    for (const corner of [box?.min, box?.max]) {
      expect(corner).toBeDefined();
    }
    expect(outlineContains(splayed, point((box?.max.x ?? 0) - 1, (box?.max.y ?? 0) - 1))).toBe(true);
  });

  it('has nothing to offer a shape with no inside', () => {
    expect(computeLargestInnerRectangle([point(0, 0), point(1000, 0)])).toBeNull();
    expect(computeLargestInnerRectangle([point(0, 0), point(1000, 0), point(2000, 0)])).toBeNull();
  });
});

describe('telling a point from the outline', () => {
  it('knows the inside from the outside', () => {
    expect(outlineContains(rectangle(5000, 4000), point(2500, 2000))).toBe(true);
    expect(outlineContains(rectangle(5000, 4000), point(6000, 2000))).toBe(false);
  });

  it('knows the bite out of a concave room is outside it', () => {
    expect(outlineContains(L_SHAPED_ROOM, point(5000, 3000))).toBe(false);
    expect(outlineContains(L_SHAPED_ROOM, point(5000, 1000))).toBe(true);
  });
});

describe('explaining the number', () => {
  it('hands back a term for every edge', () => {
    const breakdown = explainArea(L_SHAPED_ROOM);

    expect(breakdown.terms).toHaveLength(L_SHAPED_ROOM.length);
    expect(breakdown.terms[0]?.from).toEqual(point(0, 0));
    expect(breakdown.terms[0]?.to).toEqual(point(6000, 0));
  });

  it('shows terms that really do add up to the answer', () => {
    const breakdown = explainArea(L_SHAPED_ROOM);
    const added = breakdown.terms.reduce((sum, term) => sum + term.crossMm2, 0);

    expect(added).toBe(breakdown.doubleAreaMm2);
    expect(breakdown.areaMm2).toBe(Math.abs(breakdown.doubleAreaMm2) / 2);
    expect(breakdown.areaM2).toBe(computeArea(L_SHAPED_ROOM));
  });

  it('says whether the sum was exact', () => {
    expect(explainArea(L_SHAPED_ROOM).onMillimetreGrid).toBe(true);
    expect(explainArea([point(0, 0), point(1000.5, 0), point(1000.5, 1000)]).onMillimetreGrid).toBe(
      false,
    );
  });

  it('says which way round the corners were listed', () => {
    expect(explainArea(L_SHAPED_ROOM).counterClockwise).toBe(true);
    expect(explainArea([...L_SHAPED_ROOM].reverse()).counterClockwise).toBe(false);
  });

  it('writes out every edge and the two divisions at the end', () => {
    const text = explainRoom({ outline: L_SHAPED_ROOM, name: 'Phòng khách' });

    expect(text).toContain('Phòng khách');
    expect(text).toContain('21,00 m²');
    expect(text).toContain('dây giày');
    expect(text).toContain('Cạnh 1');
    expect(text).toContain('Cạnh 6');
    expect(text).toContain('Tổng tích chéo: 42.000.000 mm²');
    expect(text).toContain('Chia đôi: 21.000.000 mm²');
    expect(text).toContain('21.000.000 ÷ 1.000.000 = 21,00 m²');
  });

  it('reports the perimeter and the centre of area alongside', () => {
    const text = explainRoom({ outline: L_SHAPED_ROOM });

    expect(text).toContain('Chu vi 20.000 mm');
    expect(text).toContain('Trọng tâm');
  });

  it('uses a comma for the decimal mark, never a full stop', () => {
    const text = explainRoom({ outline: SAMPLE_ROOM_OUTLINES[0] ?? [] });

    expect(text).toContain('17,00 m²');
    expect(text).not.toMatch(/\d\.\d{2} m²/u);
  });

  it('adds up when the numbers are read back off the page', () => {
    const text = explainRoom({ outline: U_SHAPED_ROOM });
    const shown = [...text.matchAll(/tích chéo (-?[\d.]+(?:,\d+)?) mm²/gu)].map((match) =>
      parseVietnameseNumber(match[1] ?? '0'),
    );
    const totalLine = /Tổng tích chéo: (-?[\d.]+(?:,\d+)?) mm²/u.exec(text);

    expect(shown).toHaveLength(U_SHAPED_ROOM.length);
    expect(shown.reduce((sum, term) => sum + term, 0)).toBe(
      parseVietnameseNumber(totalLine?.[1] ?? '0'),
    );
  });

  it('warns when the corners are not on the millimetre grid', () => {
    const text = explainRoom({ outline: [point(0, 0), point(1000.5, 0), point(1000.5, 1000)] });

    expect(text).toContain('lưới milimét');
  });

  it('explains a clockwise outline without changing the answer', () => {
    const text = explainRoom({ outline: [...L_SHAPED_ROOM].reverse() });

    expect(text).toContain('chiều kim đồng hồ');
    expect(text).toContain('21,00 m²');
  });

  it('says plainly when there is nothing to measure yet', () => {
    const text = explainRoom({ outline: [point(0, 0), point(1000, 0)] });

    expect(text).toContain('chưa có diện tích');
    expect(text).toContain('chưa khép');
  });

  it('names a room that has no name yet without inventing one', () => {
    expect(explainRoom({ outline: L_SHAPED_ROOM })).toContain('Phòng chưa đặt tên');
  });

  it('prints what the reader actually sees', () => {
    const text = explainRoom({ outline: L_SHAPED_ROOM, name: 'Phòng khách' });

    console.log(`\n${text}\n`);

    expect(text.split('\n').length).toBeGreaterThan(L_SHAPED_ROOM.length);
  });
});

describe('agreeing with the room search', () => {
  /** Two rooms either side of a partition, drawn as walls rather than outlines. */
  function createTwoRoomPlan(): readonly Wall[] {
    const centrelines: readonly (readonly [PointMm, PointMm])[] = [
      [point(0, 0), point(6000, 0)],
      [point(6000, 0), point(6000, 4000)],
      [point(6000, 4000), point(0, 4000)],
      [point(0, 4000), point(0, 0)],
      [point(3000, 0), point(3000, 4000)],
    ];

    return centrelines.map(([start, end], index) => ({
      id: `W-${String(index + 1).padStart(4, '0')}` as WallId,
      kind: 'partition' as const,
      centreline: { start, end },
      thicknessMm: millimetres(200),
      baseElevationMm: millimetres(0),
      topElevationMm: millimetres(3000),
    }));
  }

  it('measures a detected room to the same figure the search did', () => {
    const { rooms } = detectRooms(createTwoRoomPlan());

    expect(rooms).toHaveLength(2);
    for (const room of rooms) {
      // `detectRooms` keeps the raw square metres; `computeArea` publishes the
      // rounded one. The two must be the same number to the last hundredth, or
      // one screen is quoting a different area from the next.
      expect(computeArea(room.outline)).toBeCloseTo(room.areaM2, 2);
    }
  });

  it('totals the detected rooms without rounding them one by one', () => {
    const { rooms } = detectRooms(createTwoRoomPlan());
    const outlines = rooms.map((room) => room.outline);

    // Both halves are 2800 × 3800 clear, so the pair is exactly 21,28 m².
    expect(totalArea(outlines)).toBe(21.28);
  });

  it('puts the label of a detected room inside it', () => {
    const { rooms } = detectRooms(createTwoRoomPlan());

    for (const room of rooms) {
      const box = computeLargestInnerRectangle(room.outline);
      const centre = point(
        ((box?.min.x ?? 0) + (box?.max.x ?? 0)) / 2,
        ((box?.min.y ?? 0) + (box?.max.y ?? 0)) / 2,
      );

      expect(outlineContains(room.outline, centre)).toBe(true);
    }
  });
});
