import { describe, expect, it } from 'vitest';

import { normalizeSpatial } from '../../spatial/normalize';
import type {
  Furniture,
  FurnitureId,
  FurnitureKind,
  Level,
  LevelId,
  Opening,
  OpeningId,
  Point,
  Room,
  RoomId,
  RoomUsage,
  SpatialGraph,
  Wall,
  WallId,
  WallKind,
} from '../../spatial/types';
import { createRuleRegistry, ROOM_USAGE_LABELS, type RuleContext } from '../registry';
import { runRules } from '../runner';
import {
  checkFixtureOffWall,
  checkRoomFurnitureMismatch,
  checkWindowOnInnerWall,
  FITOUT_RULES,
  MISPLACED_FURNITURE,
  registerFitoutRules,
  WALL_HUGGING_FURNITURE,
  WALL_HUGGING_TOLERANCE_MM,
  type FitoutCheck,
  type FitoutFinding,
} from '../fitout';

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

function wall(code: string, start: Point, end: Point, kind: WallKind = 'partition'): Wall {
  return {
    ...DETECTED,
    id: wallId(code),
    levelId: GROUND,
    centreline: { start, end },
    thicknessMm: kind === 'envelope' ? ENVELOPE_THICKNESS_MM : PARTITION_THICKNESS_MM,
    heightMm: LEVEL_HEIGHT_MM,
    kind,
    openingIds: [],
  };
}

function window(code: string, host: WallId): Opening {
  return {
    ...DETECTED,
    id: openingId(code),
    wallId: host,
    kind: 'window',
    offsetMm: 1000,
    widthMm: 1200,
    heightMm: 1400,
    sillHeightMm: 900,
    swing: 'fixed',
  };
}

function door(code: string, host: WallId): Opening {
  return {
    ...DETECTED,
    id: openingId(code),
    wallId: host,
    kind: 'door',
    offsetMm: 1000,
    widthMm: 900,
    heightMm: 2200,
    sillHeightMm: 0,
    swing: 'left',
  };
}

function room(code: string, usage: RoomUsage, outline: readonly Point[]): Room {
  return {
    ...REVIEWED,
    id: roomId(code),
    levelId: GROUND,
    name: code,
    usage,
    outline,
    areaM2: 12,
    wallIds: [],
  };
}

/** A rectangular room, corners counter-clockwise. */
function rectangleRoom(code: string, usage: RoomUsage, min: Point, max: Point): Room {
  return room(code, usage, [
    min,
    { x: max.x, y: min.y },
    max,
    { x: min.x, y: max.y },
  ]);
}

interface FurnitureOptions {
  readonly kind?: FurnitureKind;
  readonly roomId?: RoomId;
  readonly sizeMm?: number;
}

