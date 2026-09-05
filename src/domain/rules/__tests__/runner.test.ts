import { describe, expect, it } from 'vitest';

import {
  createSampleBuilding,
  SAMPLE_BUILDING,
  SAMPLE_WALL_COUNT,
  sampleLevelId,
  sampleLevelOf,
  sampleRoomId,
  sampleWallId,
} from '../../spatial/__fixtures__/sampleBuilding';
import { isValidId } from '../../spatial/ids';
import { normalizeSpatial, type NormalizedSpatial } from '../../spatial/normalize';
import type { LevelId, Room, RoomId, SpatialGraph, Wall, WallId } from '../../spatial/types';
import { ALL_RULES, createDefaultRuleRegistry } from '../defaults';
import { SUPERSEDED_BUILT_IN_CODES } from '../function';
import {
  BUILT_IN_RULES,
  createRuleRegistry,
  entitiesInScope,
  MIN_WALL_THICKNESS_MM,
  RULE_SEVERITIES,
  type Rule,
  type RuleRegistry,
} from '../registry';
import {
  countEntities,
  evaluatedRuleCodes,
  handleRuleWorkerRequest,
  runRules,
  runRulesAsync,
  WORKER_ENTITY_THRESHOLD,
  type RuleWorkerLike,
  type RuleWorkerRequest,
  type RuleWorkerResponse,
} from '../runner';

/* -------------------------------------------------------------------------- */
/* Fixtures.                                                                   */
/* -------------------------------------------------------------------------- */

const GROUND_LEVEL_ID: LevelId = sampleLevelId(0);
const FIRST_WALL_ID: WallId = sampleWallId(0);

/**
 * Rules that read walls, and so go stale when one moves.
 *
 * Fifteen rather than the four the eight built-ins gave, because the default
 * book now holds all twenty-five: the geometry, function and fit-out groups are
 * registered by `createDefaultRuleRegistry` itself. `rulesFor` answers with the
 * **enabled** rules, so `ROOM-HAS-DOOR` is absent — the function group stands it
 * down and `ROOM-NO-DOOR` reads walls in its place.
 */
const WALL_DEPENDENT_CODES = [
  'WALL-THICKNESS',
  'WALL-LENGTH',
  'OPENING-IN-WALL',
  'WALL-OVERLAP',
  'WALL-DANGLING-END',
  'ROOM-NOT-CLOSED',
  'DOOR-SWING-BLOCKED',
  'WALL-UNSUPPORTED',
  'ROOM-NO-DOOR',
  'ROOM-NO-WINDOW',
  'ESCAPE-DISTANCE',
  'DOOR-BLOCKS-PATH',
  'FURNITURE-CLASH',
  'FIXTURE-OFF-WALL',
  'WINDOW-ON-INNER-WALL',
];

/**
 * The one of those that is building-scoped rather than level-scoped.
 *
 * It matters to the arithmetic below: a building-scoped rule has exactly one
 * task however many floors went stale, so it is counted once, not four times.
 */
const BUILDING_SCOPED_WALL_CODES = ['WALL-UNSUPPORTED'];

/** Rules that read rooms. `ROOM-MIN-AREA` is stood down; `ROOM-AREA-BELOW-MINIMUM` replaced it. */
const ROOM_DEPENDENT_CODES = [
  'ROOM-UNNAMED',
  'ROOM-NOT-CLOSED',
  'ROOM-NO-DOOR',
  'CORRIDOR-WIDTH',
  'ROOM-NO-WINDOW',
  'ESCAPE-DISTANCE',
  'DOOR-BLOCKS-PATH',
  'ROOM-AREA-BELOW-MINIMUM',
  'ROOM-FURNITURE-MISMATCH',
];

/** Rules that read levels — all three building-scoped. */
const LEVEL_DEPENDENT_CODES = ['LEVEL-ELEVATION', 'WALL-UNSUPPORTED', 'STAIR-ALIGNMENT'];

/** Twenty level-scoped rules over four floors, plus three building-scoped ones. */
const FULL_PASS_TASK_COUNT = 20 * 4 + 3;

function normalizedSample(): NormalizedSpatial {
  return normalizeSpatial(createSampleBuilding());
}

/** The sample building with one wall rewritten, without touching the original. */
function withWall(graph: SpatialGraph, wallId: WallId, patch: Partial<Wall>): SpatialGraph {
  return {
    ...graph,
    walls: graph.walls.map((wall) => (wall.id === wallId ? { ...wall, ...patch } : wall)),
  };
}

