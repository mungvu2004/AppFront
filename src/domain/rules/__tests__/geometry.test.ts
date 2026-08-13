import { describe, expect, it } from 'vitest';

import { normalizeSpatial } from '../../spatial/normalize';
import type {
  Furniture,
  FurnitureId,
  Level,
  LevelId,
  Opening,
  OpeningId,
  Point,
  Room,
  RoomId,
  RoomUsage,
  SpatialGraph,
  SwingDirection,
  Wall,
  WallId,
  WallKind,
} from '../../spatial/types';
import { createRuleRegistry, type RuleContext } from '../registry';
import { runRules } from '../runner';
import {
  checkDanglingWallEnds,
  checkDoorSwing,
  checkLoadBearingSupport,
  checkOpeningOverlap,
  checkRoomClosure,
  checkStairAlignment,
  checkWallOverlap,
  GEOMETRY_RULES,
  JOINT_TOLERANCE_MM,
  MIN_SUPPORT_SHARE,
  registerGeometryRules,
  STAIR_ALIGNMENT_TOLERANCE_MM,
  type GeometryCheck,
  type GeometryFinding,
} from '../geometry';
import { lengthText } from '../geometry/messages';

/* -------------------------------------------------------------------------- */
/* Building a plan.                                                            */
/* -------------------------------------------------------------------------- */

const REVIEWED = { confidence: 1, source: 'human', reviewed: true } as const;
const DETECTED = { confidence: 0.82, source: 'ai', reviewed: false } as const;

const LEVEL_HEIGHT_MM = 3600;
const ENVELOPE_THICKNESS_MM = 220;
const PARTITION_THICKNESS_MM = 100;

/** Ids are `<prefix>-<ten uppercase characters>`, which is what the graph checks. */
const wallId = (code: string): WallId => `W-${code.padEnd(10, '0')}`;
const openingId = (code: string): OpeningId => `D-${code.padEnd(10, '0')}`;
const roomId = (code: string): RoomId => `R-${code.padEnd(10, '0')}`;
const furnitureId = (code: string): FurnitureId => `F-${code.padEnd(10, '0')}`;
const levelId = (code: string): LevelId => `L-${code.padEnd(10, '0')}`;

const GROUND: LevelId = levelId('GROUND');
const FIRST: LevelId = levelId('FIRST');

interface WallOptions {
  readonly kind?: WallKind;
  readonly thicknessMm?: number;
  readonly levelId?: LevelId;
}

function wall(code: string, start: Point, end: Point, options: WallOptions = {}): Wall {
  return {
    ...DETECTED,
    id: wallId(code),
    levelId: options.levelId ?? GROUND,
    centreline: { start, end },
    thicknessMm: options.thicknessMm ?? ENVELOPE_THICKNESS_MM,
    heightMm: LEVEL_HEIGHT_MM,
    kind: options.kind ?? 'loadBearing',
    openingIds: [],
  };
}

interface OpeningOptions {
  readonly kind?: 'door' | 'window';
  readonly swing?: SwingDirection;
  readonly heightMm?: number;
  readonly sillHeightMm?: number;
}

function opening(
  code: string,
  host: WallId,
  offsetMm: number,
  widthMm: number,
  options: OpeningOptions = {},
): Opening {
  return {
    ...DETECTED,
    id: openingId(code),
    wallId: host,
    kind: options.kind ?? 'door',
    offsetMm,
    widthMm,
    heightMm: options.heightMm ?? 2200,
    sillHeightMm: options.sillHeightMm ?? 0,
    swing: options.swing ?? 'left',
  };
}

interface RoomOptions {
  readonly usage?: RoomUsage;
  readonly levelId?: LevelId;
  readonly name?: string;
  readonly areaM2?: number;
}

function room(
  code: string,
  outline: readonly Point[],
  wallIds: readonly WallId[],
  options: RoomOptions = {},
): Room {
  return {
    ...REVIEWED,
    id: roomId(code),
    levelId: options.levelId ?? GROUND,
    name: options.name ?? code,
    usage: options.usage ?? 'bedroom',
    outline,
    areaM2: options.areaM2 ?? 12,
    wallIds,
  };
}

function stair(code: string, centre: Point, host: LevelId): Furniture {
  return {
    ...DETECTED,
    id: furnitureId(code),
    levelId: host,
    kind: 'stair',
    centre,
    boundingBox: {
      min: { x: centre.x - 900, y: centre.y - 800 },
      max: { x: centre.x + 900, y: centre.y + 800 },
    },
    rotationDeg: 0,
  };
}

function level(id: LevelId, order: number, name: string): Level {
  return {
    ...REVIEWED,
    id,
    name,
    order,
    elevationMm: order * LEVEL_HEIGHT_MM,
    heightMm: LEVEL_HEIGHT_MM,
  };
}

