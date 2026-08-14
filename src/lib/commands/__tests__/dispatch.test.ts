import { describe, expect, it } from 'vitest';

import { createRuleRegistry, type Rule } from '@/domain/rules/registry';
import { EMPTY_RUN_STATE, evaluatedRuleCodes, type ChangedEntity, type RuleRunResult } from '@/domain/rules/runner';
import { applyPatch } from '@/domain/spatial/applyPatch';
import { normalizeSpatial, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Level, Opening, Room, SpatialGraph, Wall } from '@/domain/spatial/types';
import { changeForAdd, changeForRemove, changeForUpdate, createCommand } from '@/lib/commands/createCommand';
import {
  createIncrementalRuleRunner,
  dispatch,
  DISPATCH_STAGES,
  validateCommand,
  type DispatchBatch,
  type DispatchDeps,
  type DispatchStage,
  type UndoEntry,
} from '@/lib/commands/dispatch';
import { runTransaction } from '@/lib/commands/transaction';
import type { Command } from '@/lib/commands/types';

/* -------------------------------------------------------------------------- */
/* Fixtures — the standard sample floor.                                       */
/* -------------------------------------------------------------------------- */

const LEVEL_ID = 'L-000001AAAA' as const;
const WALL_ID = 'W-000001AAAA' as const;
const NEW_WALL_ID = 'W-000002AAAA' as const;
const MISSING_WALL_ID = 'W-000099AAAA' as const;
const OPENING_ID = 'D-000001AAAA' as const;
const ROOM_ID = 'R-000001AAAA' as const;
const MISSING_ROOM_ID = 'R-000099AAAA' as const;

const levelFixture: Level = {
  id: LEVEL_ID,
  name: 'Tầng 1',
  order: 0,
  elevationMm: 0,
  heightMm: 3400,
  areaM2: 248.6,
  confidence: 0.95,
  source: 'human',
  reviewed: true,
};

const wallFixture: Wall = {
  id: WALL_ID,
  levelId: LEVEL_ID,
  centreline: { start: { x: 0, y: 0 }, end: { x: 4800, y: 0 } },
  thicknessMm: 220,
  heightMm: 3400,
  kind: 'loadBearing',
  openingIds: [OPENING_ID],
  confidence: 0.92,
  source: 'ai',
  reviewed: false,
};

const newWallFixture: Wall = {
  id: NEW_WALL_ID,
  levelId: LEVEL_ID,
  centreline: { start: { x: 4800, y: 0 }, end: { x: 4800, y: 3600 } },
  thicknessMm: 140,
  heightMm: 3400,
  kind: 'partition',
  openingIds: [],
  confidence: 0.9,
  source: 'human',
  reviewed: true,
};

const openingFixture: Opening = {
  id: OPENING_ID,
  wallId: WALL_ID,
  kind: 'door',
  offsetMm: 1200,
  widthMm: 900,
  heightMm: 2100,
  sillHeightMm: 0,
  swing: 'left',
  confidence: 0.88,
  source: 'ai',
  reviewed: false,
};

const roomFixture: Room = {
  id: ROOM_ID,
  levelId: LEVEL_ID,
  name: 'Phòng khách',
  usage: 'livingRoom',
  outline: [
    { x: 0, y: 0 },
    { x: 4800, y: 0 },
    { x: 4800, y: 3600 },
    { x: 0, y: 3600 },
  ],
  areaM2: 17.28,
  wallIds: [WALL_ID],
  confidence: 0.9,
  source: 'ai',
  reviewed: false,
};

const missingRoomFixture: Room = { ...roomFixture, id: MISSING_ROOM_ID };

const sampleGraph: SpatialGraph = {
  building: {
    name: 'Nhà phố mẫu',
    datumElevationMm: 0,
    grossFloorAreaM2: 248.6,
    confidence: 1,
    source: 'human',
    reviewed: true,
  },
  levels: [levelFixture],
  walls: [wallFixture],
  openings: [openingFixture],
  furniture: [],
  rooms: [roomFixture],
  axes: [],
  dimensions: [],
  notes: [],
};

const createGraph = (): NormalizedSpatial => normalizeSpatial(sampleGraph);

/* -------------------------------------------------------------------------- */
/* Commands under test.                                                        */
/* -------------------------------------------------------------------------- */

let commandCounter = 0;