/** The same, for one room. */
function withRoom(graph: SpatialGraph, roomId: RoomId, patch: Partial<Room>): SpatialGraph {
  return {
    ...graph,
    rooms: graph.rooms.map((room) => (room.id === roomId ? { ...room, ...patch } : room)),
  };
}

/**
 * The sample building padded out past the worker threshold.
 *
 * The extra walls are plain 1 000 mm partitions carrying no openings and
 * belonging to no room. They broke no rule while the book held only the eight
 * built-ins; they break `WALL-DANGLING-END` now, because a partition standing on
 * its own joins nothing at either end. Nothing here asserts a violation count,
 * only that the worker and the main thread agree on whatever it is.
 */
function createOversizedGraph(extraWallCount: number): SpatialGraph {
  const graph = createSampleBuilding();
  const template = graph.walls[0];

  if (template === undefined) {
    throw new Error('sample building has no wall to copy');
  }

  const extra: Wall[] = Array.from({ length: extraWallCount }, (_unused, index) => {
    const ordinal = SAMPLE_WALL_COUNT + index;

    return {
      ...template,
      id: sampleWallId(ordinal),
      levelId: sampleLevelOf(ordinal),
      openingIds: [],
      centreline: {
        start: { x: 0, y: (ordinal + 1) * 2000 },
        end: { x: 1000, y: (ordinal + 1) * 2000 },
      },
    };
  });

  return { ...graph, walls: [...graph.walls, ...extra] };
}

/** A rule the built-in book does not contain, to prove the runner needs no edit. */
const furnitureReviewRule: Rule = {
  code: 'FURNITURE-REVIEW',
  name: 'đồ đạc do máy nhận dạng cần người duyệt',
  group: 'annotation',
  severity: 'suggestion',
  scope: 'level',
  dependsOn: ['furniture'],
  check: (context) =>
    entitiesInScope(context, 'furniture').flatMap((item) =>
      item.reviewed
        ? []
        : [
            {
              entityId: item.id,
              message: `Đồ đạc ${item.id} chưa được người duyệt.`,
              suggestion: 'Mở bảng kiểm và duyệt đồ đạc này.',
            },
          ],
    ),
};

interface FakeWorker extends RuleWorkerLike {
  readonly requests: RuleWorkerRequest[];
}

/** A worker that answers on the microtask queue, the way a real one does. */
function createFakeWorker(respond: (request: RuleWorkerRequest) => RuleWorkerResponse): FakeWorker {
  const listeners = new Set<(event: MessageEvent<RuleWorkerResponse>) => void>();
  const requests: RuleWorkerRequest[] = [];

  return {
    requests,
    postMessage: (request) => {
      requests.push(request);
      const response = respond(request);

      queueMicrotask(() => {
        for (const listener of [...listeners]) {
          listener(new MessageEvent<RuleWorkerResponse>('message', { data: response }));
        }
      });
    },
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
  };
}

function workerOf(registry: RuleRegistry): FakeWorker {
  return createFakeWorker((request) => handleRuleWorkerRequest(request, registry));
}

/* -------------------------------------------------------------------------- */
/* The rule book.                                                              */
/* -------------------------------------------------------------------------- */

