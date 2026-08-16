import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { millimetres } from '@/domain/units/types';
import type { AttachedOpening, Opening, PointMm } from '@/domain/openings/types';
import type { LevelId, OpeningId, WallId } from '@/domain/spatial/types';
import type { Wall } from '@/domain/walls/types';

import { CAMERA_SETTINGS } from '../settings';
import {
  buildWallBarrier,
  planPointOf,
  stairProgressAt,
  WalkNavigator,
  walkEyePosition,
  walkerHeightM,
  WALK_COLLISION_SETTINGS,
  WallBarrier,
  type PlanPointM,
  type Stairway,
  type Storey,
  type WalkGround,
} from '../collision';

/* -------------------------------------------------------------------------- */
/* Fixtures: a room off the standard sample plan.                              */
/* -------------------------------------------------------------------------- */

const ROOM_WIDTH_MM = 10000;
const ROOM_DEPTH_MM = 6000;
const WALL_THICKNESS_MM = 200;
const STOREY_HEIGHT_MM = 3000;

/** Radius plus half thickness: how far the walker's centre stays off a centreline. */
const CLEARANCE_M = WALK_COLLISION_SETTINGS.bodyRadiusM + WALL_THICKNESS_MM / 2 / 1000;

const GROUND: LevelId = 'L-01';
const FIRST: LevelId = 'L-02';

function point(xMm: number, yMm: number): PointMm {
  return { x: millimetres(xMm), y: millimetres(yMm) };
}

function wall(
  id: WallId,
  startXMm: number,
  startYMm: number,
  endXMm: number,
  endYMm: number,
  band: { baseMm?: number; topMm?: number } = {},
): Wall {
  return {
    id,
    kind: 'partition',
    centreline: { start: point(startXMm, startYMm), end: point(endXMm, endYMm) },
    thicknessMm: millimetres(WALL_THICKNESS_MM),
    baseElevationMm: millimetres(band.baseMm ?? 0),
    topElevationMm: millimetres(band.topMm ?? STOREY_HEIGHT_MM),
  };
}

function opening(
  id: OpeningId,
  wallId: WallId,
  kind: AttachedOpening['kind'],
  overrides: Partial<AttachedOpening> = {},
): AttachedOpening {
  return {
    id,
    wallId,
    kind,
    relativePosition: 0.5,
    widthMm: millimetres(1000),
    heightMm: millimetres(2200),
    sillHeightMm: millimetres(0),
    swing: 'left',
    ...overrides,
  };
}

/** One wall running along the plan's x axis, at z = 0. */
const SINGLE_WALL = wall('W-1', 0, 0, ROOM_WIDTH_MM, 0);

/** Four walls round a room, centrelines on the rectangle's edges. */
const ROOM_WALLS: readonly Wall[] = [
  wall('W-N', 0, 0, ROOM_WIDTH_MM, 0),
  wall('W-E', ROOM_WIDTH_MM, 0, ROOM_WIDTH_MM, ROOM_DEPTH_MM),
  wall('W-S', 0, ROOM_DEPTH_MM, ROOM_WIDTH_MM, ROOM_DEPTH_MM),
  wall('W-W', 0, 0, 0, ROOM_DEPTH_MM),
];

function at(xM: number, zM: number): PlanPointM {
  return { xM, zM };
}

const NO_OPENINGS: readonly Opening[] = [];

/* -------------------------------------------------------------------------- */
/* Building the barrier.                                                       */
/* -------------------------------------------------------------------------- */

