/**
 * The QC scenarios every test reads from one place.
 *
 * Sample data scattered across test files drifts: one file's "violated
 * building" has six findings, another's has nine, and a screenshot taken from
 * either shows figures the rest of the product contradicts. So the scenarios
 * live here, once, all of them derived from the standard sample building —
 * 4 levels, 48 walls, 14 rooms, 248,60 m² — whose figures invariant A14 fixes
 * for the whole product.
 *
 * Three scenarios and one generator:
 *
 * - {@link createCleanBuildingScenario} — the sample building exactly as the
 *   fixture ships it, with an empty findings list. Health score 100.
 * - {@link createViolatedBuildingScenario} — the same building with its first
 *   seven walls thinned to 40 mm and the seven matching critical findings.
 *   7 × 8 penalty points leave a health score of exactly 44. The graph is
 *   wrong at the *rule* level on purpose, but stays structurally sound: it
 *   passes `checkIntegrity` with zero issues, because a thin wall is a QC
 *   finding, not a broken reference.
 * - {@link createEmptyProjectScenario} — a project the moment after creation:
 *   a building record and nothing else, not even a level. This is the shape
 *   every list screen's empty state renders from.
 * - {@link createLargeBuilding} — 20 levels, 1200 walls, 400 furniture items,
 *   for performance tests. Structurally clean, so a slow `checkIntegrity` run
 *   measured against it is slow on size alone, never on repair work.
 *
 * Everything here is **fully deterministic**. There is no randomness at all,
 * seeded or otherwise: every varying value is index arithmetic, so two builds
 * of any scenario are deep-equal and a perf regression reproduces exactly.
 *
 * The `create*` functions return fresh mutable copies for tests that break
 * things; the frozen `*_SCENARIO` constants are for tests that only read.
 */

import type { Violation } from '@/domain/rules/registry';
import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import type {
  Furniture,
  FurnitureId,
  Level,
  LevelId,
  SpatialGraph,
  Wall,
  WallId,
} from '@/domain/spatial/types';

/* -------------------------------------------------------------------------- */
/* The shape every scenario shares.                                            */
/* -------------------------------------------------------------------------- */

/** A model plus the findings of its last rule run — what a QC screen consumes. */
export interface QcScenario {
  readonly graph: SpatialGraph;
  readonly violations: readonly Violation[];
}

/* -------------------------------------------------------------------------- */
/* Scenario 1 — the clean building.                                            */
/* -------------------------------------------------------------------------- */

/** The standard sample building, nothing wrong with it. Health score 100. */
export function createCleanBuildingScenario(): QcScenario {
  return { graph: createSampleBuilding(), violations: [] };
}

/* -------------------------------------------------------------------------- */
/* Scenario 2 — the building with seven critical findings.                     */
/* -------------------------------------------------------------------------- */

/** Exactly seven, because 100 − 7 × 8 = 44 — a score every report test can pin. */
export const VIOLATED_CRITICAL_COUNT = 7;

/** What the seven walls are thinned to. Far below any buildable section. */
export const THIN_WALL_THICKNESS_MM = 40;

/** The minimum the finding text cites, matching the WALL-THICKNESS rule's wording. */
const MIN_WALL_THICKNESS_MM = 90;

/**
 * The sample building with its first seven walls thinned to 40 mm, and the
 * seven critical findings a rule run would raise about them.
 *
 * The graph and the findings tell one story: every violation names a wall
 * that really is thin in the graph it comes with, so a screen that zooms to
 * the entity finds what the finding describes. The damage is rule-level only
 * — every reference still resolves, so `checkIntegrity` stays clean and the
 * key sample figures (4 levels, 48 walls, 14 rooms, 248,60 m²) are untouched.
 */
export function createViolatedBuildingScenario(): QcScenario {
  const graph = createSampleBuilding();
  const violations: Violation[] = [];

  for (let index = 0; index < VIOLATED_CRITICAL_COUNT; index += 1) {
    const wall = graph.walls[index];

    if (wall === undefined) {
      throw new Error('The sample building has fewer walls than the scenario thins.');
    }

    wall.thicknessMm = THIN_WALL_THICKNESS_MM;
    violations.push({
      ruleCode: 'WALL-THICKNESS',
      severity: 'critical',
      levelId: wall.levelId,
      entityId: wall.id,
      message: `tường ${wall.id} dày ${String(THIN_WALL_THICKNESS_MM)} mm, mỏng hơn mức tối thiểu ${String(MIN_WALL_THICKNESS_MM)} mm`,
      suggestion: `tăng bề dày tường lên ít nhất ${String(MIN_WALL_THICKNESS_MM)} mm`,
    });
  }

  return { graph, violations };
}

/* -------------------------------------------------------------------------- */
/* Scenario 3 — the project with no levels yet.                                */
/* -------------------------------------------------------------------------- */

/**
 * A project the moment after creation: a named building and eight empty
 * lists. Not reviewed — nobody has approved a model that does not exist yet.
 */