describe('the rule book', () => {
  it('gives every rule an upper-case code, a lower-case Vietnamese name and a severity', () => {
    for (const rule of BUILT_IN_RULES) {
      expect(rule.code).toBe(rule.code.toUpperCase());
      expect(rule.name).toBe(rule.name.toLowerCase());
      expect(RULE_SEVERITIES).toContain(rule.severity);
      expect(rule.dependsOn.length).toBeGreaterThan(0);
    }
  });

  it('refuses two rules sharing a code', () => {
    const registry = createDefaultRuleRegistry();

    expect(() => {
      registry.register({ ...furnitureReviewRule, code: 'WALL-LENGTH' });
    }).toThrow(/WALL-LENGTH/);
  });

  it('maps an entity kind to the rules that read it, in registration order', () => {
    const registry = createDefaultRuleRegistry();

    expect(registry.rulesFor(['wall']).map((rule) => rule.code)).toEqual(WALL_DEPENDENT_CODES);
    expect(registry.rulesFor(['room']).map((rule) => rule.code)).toEqual(ROOM_DEPENDENT_CODES);
  });

  it('lists a rule once however many of its kinds changed', () => {
    const registry = createDefaultRuleRegistry();
    const codes = registry.rulesFor(['wall', 'opening', 'room']).map((rule) => rule.code);

    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toContain('OPENING-IN-WALL');
  });

  it('switches one rule off and back on', () => {
    const registry = createDefaultRuleRegistry();

    expect(registry.isEnabled('DOOR-WIDTH')).toBe(true);
    registry.setEnabled('DOOR-WIDTH', false);
    expect(registry.isEnabled('DOOR-WIDTH')).toBe(false);
    expect(registry.listEnabled().map((rule) => rule.code)).not.toContain('DOOR-WIDTH');
    expect(registry.rulesFor(['opening']).map((rule) => rule.code)).not.toContain('DOOR-WIDTH');

    registry.setEnabled('DOOR-WIDTH', true);
    // Twenty-five registered, less the two the function group stands down.
    expect(registry.listEnabled()).toHaveLength(ALL_RULES.length - SUPERSEDED_BUILT_IN_CODES.length);
  });

  it('refuses to switch a rule nobody registered', () => {
    const registry = createDefaultRuleRegistry();

    expect(() => {
      registry.setEnabled('NO-SUCH-RULE', false);
    }).toThrow(/NO-SUCH-RULE/);
    expect(registry.isEnabled('NO-SUCH-RULE')).toBe(false);
    expect(registry.get('NO-SUCH-RULE')).toBeNull();
  });

  it('runs a rule the runner has never heard of, with no change to the runner', () => {
    const registry = createDefaultRuleRegistry();
    registry.register(furnitureReviewRule);

    const result = runRules(normalizedSample(), { registry });
    const reported = result.violations.filter((found) => found.ruleCode === 'FURNITURE-REVIEW');

    expect(reported).toHaveLength(21);
    expect(reported.every((found) => found.severity === 'suggestion')).toBe(true);
  });

  it('runs only registered rules when the book is otherwise empty', () => {
    const registry = createRuleRegistry([furnitureReviewRule]);
    const result = runRules(normalizedSample(), { registry });

    expect(evaluatedRuleCodes(result)).toEqual(['FURNITURE-REVIEW']);
  });
});

/* -------------------------------------------------------------------------- */
/* What a violation has to carry.                                              */
/* -------------------------------------------------------------------------- */

describe('a violation', () => {
  const registry = createDefaultRuleRegistry();
  const result = runRules(normalizedSample(), { registry });

  // The sample building is built to pass `checkIntegrity`, which is referential:
  // no dangling id, no zero-length wall, no room naming a wall that is not there.
  // It was never built to be a plausible *plan* — its 48 walls are collinear
  // 1 000 mm stubs spread round-robin over four floors, each room lists exactly
  // one such stub as its only boundary wall, and each of its 21 tables sits
  // astride the wall it was placed on. The eight built-ins could see none of
  // that. The other seventeen can, and every count below is a true reading of
  // the fixture's own geometry.
  it('is raised by the standard sample: 96 wall ends joining nothing, 21 tables through a wall', () => {
    const byRule = new Map<string, number>();

    for (const found of result.violations) {
      byRule.set(found.ruleCode, (byRule.get(found.ruleCode) ?? 0) + 1);
    }

    expect(Object.fromEntries(byRule)).toEqual({
      'OPENING-IN-WALL': 16,
      'WALL-DANGLING-END': 96,
      'ROOM-NOT-CLOSED': 14,
      'ROOM-NO-DOOR': 13,
      'ROOM-NO-WINDOW': 14,
      'ESCAPE-DISTANCE': 1,
      'FURNITURE-CLASH': 21,
      'WINDOW-ON-INNER-WALL': 7,
    });
  });

  it('always names an entity code that exists in the model', () => {
    expect(result.violations.length).toBeGreaterThan(0);

    for (const found of result.violations) {
      expect(isValidId(found.entityId)).toBe(true);
      expect(found.message).toContain(found.entityId);
    }
  });

  it('always carries a Vietnamese sentence and a fix to try', () => {
    for (const found of result.violations) {
      expect(found.message.trim().endsWith('.')).toBe(true);
      expect(found.suggestion.trim().endsWith('.')).toBe(true);
      expect(found.suggestion.length).toBeGreaterThan(0);
      expect(RULE_SEVERITIES).toContain(found.severity);
    }
  });

  it('says which level it was found on', () => {
    for (const found of result.violations) {
      expect(found.levelId).not.toBeNull();
    }
  });

  it('gives wall lengths in whole millimetres', () => {
    const graph = normalizeSpatial(withWall(createSampleBuilding(), FIRST_WALL_ID, { thicknessMm: 12.5 }));
    const thickness = runRules(graph, { registry: createDefaultRuleRegistry() }).violations.find(
      (found) => found.ruleCode === 'WALL-THICKNESS',
    );

    expect(thickness?.message).toContain('13 mm');
    expect(thickness?.suggestion).toContain(`${String(MIN_WALL_THICKNESS_MM)} mm`);
  });

  it('gives areas in square metres, with a comma for the decimal', () => {
    const graph = normalizeSpatial(withRoom(createSampleBuilding(), sampleRoomId(0), { areaM2: 8 }));
    // `ROOM-MIN-AREA` is stood down in the default book. `ROOM-AREA-BELOW-MINIMUM`
    // reports the same shortfall against the same 9,00 m2 floor for a bedroom,
    // and the decimal comma is the point of this test either way.
    const area = runRules(graph, { registry: createDefaultRuleRegistry() }).violations.find(
      (found) => found.ruleCode === 'ROOM-AREA-BELOW-MINIMUM',
    );

    expect(area?.message).toContain('8,00 m²');
    expect(area?.message).toContain('9,00 m²');
    expect(area?.message).toContain('phòng ngủ');
  });
});

