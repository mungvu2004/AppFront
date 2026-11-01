/** @vitest-environment node */
/**
 * Tường cong qua các phép sửa tường và dò phòng: tách giữ đúng cung, không gộp, phòng ôm theo cung.
 */

import { describe, expect, it } from 'vitest';

import { detectRooms } from '../../rooms/detect';
import type { WallId } from '../../spatial/types';
import type { PointMm } from '../../units/compare';
import { millimetres } from '../../units/types';
import { mergeWalls, splitWall } from '../edit';
import { centrelineLength, type Wall } from '../types';

const point = (x: number, y: number): PointMm => ({ x: millimetres(x), y: millimetres(y) });

const wall = (id: string, from: PointMm, to: PointMm, curveOffsetMm?: number): Wall => ({
  id: `W-${id.padEnd(10, '0')}` as WallId,
  kind: 'partition',
  centreline: { start: from, end: to },
  ...(curveOffsetMm === undefined ? {} : { curveOffsetMm: millimetres(curveOffsetMm) }),
  thicknessMm: millimetres(200),
  baseElevationMm: millimetres(0),
  topElevationMm: millimetres(3000),
});

// Half circle about (2000, 0), radius 2000, bulging to −y.
const ARC = wall('ARC', point(0, 0), point(4000, 0), 2000);

describe('splitWall on a curved wall', () => {
  it('cuts on the arc and gives each piece the sagitta of its own sub-arc', () => {
    const outcome = splitWall(ARC, point(2000, -2100), 'W-SECOND0000' as WallId);
    if (!outcome.ok) throw new Error(outcome.reason);
    const [first, second] = outcome.walls;

    expect(first.centreline.end.x).toBeCloseTo(2000);
    expect(first.centreline.end.y).toBeCloseTo(-2000);
    // A quarter circle of radius 2000: sagitta r·(1 − cos 45°).
    expect(first.curveOffsetMm).toBeCloseTo(2000 * (1 - Math.SQRT1_2));
    expect(second.curveOffsetMm).toBeCloseTo(2000 * (1 - Math.SQRT1_2));
    expect(centrelineLength(first) + centrelineLength(second)).toBeCloseTo(centrelineLength(ARC));
  });
});

describe('mergeWalls with a curved wall', () => {
  it('refuses, whatever the other wall is', () => {
    const straight = wall('LINE', point(4000, 0), point(6000, 0));
    expect(mergeWalls(ARC, straight)).toEqual({ ok: false, reason: 'curvedWall' });
  });
});

describe('detectRooms next to a curved wall', () => {
  it('follows the arc instead of the chord', () => {
    // A D-shaped room: the curved wall closed by a straight one along the chord.
    const chord = wall('CHORD', point(4000, 0), point(0, 0));
    const [room] = detectRooms([ARC, chord]).rooms;

    expect(room?.centrelineOutline.length).toBeGreaterThan(10);
    // Half the disc of radius 2000, less the 100 mm half thickness all round (approximately).
    expect(room?.areaM2).toBeGreaterThan(5);
    expect(room?.areaM2).toBeLessThan((Math.PI * 2 ** 2) / 2);
  });
});