const nextCommandId = (): `C-${string}` => {
  commandCounter += 1;

  return `C-${String(commandCounter).padStart(6, '0')}AAAA`;
};

const buildThickenWallCommand = (): Command =>
  createCommand({
    type: 'wall.resize',
    actorId: 'user-01',
    description: 'Đổi bề dày tường sang 240 mm',
    changes: [changeForUpdate('wall', wallFixture, { ...wallFixture, thicknessMm: 240 })],
    id: nextCommandId(),
    timestamp: '2026-08-14T09:00:00+07:00',
  });

const buildAddWallCommand = (): Command =>
  createCommand({
    type: 'wall.add',
    actorId: 'user-01',
    description: 'Thêm tường ngăn',
    changes: [changeForAdd('wall', newWallFixture)],
    id: nextCommandId(),
    timestamp: '2026-08-14T09:01:00+07:00',
  });

const buildThinNewWallCommand = (): Command =>
  createCommand({
    type: 'wall.resize',
    actorId: 'user-01',
    description: 'Đổi bề dày tường ngăn sang 100 mm',
    changes: [changeForUpdate('wall', newWallFixture, { ...newWallFixture, thicknessMm: 100 })],
    id: nextCommandId(),
    timestamp: '2026-08-14T09:02:00+07:00',
  });

const buildRemoveRoomCommand = (): Command =>
  createCommand({
    type: 'room.remove',
    actorId: 'user-01',
    description: 'Xoá phòng khách',
    changes: [changeForRemove('room', roomFixture)],
    id: nextCommandId(),
    timestamp: '2026-08-14T09:03:00+07:00',
  });

/** Points at a room the drawing does not hold, so step one must reject it. */
const buildRemoveMissingRoomCommand = (): Command =>
  createCommand({
    type: 'room.remove',
    actorId: 'user-01',
    description: 'Xoá phòng không còn tồn tại',
    changes: [changeForRemove('room', missingRoomFixture)],
    id: nextCommandId(),
    timestamp: '2026-08-14T09:04:00+07:00',
  });

/* -------------------------------------------------------------------------- */
/* A store, an undo stack, a rule pass and a queue, all in memory.             */
/* -------------------------------------------------------------------------- */

const EMPTY_RUN_RESULT: RuleRunResult = {
  violations: [],
  state: EMPTY_RUN_STATE,
  evaluated: [],
  reusedTaskCount: 0,
  ranInWorker: false,
};

interface HarnessOptions {
  /** Makes the store throw on the n-th `applyPatches` call, counting from 1. */
  readonly failOnApplyCall?: number;
  /** Makes the undo stack throw on `push`. */
  readonly historyError?: Error;
  /** Makes the sync queue reject. */
  readonly syncError?: Error;
  /** Replaces the rules port, e.g. with the real incremental runner. */
  readonly rules?: DispatchDeps['rules'];
}

interface Harness {
  readonly deps: DispatchDeps;
  /** The steps that reported in, in the order they ran. */
  readonly log: DispatchStage[];
  readonly entries: UndoEntry[];
  readonly queued: DispatchBatch[];
  readonly changesSeenByRules: ChangedEntity[][];
  graph: () => NormalizedSpatial | null;
}

const createHarness = (options: HarnessOptions = {}): Harness => {
  let graph: NormalizedSpatial | null = createGraph();
  let applyCalls = 0;
  let rolledBack = false;

  const log: DispatchStage[] = [];
  const entries: UndoEntry[] = [];
  const queued: DispatchBatch[] = [];
  const changesSeenByRules: ChangedEntity[][] = [];

  const deps: DispatchDeps = {
    spatial: {
      read: () => graph,
      applyPatches: (patches) => {
        applyCalls += 1;

        if (options.failOnApplyCall === applyCalls) {
          // The next call is the pipeline putting things back; let it through.
          rolledBack = true;
          throw new Error('Kho dữ liệu từ chối ghi.');
        }

        if (!rolledBack) {
          log.push('apply');
        }

        graph = graph === null ? null : applyPatch(graph, patches);
      },
    },
    history: {
      push: (entry) => {
        log.push('history');

        if (options.historyError !== undefined) {
          throw options.historyError;
        }

        entries.push(entry);
      },
      drop: (entryId) => {
        const index = entries.findIndex((entry) => entry.id === entryId);

        if (index !== -1) {
          entries.splice(index, 1);
        }
      },
    },
    rules: options.rules ?? {
      run: (_graph, changes) => {
        log.push('rules');
        changesSeenByRules.push([...changes]);

        return EMPTY_RUN_RESULT;
      },
      write: () => undefined,
    },
    sync: {
      enqueue: async (batch) => {
        log.push('sync');

        if (options.syncError !== undefined) {
          throw options.syncError;
        }

        queued.push(batch);
      },
    },
    now: () => '2026-08-14T10:00:00+07:00',
  };

  return { deps, log, entries, queued, changesSeenByRules, graph: () => graph };
};