/* -------------------------------------------------------------------------- */
/* Rules never touch the model.                                                */
/* -------------------------------------------------------------------------- */

describe('running the book', () => {
  it('leaves the model exactly as it found it', () => {
    const before = JSON.stringify(SAMPLE_BUILDING);
    const graph = normalizeSpatial(SAMPLE_BUILDING);
    const indexBefore = JSON.stringify(graph);

    runRules(graph, { registry: createDefaultRuleRegistry() });

    expect(JSON.stringify(SAMPLE_BUILDING)).toBe(before);
    expect(JSON.stringify(graph)).toBe(indexBefore);
  });

  it('reports a rule that throws instead of taking the pass down with it', () => {
    const registry = createRuleRegistry([
      {
        ...furnitureReviewRule,
        code: 'BROKEN-RULE',
        check: () => {
          throw new Error('mất chỉ mục');
        },
      },
      furnitureReviewRule,
    ]);

    const result = runRules(normalizedSample(), { registry });
    const broken = result.violations.filter((found) => found.ruleCode === 'BROKEN-RULE');

    expect(broken).toHaveLength(4);
    expect(broken[0]?.severity).toBe('critical');
    expect(broken[0]?.message).toContain('mất chỉ mục');
    expect(broken[0]?.suggestion).toContain('BROKEN-RULE');
    expect(result.violations.some((found) => found.ruleCode === 'FURNITURE-REVIEW')).toBe(true);
  });

  it('lists violations in the same order however much of the pass was re-run', () => {
    const registry = createDefaultRuleRegistry();
    const graph = normalizedSample();
    const full = runRules(graph, { registry });
    const incremental = runRules(graph, {
      registry,
      previous: full.state,
      changes: [{ entityId: FIRST_WALL_ID }],
    });

    expect(incremental.violations).toEqual(full.violations);
  });
});

/* -------------------------------------------------------------------------- */
/* Only re-running what went stale.                                            */
/* -------------------------------------------------------------------------- */

