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
import { BUILT_IN_RULES, createRuleRegistry, type RuleContext } from '../registry';
import { runRules } from '../runner';
import { computeHealthScore, explainHealthScore, sortBySeverity } from '../healthScore';
import {
  checkCorridorWidth,
  checkDoorBlocksPath,
  checkEscapeDistance,
  checkFurnitureClash,
  checkHabitableWindow,
  checkRoomArea,
  checkRoomHasDoor,
  FUNCTION_RULES,
  MAX_ESCAPE_DISTANCE_MM,
  MIN_CLEAR_PASSAGE_MM,
  registerFunctionRules,
  SUPERSEDED_BUILT_IN_CODES,
  USAGE_REQUIREMENTS,
  type FunctionCheck,
  type FunctionFinding,
} from '../function';

/* -------------------------------------------------------------------------- */
/* Building a plan.                                                            */
/* -------------------------------------------------------------------------- */

const REVIEWED = { confidence: 1, source: 'human', reviewed: true } as const;
const DETECTED = { confidence: 0.82, source: 'ai', reviewed: false } as const;

const LEVEL_HEIGHT_MM = 3600;
const ENVELOPE_THICKNESS_MM = 220;
const PARTITION_THICKNESS_MM = 100;

const wallId = (code: string): WallId => `W-${code.padEnd(10, '0')}`;
const openingId = (code: string): OpeningId => `D-${code.padEnd(10, '0')}`;
const roomId = (code: string): RoomId => `R-${code.padEnd(10, '0')}`;
const furnitureId = (code: string): FurnitureId => `F-${code.padEnd(10, '0')}`;

const GROUND: LevelId = 'L-GROUND0000';

interface WallOptions {
  readonly kind?: WallKind;
  readonly thicknessMm?: number;
}

function wall(code: string, start: Point, end: Point, options: WallOptions = {}): Wall {
  return {
    ...DETECTED,
    id: wallId(code),
    levelId: GROUND,
    centreline: { start, end },
    thicknessMm: options.thicknessMm ?? PARTITION_THICKNESS_MM,
    heightMm: LEVEL_HEIGHT_MM,
    kind: options.kind ?? 'partition',
    openingIds: [],
  };
}

function envelope(code: string, start: Point, end: Point): Wall {
  return wall(code, start, end, { kind: 'envelope', thicknessMm: ENVELOPE_THICKNESS_MM });
}

interface OpeningOptions {
  readonly kind?: 'door' | 'window';
  readonly swing?: SwingDirection;
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
    heightMm: options.kind === 'window' ? 1400 : 2200,
    sillHeightMm: options.kind === 'window' ? 900 : 0,
    swing: options.swing ?? 'left',
  };
}

function room(
  code: string,
  usage: RoomUsage,
  outline: readonly Point[],
  wallIds: readonly WallId[],
  areaM2: number,
  name = code,
): Room {
  return { ...REVIEWED, id: roomId(code), levelId: GROUND, name, usage, outline, areaM2, wallIds };
}

function box(code: string, min: Point, max: Point): Furniture {
  return {
    ...DETECTED,
    id: furnitureId(code),
    levelId: GROUND,
    kind: 'bed',
    centre: { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2 },
    boundingBox: { min, max },
    rotationDeg: 0,
  };
}

const LEVELS: readonly Level[] = [
  { ...REVIEWED, id: GROUND, name: 'Tầng trệt', order: 0, elevationMm: 0, heightMm: LEVEL_HEIGHT_MM },
];

interface PlanParts {
  readonly walls?: readonly Wall[];
  readonly openings?: readonly Opening[];
  readonly rooms?: readonly Room[];
  readonly furniture?: readonly Furniture[];
}

function planOf(parts: PlanParts): SpatialGraph {
  const openings = parts.openings ?? [];

  return {
    building: { ...REVIEWED, name: 'Nhà mẫu kiểm công năng', datumElevationMm: 0 },
    levels: LEVELS,
    walls: (parts.walls ?? []).map((item) => ({
      ...item,
      openingIds: openings.filter((hole) => hole.wallId === item.id).map((hole) => hole.id),
    })),
    openings,
    furniture: parts.furniture ?? [],
    rooms: parts.rooms ?? [],
    axes: [],
    dimensions: [],
    notes: [],
  };
}

function contextOf(graph: SpatialGraph): RuleContext {
  return { graph: normalizeSpatial(graph), levelId: GROUND };
}

function runCheck(check: FunctionCheck, graph: SpatialGraph): readonly FunctionFinding[] {
  return check(contextOf(graph));
}

