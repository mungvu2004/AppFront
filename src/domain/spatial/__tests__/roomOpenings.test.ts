import { describe, expect, it } from 'vitest';

import { countOpeningsByKind, openingsOfRoom } from '../roomOpenings';
import type { Opening, Point, Room, Wall } from '../types';

/* -------------------------------------------------------------------------- */
/* Fixtures.                                                                   */
/* -------------------------------------------------------------------------- */

const DETECTED = { confidence: 0.8, source: 'ai', reviewed: false } as const;
const REVIEWED = { confidence: 1, source: 'human', reviewed: true } as const;

const wallId = (code: string): Wall['id'] => `W-${code}`;
const openingId = (code: string): Opening['id'] => `D-${code}`;
const roomId = (code: string): Room['id'] => `R-${code}`;

function wall(code: string, start: Point, end: Point, openingIds: readonly string[] = []): Wall {
  return {
    ...DETECTED,
    id: wallId(code),
    levelId: 'L-1',
    centreline: { start, end },
    thicknessMm: 200,
    heightMm: 2800,
    kind: 'partition',
    openingIds: openingIds as Wall['openingIds'],
  };
}

function opening(code: string, host: string, offsetMm: number, widthMm: number, kind: Opening['kind'] = 'door'): Opening {
  return {
    ...DETECTED,
    id: openingId(code),
    wallId: wallId(host),
    kind,
    offsetMm,
    widthMm,
    heightMm: kind === 'window' ? 1400 : 2200,
    sillHeightMm: kind === 'window' ? 900 : 0,
    swing: 'left',
  };
}

function room(code: string, outline: readonly Point[], wallIds: readonly string[]): Room {
  return {
    ...REVIEWED,
    id: roomId(code),
    levelId: 'L-1',
    name: code,
    usage: 'bedroom',
    outline,
    areaM2: 10,
    wallIds: wallIds as Room['wallIds'],
  };
}

/* -------------------------------------------------------------------------- */
/* openingsOfRoom.                                                             */
/* -------------------------------------------------------------------------- */

describe('openingsOfRoom', () => {
  it('returns the opening cut into a wall bounding the room', () => {
    const w1 = wall('1', { x: 0, y: 0 }, { x: 4000, y: 0 }, [openingId('1')]);
    const d1 = opening('1', '1', 1500, 900);
    const r1 = room(
      '1',
      [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
        { x: 4000, y: 3000 },
        { x: 0, y: 3000 },
      ],
      [wallId('1')],
    );

    expect(openingsOfRoom(r1, [w1], [d1])).toEqual([d1]);
  });

  it('does not count a door at the far end of the same wall', () => {
    // The wall is 20 m long; the room only occupies its first 4 m.
    const w1 = wall('LONG', { x: 0, y: 0 }, { x: 20000, y: 0 }, [openingId('FAR')]);
    const dFar = opening('FAR', 'LONG', 18000, 700);
    const r1 = room(
      '1',
      [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
        { x: 4000, y: 3000 },
        { x: 0, y: 3000 },
      ],
      [wallId('LONG')],
    );

    expect(openingsOfRoom(r1, [w1], [dFar])).toEqual([]);
  });

  it('counts an opening on a wall shared by two rooms for BOTH rooms', () => {
    // One partition at y = 0, four metres long, with a door in the middle.
    const shared = wall('SHARED', { x: 0, y: 0 }, { x: 4000, y: 0 }, [openingId('MID')]);
    const door = opening('MID', 'SHARED', 1650, 900);
    const walls = [shared];
    const openings = [door];

    const below = room(
      'BELOW',
      [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
        { x: 4000, y: -3000 },
        { x: 0, y: -3000 },
      ],
      [wallId('SHARED')],
    );
    const above = room(
      'ABOVE',
      [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
        { x: 4000, y: 3000 },
        { x: 0, y: 3000 },
      ],
      [wallId('SHARED')],
    );

    expect(openingsOfRoom(below, walls, openings)).toEqual([door]);
    expect(openingsOfRoom(above, walls, openings)).toEqual([door]);
  });

  it('does not filter by kind: a door and a window on the same wall both come back', () => {
    const w1 = wall('1', { x: 0, y: 0 }, { x: 4000, y: 0 }, [openingId('DOOR'), openingId('WIN')]);
    const door = opening('DOOR', '1', 500, 900, 'door');
    const win = opening('WIN', '1', 2200, 1200, 'window');
    const r1 = room(
      '1',
      [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
        { x: 4000, y: 3000 },
        { x: 0, y: 3000 },
      ],
      [wallId('1')],
    );

    expect(openingsOfRoom(r1, [w1], [door, win])).toEqual([door, win]);
  });

  it('measures against a single-point outline rather than throwing', () => {
    const w1 = wall('1', { x: 0, y: 0 }, { x: 4000, y: 0 }, [openingId('NEAR'), openingId('FAR')]);
    const near = opening('NEAR', '1', 0, 100);
    const far = opening('FAR', '1', 3900, 100);
    const degenerate = room('1', [{ x: 0, y: 0 }], [wallId('1')]);

    expect(openingsOfRoom(degenerate, [w1], [near, far])).toEqual([near]);
  });

  it('skips a wall id or opening id that resolves to nothing in the arrays handed in', () => {
    const r1 = room('1', [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], [wallId('MISSING')]);

    expect(openingsOfRoom(r1, [], [])).toEqual([]);

    const w1 = wall('1', { x: 0, y: 0 }, { x: 4000, y: 0 }, [openingId('MISSING')]);
    const r2 = room(
      '2',
      [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
        { x: 4000, y: 3000 },
        { x: 0, y: 3000 },
      ],
      [wallId('1')],
    );

    expect(openingsOfRoom(r2, [w1], [])).toEqual([]);
  });

  it('writes to none of its arguments', () => {
    const w1 = wall('1', { x: 0, y: 0 }, { x: 4000, y: 0 }, [openingId('1')]);
    const d1 = opening('1', '1', 1500, 900);
    const r1 = room(
      '1',
      [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
        { x: 4000, y: 3000 },
        { x: 0, y: 3000 },
      ],
      [wallId('1')],
    );
    const before = JSON.stringify({ r1, w1, d1 });

    openingsOfRoom(r1, [w1], [d1]);

    expect(JSON.stringify({ r1, w1, d1 })).toBe(before);
  });
});

/* -------------------------------------------------------------------------- */
/* countOpeningsByKind.                                                       */
/* -------------------------------------------------------------------------- */

describe('countOpeningsByKind', () => {
  it('tallies doors and windows separately', () => {
    const openings = [
      opening('1', '1', 0, 900, 'door'),
      opening('2', '1', 1000, 900, 'door'),
      opening('3', '1', 2000, 1200, 'window'),
    ];

    expect(countOpeningsByKind(openings)).toEqual({ doorCount: 2, windowCount: 1 });
  });

  it('is zero for an empty list', () => {
    expect(countOpeningsByKind([])).toEqual({ doorCount: 0, windowCount: 0 });
  });
});