/* -------------------------------------------------------------------------- */
/* The five steps.                                                             */
/* -------------------------------------------------------------------------- */

describe('dispatch', () => {
  it('runs the five steps in the declared order', async () => {
    const harness = createHarness();

    const result = await dispatch(buildThickenWallCommand(), harness.deps);

    expect(result.ok).toBe(true);
    expect(DISPATCH_STAGES).toEqual(['validate', 'apply', 'history', 'rules', 'sync']);
    // Step one leaves no trace when it passes; the other four report in order.
    expect(harness.log).toEqual(['apply', 'history', 'rules', 'sync']);
  });

  it('applies the command, keeps one undo entry and queues the batch', async () => {
    const harness = createHarness();
    const command = buildThickenWallCommand();

    const result = await dispatch(command, harness.deps);

    if (!result.ok) {
      throw new Error(`Lệnh hợp lệ mà vẫn hỏng: ${result.error.reasons.join(' ')}`);
    }

    expect(harness.graph()?.byId[WALL_ID]).toEqual({ ...wallFixture, thicknessMm: 240 });
    expect(harness.entries).toHaveLength(1);
    expect(harness.entries[0]?.commands).toEqual([command]);
    expect(harness.entries[0]?.label).toBe('Đổi bề dày tường sang 240 mm');
    expect(harness.queued).toHaveLength(1);
    expect(harness.queued[0]?.id).toBe(result.data.entry.id);
    expect(harness.queued[0]?.timestamp).toBe('2026-08-14T10:00:00+07:00');
  });

  it('hands the undo stack patches that put the drawing back exactly', async () => {
    const harness = createHarness();
    const before = createGraph();

    const result = await dispatch(buildThickenWallCommand(), harness.deps);

    if (!result.ok) {
      throw new Error('Lệnh hợp lệ mà vẫn hỏng.');
    }

    const current = harness.graph();

    expect(current).not.toBeNull();
    expect(applyPatch(current as NormalizedSpatial, result.data.entry.undoPatches)).toEqual(before);
  });

  it('reports the entity, kind and level the change made stale', async () => {
    const harness = createHarness();

    await dispatch(buildThickenWallCommand(), harness.deps);

    expect(harness.changesSeenByRules).toEqual([[{ entityId: WALL_ID, kind: 'wall', levelId: LEVEL_ID }]]);
  });

  it('re-runs only the rules the change touched', async () => {
    const wallRule: Rule = {
      code: 'WALL-TEST',
      name: 'tường luôn đạt',
      group: 'geometry',
      severity: 'warning',
      scope: 'level',
      dependsOn: ['wall'],
      check: () => [],
    };
    const levelRule: Rule = {
      code: 'LEVEL-TEST',
      name: 'tầng luôn đạt',
      group: 'levels',
      severity: 'warning',
      scope: 'building',
      dependsOn: ['level'],
      check: () => [],
    };
    const harness = createHarness({
      rules: createIncrementalRuleRunner({ registry: createRuleRegistry([wallRule, levelRule]) }),
    });

    // The first pass has nothing cached, so it checks everything.
    const first = await dispatch(buildAddWallCommand(), harness.deps);
    const second = await dispatch(buildThinNewWallCommand(), harness.deps);

    if (!first.ok || !second.ok) {
      throw new Error('Lệnh hợp lệ mà vẫn hỏng.');
    }

    expect(evaluatedRuleCodes(first.data.rules)).toEqual(['WALL-TEST', 'LEVEL-TEST']);
    expect(evaluatedRuleCodes(second.data.rules)).toEqual(['WALL-TEST']);
    expect(second.data.rules.reusedTaskCount).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Step one is a wall, not a filter.                                           */
/* -------------------------------------------------------------------------- */

describe('dispatch: lệnh không hợp lệ', () => {
  it('stops at step one without touching the store or the undo stack', async () => {
    const harness = createHarness();
    const before = harness.graph();
    const command = buildRemoveMissingRoomCommand();

    const result = await dispatch(command, harness.deps);

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error('Lệnh hỏng mà vẫn chạy.');
    }

    expect(result.error.stage).toBe('validate');
    expect(result.error.message).toBe('Lệnh không hợp lệ nên đã bị chặn trước khi chạm vào dữ liệu.');
    expect(result.error.reasons).toEqual([
      `Lệnh ${command.id}, thay đổi 1: đối tượng ${MISSING_ROOM_ID} không còn trong bản vẽ.`,
    ]);
    // Nothing ran: no patch, no undo entry, no rule pass, no queued item.
    expect(harness.log).toEqual([]);
    expect(harness.entries).toEqual([]);
    expect(harness.queued).toEqual([]);
    expect(harness.graph()).toBe(before);
  });

  it('names every problem of a malformed command in Vietnamese', () => {
    const broken = {
      id: 'C-',
      type: '',
      timestamp: 'hôm nọ',
      actorId: '',
      description: '',
      changes: [{ kind: 'wall', id: MISSING_WALL_ID, before: null, after: null }],
      scope: { entityIds: [], levelIds: [], kinds: [] },
    } as unknown as Command;

    const reasons = validateCommand(broken, createGraph());

    expect(reasons).toEqual([
      'Lệnh C-: thiếu loại lệnh.',
      'Lệnh C-: thiếu người thực hiện.',
      'Lệnh C-: thiếu mô tả để hiện trên nhật ký và nút hoàn tác.',
      'Lệnh C-: thời điểm không đọc được.',
      'Lệnh C-, thay đổi 1: không có ảnh chụp nào nên không thể hoàn tác.',
    ]);
  });

  it('refuses to create an entity the drawing already holds', () => {
    const clash = createCommand({
      type: 'wall.add',
      actorId: 'user-01',
      description: 'Thêm lại tường đã có',
      changes: [changeForAdd('wall', wallFixture)],
      id: nextCommandId(),
      timestamp: '2026-08-14T09:06:00+07:00',
    });

    expect(validateCommand(clash, createGraph())).toEqual([
      `Lệnh ${clash.id}, thay đổi 1: đối tượng ${WALL_ID} đã có trong bản vẽ nên không tạo mới được.`,
    ]);
  });

  it('accepts a command that builds on what an earlier command in the batch created', async () => {
    const harness = createHarness();

    const result = await runTransaction([buildAddWallCommand(), buildThinNewWallCommand()], harness.deps);

    expect(result.ok).toBe(true);
    expect(harness.graph()?.byId[NEW_WALL_ID]).toEqual({ ...newWallFixture, thicknessMm: 100 });
  });
});

/* -------------------------------------------------------------------------- */
/* All or nothing.                                                             */
/* -------------------------------------------------------------------------- */

describe('runTransaction', () => {
  it('shows a batch as a single undo entry', async () => {
    const harness = createHarness();
    const commands = [buildAddWallCommand(), buildThinNewWallCommand(), buildRemoveRoomCommand()];

    const result = await runTransaction(commands, harness.deps);

    expect(result.ok).toBe(true);
    expect(harness.entries).toHaveLength(1);
    expect(harness.entries[0]?.commands).toEqual(commands);
    expect(harness.entries[0]?.label).toBe('Gộp 3 thay đổi');
    // One undo entry, one rule pass, one queued item — for all three commands.
    expect(harness.log).toEqual(['apply', 'apply', 'apply', 'history', 'rules', 'sync']);
    expect(harness.queued).toHaveLength(1);
  });

  it('undoes the whole batch in one step', async () => {
    const harness = createHarness();
    const before = createGraph();

    const result = await runTransaction(
      [buildAddWallCommand(), buildThinNewWallCommand(), buildRemoveRoomCommand()],
      harness.deps,
    );

    if (!result.ok) {
      throw new Error('Giao dịch hợp lệ mà vẫn hỏng.');
    }

    const current = harness.graph();

    expect(current).not.toBeNull();
    expect(applyPatch(current as NormalizedSpatial, result.data.entry.undoPatches)).toEqual(before);
  });

  it('cancels all three commands when the third is invalid', async () => {
    const harness = createHarness();
    const before = harness.graph();

    const result = await runTransaction(
      [buildAddWallCommand(), buildThinNewWallCommand(), buildRemoveMissingRoomCommand()],
      harness.deps,
    );

    if (result.ok) {
      throw new Error('Giao dịch hỏng mà vẫn chạy.');
    }

    expect(result.error.stage).toBe('validate');
    expect(result.error.reasons).toHaveLength(1);
    expect(result.error.reasons[0]).toContain(`đối tượng ${MISSING_ROOM_ID} không còn trong bản vẽ.`);
    expect(harness.log).toEqual([]);
    expect(harness.entries).toEqual([]);
    expect(harness.queued).toEqual([]);
    expect(harness.graph()).toBe(before);
  });

  it('puts the first two commands back when the third fails on the way into the store', async () => {
    const harness = createHarness({ failOnApplyCall: 3 });
    const before = createGraph();

    const result = await runTransaction(
      [buildAddWallCommand(), buildThinNewWallCommand(), buildRemoveRoomCommand()],
      harness.deps,
    );

    if (result.ok) {
      throw new Error('Giao dịch hỏng mà vẫn chạy.');
    }

    expect(result.error.stage).toBe('apply');
    expect(result.error.reasons).toEqual(['Kho dữ liệu từ chối ghi.']);
    expect(result.error.rolledBack).toBe(true);
    expect(result.error.rollbackIssues).toEqual([]);
    expect(harness.graph()).toEqual(before);
    expect(harness.entries).toEqual([]);
    expect(harness.queued).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* No step swallows its error.                                                 */
/* -------------------------------------------------------------------------- */

describe('dispatch: lỗi giữa đường ống', () => {
  it('rolls the store back and drops the undo entry when the queue refuses', async () => {
    const syncError = new Error('Hàng đợi đồng bộ đã đầy.');
    const harness = createHarness({ syncError });
    const before = createGraph();

    const result = await dispatch(buildThickenWallCommand(), harness.deps);

    if (result.ok) {
      throw new Error('Lệnh hỏng mà vẫn báo thành công.');
    }

    expect(result.error.stage).toBe('sync');
    expect(result.error.cause).toBe(syncError);
    expect(result.error.reasons).toEqual(['Hàng đợi đồng bộ đã đầy.']);
    expect(result.error.rolledBack).toBe(true);
    expect(harness.graph()).toEqual(before);
    expect(harness.entries).toEqual([]);
    expect(harness.queued).toEqual([]);
  });

  it('rolls the store back when the undo stack refuses the entry', async () => {
    const historyError = new Error('Ngăn xếp hoàn tác đã khoá.');
    const harness = createHarness({ historyError });
    const before = createGraph();

    const result = await dispatch(buildThickenWallCommand(), harness.deps);

    if (result.ok) {
      throw new Error('Lệnh hỏng mà vẫn báo thành công.');
    }

    expect(result.error.stage).toBe('history');
    expect(result.error.cause).toBe(historyError);
    expect(result.error.rolledBack).toBe(true);
    expect(harness.graph()).toEqual(before);
    // Neither the rule pass nor the queue is reached; the trailing apply is the
    // pipeline putting the drawing back.
    expect(harness.log).toEqual(['apply', 'history', 'apply']);
    expect(harness.queued).toEqual([]);
  });

  it('reports rather than hides an error met while rolling back', async () => {
    const syncError = new Error('Hàng đợi đồng bộ đã đầy.');
    const rollbackError = new Error('Kho dữ liệu đã đóng.');
    const harness = createHarness({ syncError });
    const brittleDeps: DispatchDeps = {
      ...harness.deps,
      spatial: {
        read: harness.deps.spatial.read,
        applyPatches: (patches) => {
          if (harness.log.includes('sync')) {
            throw rollbackError;
          }

          harness.deps.spatial.applyPatches(patches);
        },
      },
    };

    const result = await dispatch(buildThickenWallCommand(), brittleDeps);

    if (result.ok) {
      throw new Error('Lệnh hỏng mà vẫn báo thành công.');
    }

    expect(result.error.stage).toBe('sync');
    expect(result.error.cause).toBe(syncError);
    expect(result.error.rolledBack).toBe(false);
    expect(result.error.rollbackIssues).toEqual([
      {
        stage: 'apply',
        message: 'Không trả được bản vẽ về trạng thái trước lệnh: Kho dữ liệu đã đóng.',
        cause: rollbackError,
      },
    ]);
  });
});