/* -------------------------------------------------------------------------- */
/* The reference flat: nothing wrong with it.                                  */
/* -------------------------------------------------------------------------- */

const BEDROOM_ONE = roomId('BR1');
const BEDROOM_TWO = roomId('BR2');
const BATHROOM = roomId('BA1');
const SOUTH_WALL = wallId('ES');
const BED = furnitureId('BED1');

const MAIN_WALLS: readonly Wall[] = [
  envelope('ES', { x: 0, y: 0 }, { x: 12000, y: 0 }),
  envelope('EE', { x: 12000, y: 0 }, { x: 12000, y: 8000 }),
  envelope('EN', { x: 12000, y: 8000 }, { x: 0, y: 8000 }),
  envelope('EW', { x: 0, y: 8000 }, { x: 0, y: 0 }),
  wall('CS', { x: 0, y: 3400 }, { x: 12000, y: 3400 }),
  wall('CN', { x: 0, y: 4900 }, { x: 12000, y: 4900 }),
  wall('MIDS', { x: 6000, y: 0 }, { x: 6000, y: 3400 }),
  wall('MIDN', { x: 3000, y: 4900 }, { x: 3000, y: 8000 }),
];

const MAIN_OPENINGS: readonly Opening[] = [
  // In the west envelope wall, on the corridor's stretch of it: the way out.
  opening('DENTRY', wallId('EW'), 3850, 700),
  opening('DBR1', wallId('CS'), 2650, 700),
  opening('DBR2', wallId('CS'), 8650, 700),
  opening('DBA1', wallId('CN'), 1150, 700),
  opening('DLV1', wallId('CN'), 6650, 700),
  opening('WBR1', wallId('ES'), 2650, 700, { kind: 'window', swing: 'fixed' }),
  opening('WBR2', wallId('ES'), 8650, 700, { kind: 'window', swing: 'fixed' }),
  opening('WLV1', wallId('EN'), 4650, 700, { kind: 'window', swing: 'fixed' }),
];

const MAIN_ROOMS: readonly Room[] = [
  room(
    'CO1',
    'corridor',
    [
      { x: 0, y: 3400 },
      { x: 12000, y: 3400 },
      { x: 12000, y: 4900 },
      { x: 0, y: 4900 },
    ],
    [wallId('CS'), wallId('CN'), wallId('EW'), wallId('EE')],
    18,
    'Hành lang',
  ),
  room(
    'BR1',
    'bedroom',
    [
      { x: 0, y: 0 },
      { x: 6000, y: 0 },
      { x: 6000, y: 3400 },
      { x: 0, y: 3400 },
    ],
    [wallId('ES'), wallId('EW'), wallId('CS'), wallId('MIDS')],
    20.4,
    'Ngủ 1',
  ),
  room(
    'BR2',
    'bedroom',
    [
      { x: 6000, y: 0 },
      { x: 12000, y: 0 },
      { x: 12000, y: 3400 },
      { x: 6000, y: 3400 },
    ],
    [wallId('ES'), wallId('EE'), wallId('CS'), wallId('MIDS')],
    20.4,
    'Ngủ 2',
  ),
  room(
    'BA1',
    'bathroom',
    [
      { x: 0, y: 4900 },
      { x: 3000, y: 4900 },
      { x: 3000, y: 8000 },
      { x: 0, y: 8000 },
    ],
    [wallId('CN'), wallId('EW'), wallId('EN'), wallId('MIDN')],
    9.3,
    'Vệ sinh',
  ),
  room(
    'LV1',
    'livingRoom',
    [
      { x: 3000, y: 4900 },
      { x: 12000, y: 4900 },
      { x: 12000, y: 8000 },
      { x: 3000, y: 8000 },
    ],
    [wallId('CN'), wallId('EE'), wallId('EN'), wallId('MIDN')],
    27.9,
    'Khách',
  ),
];

/** A bed standing well clear of every wall. */
const CLEAR_BED = box('BED1', { x: 1000, y: 500 }, { x: 2600, y: 2500 });

/**
 * Twelve by eight metres: two bedrooms, a bathroom, a living room and the
 * corridor that joins them to the front door.
 *
 * Every room the table asks for a door has one on its own stretch of wall,
 * every habitable room has a window, the corridor is 1 500 mm wide, and the
 * furthest room is eleven metres from the way out. Nothing in this group has
 * anything to say about it.
 */
function createCleanFlat(): SpatialGraph {
  return planOf({
    walls: MAIN_WALLS,
    openings: MAIN_OPENINGS,
    rooms: MAIN_ROOMS,
    furniture: [CLEAR_BED],
  });
}

