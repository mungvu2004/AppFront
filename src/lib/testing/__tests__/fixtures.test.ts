/**
 * Pins the QC scenarios of `../fixtures` and the shared clock of
 * `../fakeClock` — the two halves of "tests must be deterministic": fixed
 * data, fixed time.
 */

import { describe, expect, it, vi } from 'vitest';

import { computeHealthScore } from '@/domain/rules/healthScore';
import { checkIntegrity } from '@/domain/spatial/integrity';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { SAMPLE_TOTAL_AREA_M2 } from '@/domain/spatial/__fixtures__/sampleBuilding';
import type { SpatialGraph } from '@/domain/spatial/types';
import { formatArea } from '@/lib/format/measure';

import { FAKE_CLOCK_START, installFakeClock, withFakeClock } from '../fakeClock';
import {
  CLEAN_BUILDING_SCENARIO,
  createCleanBuildingScenario,
  createEmptyProjectScenario,
  createLargeBuilding,
  createViolatedBuildingScenario,
  EMPTY_PROJECT_SCENARIO,
  LARGE_BUILDING_FURNITURE_COUNT,
  LARGE_BUILDING_LEVEL_COUNT,
  LARGE_BUILDING_WALL_COUNT,
  THIN_WALL_THICKNESS_MM,
  VIOLATED_BUILDING_SCENARIO,
  VIOLATED_CRITICAL_COUNT,
} from '../fixtures';

/** The integrity issues of a graph, exactly as the domain reports them. */
function integrityIssuesOf(graph: SpatialGraph): ReturnType<typeof checkIntegrity> {
  return checkIntegrity(normalizeSpatial(graph));
}

/* -------------------------------------------------------------------------- */
/* Scenario 1 — the clean building.                                            */
/* -------------------------------------------------------------------------- */