describe('buildWallBarrier', () => {
  it('turns a plain wall into one solid stretch, in metres', () => {
    const barrier = buildWallBarrier([SINGLE_WALL], NO_OPENINGS);

    expect(barrier.solids).toHaveLength(1);
    const solid = barrier.solids[0];
    expect(solid?.wallId).toBe('W-1');
    expect(solid?.start).toEqual({ xM: 0, zM: 0 });
    expect(solid?.end).toEqual({ xM: 10, zM: 0 });
    expect(solid?.halfThicknessM).toBeCloseTo(0.1, 10);
    expect(solid?.baseM).toBeCloseTo(0, 10);
    expect(solid?.topM).toBeCloseTo(3, 10);
  });

  it('leaves two jambs where a door is cut, with a real gap between them', () => {
    const barrier = buildWallBarrier([SINGLE_WALL], [opening('D-1', 'W-1', 'door')]);

    expect(barrier.solids).toHaveLength(2);
    expect(barrier.solids[0]?.end.xM).toBeCloseTo(4.5, 10);
    expect(barrier.solids[1]?.start.xM).toBeCloseTo(5.5, 10);
  });

  it('keeps the wall whole where the opening is a window', () => {
    const barrier = buildWallBarrier(
      [SINGLE_WALL],
      [opening('D-1', 'W-1', 'window', { sillHeightMm: millimetres(900) })],
    );

    expect(barrier.solids).toHaveLength(1);
  });

  it('keeps the wall whole where a door leaf is shut', () => {
    const barrier = buildWallBarrier([SINGLE_WALL], [opening('D-1', 'W-1', 'door')], {
      openDoorIds: new Set<OpeningId>(),
    });

    expect(barrier.solids).toHaveLength(1);
  });

  it('opens the wall for a hole with nothing hung in it, whatever the door state', () => {
    const barrier = buildWallBarrier([SINGLE_WALL], [opening('D-1', 'W-1', 'void')], {
      openDoorIds: new Set<OpeningId>(),
    });

    expect(barrier.solids).toHaveLength(2);
  });

  it('keeps the wall whole for a hatch too low to walk through', () => {
    const barrier = buildWallBarrier(
      [SINGLE_WALL],
      [opening('D-1', 'W-1', 'void', { heightMm: millimetres(1200) })],
    );

    expect(barrier.solids).toHaveLength(1);
  });

  it('ignores an opening whose host wall is not on the plan', () => {
    const barrier = buildWallBarrier([SINGLE_WALL], [opening('D-1', 'W-9', 'door')]);

    expect(barrier.solids).toHaveLength(1);
  });

  it('drops a wall of no length rather than dividing by it', () => {
    const barrier = buildWallBarrier([wall('W-0', 500, 500, 500, 500)], NO_OPENINGS);

    expect(barrier.solids).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Walking into walls.                                                         */
/* -------------------------------------------------------------------------- */

describe('WallBarrier.slide', () => {
  const barrier = buildWallBarrier([SINGLE_WALL], NO_OPENINGS);

  it('is a cylinder of 0,3 m, as the brief asks', () => {
    expect(WALK_COLLISION_SETTINGS.bodyRadiusM).toBe(0.3);
  });

  it('stops a walker who walks straight at a wall, short of its face', () => {
    const landed = barrier.slide(at(5, 3), at(5, -3), 0);

    // Never past the near face of the wall, which is half a thickness off the
    // centreline — and clear of it by the body radius.
    expect(landed.zM).toBeGreaterThan(WALL_THICKNESS_MM / 2 / 1000);
    expect(landed.zM).toBeGreaterThanOrEqual(CLEARANCE_M);
    expect(landed.zM).toBeCloseTo(CLEARANCE_M + WALK_COLLISION_SETTINGS.skinM, 6);
    expect(landed.xM).toBeCloseTo(5, 10);
  });

  it('stops a walker coming at the same wall from the other side', () => {
    const landed = barrier.slide(at(5, -3), at(5, 3), 0);

    expect(landed.zM).toBeLessThan(-(WALL_THICKNESS_MM / 2 / 1000));
    expect(landed.zM).toBeCloseTo(-(CLEARANCE_M + WALK_COLLISION_SETTINGS.skinM), 6);
  });

  it('stops a single huge step just as it stops a small one', () => {
    const landed = barrier.slide(at(5, 3), at(5, -50), 0);

    expect(landed.zM).toBeGreaterThanOrEqual(CLEARANCE_M);
  });

  it('slides along the face instead of stopping dead at a glancing angle', () => {
    const landed = barrier.slide(at(3, 0.5), at(6, -0.5), 0);

    expect(landed.zM).toBeGreaterThanOrEqual(CLEARANCE_M);
    // The component along the wall survives the push, which is what sliding is.
    expect(landed.xM).toBeCloseTo(6, 6);
  });

  it('leaves a walker in the open exactly where they asked to be', () => {
    const landed = barrier.slide(at(2, 4), at(3, 5), 0);

    expect(landed).toEqual({ xM: 3, zM: 5 });
  });

  it('holds a walker inside a room they run at the corner of', () => {
    const room = buildWallBarrier(ROOM_WALLS, NO_OPENINGS);
    const landed = room.slide(at(5, 3), at(60, 40), 0);

    expect(landed.xM).toBeLessThanOrEqual(ROOM_WIDTH_MM / 1000 - CLEARANCE_M);
    expect(landed.zM).toBeLessThanOrEqual(ROOM_DEPTH_MM / 1000 - CLEARANCE_M);
    expect(landed.xM).toBeGreaterThan(ROOM_WIDTH_MM / 1000 - CLEARANCE_M - 0.01);
    expect(landed.zM).toBeGreaterThan(ROOM_DEPTH_MM / 1000 - CLEARANCE_M - 0.01);
    expect(room.blocked(landed, 0)).toBe(false);
  });

  it('pushes a walker who starts inside a wall out through the nearer face', () => {
    const landed = barrier.slide(at(5, 0.02), at(5, 0.02), 0);

    expect(landed.zM).toBeGreaterThanOrEqual(CLEARANCE_M);
  });

  it('leaves the walker where they were when the frame hands it a NaN', () => {
    const landed = barrier.slide(at(5, 3), at(Number.NaN, Number.NaN), 0);

    expect(landed).toEqual({ xM: 5, zM: 3 });
  });

  it('blocks nothing at all when there is no plan yet', () => {
    const empty = new WallBarrier([]);

    expect(empty.slide(at(0, 0), at(40, 40), 0)).toEqual({ xM: 40, zM: 40 });
    expect(empty.blocked(at(0, 0), 0)).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Doors.                                                                      */
/* -------------------------------------------------------------------------- */

describe('walking through openings', () => {
  it('lets the walker through an open door', () => {
    const barrier = buildWallBarrier([SINGLE_WALL], [opening('D-1', 'W-1', 'door')]);
    const landed = barrier.slide(at(5, 2), at(5, -2), 0);

    expect(landed.zM).toBeCloseTo(-2, 6);
  });

  it('stops the walker at a shut door', () => {
    const barrier = buildWallBarrier([SINGLE_WALL], [opening('D-1', 'W-1', 'door')], {
      openDoorIds: new Set<OpeningId>(),
    });
    const landed = barrier.slide(at(5, 2), at(5, -2), 0);

    expect(landed.zM).toBeGreaterThanOrEqual(CLEARANCE_M);
  });

  it('stops the walker at a fixed leaf, which is a panel rather than a door', () => {
    const barrier = buildWallBarrier(
      [SINGLE_WALL],
      [opening('D-1', 'W-1', 'door', { swing: 'fixed' })],
    );
    const landed = barrier.slide(at(5, 2), at(5, -2), 0);

    expect(landed.zM).toBeGreaterThanOrEqual(CLEARANCE_M);
  });

  it('stops the walker at the jamb of an open door they aim beside', () => {
    const barrier = buildWallBarrier([SINGLE_WALL], [opening('D-1', 'W-1', 'door')]);
    const landed = barrier.slide(at(4, 2), at(4, -2), 0);

    expect(landed.zM).toBeGreaterThanOrEqual(CLEARANCE_M);
  });
});

/* -------------------------------------------------------------------------- */
/* Which storey a wall belongs to.                                             */
/* -------------------------------------------------------------------------- */

describe('the band of air the walker occupies', () => {
  const upstairs = buildWallBarrier(
    [wall('W-U', 0, 0, ROOM_WIDTH_MM, 0, { baseMm: 3000, topMm: 6000 })],
    NO_OPENINGS,
  );

  it('lets a walker on the ground floor pass under a wall of the storey above', () => {
    expect(upstairs.slide(at(5, 2), at(5, -2), 0).zM).toBeCloseTo(-2, 6);
  });

  it('stops the same walker once they are standing on that storey', () => {
    expect(upstairs.slide(at(5, 2), at(5, -2), 3).zM).toBeGreaterThanOrEqual(CLEARANCE_M);
  });

  it('lets a walker step over an upstand lower than the step-over height', () => {
    const kerb = buildWallBarrier(
      [wall('W-K', 0, 0, ROOM_WIDTH_MM, 0, { baseMm: 0, topMm: 150 })],
      NO_OPENINGS,
    );

    expect(kerb.slide(at(5, 2), at(5, -2), 0).zM).toBeCloseTo(-2, 6);
  });

  it('is the eye height plus a crown, never a second opinion about it', () => {
    expect(walkerHeightM()).toBeCloseTo(
      CAMERA_SETTINGS.walk.eyeHeightM + WALK_COLLISION_SETTINGS.headClearanceM,
      10,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* The broad phase.                                                            */
/* -------------------------------------------------------------------------- */

describe('the broad phase', () => {
  /** A hundred walls spread over four hundred metres of site. */
  const manyWalls: readonly Wall[] = Array.from({ length: 100 }, (_unused, index) =>
    wall(`W-${String(index)}`, index * 4000, 0, index * 4000, 4000),
  );

  it('reads a handful of walls per step, not the whole site', () => {
    const barrier = buildWallBarrier(manyWalls, NO_OPENINGS);

    expect(barrier.solids).toHaveLength(100);
    expect(barrier.nearbySolids(at(200, 2), at(200.5, 2), 0).length).toBeLessThanOrEqual(8);
  });

  it('still finds the wall the walker is about to hit', () => {
    const barrier = buildWallBarrier(manyWalls, NO_OPENINGS);
    const found = barrier.nearbySolids(at(199.5, 2), at(200.5, 2), 0);

    expect(found.map((solid) => solid.wallId)).toContain('W-50');
  });

  it('leaves out the walls of a storey the walker is not on', () => {
    const barrier = buildWallBarrier(
      [wall('W-U', 0, 0, ROOM_WIDTH_MM, 0, { baseMm: 3000, topMm: 6000 })],
      NO_OPENINGS,
    );

    expect(barrier.nearbySolids(at(5, 0), at(5, 0), 0)).toHaveLength(0);
    expect(barrier.nearbySolids(at(5, 0), at(5, 0), 3)).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------------- */
/* The ground under the walker.                                                */
/* -------------------------------------------------------------------------- */

describe('WalkNavigator', () => {
  const STOREYS: readonly Storey[] = [
    { levelId: GROUND, floorElevationM: 0 },
    { levelId: FIRST, floorElevationM: 3.5 },
  ];

  /** A flight running along +x from (2, 2) to (5, 2), 1,2 m wide. */
  const STAIR: Stairway = {
    id: 'F-1',
    lowerLevelId: GROUND,
    upperLevelId: FIRST,
    lowerEnd: { xM: 2, zM: 2 },
    upperEnd: { xM: 5, zM: 2 },
    halfWidthM: 0.6,
  };

  const GROUND_PLAN: WalkGround = { storeys: STOREYS, stairs: [STAIR] };

  function navigator(ground: WalkGround = GROUND_PLAN, levelId: LevelId = GROUND): WalkNavigator {
    return new WalkNavigator(new WallBarrier([]), ground, { position: at(0, 2), levelId });
  }

  it('stands on the floor of the storey it was put on', () => {
    const walker = navigator(GROUND_PLAN, FIRST);

    expect(walker.ground.levelId).toBe(FIRST);
    expect(walker.ground.floorElevationM).toBe(3.5);
    expect(walker.eyeElevationM).toBeCloseTo(3.5 + CAMERA_SETTINGS.walk.eyeHeightM, 10);
  });

  it('keeps the eye at one height while it walks a storey', () => {
    const walker = navigator();
    const step = walker.moveTo(at(0, 5));

    expect(step.ground.floorElevationM).toBe(0);
    expect(step.changedLevel).toBe(false);
    expect(walkEyePosition(step).y).toBeCloseTo(CAMERA_SETTINGS.walk.eyeHeightM, 10);
  });

  it('rises with the going as the flight is climbed', () => {
    const walker = navigator();

    walker.moveTo(at(2, 2));
    expect(walker.ground.floorElevationM).toBeCloseTo(0, 10);
    expect(walker.ground.stairId).toBe('F-1');

    walker.moveTo(at(3.5, 2));
    expect(walker.ground.floorElevationM).toBeCloseTo(1.75, 10);
    expect(walker.ground.stairProgress).toBeCloseTo(0.5, 10);
  });

  it('changes storey on the way up, and stays there once off the top', () => {
    const walker = navigator();

    walker.moveTo(at(2.5, 2));
    expect(walker.ground.levelId).toBe(GROUND);

    const crossing = walker.moveTo(at(4, 2));
    expect(crossing.changedLevel).toBe(true);
    expect(crossing.ground.levelId).toBe(FIRST);

    const off = walker.moveTo(at(7, 2));
    expect(off.ground.stairId).toBeNull();
    expect(off.ground.levelId).toBe(FIRST);
    expect(off.ground.floorElevationM).toBe(3.5);
  });

  it('comes back down the same flight', () => {
    const walker = navigator();

    walker.moveTo(at(4.5, 2));
    walker.moveTo(at(7, 2));
    expect(walker.ground.levelId).toBe(FIRST);

    walker.moveTo(at(4.5, 2));
    walker.moveTo(at(2.5, 2));
    expect(walker.ground.levelId).toBe(GROUND);

    const down = walker.moveTo(at(0, 2));
    expect(down.ground.levelId).toBe(GROUND);
    expect(down.ground.floorElevationM).toBe(0);
  });

  it('walks past a flight it is beside without climbing it', () => {
    const walker = navigator();
    const step = walker.moveTo(at(3.5, 4));

    expect(step.ground.stairId).toBeNull();
    expect(step.ground.floorElevationM).toBe(0);
  });

  it('reports how much of a move a wall took away', () => {
    const walker = new WalkNavigator(
      buildWallBarrier([SINGLE_WALL], NO_OPENINGS),
      { storeys: STOREYS, stairs: [] },
      { position: at(5, 3), levelId: GROUND },
    );
    const step = walker.moveTo(at(5, -3));

    expect(step.blockedM).toBeGreaterThan(3);
    expect(step.position.zM).toBeGreaterThanOrEqual(CLEARANCE_M);
  });

  it('puts a walker down elsewhere without dropping them inside a wall', () => {
    const walker = new WalkNavigator(
      buildWallBarrier([SINGLE_WALL], NO_OPENINGS),
      { storeys: STOREYS, stairs: [] },
      { position: at(5, 3), levelId: GROUND },
    );
    const step = walker.teleportTo(at(2, 0), GROUND);

    expect(Math.abs(step.position.zM)).toBeGreaterThanOrEqual(CLEARANCE_M);
  });

  it('puts a walker down on another storey, above the walls of this one', () => {
    const walker = new WalkNavigator(
      buildWallBarrier([SINGLE_WALL], NO_OPENINGS),
      { storeys: STOREYS, stairs: [] },
      { position: at(5, 3), levelId: GROUND },
    );
    const step = walker.teleportTo(at(2, 0), FIRST);

    expect(step.ground.levelId).toBe(FIRST);
    expect(step.changedLevel).toBe(true);
    // The ground floor's walls stop at 3 m and this walker's feet are at 3,5 m,
    // so the wall on the centreline below is under them, not in their way.
    expect(step.position).toEqual({ xM: 2, zM: 0 });
  });

  it('draws the ground floor rather than refusing, when the storey is unknown', () => {
    const walker = navigator(GROUND_PLAN, 'L-99');

    expect(walker.ground.levelId).toBe(GROUND);
    expect(walker.ground.floorElevationM).toBe(0);
  });

  it('survives a building with no storeys at all', () => {
    const walker = navigator({ storeys: [], stairs: [] }, GROUND);

    expect(walker.ground.levelId).toBe(GROUND);
    expect(walker.ground.floorElevationM).toBe(0);
    expect(walker.moveTo(at(1, 1)).position).toEqual({ xM: 1, zM: 1 });
  });
});

describe('stairProgressAt', () => {
  const STAIR: Stairway = {
    id: 'F-1',
    lowerLevelId: GROUND,
    upperLevelId: FIRST,
    lowerEnd: { xM: 2, zM: 2 },
    upperEnd: { xM: 5, zM: 2 },
    halfWidthM: 0.6,
  };

  it('reads 0 at the bottom step and 1 at the top', () => {
    expect(stairProgressAt(STAIR, at(2, 2))).toBeCloseTo(0, 10);
    expect(stairProgressAt(STAIR, at(5, 2))).toBeCloseTo(1, 10);
  });

  it('is null beside the flight and past either end', () => {
    expect(stairProgressAt(STAIR, at(3.5, 3))).toBeNull();
    expect(stairProgressAt(STAIR, at(1, 2))).toBeNull();
    expect(stairProgressAt(STAIR, at(6, 2))).toBeNull();
  });

  it('is null for a flight with no run', () => {
    expect(stairProgressAt({ ...STAIR, upperEnd: { xM: 2, zM: 2 } }, at(2, 2))).toBeNull();
  });
});

describe('planPointOf', () => {
  it('drops the height and keeps the two plan axes', () => {
    expect(planPointOf(new Vector3(3, 1.6, -4))).toEqual({ xM: 3, zM: -4 });
  });
});