/**
 * The same flat with one instance of each of the seven defects.
 *
 * Three are made by taking something away — the bathroom door, the second
 * bedroom's window — and the rest by an annexe off to the east that carries a
 * narrow passage, a wide passage with a door swinging across it, a dead-end
 * corridor past the escape distance, and a bathroom under size.
 */
function createFaultyFlat(): SpatialGraph {
  return planOf({
    walls: [
      ...MAIN_WALLS,
      // 2 — a passage 800 mm wide, with its own way out.
      wall('AS', { x: 20000, y: 0 }, { x: 28000, y: 0 }),
      wall('AN', { x: 20000, y: 800 }, { x: 28000, y: 800 }),
      envelope('AE', { x: 28000, y: 0 }, { x: 28000, y: 800 }),
      // 5 — a passage wide enough, with a 900 mm leaf swinging into it.
      wall('BS', { x: 20000, y: 2000 }, { x: 28000, y: 2000 }),
      wall('BN', { x: 20000, y: 3200 }, { x: 28000, y: 3200 }),
      envelope('BE', { x: 28000, y: 2000 }, { x: 28000, y: 3200 }),
      // 4 — a dead-end corridor running away from that passage.
      wall('DW', { x: 20000, y: 3200 }, { x: 20000, y: 55000 }),
      wall('DE', { x: 24000, y: 3200 }, { x: 24000, y: 55000 }),
      wall('DN', { x: 20000, y: 55000 }, { x: 24000, y: 55000 }),
      // 6 — a shower room too small for what it is called.
      wall('BAE', { x: 27200, y: 3200 }, { x: 27200, y: 4600 }),
      wall('BAN', { x: 27200, y: 4600 }, { x: 26000, y: 4600 }),
      wall('BAW', { x: 26000, y: 4600 }, { x: 26000, y: 3200 }),
    ],
    openings: [
      // 1 — the bathroom door is gone, so nobody can get in.
      ...MAIN_OPENINGS.filter(
        (item) => item.id !== openingId('DBA1') && item.id !== openingId('WBR2'),
      ),
      opening('DA1', wallId('AE'), 50, 700, { swing: 'sliding' }),
      opening('DA2', wallId('BS'), 3000, 900),
      opening('DA3', wallId('BE'), 250, 700, { swing: 'sliding' }),
      opening('DA4', wallId('BN'), 1650, 700, { swing: 'sliding' }),
      opening('DA5', wallId('BN'), 6250, 700, { swing: 'sliding' }),
    ],
    rooms: [
      // 3 — bedroom two has lost its window.
      ...MAIN_ROOMS,
      room(
        'CO2',
        'corridor',
        [
          { x: 20000, y: 0 },
          { x: 28000, y: 0 },
          { x: 28000, y: 800 },
          { x: 20000, y: 800 },
        ],
        [wallId('AS'), wallId('AN'), wallId('AE')],
        6.4,
        'Lối hẹp',
      ),
      room(
        'CO3',
        'corridor',
        [
          { x: 20000, y: 2000 },
          { x: 28000, y: 2000 },
          { x: 28000, y: 3200 },
          { x: 20000, y: 3200 },
        ],
        [wallId('BS'), wallId('BN'), wallId('BE')],
        9.6,
        'Lối phụ',
      ),
      room(
        'DP1',
        'corridor',
        [
          { x: 20000, y: 3200 },
          { x: 24000, y: 3200 },
          { x: 24000, y: 55000 },
          { x: 20000, y: 55000 },
        ],
        [wallId('BN'), wallId('DW'), wallId('DE'), wallId('DN')],
        207.2,
        'Hành lang cụt',
      ),
      room(
        'BA2',
        'bathroom',
        [
          { x: 26000, y: 3200 },
          { x: 27200, y: 3200 },
          { x: 27200, y: 4600 },
          { x: 26000, y: 4600 },
        ],
        [wallId('BN'), wallId('BAE'), wallId('BAN'), wallId('BAW')],
        1.68,
        'Tắm phụ',
      ),
    ],
    // 7 — the bed pushed into the south wall.
    furniture: [box('BED1', { x: 1000, y: -200 }, { x: 2600, y: 1400 })],
  });
}

/* -------------------------------------------------------------------------- */
/* The group.                                                                  */
/* -------------------------------------------------------------------------- */