interface PlanParts {
  readonly levels?: readonly Level[];
  readonly walls?: readonly Wall[];
  readonly openings?: readonly Opening[];
  readonly rooms?: readonly Room[];
  readonly furniture?: readonly Furniture[];
}

/**
 * A whole graph from the parts a test cares about.
 *
 * Walls are given their opening lists here rather than in every fixture, so a
 * test that moves a door cannot leave the wall pointing at the old one.
 */
function planOf(parts: PlanParts): SpatialGraph {
  const openings = parts.openings ?? [];
  const walls = (parts.walls ?? []).map((item) => ({
    ...item,
    openingIds: openings.filter((hole) => hole.wallId === item.id).map((hole) => hole.id),
  }));

  return {
    building: { ...REVIEWED, name: 'Nhà mẫu kiểm luật', datumElevationMm: 0 },
    levels: parts.levels ?? [level(GROUND, 0, 'Tầng trệt')],
    walls,
    openings,
    furniture: parts.furniture ?? [],
    rooms: parts.rooms ?? [],
    axes: [],
    dimensions: [],
    notes: [],
  };
}

function contextOf(graph: SpatialGraph, host: LevelId | null): RuleContext {
  return { graph: normalizeSpatial(graph), levelId: host };
}

function runCheck(check: GeometryCheck, graph: SpatialGraph, host: LevelId | null): readonly GeometryFinding[] {
  return check(contextOf(graph, host));
}

/* -------------------------------------------------------------------------- */
/* The reference plan: two storeys that break nothing.                         */
/* -------------------------------------------------------------------------- */

const GROUND_SOUTH = wallId('GSOUTH');
const GROUND_EAST = wallId('GEAST');
const GROUND_NORTH = wallId('GNORTH');
const GROUND_WEST = wallId('GWEST');
const GROUND_MID = wallId('GMID');
const GROUND_DUPLICATE = wallId('GDUP');

const FIRST_SOUTH = wallId('FSOUTH');
const FIRST_EAST = wallId('FEAST');
const FIRST_NORTH = wallId('FNORTH');
const FIRST_WEST = wallId('FWEST');
const FIRST_STUB = wallId('FSTUB');
const FIRST_COLUMN = wallId('FCOL');
const FIRST_CLOSET_SOUTH = wallId('FCLS');
const FIRST_CLOSET_NORTH = wallId('FCLN');

const GROUND_MID_DOOR = openingId('GDMID');
const GROUND_MID_WINDOW = openingId('GWMID');
const CLOSET_DOOR = openingId('FDCLOSET');

const WEST_ROOM = roomId('GRWEST');
const FIRST_STAIR = furnitureId('FSTAIR');

const LEVELS: readonly Level[] = [level(GROUND, 0, 'Tầng trệt'), level(FIRST, 1, 'Tầng 1')];

/**
 * Six by four metres, two storeys, everything where it belongs.
 *
 * The ground floor is split in two by a partition; the storey above repeats the
 * envelope exactly, so every load-bearing wall stands on the one below and the
 * stair core lines up. No geometry rule has anything to say about it, which is
 * what makes it the baseline every negative test measures against.
 */
