import { describe, expect, it } from 'vitest';

import {
  FACINGS,
  FINISHES,
  furnitureCentre,
  furnitureSize,
  heightAbove,
  isFacing,
  isFinish,
  roomCentre,
  toBuildableLevel,
  toBuildableRoom,
  toDomainOpening,
  toDomainWall,
} from '../plan';

import { FIXTURE_PLAN } from './fixtures';

const level = FIXTURE_PLAN.levels[0]!;

describe('plan conversions', () => {
  it('turns a JSON wall into a domain wall at storey height', () => {
    const wall = toDomainWall(FIXTURE_PLAN.walls[0]!, level);

    expect(wall.id).toBe('W-S');
    expect(wall.kind).toBe('loadBearing');
    expect(wall.centreline.end.x).toBe(6000);
    expect(wall.baseElevationMm).toBe(0);
    expect(wall.topElevationMm).toBe(2400);
  });

  it('lets a wall declare its own height — a balustrade', () => {
    const railing = toDomainWall(FIXTURE_PLAN.walls[5]!, level);

    expect(railing.kind).toBe('railing');
    expect(railing.topElevationMm).toBe(1050);
  });

  it('stacks a wall on a raised storey', () => {
    const upper = toDomainWall(FIXTURE_PLAN.walls[0]!, { id: 'L-1', elevationMm: 3000, heightMm: 2700 });

    expect(upper.baseElevationMm).toBe(3000);
    expect(upper.topElevationMm).toBe(5700);
  });

  it('reads a missing coordinate as zero rather than NaN', () => {
    const wall = toDomainWall({ ...FIXTURE_PLAN.walls[0]!, start: [], end: [1000] }, level);

    expect(wall.centreline.start).toEqual({ x: 0, y: 0 });
    expect(wall.centreline.end).toEqual({ x: 1000, y: 0 });
  });

  it('turns an opening and a room into what the builder wants', () => {
    const opening = toDomainOpening(FIXTURE_PLAN.openings[1]!);
    const room = toBuildableRoom(FIXTURE_PLAN.rooms[0]!);
    const built = toBuildableLevel(level);

    expect(opening).toMatchObject({ id: 'D-2', kind: 'window', widthMm: 1200, swing: 'sliding' });
    expect(room.outline).toHaveLength(4);
    expect(room.outline[2]).toEqual({ x: 3000, y: 4000 });
    expect(built).toEqual({ id: 'L-G', elevationMm: 0, heightMm: 2400 });
  });

  it('finds the centre of a room in metres', () => {
    expect(roomCentre(FIXTURE_PLAN.rooms[0]!)).toEqual({ x: 1.5, z: 2 });
    expect(roomCentre({ id: 'R-X', levelId: 'L-G', finish: 'wood', outline: [] })).toEqual({ x: 0, z: 0 });
  });

  it('sizes and places furniture in metres', () => {
    const bed = FIXTURE_PLAN.furniture[0]!;

    expect(furnitureSize(bed)).toEqual({ w: 1.6, d: 2, h: 0.5 });
    expect(furnitureCentre(bed)).toEqual({ x: 1.5, z: 2 });
    expect(heightAbove({ id: 'L-1', elevationMm: 3000, heightMm: 2400 }, 2300)).toBeCloseTo(5.3);
  });

  it('knows its own vocabularies', () => {
    for (const finish of FINISHES) {
      expect(isFinish(finish)).toBe(true);
    }
    for (const facing of FACINGS) {
      expect(isFacing(facing)).toBe(true);
    }
    expect(isFinish('carpet')).toBe(false);
    expect(isFacing('up')).toBe(false);
  });
});