describe('the function group', () => {
  it('is seven rules across three severities', () => {
    expect(FUNCTION_RULES.map((rule) => rule.code)).toEqual([
      'ROOM-NO-DOOR',
      'CORRIDOR-WIDTH',
      'ROOM-NO-WINDOW',
      'ESCAPE-DISTANCE',
      'DOOR-BLOCKS-PATH',
      'ROOM-AREA-BELOW-MINIMUM',
      'FURNITURE-CLASH',
    ]);
    expect(FUNCTION_RULES.map((rule) => rule.severity)).toEqual([
      'critical',
      'critical',
      'warning',
      'critical',
      'warning',
      'warning',
      'suggestion',
    ]);
  });

  it('keeps every threshold in the usage table, not in a rule', () => {
    expect(USAGE_REQUIREMENTS.corridor.minClearWidthMm).toBe(900);
    expect(USAGE_REQUIREMENTS.bedroom.needsWindow).toBe(true);
    expect(USAGE_REQUIREMENTS.bathroom.needsWindow).toBe(false);
    expect(USAGE_REQUIREMENTS.corridor.needsDoor).toBe(false);
    expect(USAGE_REQUIREMENTS.stairwell.isEscape).toBe(true);
    expect(USAGE_REQUIREMENTS.bathroom.minAreaM2).toBe(2.5);
  });

  it('stands the two built-in rules it replaces down as it registers', () => {
    // The book as it is *before* this group joins it. `createDefaultRuleRegistry`
    // is no use here: it registers this group itself, so the two would already be
    // down and the test would prove nothing about what standing them down does.
    const registry = createRuleRegistry(BUILT_IN_RULES);

    expect(registry.isEnabled('ROOM-HAS-DOOR')).toBe(true);
    expect(registry.isEnabled('ROOM-MIN-AREA')).toBe(true);

    registerFunctionRules(registry);
    registerFunctionRules(registry);

    for (const code of SUPERSEDED_BUILT_IN_CODES) {
      expect(registry.isEnabled(code)).toBe(false);
    }

    expect(registry.isEnabled('ROOM-NO-DOOR')).toBe(true);
    expect(registry.list()).toHaveLength(BUILT_IN_RULES.length + FUNCTION_RULES.length);
  });

  it('registers into an empty book without complaining about the missing built-ins', () => {
    const registry = createRuleRegistry();

    registerFunctionRules(registry);

    expect(registry.listEnabled()).toHaveLength(7);
  });

  it('says nothing at all about a flat that is laid out properly', () => {
    const result = runRules(normalizeSpatial(createCleanFlat()), {
      registry: createRuleRegistry(FUNCTION_RULES),
    });

    expect(result.violations).toEqual([]);
    expect(computeHealthScore(result.violations)).toBe(100);
  });

  it('finds exactly one of each defect in the broken flat', () => {
    const result = runRules(normalizeSpatial(createFaultyFlat()), {
      registry: createRuleRegistry(FUNCTION_RULES),
    });

    expect(result.violations.map((found) => found.ruleCode)).toEqual(
      FUNCTION_RULES.map((rule) => rule.code),
    );
  });

  it('scores the broken flat at 66: three critical, three warning, one suggestion', () => {
    const result = runRules(normalizeSpatial(createFaultyFlat()), {
      registry: createRuleRegistry(FUNCTION_RULES),
    });
    const explained = explainHealthScore(result.violations);

    expect(explained.counts).toEqual({ critical: 3, warning: 3, suggestion: 1 });
    expect(explained.score).toBe(66);
    expect(sortBySeverity(result.violations).map((found) => found.severity)).toEqual([
      'critical',
      'critical',
      'critical',
      'warning',
      'warning',
      'warning',
      'suggestion',
    ]);
  });

  it('gives every finding an entity code, numbers and a fix', () => {
    const result = runRules(normalizeSpatial(createFaultyFlat()), {
      registry: createRuleRegistry(FUNCTION_RULES),
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
    const plan = createFaultyFlat();
    const before = JSON.stringify(plan);

    runRules(normalizeSpatial(plan), { registry: createRuleRegistry(FUNCTION_RULES) });

    expect(JSON.stringify(plan)).toBe(before);
  });
});

/* -------------------------------------------------------------------------- */
/* 1 — ROOM-NO-DOOR.                                                           */
/* -------------------------------------------------------------------------- */

describe('rooms nobody can walk into', () => {
  it('reports the room whose door was never drawn', () => {
    const found = runCheck(checkRoomHasDoor, createFaultyFlat());

    expect(found).toHaveLength(1);
    expect(found[0]?.entityId).toBe(BATHROOM);
    expect(found[0]?.message).toContain('Vệ sinh');
  });

  it('says nothing when every room the table asks has one', () => {
    expect(runCheck(checkRoomHasDoor, createCleanFlat())).toEqual([]);
  });

  it('asks nothing of a corridor, which is what other rooms open onto', () => {
    const plan = planOf({
      walls: [wall('W1', { x: 0, y: 0 }, { x: 4000, y: 0 })],
      rooms: [
        room(
          'CO',
          'corridor',
          [
            { x: 0, y: 0 },
            { x: 4000, y: 0 },
            { x: 4000, y: 1200 },
            { x: 0, y: 1200 },
          ],
          [wallId('W1')],
          4.8,
        ),
      ],
    });

    expect(runCheck(checkRoomHasDoor, plan)).toEqual([]);
  });

  it('does not count a door at the far end of a shared wall', () => {
    // The door is on the same long wall, but nowhere near this room's stretch.
    const plan = planOf({
      walls: [wall('WLONG', { x: 0, y: 0 }, { x: 20000, y: 0 })],
      openings: [opening('DFAR', wallId('WLONG'), 18000, 700)],
      rooms: [
        room(
          'BR',
          'bedroom',
          [
            { x: 0, y: 0 },
            { x: 4000, y: 0 },
            { x: 4000, y: 3000 },
            { x: 0, y: 3000 },
          ],
          [wallId('WLONG')],
          12,
        ),
      ],
    });

    expect(runCheck(checkRoomHasDoor, plan)).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------------- */
/* 2 — CORRIDOR-WIDTH.                                                         */
/* -------------------------------------------------------------------------- */

describe('routes too narrow to walk along', () => {
  it('reports the narrow passage with both widths', () => {
    const found = runCheck(checkCorridorWidth, createFaultyFlat());

    expect(found).toHaveLength(1);
    expect(found[0]?.entityId).toBe(roomId('CO2'));
    expect(found[0]?.message).toContain('800 mm');
    expect(found[0]?.message).toContain('900 mm');
    expect(found[0]?.suggestion).toContain('100 mm');
  });

  it('says nothing about a corridor at or above the minimum', () => {
    expect(runCheck(checkCorridorWidth, createCleanFlat())).toEqual([]);
  });

  it('measures the narrowest point, not the bounding box', () => {
    // An L on its side: nine metres long, but only 700 mm across everywhere.
    const plan = planOf({
      rooms: [
        room(
          'CO',
          'corridor',
          [
            { x: 0, y: 0 },
            { x: 9000, y: 0 },
            { x: 9000, y: 700 },
            { x: 700, y: 700 },
            { x: 700, y: 6000 },
            { x: 0, y: 6000 },
          ],
          [],
          10.5,
        ),
      ],
    });

    const found = runCheck(checkCorridorWidth, plan);

    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain('700 mm');
  });

  it('measures nothing for a use the table gives no minimum width', () => {
    const plan = planOf({
      rooms: [
        room(
          'ST',
          'utility',
          [
            { x: 0, y: 0 },
            { x: 4000, y: 0 },
            { x: 4000, y: 600 },
            { x: 0, y: 600 },
          ],
          [],
          2.4,
        ),
      ],
    });

    expect(runCheck(checkCorridorWidth, plan)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* 3 — ROOM-NO-WINDOW.                                                         */
/* -------------------------------------------------------------------------- */

describe('rooms people occupy with no daylight', () => {
  it('reports the bedroom whose window was removed', () => {
    const found = runCheck(checkHabitableWindow, createFaultyFlat());

    expect(found).toHaveLength(1);
    expect(found[0]?.entityId).toBe(BEDROOM_TWO);
    expect(found[0]?.message).toContain('không có cửa sổ');
  });

  it('says nothing when every habitable room has one', () => {
    expect(runCheck(checkHabitableWindow, createCleanFlat())).toEqual([]);
    expect(runCheck(checkHabitableWindow, createCleanFlat()).length).toBe(0);
  });

  it('asks nothing of a bathroom, which the table does not call habitable', () => {
    const plan = planOf({
      walls: [wall('W1', { x: 0, y: 0 }, { x: 3000, y: 0 })],
      openings: [opening('D1', wallId('W1'), 1000, 700)],
      rooms: [
        room(
          'BA',
          'bathroom',
          [
            { x: 0, y: 0 },
            { x: 3000, y: 0 },
            { x: 3000, y: 2000 },
            { x: 0, y: 2000 },
          ],
          [wallId('W1')],
          6,
        ),
      ],
    });

    expect(runCheck(checkHabitableWindow, plan)).toEqual([]);
  });

  it('counts a window on any of the room’s own walls', () => {
    const clean = createCleanFlat();

    expect(
      runCheck(checkHabitableWindow, clean).some((item) => item.entityId === BEDROOM_ONE),
    ).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* 4 — ESCAPE-DISTANCE.                                                        */
/* -------------------------------------------------------------------------- */

describe('the way out', () => {
  it('reports the dead-end corridor and how far it is', () => {
    const found = runCheck(checkEscapeDistance, createFaultyFlat());

    expect(found).toHaveLength(1);
    expect(found[0]?.entityId).toBe(roomId('DP1'));
    expect(found[0]?.message).toContain('30,0 m');
    expect(found[0]?.message).toMatch(/3[12],\d m/);
  });

  it('says nothing when every room is within the distance', () => {
    expect(runCheck(checkEscapeDistance, createCleanFlat())).toEqual([]);
  });

  it('measures through the doors, not through the walls', () => {
    // The upper room's centre is 12,6 m from the front door as the crow flies,
    // but the only door between them is at the far end, so the walk is 34,4 m.
    const plan = planOf({
      walls: [
        envelope('EWALL', { x: 0, y: 0 }, { x: 0, y: 4000 }),
        wall('SPLIT', { x: 0, y: 4000 }, { x: 24000, y: 4000 }),
      ],
      openings: [
        opening('DOUT', wallId('EWALL'), 1650, 700),
        opening('DMID', wallId('SPLIT'), 22650, 700),
      ],
      rooms: [
        room(
          'LOWER',
          'livingRoom',
          [
            { x: 0, y: 0 },
            { x: 24000, y: 0 },
            { x: 24000, y: 4000 },
            { x: 0, y: 4000 },
          ],
          [wallId('EWALL'), wallId('SPLIT')],
          96,
        ),
        room(
          'UPPER',
          'livingRoom',
          [
            { x: 0, y: 4000 },
            { x: 24000, y: 4000 },
            { x: 24000, y: 8000 },
            { x: 0, y: 8000 },
          ],
          [wallId('SPLIT')],
          96,
        ),
      ],
    });

    const found = runCheck(checkEscapeDistance, plan);

    expect(found).toHaveLength(1);
    expect(found[0]?.entityId).toBe(roomId('UPPER'));
    expect(found[0]?.message).toContain('34,4 m');
    expect(found[0]?.message).toContain('30,0 m');
  });

  it('counts reaching a stairwell as having got out', () => {
    const plan = planOf({
      walls: [wall('WSHARED', { x: 0, y: 0 }, { x: 8000, y: 0 })],
      openings: [opening('DSTAIR', wallId('WSHARED'), 3650, 700)],
      rooms: [
        room(
          'ST',
          'stairwell',
          [
            { x: 0, y: -4000 },
            { x: 8000, y: -4000 },
            { x: 8000, y: 0 },
            { x: 0, y: 0 },
          ],
          [wallId('WSHARED')],
          32,
        ),
        room(
          'LV',
          'livingRoom',
          [
            { x: 0, y: 0 },
            { x: 8000, y: 0 },
            { x: 8000, y: 6000 },
            { x: 0, y: 6000 },
          ],
          [wallId('WSHARED')],
          48,
        ),
      ],
    });

    expect(runCheck(checkEscapeDistance, plan)).toEqual([]);
  });

  it('reports a room whose doors lead nowhere out', () => {
    const plan = planOf({
      walls: [wall('WINNER', { x: 0, y: 0 }, { x: 6000, y: 0 })],
      openings: [opening('DINNER', wallId('WINNER'), 2650, 700)],
      rooms: [
        room(
          'LV',
          'livingRoom',
          [
            { x: 0, y: 0 },
            { x: 6000, y: 0 },
            { x: 6000, y: 4000 },
            { x: 0, y: 4000 },
          ],
          [wallId('WINNER')],
          24,
        ),
      ],
    });

    const found = runCheck(checkEscapeDistance, plan);

    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain('không có đường nào');
  });

  it('leaves a room with no door at all to ROOM-NO-DOOR', () => {
    const plan = planOf({
      walls: [wall('WSHUT', { x: 0, y: 0 }, { x: 6000, y: 0 })],
      rooms: [
        room(
          'LV',
          'livingRoom',
          [
            { x: 0, y: 0 },
            { x: 6000, y: 0 },
            { x: 6000, y: 4000 },
            { x: 0, y: 4000 },
          ],
          [wallId('WSHUT')],
          24,
        ),
      ],
    });

    expect(runCheck(checkEscapeDistance, plan)).toEqual([]);
    expect(runCheck(checkRoomHasDoor, plan)).toHaveLength(1);
  });

  it('keeps the threshold at thirty metres', () => {
    expect(MAX_ESCAPE_DISTANCE_MM).toBe(30000);
  });
});

/* -------------------------------------------------------------------------- */
/* 5 — DOOR-BLOCKS-PATH.                                                       */
/* -------------------------------------------------------------------------- */

describe('doors that block the way past', () => {
  it('reports the leaf, the passage and what is left', () => {
    const found = runCheck(checkDoorBlocksPath, createFaultyFlat());

    expect(found).toHaveLength(1);
    expect(found[0]?.entityId).toBe(openingId('DA2'));
    expect(found[0]?.message).toContain('900 mm');
    expect(found[0]?.message).toContain('300 mm');
    expect(found[0]?.message).toContain('750 mm');
  });

  it('says nothing when enough corridor is left to pass', () => {
    expect(runCheck(checkDoorBlocksPath, createCleanFlat())).toEqual([]);
  });

  it('says nothing about a door that slides', () => {
    const flat = createFaultyFlat();
    const sliding: SpatialGraph = {
      ...flat,
      openings: flat.openings.map((item) =>
        item.id === openingId('DA2') ? { ...item, swing: 'sliding' as const } : item,
      ),
    };

    expect(runCheck(checkDoorBlocksPath, sliding)).toEqual([]);
  });

  it('measures a double door by one leaf', () => {
    const flat = createFaultyFlat();
    const doubled: SpatialGraph = {
      ...flat,
      openings: flat.openings.map((item) =>
        item.id === openingId('DA2') ? { ...item, swing: 'double' as const } : item,
      ),
    };

    // 1 200 mm of corridor less a 450 mm leaf leaves 750 mm, exactly enough.
    expect(runCheck(checkDoorBlocksPath, doubled)).toEqual([]);
  });

  it('leaves a corridor already too narrow to CORRIDOR-WIDTH', () => {
    const plan = planOf({
      walls: [wall('WNARROW', { x: 0, y: 0 }, { x: 6000, y: 0 })],
      openings: [opening('DNARROW', wallId('WNARROW'), 2650, 700)],
      rooms: [
        room(
          'CO',
          'corridor',
          [
            { x: 0, y: 0 },
            { x: 6000, y: 0 },
            { x: 6000, y: 800 },
            { x: 0, y: 800 },
          ],
          [wallId('WNARROW')],
          4.8,
        ),
      ],
    });

    expect(runCheck(checkDoorBlocksPath, plan)).toEqual([]);
    expect(runCheck(checkCorridorWidth, plan)).toHaveLength(1);
  });

  it('keeps the clear passage at 750 mm', () => {
    expect(MIN_CLEAR_PASSAGE_MM).toBe(750);
  });
});

/* -------------------------------------------------------------------------- */
/* 6 — ROOM-AREA-BELOW-MINIMUM.                                                */
/* -------------------------------------------------------------------------- */

describe('rooms too small for what they are called', () => {
  it('reports the shortfall as well as the area', () => {
    const found = runCheck(checkRoomArea, createFaultyFlat());

    expect(found).toHaveLength(1);
    expect(found[0]?.entityId).toBe(roomId('BA2'));
    expect(found[0]?.message).toContain('1,68 m²');
    expect(found[0]?.message).toContain('0,82 m²');
    expect(found[0]?.message).toContain('2,50 m²');
  });

  it('says nothing when every room is big enough', () => {
    expect(runCheck(checkRoomArea, createCleanFlat())).toEqual([]);
  });

  it('measures nothing for a use the table gives no minimum', () => {
    const plan = planOf({
      rooms: [
        room(
          'ST',
          'utility',
          [
            { x: 0, y: 0 },
            { x: 1000, y: 0 },
            { x: 1000, y: 1000 },
            { x: 0, y: 1000 },
          ],
          [],
          1,
        ),
      ],
    });

    expect(runCheck(checkRoomArea, plan)).toEqual([]);
  });

  it('reads its minimum from the table, whatever the use', () => {
    const plan = planOf({
      rooms: [
        room('BR', 'bedroom', [], [], USAGE_REQUIREMENTS.bedroom.minAreaM2 - 0.01),
        room('LV', 'livingRoom', [], [], USAGE_REQUIREMENTS.livingRoom.minAreaM2),
      ],
    });

    const found = runCheck(checkRoomArea, plan);

    expect(found.map((item) => item.entityId)).toEqual([roomId('BR')]);
  });
});

/* -------------------------------------------------------------------------- */
/* 7 — FURNITURE-CLASH.                                                        */
/* -------------------------------------------------------------------------- */

describe('furniture standing where something else is', () => {
  it('reports the bed pushed into the wall, with how deep it reaches', () => {
    const found = runCheck(checkFurnitureClash, createFaultyFlat());

    expect(found).toHaveLength(1);
    expect(found[0]?.entityId).toBe(BED);
    expect(found[0]?.relatedIds).toContain(SOUTH_WALL);
    expect(found[0]?.message).toContain('110 mm');
  });

  it('says nothing about furniture standing clear', () => {
    expect(runCheck(checkFurnitureClash, createCleanFlat())).toEqual([]);
  });

  it('reports two pieces inside each other, once, against the first', () => {
    const plan = planOf({
      furniture: [
        box('BEDA', { x: 0, y: 0 }, { x: 2000, y: 1000 }),
        box('BEDB', { x: 1500, y: 200 }, { x: 3500, y: 1200 }),
      ],
    });

    const found = runCheck(checkFurnitureClash, plan);

    expect(found).toHaveLength(1);
    expect(found[0]?.entityId).toBe(furnitureId('BEDA'));
    expect(found[0]?.relatedIds).toEqual([furnitureId('BEDA'), furnitureId('BEDB')]);
    expect(found[0]?.message).toContain('500 mm');
  });

  it('says nothing about two pieces that only touch along an edge', () => {
    const plan = planOf({
      furniture: [
        box('BEDA', { x: 0, y: 0 }, { x: 2000, y: 1000 }),
        box('BEDB', { x: 2000, y: 0 }, { x: 4000, y: 1000 }),
      ],
    });

    expect(runCheck(checkFurnitureClash, plan)).toEqual([]);
  });

  it('names the walls and the other furniture in one finding', () => {
    const plan = planOf({
      walls: [wall('WBACK', { x: 0, y: 0 }, { x: 6000, y: 0 })],
      furniture: [
        box('BEDA', { x: 0, y: -100 }, { x: 2000, y: 1000 }),
        box('BEDB', { x: 1000, y: 200 }, { x: 3000, y: 1200 }),
      ],
    });

    const found = runCheck(checkFurnitureClash, plan);

    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain(wallId('WBACK'));
    expect(found[0]?.message).toContain(furnitureId('BEDB'));
  });
});

/* -------------------------------------------------------------------------- */
/* Nothing counted twice.                                                      */
/* -------------------------------------------------------------------------- */

describe('the seven staying out of each other’s way', () => {
  const CHECKS: readonly (readonly [string, FunctionCheck])[] = [
    ['ROOM-NO-DOOR', checkRoomHasDoor],
    ['CORRIDOR-WIDTH', checkCorridorWidth],
    ['ROOM-NO-WINDOW', checkHabitableWindow],
    ['ESCAPE-DISTANCE', checkEscapeDistance],
    ['DOOR-BLOCKS-PATH', checkDoorBlocksPath],
    ['ROOM-AREA-BELOW-MINIMUM', checkRoomArea],
    ['FURNITURE-CLASH', checkFurnitureClash],
  ];

  it('has each defect claimed by exactly one rule', () => {
    const flat = createFaultyFlat();
    const counts = CHECKS.map(([code, check]) => [code, runCheck(check, flat).length]);

    expect(Object.fromEntries(counts)).toEqual({
      'ROOM-NO-DOOR': 1,
      'CORRIDOR-WIDTH': 1,
      'ROOM-NO-WINDOW': 1,
      'ESCAPE-DISTANCE': 1,
      'DOOR-BLOCKS-PATH': 1,
      'ROOM-AREA-BELOW-MINIMUM': 1,
      'FURNITURE-CLASH': 1,
    });
  });

  it('never names the same entity twice across two rules', () => {
    const flat = createFaultyFlat();
    const subjects = CHECKS.flatMap(([, check]) => runCheck(check, flat).map((item) => item.entityId));

    expect(new Set(subjects).size).toBe(subjects.length);
  });

  it('gives the same violations in the same order twice running', () => {
    const registry = createRuleRegistry(FUNCTION_RULES);
    const first = runRules(normalizeSpatial(createFaultyFlat()), { registry });
    const second = runRules(normalizeSpatial(createFaultyFlat()), { registry });

    expect(second.violations).toEqual(first.violations);
  });
});