function createCleanPlan(): SpatialGraph {
  const groundWalls = [
    wall('GSOUTH', { x: 0, y: 0 }, { x: 6000, y: 0 }),
    wall('GEAST', { x: 6000, y: 0 }, { x: 6000, y: 4000 }),
    wall('GNORTH', { x: 6000, y: 4000 }, { x: 0, y: 4000 }),
    wall('GWEST', { x: 0, y: 4000 }, { x: 0, y: 0 }),
    wall('GMID', { x: 3000, y: 0 }, { x: 3000, y: 4000 }, {
      kind: 'partition',
      thicknessMm: PARTITION_THICKNESS_MM,
    }),
  ];

  const firstWalls = [
    wall('FSOUTH', { x: 0, y: 0 }, { x: 6000, y: 0 }, { levelId: FIRST }),
    wall('FEAST', { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { levelId: FIRST }),
    wall('FNORTH', { x: 6000, y: 4000 }, { x: 0, y: 4000 }, { levelId: FIRST }),
    wall('FWEST', { x: 0, y: 4000 }, { x: 0, y: 0 }, { levelId: FIRST }),
  ];

  return planOf({
    levels: LEVELS,
    walls: [...groundWalls, ...firstWalls],
    openings: [
      opening('GDMID', GROUND_MID, 1000, 900, { swing: 'left' }),
      opening('GDENTRY', GROUND_SOUTH, 500, 900, { swing: 'right' }),
      opening('GWEAST', GROUND_EAST, 1500, 1200, {
        kind: 'window',
        swing: 'fixed',
        heightMm: 1400,
        sillHeightMm: 900,
      }),
    ],
    rooms: [
      room(
        'GRWEST',
        [
          { x: 0, y: 0 },
          { x: 3000, y: 0 },
          { x: 3000, y: 4000 },
          { x: 0, y: 4000 },
        ],
        [GROUND_SOUTH, GROUND_MID, GROUND_NORTH, GROUND_WEST],
        { name: 'Phòng ngủ' },
      ),
      room(
        'GREAST',
        [
          { x: 3000, y: 0 },
          { x: 6000, y: 0 },
          { x: 6000, y: 4000 },
          { x: 3000, y: 4000 },
        ],
        [GROUND_SOUTH, GROUND_EAST, GROUND_NORTH, GROUND_MID],
        { name: 'Phòng khách', usage: 'livingRoom' },
      ),
      room(
        'FRALL',
        [
          { x: 0, y: 0 },
          { x: 6000, y: 0 },
          { x: 6000, y: 4000 },
          { x: 0, y: 4000 },
        ],
        [FIRST_SOUTH, FIRST_EAST, FIRST_NORTH, FIRST_WEST],
        { name: 'Phòng lớn', levelId: FIRST, areaM2: 24 },
      ),
    ],
    furniture: [
      stair('GSTAIR', { x: 4500, y: 3000 }, GROUND),
      stair('FSTAIR', { x: 4500, y: 3000 }, FIRST),
    ],
  });
}

/**
 * The same plan with one instance of each of the seven defects.
 *
 * Every injection is placed so that it breaks exactly one rule: the duplicate
 * wall lands away from any door swing, the stub with the loose end stays clear
 * of the column, the open room side is a traced outline rather than a missing
 * wall. That separation is the point of the fixture — it is what proves the
 * seven rules do not report each other's findings.
 */
function createFaultyPlan(): SpatialGraph {
  const clean = createCleanPlan();

  return planOf({
    levels: LEVELS,
    walls: [
      ...clean.walls,
      // 1 — a second wall laid along the ground floor's south wall.
      wall('GDUP', { x: 4000, y: 0 }, { x: 5000, y: 0 }, {
        kind: 'partition',
        thicknessMm: PARTITION_THICKNESS_MM,
      }),
      // 2 — a stub off the first floor's west wall, loose at its far end.
      wall('FSTUB', { x: 0, y: 3000 }, { x: 700, y: 3000 }, {
        levelId: FIRST,
        kind: 'partition',
        thicknessMm: PARTITION_THICKNESS_MM,
      }),
      // 4 — two cupboards back to back, each shallower than the door leaf.
      wall('FCLW', { x: 5000, y: 0 }, { x: 5000, y: 1200 }, {
        levelId: FIRST,
        kind: 'partition',
        thicknessMm: PARTITION_THICKNESS_MM,
      }),
      wall('FCLS', { x: 5000, y: 600 }, { x: 6000, y: 600 }, {
        levelId: FIRST,
        kind: 'partition',
        thicknessMm: PARTITION_THICKNESS_MM,
      }),
      wall('FCLN', { x: 5000, y: 1200 }, { x: 6000, y: 1200 }, {
        levelId: FIRST,
        kind: 'partition',
        thicknessMm: PARTITION_THICKNESS_MM,
      }),
      // 6 — a load-bearing wall upstairs with nothing under it.
      wall('FCOL', { x: 1000, y: 0 }, { x: 1000, y: 4000 }, { levelId: FIRST }),
    ],
    openings: [
      ...clean.openings,
      // 5 — a window cut across the door already in the middle wall.
      opening('GWMID', GROUND_MID, 1500, 900, {
        kind: 'window',
        swing: 'fixed',
        heightMm: 1400,
        sillHeightMm: 900,
      }),
      // 4 — the door that has nowhere to swing.
      opening('FDCLOSET', FIRST_CLOSET_SOUTH, 150, 700, { swing: 'left' }),
    ],
    rooms: clean.rooms.map((item) =>
      // 3 — the west room's outline traced 600 mm outside its west wall.
      item.id === WEST_ROOM
        ? {
            ...item,
            outline: [
              { x: -600, y: 0 },
              { x: 3000, y: 0 },
              { x: 3000, y: 4000 },
              { x: -600, y: 4000 },
            ],
          }
        : item,
    ),
    // 7 — the upper flight moved off the one below it.
    furniture: clean.furniture.map((item) =>
      item.id === FIRST_STAIR ? stair('FSTAIR', { x: 4500, y: 1500 }, FIRST) : item,
    ),
  });
}

/* -------------------------------------------------------------------------- */
/* The whole group.                                                            */
/* -------------------------------------------------------------------------- */

describe('the geometry group', () => {
  it('is seven rules, every one of them critical', () => {
    expect(GEOMETRY_RULES).toHaveLength(7);
    expect(GEOMETRY_RULES.map((rule) => rule.code)).toEqual([
      'WALL-OVERLAP',
      'WALL-DANGLING-END',
      'ROOM-NOT-CLOSED',
      'DOOR-SWING-BLOCKED',
      'OPENING-OVERLAP',
      'WALL-UNSUPPORTED',
      'STAIR-ALIGNMENT',
    ]);
    expect(GEOMETRY_RULES.every((rule) => rule.severity === 'critical')).toBe(true);
  });

  it('declares a dependency map that matches what each check reads', () => {
    const registry = createRuleRegistry(GEOMETRY_RULES);

    expect(registry.rulesFor(['wall']).map((rule) => rule.code)).toEqual([
      'WALL-OVERLAP',
      'WALL-DANGLING-END',
      'ROOM-NOT-CLOSED',
      'DOOR-SWING-BLOCKED',
      'WALL-UNSUPPORTED',
    ]);
    expect(registry.rulesFor(['room']).map((rule) => rule.code)).toEqual(['ROOM-NOT-CLOSED']);
    expect(registry.rulesFor(['opening']).map((rule) => rule.code)).toEqual([
      'DOOR-SWING-BLOCKED',
      'OPENING-OVERLAP',
    ]);
    expect(registry.rulesFor(['furniture']).map((rule) => rule.code)).toEqual(['STAIR-ALIGNMENT']);
    expect(registry.rulesFor(['level']).map((rule) => rule.code)).toEqual([
      'WALL-UNSUPPORTED',
      'STAIR-ALIGNMENT',
    ]);
  });

  it('registers into a rule book, and registering twice changes nothing', () => {
    const registry = createRuleRegistry();

    registerGeometryRules(registry);
    registerGeometryRules(registry);

    expect(registry.list()).toHaveLength(7);
    expect(registry.isEnabled('WALL-OVERLAP')).toBe(true);
  });

  it('refuses a foreign rule that claims one of the seven codes', () => {
    const registry = createRuleRegistry([
      { ...GEOMETRY_RULES[0]!, name: 'luật khác cùng mã', check: () => [] },
    ]);

    expect(() => {
      registerGeometryRules(registry);
    }).toThrow(/WALL-OVERLAP/);
  });

  it('says nothing at all about a plan that is drawn correctly', () => {
    const result = runRules(normalizeSpatial(createCleanPlan()), {
      registry: createRuleRegistry(GEOMETRY_RULES),
    });

    expect(result.violations).toEqual([]);
  });

  it('finds exactly seven critical violations in the deliberately broken plan', () => {
    const result = runRules(normalizeSpatial(createFaultyPlan()), {
      registry: createRuleRegistry(GEOMETRY_RULES),
    });

    expect(result.violations).toHaveLength(7);
    expect(result.violations.every((found) => found.severity === 'critical')).toBe(true);
    expect(result.violations.map((found) => found.ruleCode)).toEqual(
      GEOMETRY_RULES.map((rule) => rule.code),
    );
  });

  it('gives every one of them an entity code, a sentence with numbers and a fix', () => {
    const result = runRules(normalizeSpatial(createFaultyPlan()), {
      registry: createRuleRegistry(GEOMETRY_RULES),
    });

    for (const found of result.violations) {
      expect(found.entityId).toMatch(/^[A-Z]-[0-9A-Z]{10,}$/);
      expect(found.message).toContain(found.entityId);
      expect(found.message).toMatch(/\d/);
      expect(found.message.trim().endsWith('.')).toBe(true);
      expect(found.suggestion.trim().endsWith('.')).toBe(true);
    }
  });

  it('leaves the plan exactly as it found it', () => {
    const plan = createFaultyPlan();
    const before = JSON.stringify(plan);

    runRules(normalizeSpatial(plan), { registry: createRuleRegistry(GEOMETRY_RULES) });

    expect(JSON.stringify(plan)).toBe(before);
  });
});

/* -------------------------------------------------------------------------- */
/* 1 — WALL-OVERLAP.                                                           */
/* -------------------------------------------------------------------------- */

describe('walls on top of each other', () => {
  it('reports a wall laid along another one, with the shared length', () => {
    const found = runCheck(checkWallOverlap, createFaultyPlan(), GROUND);

    expect(found).toHaveLength(1);
    expect(found[0]?.entityId).toBe(GROUND_SOUTH);
    expect(found[0]?.relatedIds).toEqual([GROUND_SOUTH, GROUND_DUPLICATE]);
    expect(found[0]?.message).toContain(lengthText(1000));
  });

  it('reports a wall running through the middle of another', () => {
    const plan = planOf({
      walls: [
        wall('WCROSSA', { x: 0, y: 0 }, { x: 4000, y: 0 }),
        wall('WCROSSB', { x: 2000, y: -2000 }, { x: 2000, y: 2000 }),
      ],
    });

    const found = runCheck(checkWallOverlap, plan, GROUND);

    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain('cắt ngang');
    expect(found[0]?.message).toContain('(2.000; 0)');
  });

  it('says nothing about walls meeting at a corner or a tee', () => {
    expect(runCheck(checkWallOverlap, createCleanPlan(), GROUND)).toEqual([]);
    expect(runCheck(checkWallOverlap, createCleanPlan(), FIRST)).toEqual([]);
  });

  it('says nothing about two walls laid end to end on one line', () => {
    const plan = planOf({
      walls: [
        wall('WRUNA', { x: 0, y: 0 }, { x: 3000, y: 0 }),
        wall('WRUNB', { x: 3000, y: 0 }, { x: 6000, y: 0 }),
      ],
    });

    expect(runCheck(checkWallOverlap, plan, GROUND)).toEqual([]);
  });

  it('says nothing about parallel walls a room apart', () => {
    const plan = planOf({
      walls: [
        wall('WFARA', { x: 0, y: 0 }, { x: 3000, y: 0 }),
        wall('WFARB', { x: 0, y: 3000 }, { x: 3000, y: 3000 }),
      ],
    });

    expect(runCheck(checkWallOverlap, plan, GROUND)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* 2 — WALL-DANGLING-END.                                                      */
/* -------------------------------------------------------------------------- */

describe('wall ends joined to nothing', () => {
  it('reports the loose end, where it is and how far it has to reach', () => {
    const found = runCheck(checkDanglingWallEnds, createFaultyPlan(), FIRST);

    expect(found).toHaveLength(1);
    expect(found[0]?.entityId).toBe(FIRST_STUB);
    expect(found[0]?.relatedIds).toEqual([FIRST_STUB, FIRST_COLUMN]);
    expect(found[0]?.message).toContain('(700; 3.000)');
    expect(found[0]?.message).toContain(lengthText(190));
    expect(found[0]?.suggestion).toContain(FIRST_COLUMN);
  });

  it('reports both ends of a wall standing on its own', () => {
    const plan = planOf({ walls: [wall('WALONE', { x: 0, y: 0 }, { x: 2000, y: 0 })] });
    const found = runCheck(checkDanglingWallEnds, plan, GROUND);

    expect(found).toHaveLength(2);
    expect(found.every((item) => item.entityId === wallId('WALONE'))).toBe(true);
    expect(found[0]?.message).toContain('tầng này không còn tường nào khác');
  });

  it('says nothing about a closed loop of walls', () => {
    expect(runCheck(checkDanglingWallEnds, createCleanPlan(), GROUND)).toEqual([]);
    expect(runCheck(checkDanglingWallEnds, createCleanPlan(), FIRST)).toEqual([]);
  });

  it('counts an end that lands on the face of another wall as joined', () => {
    const plan = planOf({
      walls: [
        wall('WSPINE', { x: 0, y: 0 }, { x: 4000, y: 0 }),
        // Stops 100 mm short of the spine's centreline, which is 110 mm thick.
        wall('WTEE', { x: 2000, y: 2000 }, { x: 2000, y: 100 }, {
          kind: 'partition',
          thicknessMm: PARTITION_THICKNESS_MM,
        }),
      ],
    });

    const teeEnds = runCheck(checkDanglingWallEnds, plan, GROUND).filter(
      (item) => item.entityId === wallId('WTEE'),
    );

    // Only the far end is loose; the one against the spine's face is joined.
    expect(teeEnds).toHaveLength(1);
    expect(teeEnds[0]?.message).toContain('(2.000; 2.000)');
  });
});

/* -------------------------------------------------------------------------- */
/* 3 — ROOM-NOT-CLOSED.                                                        */
/* -------------------------------------------------------------------------- */

describe('rooms that are not sealed', () => {
  it('reports the open length, the number of gaps and the worst one', () => {
    const found = runCheck(checkRoomClosure, createFaultyPlan(), GROUND);

    expect(found).toHaveLength(1);
    expect(found[0]?.entityId).toBe(WEST_ROOM);
    expect(found[0]?.message).toContain(lengthText(5200));
    expect(found[0]?.message).toContain('3 chỗ hở');
    expect(found[0]?.message).toContain('(-600; 2.000)');
    expect(found[0]?.suggestion).toContain('(-600; 2.000)');
  });

  it('says nothing about a room whose every side has a wall along it', () => {
    expect(runCheck(checkRoomClosure, createCleanPlan(), GROUND)).toEqual([]);
    expect(runCheck(checkRoomClosure, createCleanPlan(), FIRST)).toEqual([]);
  });

  it('accepts a side closed by two walls end to end', () => {
    const plan = planOf({
      walls: [
        wall('WSPLITA', { x: 0, y: 0 }, { x: 2000, y: 0 }),
        wall('WSPLITB', { x: 2000, y: 0 }, { x: 4000, y: 0 }),
        wall('WSIDEE', { x: 4000, y: 0 }, { x: 4000, y: 3000 }),
        wall('WBACK', { x: 4000, y: 3000 }, { x: 0, y: 3000 }),
        wall('WSIDEW', { x: 0, y: 3000 }, { x: 0, y: 0 }),
      ],
      rooms: [
        room(
          'RSPLIT',
          [
            { x: 0, y: 0 },
            { x: 4000, y: 0 },
            { x: 4000, y: 3000 },
            { x: 0, y: 3000 },
          ],
          [wallId('WSPLITA'), wallId('WSPLITB'), wallId('WSIDEE'), wallId('WBACK'), wallId('WSIDEW')],
        ),
      ],
    });

    expect(runCheck(checkRoomClosure, plan, GROUND)).toEqual([]);
  });

  it('leaves an outline with too few vertices to integrity checking', () => {
    const plan = planOf({
      walls: [wall('WONLY', { x: 0, y: 0 }, { x: 2000, y: 0 })],
      rooms: [
        room(
          'RTHIN',
          [
            { x: 0, y: 0 },
            { x: 2000, y: 0 },
          ],
          [wallId('WONLY')],
        ),
      ],
    });

    expect(runCheck(checkRoomClosure, plan, GROUND)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* 4 — DOOR-SWING-BLOCKED.                                                     */
/* -------------------------------------------------------------------------- */

describe('doors with nowhere to open', () => {
  it('reports the walls the leaf hits and the deepest clear space left', () => {
    const found = runCheck(checkDoorSwing, createFaultyPlan(), FIRST);

    expect(found).toHaveLength(1);
    expect(found[0]?.entityId).toBe(CLOSET_DOOR);
    expect(found[0]?.relatedIds).toEqual([
      CLOSET_DOOR,
      FIRST_CLOSET_SOUTH,
      FIRST_SOUTH,
      FIRST_CLOSET_NORTH,
    ]);
    expect(found[0]?.message).toContain(lengthText(700));
    expect(found[0]?.message).toContain(lengthText(550));
  });

  it('says nothing when one face of the door is clear', () => {
    expect(runCheck(checkDoorSwing, createCleanPlan(), GROUND)).toEqual([]);
  });

  it('says nothing about a door that slides', () => {
    const blocked = createFaultyPlan();
    const sliding: SpatialGraph = {
      ...blocked,
      openings: blocked.openings.map((item) =>
        item.id === CLOSET_DOOR ? { ...item, swing: 'sliding' as const } : item,
      ),
    };

    expect(runCheck(checkDoorSwing, sliding, FIRST)).toEqual([]);
  });

  it('says nothing about a window, which has no leaf to swing', () => {
    const plan = planOf({
      walls: [
        wall('WHOST', { x: 0, y: 0 }, { x: 2000, y: 0 }, { thicknessMm: PARTITION_THICKNESS_MM }),
        wall('WNEARN', { x: 0, y: 300 }, { x: 2000, y: 300 }, { thicknessMm: PARTITION_THICKNESS_MM }),
        wall('WNEARS', { x: 0, y: -300 }, { x: 2000, y: -300 }, { thicknessMm: PARTITION_THICKNESS_MM }),
      ],
      openings: [
        opening('OWIN', wallId('WHOST'), 500, 900, { kind: 'window', swing: 'fixed' }),
      ],
    });

    expect(runCheck(checkDoorSwing, plan, GROUND)).toEqual([]);
  });

  it('measures a double door by one leaf, not by the pair', () => {
    const walls = [
      wall('WHOST', { x: 0, y: 0 }, { x: 2000, y: 0 }, { thicknessMm: PARTITION_THICKNESS_MM }),
      wall('WNEARN', { x: 0, y: 600 }, { x: 2000, y: 600 }, { thicknessMm: PARTITION_THICKNESS_MM }),
      wall('WNEARS', { x: 0, y: -600 }, { x: 2000, y: -600 }, { thicknessMm: PARTITION_THICKNESS_MM }),
    ];

    // Each leaf is 450 mm and clears the 550 mm to the neighbouring wall face.
    const asDouble = planOf({
      walls,
      openings: [opening('ODBL', wallId('WHOST'), 500, 900, { swing: 'double' })],
    });
    // The same 900 mm as one leaf does not.
    const asSingle = planOf({
      walls,
      openings: [opening('ODBL', wallId('WHOST'), 500, 900, { swing: 'left' })],
    });

    expect(runCheck(checkDoorSwing, asDouble, GROUND)).toEqual([]);
    expect(runCheck(checkDoorSwing, asSingle, GROUND)).toHaveLength(1);
  });

  it('leaves a door hanging off the end of its wall to OPENING-IN-WALL', () => {
    const plan = planOf({
      walls: [
        wall('WSHORT', { x: 0, y: 0 }, { x: 800, y: 0 }, { thicknessMm: PARTITION_THICKNESS_MM }),
        wall('WNEARN', { x: 0, y: 300 }, { x: 2000, y: 300 }, { thicknessMm: PARTITION_THICKNESS_MM }),
        wall('WNEARS', { x: 0, y: -300 }, { x: 2000, y: -300 }, { thicknessMm: PARTITION_THICKNESS_MM }),
      ],
      openings: [opening('OOVER', wallId('WSHORT'), 200, 900, { swing: 'left' })],
    });

    expect(runCheck(checkDoorSwing, plan, GROUND)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* 5 — OPENING-OVERLAP.                                                        */
/* -------------------------------------------------------------------------- */

describe('openings cut over each other', () => {
  it('reports the shared stretch of wall, once for the pair', () => {
    const found = runCheck(checkOpeningOverlap, createFaultyPlan(), GROUND);

    expect(found).toHaveLength(1);
    expect(found[0]?.entityId).toBe(GROUND_MID_DOOR);
    expect(found[0]?.relatedIds).toEqual([GROUND_MID_DOOR, GROUND_MID_WINDOW, GROUND_MID]);
    expect(found[0]?.message).toContain(lengthText(400));
    expect(found[0]?.message).toContain(`${lengthText(1500)}–${lengthText(1900)}`);
  });

  it('says nothing about one opening per wall', () => {
    expect(runCheck(checkOpeningOverlap, createCleanPlan(), GROUND)).toEqual([]);
  });

  it('says nothing about two openings that merely touch', () => {
    const plan = planOf({
      walls: [wall('WTWIN', { x: 0, y: 0 }, { x: 4000, y: 0 })],
      openings: [
        opening('OLEFT', wallId('WTWIN'), 500, 900, { kind: 'window', swing: 'fixed' }),
        opening('ORIGHT', wallId('WTWIN'), 1400, 900, { kind: 'window', swing: 'fixed' }),
      ],
    });

    expect(runCheck(checkOpeningOverlap, plan, GROUND)).toEqual([]);
  });

  it('says nothing about two openings on different walls at the same offset', () => {
    const plan = planOf({
      walls: [
        wall('WONEA', { x: 0, y: 0 }, { x: 4000, y: 0 }),
        wall('WONEB', { x: 0, y: 3000 }, { x: 4000, y: 3000 }),
      ],
      openings: [
        opening('OONEA', wallId('WONEA'), 500, 900, { kind: 'window', swing: 'fixed' }),
        opening('OONEB', wallId('WONEB'), 500, 900, { kind: 'window', swing: 'fixed' }),
      ],
    });

    expect(runCheck(checkOpeningOverlap, plan, GROUND)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* 6 — WALL-UNSUPPORTED.                                                       */
/* -------------------------------------------------------------------------- */

describe('load-bearing walls standing on air', () => {
  it('reports the wall, the share carried and that nothing lines up below', () => {
    const found = runCheck(checkLoadBearingSupport, createFaultyPlan(), null);

    expect(found).toHaveLength(1);
    expect(found[0]?.entityId).toBe(FIRST_COLUMN);
    expect(found[0]?.message).toContain('0%');
    expect(found[0]?.message).toContain('Tầng 1');
    expect(found[0]?.message).toContain('Tầng trệt');
    expect(found[0]?.suggestion).toContain('tường ngăn');
  });

  it('says nothing when every upper wall sits on the one below', () => {
    expect(runCheck(checkLoadBearingSupport, createCleanPlan(), null)).toEqual([]);
  });

  it('says nothing about a partition upstairs, which carries nothing', () => {
    const plan = planOf({
      levels: LEVELS,
      walls: [
        wall('WFLOAT', { x: 0, y: 0 }, { x: 4000, y: 0 }, {
          levelId: FIRST,
          kind: 'partition',
          thicknessMm: PARTITION_THICKNESS_MM,
        }),
      ],
    });

    expect(runCheck(checkLoadBearingSupport, plan, null)).toEqual([]);
  });

  it('adds up two short walls below into one long support', () => {
    const plan = planOf({
      levels: LEVELS,
      walls: [
        wall('WBASEA', { x: 0, y: 0 }, { x: 2000, y: 0 }),
        wall('WBASEB', { x: 2000, y: 0 }, { x: 4000, y: 0 }),
        wall('WABOVE', { x: 0, y: 0 }, { x: 4000, y: 0 }, { levelId: FIRST }),
      ],
    });

    expect(runCheck(checkLoadBearingSupport, plan, null)).toEqual([]);
  });

  it('reports a wall carried for less than the share the rule asks for', () => {
    const plan = planOf({
      levels: LEVELS,
      walls: [
        wall('WBASEA', { x: 0, y: 0 }, { x: 2000, y: 0 }),
        wall('WABOVE', { x: 0, y: 0 }, { x: 4000, y: 0 }, { levelId: FIRST }),
      ],
    });

    const found = runCheck(checkLoadBearingSupport, plan, null);

    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain('50%');
    expect(found[0]?.message).toContain(wallId('WBASEA'));
    expect(MIN_SUPPORT_SHARE).toBeGreaterThan(0.5);
  });
});

/* -------------------------------------------------------------------------- */
/* 7 — STAIR-ALIGNMENT.                                                        */
/* -------------------------------------------------------------------------- */

describe('stairs that miss the flight below', () => {
  it('reports how far off axis the upper flight is, and where it should go', () => {
    const found = runCheck(checkStairAlignment, createFaultyPlan(), null);

    expect(found).toHaveLength(1);
    expect(found[0]?.entityId).toBe(FIRST_STAIR);
    expect(found[0]?.relatedIds).toEqual([FIRST_STAIR, furnitureId('GSTAIR'), FIRST]);
    expect(found[0]?.message).toContain(lengthText(1500));
    expect(found[0]?.suggestion).toContain('(4.500; 3.000)');
  });

  it('says nothing when the flights stand over each other', () => {
    expect(runCheck(checkStairAlignment, createCleanPlan(), null)).toEqual([]);
  });

  it('accepts a flight within the tolerance', () => {
    const plan = planOf({
      levels: LEVELS,
      furniture: [
        stair('GSTAIR', { x: 4500, y: 3000 }, GROUND),
        stair('FSTAIR', { x: 4500, y: 3000 + STAIR_ALIGNMENT_TOLERANCE_MM }, FIRST),
      ],
    });

    expect(runCheck(checkStairAlignment, plan, null)).toEqual([]);
  });

  it('leaves a storey with no stair below alone, since that is a different problem', () => {
    const plan = planOf({
      levels: LEVELS,
      furniture: [stair('FSTAIR', { x: 4500, y: 1500 }, FIRST)],
    });

    expect(runCheck(checkStairAlignment, plan, null)).toEqual([]);
  });

  it('matches the nearest flight below when a storey has two', () => {
    const plan = planOf({
      levels: LEVELS,
      furniture: [
        stair('GSTAIRA', { x: 1000, y: 1000 }, GROUND),
        stair('GSTAIRB', { x: 8000, y: 1000 }, GROUND),
        stair('FSTAIR', { x: 8000, y: 1000 }, FIRST),
      ],
    });

    expect(runCheck(checkStairAlignment, plan, null)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* No defect is claimed by two rules.                                          */
/* -------------------------------------------------------------------------- */

describe('the seven staying out of each other’s way', () => {
  const CHECKS: readonly (readonly [string, GeometryCheck, LevelId | null])[] = [
    ['WALL-OVERLAP', checkWallOverlap, GROUND],
    ['WALL-DANGLING-END', checkDanglingWallEnds, FIRST],
    ['ROOM-NOT-CLOSED', checkRoomClosure, GROUND],
    ['DOOR-SWING-BLOCKED', checkDoorSwing, FIRST],
    ['OPENING-OVERLAP', checkOpeningOverlap, GROUND],
    ['WALL-UNSUPPORTED', checkLoadBearingSupport, null],
    ['STAIR-ALIGNMENT', checkStairAlignment, null],
  ];

  it('has each defect claimed by exactly one rule', () => {
    const plan = createFaultyPlan();
    const counts = CHECKS.map(([code, check, host]) => [code, runCheck(check, plan, host).length]);

    expect(Object.fromEntries(counts)).toEqual({
      'WALL-OVERLAP': 1,
      'WALL-DANGLING-END': 1,
      'ROOM-NOT-CLOSED': 1,
      'DOOR-SWING-BLOCKED': 1,
      'OPENING-OVERLAP': 1,
      'WALL-UNSUPPORTED': 1,
      'STAIR-ALIGNMENT': 1,
    });
  });

  it('never names the same entity twice across two rules', () => {
    const plan = createFaultyPlan();
    const subjects = CHECKS.flatMap(([, check, host]) =>
      runCheck(check, plan, host).map((item) => item.entityId),
    );

    expect(new Set(subjects).size).toBe(subjects.length);
  });

  it('is stable: the same plan gives the same violations in the same order', () => {
    const registry = createRuleRegistry(GEOMETRY_RULES);
    const first = runRules(normalizeSpatial(createFaultyPlan()), { registry });
    const second = runRules(normalizeSpatial(createFaultyPlan()), { registry });

    expect(second.violations).toEqual(first.violations);
  });

  it('keeps the joint tolerance in step with the wall solver', () => {
    expect(JOINT_TOLERANCE_MM).toBe(50);
  });
});