describe('createCleanBuildingScenario', () => {
  it('keeps the standard sample figures: 4 levels, 48 walls, 14 rooms, 248,60 m²', () => {
    const { graph, violations } = createCleanBuildingScenario();

    expect(graph.levels).toHaveLength(4);
    expect(graph.walls).toHaveLength(48);
    expect(graph.rooms).toHaveLength(14);
    expect(graph.building.grossFloorAreaM2).toBe(SAMPLE_TOTAL_AREA_M2);
    expect(formatArea(graph.building.grossFloorAreaM2)).toBe('248,60 m²');
    expect(violations).toHaveLength(0);
    expect(computeHealthScore(violations)).toBe(100);
  });

  it('passes checkIntegrity with zero issues', () => {
    expect(integrityIssuesOf(createCleanBuildingScenario().graph)).toEqual([]);
  });

  it('hands out independent copies, and a frozen shared instance', () => {
    const first = createCleanBuildingScenario();
    const second = createCleanBuildingScenario();
    const firstWall = first.graph.walls[0];

    expect(firstWall).toBeDefined();
    if (firstWall !== undefined) {
      firstWall.thicknessMm = 1;
    }
    expect(second.graph.walls[0]?.thicknessMm).not.toBe(1);

    expect(Object.isFrozen(CLEAN_BUILDING_SCENARIO.graph)).toBe(true);
    expect(Object.isFrozen(CLEAN_BUILDING_SCENARIO.graph.walls[0])).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Scenario 2 — seven critical findings, health score exactly 44.              */
/* -------------------------------------------------------------------------- */

describe('createViolatedBuildingScenario', () => {
  it('carries exactly seven critical findings scoring exactly 44', () => {
    const { violations } = createViolatedBuildingScenario();

    expect(violations).toHaveLength(VIOLATED_CRITICAL_COUNT);
    expect(violations).toHaveLength(7);
    expect(violations.every((violation) => violation.severity === 'critical')).toBe(true);
    expect(computeHealthScore(violations)).toBe(44);
  });

  it('tells one story: every finding names a wall that really is thin', () => {
    const { graph, violations } = createViolatedBuildingScenario();
    const wallsById = new Map(graph.walls.map((wall) => [wall.id, wall]));

    for (const violation of violations) {
      const wall = wallsById.get(violation.entityId as (typeof graph.walls)[number]['id']);

      expect(wall).toBeDefined();
      expect(wall?.thicknessMm).toBe(THIN_WALL_THICKNESS_MM);
      expect(wall?.levelId).toBe(violation.levelId);
      expect(violation.message).toContain(violation.entityId);
    }
  });

  it('stays structurally sound and keeps the key sample figures', () => {
    const { graph } = createViolatedBuildingScenario();

    // Deliberately wrong at the rule level only: integrity still finds nothing.
    expect(integrityIssuesOf(graph)).toEqual([]);
    expect(graph.levels).toHaveLength(4);
    expect(graph.walls).toHaveLength(48);
    expect(graph.rooms).toHaveLength(14);
    expect(graph.building.grossFloorAreaM2).toBe(SAMPLE_TOTAL_AREA_M2);
    expect(Object.isFrozen(VIOLATED_BUILDING_SCENARIO.graph)).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Scenario 3 — the project with no levels yet.                                */
/* -------------------------------------------------------------------------- */

describe('createEmptyProjectScenario', () => {
  it('holds a building record and eight empty lists, integrity-clean', () => {
    const { graph, violations } = createEmptyProjectScenario();

    expect(graph.levels).toHaveLength(0);
    expect(graph.walls).toHaveLength(0);
    expect(graph.openings).toHaveLength(0);
    expect(graph.furniture).toHaveLength(0);
    expect(graph.rooms).toHaveLength(0);
    expect(graph.axes).toHaveLength(0);
    expect(graph.dimensions).toHaveLength(0);
    expect(graph.notes).toHaveLength(0);
    expect(graph.building.reviewed).toBe(false);
    expect(violations).toHaveLength(0);
    expect(integrityIssuesOf(graph)).toEqual([]);
    expect(Object.isFrozen(EMPTY_PROJECT_SCENARIO.graph)).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* The large building.                                                         */
/* -------------------------------------------------------------------------- */

describe('createLargeBuilding', () => {
  it('builds 20 levels, 1200 walls and 400 furniture items', () => {
    const graph = createLargeBuilding();

    expect(graph.levels).toHaveLength(LARGE_BUILDING_LEVEL_COUNT);
    expect(graph.levels).toHaveLength(20);
    expect(graph.walls).toHaveLength(LARGE_BUILDING_WALL_COUNT);
    expect(graph.walls).toHaveLength(1200);
    expect(graph.furniture).toHaveLength(LARGE_BUILDING_FURNITURE_COUNT);
    expect(graph.furniture).toHaveLength(400);
  });

  it('is fully deterministic: two builds are deep-equal', () => {
    expect(createLargeBuilding()).toEqual(createLargeBuilding());
  });

  it('passes checkIntegrity with zero issues in under one second', () => {
    const graph = createLargeBuilding();

    const startedAt = performance.now();
    const issues = integrityIssuesOf(graph);
    const elapsedMs = performance.now() - startedAt;

    expect(issues).toEqual([]);
    expect(elapsedMs).toBeLessThan(1000);
  });
});

/* -------------------------------------------------------------------------- */
/* The shared fake clock.                                                      */
/* -------------------------------------------------------------------------- */

describe('installFakeClock', () => {
  it('starts at the shared instant and moves exactly as far as it is told', async () => {
    const clock = installFakeClock();

    try {
      expect(clock.epochMs()).toBe(FAKE_CLOCK_START.getTime());
      expect(clock.now()).toBeInstanceOf(Date);

      await clock.advance(60_000);
      expect(clock.epochMs()).toBe(FAKE_CLOCK_START.getTime() + 60_000);
    } finally {
      clock.restore();
    }
  });

  it('fires a timer on its exact due tick and settles the promises it created', async () => {
    const clock = installFakeClock();

    try {
      const saved: string[] = [];
      setTimeout(() => {
        // The promise this callback creates must be settled before advance
        // returns, or the assertion below would race the microtask queue.
        void Promise.resolve().then(() => {
          saved.push('saved');
        });
      }, 800);

      await clock.advance(799);
      expect(saved).toEqual([]);

      await clock.advance(1);
      expect(saved).toEqual(['saved']);
    } finally {
      clock.restore();
    }
  });

  it('drains a chained microtask ladder without moving time', async () => {
    const clock = installFakeClock();

    try {
      let done = false;
      void Promise.resolve()
        .then(() => undefined)
        .then(() => undefined)
        .then(() => {
          done = true;
        });

      const before = clock.epochMs();
      await clock.flushMicrotasks();

      expect(done).toBe(true);
      expect(clock.epochMs()).toBe(before);
    } finally {
      clock.restore();
    }
  });

  it('runs everything scheduled, however far ahead it sits', async () => {
    const clock = installFakeClock();

    try {
      const fired: number[] = [];
      setTimeout(() => fired.push(1), 800);
      setTimeout(() => fired.push(2), 45_000);

      await clock.runAllTimers();
      expect(fired).toEqual([1, 2]);
    } finally {
      clock.restore();
    }
  });

  it('withFakeClock restores the real timers even when the body throws', async () => {
    await expect(
      withFakeClock(() => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(vi.isFakeTimers()).toBe(false);
  });

  it('withFakeClock honours a custom start instant', async () => {
    const startAt = new Date('2026-01-02T03:04:05+07:00');

    await withFakeClock(
      (clock) => {
        expect(clock.epochMs()).toBe(startAt.getTime());
      },
      { startAt },
    );
  });
});