function furniture(code: string, centre: Point, options: FurnitureOptions = {}): Furniture {
  const half = (options.sizeMm ?? 600) / 2;
  const base = {
    ...DETECTED,
    id: furnitureId(code),
    levelId: GROUND,
    kind: options.kind ?? 'bed',
    centre,
    boundingBox: {
      min: { x: centre.x - half, y: centre.y - half },
      max: { x: centre.x + half, y: centre.y + half },
    },
    rotationDeg: 0,
  };

  return options.roomId === undefined ? base : { ...base, roomId: options.roomId };
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
    building: { ...REVIEWED, name: 'Nhà mẫu kiểm nội thất', datumElevationMm: 0 },
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

function runCheck(check: FitoutCheck, graph: SpatialGraph): readonly FitoutFinding[] {
  const context: RuleContext = { graph: normalizeSpatial(graph), levelId: GROUND };
  return check(context);
}

/* -------------------------------------------------------------------------- */
/* A flat with nothing wrong with it.                                          */
/* -------------------------------------------------------------------------- */

/** A 6 × 4 m envelope with one partition down the middle at x = 3000. */
const SOUTH = wall('ES', { x: 0, y: 0 }, { x: 6000, y: 0 }, 'envelope');
const EAST = wall('EE', { x: 6000, y: 0 }, { x: 6000, y: 4000 }, 'envelope');
const NORTH = wall('EN', { x: 6000, y: 4000 }, { x: 0, y: 4000 }, 'envelope');
const WEST = wall('EW', { x: 0, y: 4000 }, { x: 0, y: 0 }, 'envelope');
const SPINE = wall('SP', { x: 3000, y: 0 }, { x: 3000, y: 4000 });

const SHELL: readonly Wall[] = [SOUTH, EAST, NORTH, WEST, SPINE];

const BEDROOM = rectangleRoom('BR1', 'bedroom', { x: 0, y: 0 }, { x: 3000, y: 4000 });
const BATHROOM = rectangleRoom('BA1', 'bathroom', { x: 3000, y: 0 }, { x: 6000, y: 4000 });

/** A basin against the east envelope wall, where a basin belongs. */
const BASIN_ON_WALL = furniture(
  'BS1',
  { x: 5600, y: 2000 },
  { kind: 'sanitaryFixture', sizeMm: 600 },
);

const TIDY_FLAT = planOf({
  walls: SHELL,
  openings: [window('W1', EAST.id), door('D1', SPINE.id)],
  rooms: [BEDROOM, BATHROOM],
  furniture: [furniture('BD1', { x: 1500, y: 2000 }, { kind: 'bed' }), BASIN_ON_WALL],
});

describe('the fit-out rules on a flat with nothing wrong with it', () => {
  it('finds nothing at all', () => {
    for (const check of [checkRoomFurnitureMismatch, checkFixtureOffWall, checkWindowOnInnerWall]) {
      expect(runCheck(check, TIDY_FLAT)).toEqual([]);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 1 — ROOM-FURNITURE-MISMATCH.                                                */
/* -------------------------------------------------------------------------- */

describe('checkRoomFurnitureMismatch', () => {
  it('reports a bed standing in a bathroom', () => {
    const findings = runCheck(
      checkRoomFurnitureMismatch,
      planOf({
        walls: SHELL,
        rooms: [BEDROOM, BATHROOM],
        furniture: [furniture('BD9', { x: 4500, y: 2000 }, { kind: 'bed' })],
      }),
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]?.entityId).toBe(furnitureId('BD9'));
    expect(findings[0]?.relatedIds).toEqual([furnitureId('BD9'), roomId('BA1')]);
    expect(findings[0]?.message).toContain('Giường');
    expect(findings[0]?.message).toContain(ROOM_USAGE_LABELS.bathroom);
  });

  it('offers changing either half, because either half may be the wrong one', () => {
    const findings = runCheck(
      checkRoomFurnitureMismatch,
      planOf({
        walls: SHELL,
        rooms: [BATHROOM],
        furniture: [furniture('BD9', { x: 4500, y: 2000 }, { kind: 'bed' })],
      }),
    );

    expect(findings[0]?.suggestion).toContain(roomId('BA1'));
    expect(findings[0]?.suggestion).toContain(furnitureId('BD9'));
  });

  it('believes the stored room before it believes the geometry', () => {
    // The piece sits inside the bathroom outline but is recorded as the bedroom's;
    // a bed is fine in a bedroom, so nothing is reported.
    const findings = runCheck(
      checkRoomFurnitureMismatch,
      planOf({
        walls: SHELL,
        rooms: [BEDROOM, BATHROOM],
        furniture: [
          furniture('BD9', { x: 4500, y: 2000 }, { kind: 'bed', roomId: BEDROOM.id }),
        ],
      }),
    );

    expect(findings).toEqual([]);
  });

  it('falls back to the outline when nothing recorded which room it is in', () => {
    const findings = runCheck(
      checkRoomFurnitureMismatch,
      planOf({
        walls: SHELL,
        rooms: [BEDROOM, BATHROOM],
        furniture: [furniture('WC9', { x: 1500, y: 2000 }, { kind: 'sanitaryFixture' })],
      }),
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]?.relatedIds).toEqual([furnitureId('WC9'), roomId('BR1')]);
  });

  it('says nothing about a piece standing in no room at all', () => {
    const findings = runCheck(
      checkRoomFurnitureMismatch,
      planOf({
        walls: SHELL,
        rooms: [BEDROOM],
        furniture: [furniture('BD9', { x: 20000, y: 20000 }, { kind: 'bed' })],
      }),
    );

    expect(findings).toEqual([]);
  });

  it('refuses nothing in a room the model could not classify', () => {
    const unknown = rectangleRoom('UN1', 'other', { x: 0, y: 0 }, { x: 3000, y: 4000 });

    expect(MISPLACED_FURNITURE.other).toEqual([]);
    expect(
      runCheck(
        checkRoomFurnitureMismatch,
        planOf({
          rooms: [unknown],
          furniture: [furniture('BD9', { x: 1500, y: 2000 }, { kind: 'bed' })],
        }),
      ),
    ).toEqual([]);
  });

  it('has a row for every use, so a new use cannot slip through unchecked', () => {
    const uses: readonly RoomUsage[] = [
      'livingRoom',
      'bedroom',
      'kitchen',
      'bathroom',
      'corridor',
      'stairwell',
      'utility',
      'other',
    ];

    for (const usage of uses) {
      expect(MISPLACED_FURNITURE[usage]).toBeDefined();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 2 — FIXTURE-OFF-WALL.                                                       */
/* -------------------------------------------------------------------------- */

describe('checkFixtureOffWall', () => {
  it('reports a basin stranded in the middle of the floor', () => {
    const findings = runCheck(
      checkFixtureOffWall,
      planOf({
        walls: SHELL,
        rooms: [BATHROOM],
        furniture: [furniture('BS9', { x: 4500, y: 2000 }, { kind: 'sanitaryFixture' })],
      }),
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]?.entityId).toBe(furnitureId('BS9'));
    expect(findings[0]?.message).toContain('Thiết bị vệ sinh');
  });

  it('accepts a fitting inside the tolerance and refuses one just outside it', () => {
    // The east envelope face sits at x = 6000 − 110 = 5890. A 600 mm box centred
    // at 5590 has its edge on the face; every 10 mm west opens a 10 mm gap.
    const onTheFace = 5590;

    const gapOf = (centreX: number): readonly FitoutFinding[] =>
      runCheck(
        checkFixtureOffWall,
        planOf({
          walls: SHELL,
          furniture: [furniture('BS9', { x: centreX, y: 2000 }, { kind: 'sanitaryFixture' })],
        }),
      );

    expect(gapOf(onTheFace)).toEqual([]);
    expect(gapOf(onTheFace - WALL_HUGGING_TOLERANCE_MM)).toEqual([]);
    expect(gapOf(onTheFace - WALL_HUGGING_TOLERANCE_MM - 10)).toHaveLength(1);
  });

  it('measures to the wall face, not to the centreline', () => {
    // Centred 200 mm clear of the 220 mm envelope's centreline: inside the wall
    // body, so the gap to the face is nil and nothing is reported.
    expect(
      runCheck(
        checkFixtureOffWall,
        planOf({
          walls: SHELL,
          furniture: [
            furniture('BS9', { x: 5900, y: 2000 }, { kind: 'sanitaryFixture', sizeMm: 200 }),
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('asks it only of the fittings that are plumbed to a wall', () => {
    expect(WALL_HUGGING_FURNITURE).toEqual(['sanitaryFixture', 'kitchenCabinet']);

    const middleOfTheRoom = { x: 4500, y: 2000 };
    expect(
      runCheck(
        checkFixtureOffWall,
        planOf({
          walls: SHELL,
          furniture: [
            furniture('BD9', middleOfTheRoom, { kind: 'bed' }),
            furniture('TB9', middleOfTheRoom, { kind: 'table' }),
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('names the nearest wall and the gap, so a nudge reads differently from a mistake', () => {
    const findings = runCheck(
      checkFixtureOffWall,
      planOf({
        walls: SHELL,
        furniture: [furniture('KC9', { x: 4500, y: 2000 }, { kind: 'kitchenCabinet' })],
      }),
    );

    expect(findings[0]?.relatedIds[1]).toMatch(/^W-/);
    expect(findings[0]?.message).toMatch(/\d/);
  });

  it('says nothing when the level has no wall to measure to', () => {
    expect(
      runCheck(
        checkFixtureOffWall,
        planOf({ furniture: [furniture('BS9', { x: 0, y: 0 }, { kind: 'sanitaryFixture' })] }),
      ),
    ).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* 3 — WINDOW-ON-INNER-WALL.                                                   */
/* -------------------------------------------------------------------------- */

describe('checkWindowOnInnerWall', () => {
  it('reports a window cut into a partition', () => {
    const findings = runCheck(
      checkWindowOnInnerWall,
      planOf({ walls: SHELL, openings: [window('W9', SPINE.id)] }),
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]?.entityId).toBe(openingId('W9'));
    expect(findings[0]?.relatedIds).toEqual([openingId('W9'), SPINE.id]);
  });

  it('offers the misclassified wall first, because that is the dangerous reading', () => {
    const findings = runCheck(
      checkWindowOnInnerWall,
      planOf({ walls: SHELL, openings: [window('W9', SPINE.id)] }),
    );

    expect(findings[0]?.suggestion.indexOf(SPINE.id)).toBeLessThan(
      findings[0]?.suggestion.indexOf('cửa đi') ?? 0,
    );
  });

  it('accepts a window in the envelope and ignores doors anywhere', () => {
    expect(
      runCheck(
        checkWindowOnInnerWall,
        planOf({
          walls: SHELL,
          openings: [window('W1', NORTH.id), door('D9', SPINE.id)],
        }),
      ),
    ).toEqual([]);
  });

  it('reports a window on a load-bearing wall that is not the envelope', () => {
    const structural = wall('LB', { x: 1000, y: 0 }, { x: 1000, y: 4000 }, 'loadBearing');

    expect(
      runCheck(
        checkWindowOnInnerWall,
        planOf({ walls: [...SHELL, structural], openings: [window('W9', structural.id)] }),
      ),
    ).toHaveLength(1);
  });

  it('leaves a dangling wall reference to the integrity check', () => {
    expect(
      runCheck(
        checkWindowOnInnerWall,
        planOf({ walls: SHELL, openings: [window('W9', wallId('GONE'))] }),
      ),
    ).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* The group in a rule book.                                                   */
/* -------------------------------------------------------------------------- */

describe('registerFitoutRules', () => {
  it('registers the three, and registering twice changes nothing', () => {
    const registry = createRuleRegistry();

    registerFitoutRules(registry);
    registerFitoutRules(registry);

    expect(registry.list().map((rule) => rule.code)).toEqual([
      'ROOM-FURNITURE-MISMATCH',
      'FIXTURE-OFF-WALL',
      'WINDOW-ON-INNER-WALL',
    ]);
  });

  it('supersedes nothing: it covers ground no other rule covers', () => {
    const registry = createRuleRegistry();
    registerFitoutRules(registry);

    for (const rule of registry.list()) {
      expect(registry.isEnabled(rule.code)).toBe(true);
    }
  });

  it('runs through the runner and stamps every finding with its rule', () => {
    const registry = createRuleRegistry();
    registerFitoutRules(registry);

    const { violations } = runRules(
      normalizeSpatial(
        planOf({
          walls: SHELL,
          openings: [window('W9', SPINE.id)],
          rooms: [BATHROOM],
          furniture: [furniture('BD9', { x: 4500, y: 2000 }, { kind: 'bed' })],
        }),
      ),
      { registry },
    );

    const codes = violations.map((violation) => violation.ruleCode).sort();
    expect(codes).toEqual(['ROOM-FURNITURE-MISMATCH', 'WINDOW-ON-INNER-WALL']);
    for (const violation of violations) {
      expect(violation.levelId).toBe(GROUND);
      expect(violation.message.length).toBeGreaterThan(0);
      expect(violation.suggestion.length).toBeGreaterThan(0);
    }
  });

  it('declares what each rule reads, so an edit can re-run only what went stale', () => {
    for (const rule of FITOUT_RULES) {
      expect(rule.dependsOn.length).toBeGreaterThan(0);
      expect(rule.code).toBe(rule.code.toUpperCase());
      expect(rule.name).toBe(rule.name.toLowerCase());
    }
  });
});