export function createEmptyProjectScenario(): QcScenario {
  const graph: SpatialGraph = {
    building: {
      confidence: 1,
      source: 'human',
      reviewed: false,
      name: 'Dự án mới',
      datumElevationMm: 0,
    },
    levels: [],
    walls: [],
    openings: [],
    furniture: [],
    rooms: [],
    axes: [],
    dimensions: [],
    notes: [],
  };

  return { graph, violations: [] };
}

/* -------------------------------------------------------------------------- */
/* The large building, for performance tests.                                  */
/* -------------------------------------------------------------------------- */

export const LARGE_BUILDING_LEVEL_COUNT = 20;
export const LARGE_BUILDING_WALL_COUNT = 1200;
export const LARGE_BUILDING_FURNITURE_COUNT = 400;

const LARGE_LEVEL_HEIGHT_MM = 3600;
const LARGE_FURNITURE_SIZE_MM = 600;

/** Wall lengths cycle through 800–4199 mm — varied, never zero, never random. */
const largeWallLengthMm = (index: number): number => 800 + ((index * 37) % 3400);

const pad = (value: number): string => String(value).padStart(6, '0');

const largeLevelId = (index: number): LevelId => `L-PERF${pad(index)}`;
const largeWallId = (index: number): WallId => `W-PERF${pad(index)}`;
const largeFurnitureId = (index: number): FurnitureId => `F-PERF${pad(index)}`;

/** The level an entity at `index` lands on, spreading entities evenly. */
const largeLevelOf = (index: number): LevelId => largeLevelId(index % LARGE_BUILDING_LEVEL_COUNT);

const DETECTED = { confidence: 0.82, source: 'ai', reviewed: false } as const;

/**
 * A structurally clean 20-level building with 1200 walls and 400 furniture
 * items — big enough to make indexing and integrity checking earn their keep,
 * small enough to build in milliseconds.
 *
 * Every value is index arithmetic: elevations rise strictly (rule 6), every
 * centreline has length (rule 4), every entity names a level that exists
 * (rules 2 and 3), and no furniture claims a room, because the graph has
 * none. Two calls return deep-equal graphs.
 */
export function createLargeBuilding(): SpatialGraph {
  const levels: Level[] = Array.from({ length: LARGE_BUILDING_LEVEL_COUNT }, (_unused, index) => ({
    ...DETECTED,
    reviewed: true,
    source: 'human',
    id: largeLevelId(index),
    name: `Level ${String(index)}`,
    order: index,
    elevationMm: index * LARGE_LEVEL_HEIGHT_MM,
    heightMm: LARGE_LEVEL_HEIGHT_MM,
  }));

  const walls: Wall[] = Array.from({ length: LARGE_BUILDING_WALL_COUNT }, (_unused, index) => {
    const alongMm = (index % 60) * 5000;
    const acrossMm = Math.floor(index / 60) * 4000;

    return {
      ...DETECTED,
      id: largeWallId(index),
      levelId: largeLevelOf(index),
      centreline: {
        start: { x: alongMm, y: acrossMm },
        end: { x: alongMm + largeWallLengthMm(index), y: acrossMm },
      },
      thicknessMm: 220,
      heightMm: LARGE_LEVEL_HEIGHT_MM,
      kind: 'partition' as const,
      openingIds: [],
    };
  });

  const furniture: Furniture[] = Array.from(
    { length: LARGE_BUILDING_FURNITURE_COUNT },
    (_unused, index) => {
      const originXMm = (index % 40) * 1500;
      const originYMm = Math.floor(index / 40) * 1500;

      return {
        ...DETECTED,
        id: largeFurnitureId(index),
        levelId: largeLevelOf(index),
        kind: 'table' as const,
        centre: { x: originXMm + LARGE_FURNITURE_SIZE_MM / 2, y: originYMm + LARGE_FURNITURE_SIZE_MM / 2 },
        boundingBox: {
          min: { x: originXMm, y: originYMm },
          max: { x: originXMm + LARGE_FURNITURE_SIZE_MM, y: originYMm + LARGE_FURNITURE_SIZE_MM },
        },
        rotationDeg: (index * 15) % 360,
      };
    },
  );

  return {
    building: {
      confidence: 1,
      source: 'human',
      reviewed: true,
      name: 'Toà nhà hiệu năng',
      datumElevationMm: 0,
    },
    levels,
    walls,
    openings: [],
    furniture,
    rooms: [],
    axes: [],
    dimensions: [],
    notes: [],
  };
}

/* -------------------------------------------------------------------------- */
/* Frozen shared instances, for tests that only read.                          */
/* -------------------------------------------------------------------------- */

const deepFreeze = <T>(value: T): T => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze(Reflect.get(value, key));
  }

  return Object.freeze(value);
};

/** The clean building, frozen. Call the `create*` twin to break something. */
export const CLEAN_BUILDING_SCENARIO: QcScenario = deepFreeze(createCleanBuildingScenario());

/** The seven-critical building, frozen. Health score exactly 44. */
export const VIOLATED_BUILDING_SCENARIO: QcScenario = deepFreeze(createViolatedBuildingScenario());

/** The level-less project, frozen. */
export const EMPTY_PROJECT_SCENARIO: QcScenario = deepFreeze(createEmptyProjectScenario());