describe('editing one wall', () => {
  const registry = createDefaultRuleRegistry();
  const graph = normalizedSample();
  const full = runRules(graph, { registry });

  it('starts from a pass over every rule on every level', () => {
    expect(full.evaluated).toHaveLength(FULL_PASS_TASK_COUNT);
    expect(full.reusedTaskCount).toBe(0);
  });

  it('re-runs the rules that read walls, and no others', () => {
    const edited = runRules(graph, {
      registry,
      previous: full.state,
      changes: [{ entityId: FIRST_WALL_ID }],
    });

    expect(evaluatedRuleCodes(edited)).toEqual(WALL_DEPENDENT_CODES);
    expect(evaluatedRuleCodes(edited)).not.toContain('DOOR-WIDTH');
    expect(evaluatedRuleCodes(edited)).not.toContain('ROOM-MIN-AREA');
    expect(evaluatedRuleCodes(edited)).not.toContain('ROOM-UNNAMED');
    expect(evaluatedRuleCodes(edited)).not.toContain('LEVEL-ELEVATION');
  });

  it('re-runs them only on the level that wall sits on', () => {
    const edited = runRules(graph, {
      registry,
      previous: full.state,
      changes: [{ entityId: FIRST_WALL_ID }],
    });

    expect(edited.evaluated).toHaveLength(WALL_DEPENDENT_CODES.length);
    expect(
      edited.evaluated
        .filter((task) => !BUILDING_SCOPED_WALL_CODES.includes(task.ruleCode))
        .every((task) => task.levelId === GROUND_LEVEL_ID),
    ).toBe(true);
    // The building-scoped one reads the whole stack, so it carries no level at all.
    expect(
      edited.evaluated
        .filter((task) => BUILDING_SCOPED_WALL_CODES.includes(task.ruleCode))
        .every((task) => task.levelId === null),
    ).toBe(true);
    expect(edited.reusedTaskCount).toBe(full.evaluated.length - WALL_DEPENDENT_CODES.length);
  });

  it('finds the same violations it would have found by re-running everything', () => {
    const changed = normalizeSpatial(withWall(createSampleBuilding(), FIRST_WALL_ID, { thicknessMm: 20 }));
    const incremental = runRules(changed, {
      registry,
      previous: full.state,
      changes: [{ entityId: FIRST_WALL_ID }],
    });

    expect(incremental.violations).toEqual(runRules(changed, { registry }).violations);
    expect(incremental.violations.some((found) => found.ruleCode === 'WALL-THICKNESS')).toBe(true);
  });

  it('re-runs the room rules when a room changes, and not the wall-only ones', () => {
    const edited = runRules(graph, {
      registry,
      previous: full.state,
      changes: [{ entityId: sampleRoomId(0) }],
    });

    expect(evaluatedRuleCodes(edited)).toEqual(ROOM_DEPENDENT_CODES);
    expect(evaluatedRuleCodes(edited)).not.toContain('WALL-LENGTH');
  });

  it('re-runs the building-wide rules when a level changes, whatever floor it is', () => {
    const edited = runRules(graph, {
      registry,
      previous: full.state,
      changes: [{ entityId: sampleLevelId(2) }],
    });

    expect(evaluatedRuleCodes(edited)).toEqual(LEVEL_DEPENDENT_CODES);
    expect(edited.evaluated).toEqual(
      LEVEL_DEPENDENT_CODES.map((ruleCode) => ({ ruleCode, levelId: null })),
    );
  });

  it('re-runs nothing when nothing changed', () => {
    const edited = runRules(graph, { registry, previous: full.state, changes: [] });

    expect(edited.evaluated).toHaveLength(0);
    expect(edited.reusedTaskCount).toBe(full.evaluated.length);
    expect(edited.violations).toEqual(full.violations);
  });

  it('re-checks every level when a deleted entity gives no level to narrow to', () => {
    const edited = runRules(graph, {
      registry,
      previous: full.state,
      changes: [{ entityId: sampleWallId(999), kind: 'wall' }],
    });

    expect(evaluatedRuleCodes(edited)).toEqual(WALL_DEPENDENT_CODES);
    // Every floor for the level-scoped ones; the building-scoped one still once.
    expect(edited.evaluated).toHaveLength(
      (WALL_DEPENDENT_CODES.length - BUILDING_SCOPED_WALL_CODES.length) * 4 +
        BUILDING_SCOPED_WALL_CODES.length,
    );
  });

  it('re-checks everything when the changed code cannot be read', () => {
    const edited = runRules(graph, {
      registry,
      previous: full.state,
      changes: [{ entityId: 'không-phải-mã' }],
    });

    expect(edited.evaluated).toHaveLength(full.evaluated.length);
  });
});

/* -------------------------------------------------------------------------- */
/* The book changing under a running session.                                  */
/* -------------------------------------------------------------------------- */

describe('switching a rule while a session is open', () => {
  it('drops the violations of a rule switched off, without re-running anything', () => {
    const registry = createDefaultRuleRegistry();
    const graph = normalizedSample();
    const full = runRules(graph, { registry });

    registry.setEnabled('OPENING-IN-WALL', false);
    const after = runRules(graph, { registry, previous: full.state, changes: [] });

    expect(after.evaluated).toHaveLength(0);
    expect(after.violations.some((found) => found.ruleCode === 'OPENING-IN-WALL')).toBe(false);
    // The sample's 182 findings, less the 16 that rule raised.
    expect(after.violations).toHaveLength(166);
  });

  it('runs a rule registered mid-session even though nothing changed', () => {
    const registry = createDefaultRuleRegistry();
    const graph = normalizedSample();
    const full = runRules(graph, { registry });

    registry.register(furnitureReviewRule);
    const after = runRules(graph, { registry, previous: full.state, changes: [] });

    expect(evaluatedRuleCodes(after)).toEqual(['FURNITURE-REVIEW']);
    expect(after.violations.filter((found) => found.ruleCode === 'FURNITURE-REVIEW')).toHaveLength(21);
  });
});

/* -------------------------------------------------------------------------- */
/* Staying off the main thread when the model is big.                          */
/* -------------------------------------------------------------------------- */

describe('choosing where the pass runs', () => {
  it('counts the standard sample well under the worker threshold', () => {
    expect(countEntities(normalizedSample())).toBe(141);
    expect(countEntities(normalizedSample())).toBeLessThan(WORKER_ENTITY_THRESHOLD);
  });

  it('runs a model under the threshold in place, even with a worker to hand', async () => {
    const registry = createDefaultRuleRegistry();
    const worker = workerOf(registry);
    const result = await runRulesAsync(normalizedSample(), {
      registry,
      createWorker: () => worker,
    });

    expect(result.ranInWorker).toBe(false);
    expect(worker.requests).toHaveLength(0);
    expect(result.violations).toEqual(runRules(normalizedSample(), { registry }).violations);
  });

  it('posts a model over the threshold to the worker, and gets the same answer', async () => {
    const registry = createDefaultRuleRegistry();
    const worker = workerOf(registry);
    const graph = normalizeSpatial(createOversizedGraph(400));

    expect(countEntities(graph)).toBeGreaterThan(WORKER_ENTITY_THRESHOLD);

    const result = await runRulesAsync(graph, { registry, createWorker: () => worker });

    expect(result.ranInWorker).toBe(true);
    expect(worker.requests).toHaveLength(1);
    expect(result.violations).toEqual(runRules(graph, { registry }).violations);
  });

  it('posts only the stale tasks, not the whole book', async () => {
    const registry = createDefaultRuleRegistry();
    const worker = workerOf(registry);
    const graph = normalizeSpatial(createOversizedGraph(400));
    const full = await runRulesAsync(graph, { registry, createWorker: () => worker });

    await runRulesAsync(graph, {
      registry,
      createWorker: () => worker,
      previous: full.state,
      changes: [{ entityId: FIRST_WALL_ID }],
    });

    expect(worker.requests[1]?.tasks.map((task) => task.ruleCode)).toEqual(WALL_DEPENDENT_CODES);
  });

  it('runs in place when no worker is wired up at all', async () => {
    const registry = createDefaultRuleRegistry();
    const graph = normalizeSpatial(createOversizedGraph(400));
    const result = await runRulesAsync(graph, { registry });

    expect(result.ranInWorker).toBe(false);
    expect(result.violations).toEqual(runRules(graph, { registry }).violations);
  });

  it('falls back to running in place when the worker reports an error', async () => {
    const registry = createDefaultRuleRegistry();
    const worker = createFakeWorker((request) => ({
      requestId: request.requestId,
      results: [],
      error: 'worker hết bộ nhớ',
    }));

    const graph = normalizeSpatial(createOversizedGraph(400));
    const result = await runRulesAsync(graph, { registry, createWorker: () => worker });

    expect(result.ranInWorker).toBe(false);
    expect(result.violations).toEqual(runRules(graph, { registry }).violations);
  });

  it('falls back when the worker answers short of the tasks it was given', async () => {
    const registry = createDefaultRuleRegistry();
    const worker = createFakeWorker((request) => {
      const full = handleRuleWorkerRequest(request, registry);

      return { requestId: full.requestId, results: full.results.slice(1) };
    });

    const graph = normalizeSpatial(createOversizedGraph(400));
    const result = await runRulesAsync(graph, { registry, createWorker: () => worker });

    expect(result.ranInWorker).toBe(false);
    expect(result.violations).toEqual(runRules(graph, { registry }).violations);
  });

  it('falls back when the worker cannot even be built', async () => {
    const registry = createDefaultRuleRegistry();
    const graph = normalizeSpatial(createOversizedGraph(400));
    const result = await runRulesAsync(graph, {
      registry,
      createWorker: () => {
        throw new Error('Worker không khả dụng');
      },
    });

    expect(result.ranInWorker).toBe(false);
    expect(result.violations).toEqual(runRules(graph, { registry }).violations);
  });

  it('ignores an answer belonging to a pass that has been superseded', async () => {
    const registry = createDefaultRuleRegistry();
    const worker = createFakeWorker((request) => {
      const full = handleRuleWorkerRequest(request, registry);

      return { ...full, requestId: full.requestId + 1000 };
    });

    const graph = normalizeSpatial(createOversizedGraph(400));
    const pass = runRulesAsync(graph, { registry, createWorker: () => worker, workerThreshold: 10 });

    await expect(Promise.race([pass, Promise.resolve('still waiting')])).resolves.toBe('still waiting');
  });

  it('takes a threshold of its own, so the choice can be tested either way', async () => {
    const registry = createDefaultRuleRegistry();
    const worker = workerOf(registry);
    const result = await runRulesAsync(normalizedSample(), {
      registry,
      createWorker: () => worker,
      workerThreshold: 50,
    });

    expect(result.ranInWorker).toBe(true);
    expect(result.violations).toEqual(runRules(normalizedSample(), { registry }).violations);
  });

  it('skips the round trip when the pass has nothing to re-run', async () => {
    const registry = createDefaultRuleRegistry();
    const worker = workerOf(registry);
    const graph = normalizeSpatial(createOversizedGraph(400));
    const full = await runRulesAsync(graph, { registry, createWorker: () => worker });
    const idle = await runRulesAsync(graph, {
      registry,
      createWorker: () => worker,
      previous: full.state,
      changes: [],
    });

    expect(idle.ranInWorker).toBe(false);
    expect(worker.requests).toHaveLength(1);
    expect(idle.violations).toEqual(full.violations);
  });
});

describe('the worker side of the protocol', () => {
  it('answers every task it was given', () => {
    const registry = createDefaultRuleRegistry();
    const tasks = [
      { ruleCode: 'WALL-LENGTH', levelId: GROUND_LEVEL_ID },
      { ruleCode: 'LEVEL-ELEVATION', levelId: null },
    ];

    const response = handleRuleWorkerRequest(
      { requestId: 7, graph: normalizedSample(), tasks },
      registry,
    );

    expect(response.requestId).toBe(7);
    expect(response.error).toBeUndefined();
    expect(response.results.map((result) => result.task)).toEqual(tasks);
  });

  it('reports a rule code its own book does not hold, rather than answering blank', () => {
    const response = handleRuleWorkerRequest(
      {
        requestId: 8,
        graph: normalizedSample(),
        tasks: [{ ruleCode: 'FURNITURE-REVIEW', levelId: GROUND_LEVEL_ID }],
      },
      createDefaultRuleRegistry(),
    );

    expect(response.error).toContain('FURNITURE-REVIEW');
    expect(response.results).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Speed.                                                                      */
/* -------------------------------------------------------------------------- */

describe('speed', () => {
  it('checks the whole standard sample in well under 200 ms', () => {
    const registry = createDefaultRuleRegistry();

    // One warm-up pass, so the figure is the steady state an editing session
    // sees rather than the first-call cost of compiling the checks.
    runRules(normalizedSample(), { registry });

    const startedAt = performance.now();
    const result = runRules(normalizeSpatial(createSampleBuilding()), { registry });
    const elapsedMs = performance.now() - startedAt;

    expect(result.violations).toHaveLength(182);
    expect(elapsedMs).toBeLessThan(200);
  });

  it('costs a fraction of that to re-check one edited wall', () => {
    const registry = createDefaultRuleRegistry();
    const graph = normalizedSample();
    const full = runRules(graph, { registry });

    const startedAt = performance.now();
    const edited = runRules(graph, {
      registry,
      previous: full.state,
      changes: [{ entityId: FIRST_WALL_ID }],
    });
    const elapsedMs = performance.now() - startedAt;

    expect(edited.evaluated).toHaveLength(WALL_DEPENDENT_CODES.length);
    expect(elapsedMs).toBeLessThan(200);
  });
});
