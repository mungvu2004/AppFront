/**
 * The one road every data change travels.
 *
 * A command that reaches the model has been through five steps, always these
 * five and always in this order:
 *
 * 1. `validate` — is the command well formed, and does the drawing still hold
 *    what it claims to change? A command that fails here is stopped **before**
 *    anything is written: the store is never touched, and the caller gets the
 *    reasons back in Vietnamese.
 * 2. `apply`    — the command's patches go into the spatial store. This module
 *    is the only writer; nothing else patches the graph.
 * 3. `history`  — one undo entry, carrying the patches that undo the whole
 *    thing, is pushed onto the undo stack.
 * 4. `rules`    — only the rules the change made stale are run again, over the
 *    graph as it now is.
 * 5. `sync`     — the batch is queued for the server.
 *
 * **Nothing is swallowed.** A step that throws stops the pipeline, everything
 * the earlier steps did is undone, and the failure comes back naming the step,
 * the Vietnamese reason and the original `cause` — including any error met
 * while undoing, which is reported rather than hidden.
 *
 * The store, the undo stack, the rule state and the sync queue arrive as ports
 * (`DispatchDeps`) rather than as imports: `src/lib` may not import
 * `src/store`, and injecting them is also what lets the whole pipeline be
 * tested without a store. The application shell wires the ports once, and the
 * spatial slice's patch gateway is reachable from nowhere else.
 *
 * One command goes through `dispatch`; a group that must succeed or fail
 * together goes through `runTransaction` (see `./transaction`). Both hold the
 * same lock, so two edits never interleave between applying and queueing.
 */

import type { RuleRegistry } from '@/domain/rules/registry';
import {
  EMPTY_RUN_STATE,
  runRules,
  type ChangedEntity,
  type RuleRunResult,
  type RuleRunState,
} from '@/domain/rules/runner';
import type { SpatialPatch } from '@/domain/spatial/applyPatch';
import { ID_PREFIX_BY_KIND, isIdOfKind, type EntityKind } from '@/domain/spatial/ids';
import {
  isEntityOfKind,
  resolveLevelId,
  type NormalizedSpatial,
  type SpatialEntity,
} from '@/domain/spatial/normalize';
import type { LevelId } from '@/domain/spatial/types';
import { createUuid } from '@/lib/http/ids';
import { err, ok, type MaybePromise, type Result } from '@/lib/http/types';
import { runExclusive } from '@/lib/mutations/entityQueue';

import { commandToPatches, invertCommand } from './invert';
import type { Command } from './types';

/* -------------------------------------------------------------------------- */
/* The five steps.                                                             */
/* -------------------------------------------------------------------------- */

/** One step of the pipeline. */
export type DispatchStage = 'validate' | 'apply' | 'history' | 'rules' | 'sync';

/**
 * The steps, in the only order they ever run in.
 *
 * Exported so callers and tests read the order from the pipeline itself rather
 * than restating it.
 */
export const DISPATCH_STAGES = [
  'validate',
  'apply',
  'history',
  'rules',
  'sync',
] as const satisfies readonly DispatchStage[];

/** What the interface calls each step. */
export const DISPATCH_STAGE_LABELS: Readonly<Record<DispatchStage, string>> = {
  validate: 'kiểm hợp lệ',
  apply: 'áp vào dữ liệu',
  history: 'đẩy vào ngăn xếp hoàn tác',
  rules: 'chạy lại luật liên quan',
  sync: 'xếp hàng đồng bộ',
};

/* -------------------------------------------------------------------------- */
/* Ports.                                                                      */
/* -------------------------------------------------------------------------- */

/** Undo entry id, prefixed with `U-`. */
export type UndoEntryId = `U-${string}`;

/** One or more commands that land, undo and sync as a single unit. */
export interface DispatchBatch {
  readonly id: UndoEntryId;
  /** Vietnamese label for the undo toast, e.g. `Xoá tường`. */
  readonly label: string;
  /** Applied in array order. */
  readonly commands: readonly Command[];
  /** Creation time as an ISO 8601 string. */
  readonly timestamp: string;
}

/**
 * What the undo stack is given: the batch plus the patches that undo it.
 *
 * The patches are computed once, here, from the commands' own snapshots, so the
 * undo stack stores plain data and never has to re-derive an inverse.
 */
export interface UndoEntry extends DispatchBatch {
  readonly undoPatches: readonly SpatialPatch[];
}

/**
 * The spatial store, as this pipeline needs it.
 *
 * `applyPatches` is the only write this layer performs, and the adapter that
 * implements it is meant to be the only caller of the spatial slice's patch
 * gateway in the whole application; every other layer reads.
 */
export interface SpatialPort {
  /** The graph as it is now; `null` before a floor has been loaded. */
  read: () => NormalizedSpatial | null;
  /** Applies patches in order, as one step. */
  applyPatches: (patches: readonly SpatialPatch[]) => void;
}

/** The undo stack. */
export interface HistoryPort {
  push: (entry: UndoEntry) => void;
  /** Removes an entry again when a later step fails. Unknown ids are ignored. */
  drop: (entryId: UndoEntryId) => void;
}

/**
 * The rule pass.
 *
 * Split in two so the pipeline can tell a pass that failed from a pass whose
 * result was published: `run` computes, `write` publishes the violations and
 * keeps the state for the next pass.
 */
export interface RulesPort {
  run: (graph: NormalizedSpatial, changes: readonly ChangedEntity[]) => RuleRunResult;
  write: (result: RuleRunResult) => void;
}

/** The outbound queue. */
export interface SyncPort {
  enqueue: (batch: DispatchBatch) => MaybePromise<void>;
}

/** Everything the pipeline talks to. */
export interface DispatchDeps {
  readonly spatial: SpatialPort;
  readonly history: HistoryPort;
  readonly rules: RulesPort;
  readonly sync: SyncPort;
  /** Clock for the batch timestamp; the wall clock when left out. */
  readonly now?: () => string;
}

/* -------------------------------------------------------------------------- */
/* Results.                                                                    */
/* -------------------------------------------------------------------------- */

/** Something that went wrong while undoing a partly-done pipeline. */
export interface RollbackIssue {
  readonly stage: DispatchStage;
  /** Vietnamese sentence. */
  readonly message: string;
  readonly cause: unknown;
}

export interface DispatchFailure {
  /** The step that stopped the pipeline. */
  readonly stage: DispatchStage;
  /** Vietnamese sentence saying what did not happen. */
  readonly message: string;
  /** Vietnamese sentences, one per problem found. Never empty. */
  readonly reasons: readonly string[];
  /** The error the step threw; `null` when the step reported rather than threw. */
  readonly cause: unknown;
  /** Is the graph back to what it was before the pipeline started? */
  readonly rolledBack: boolean;
  /** Errors met while undoing. Reported, never hidden. */
  readonly rollbackIssues: readonly RollbackIssue[];
}

export interface DispatchSuccess {
  /** The entry pushed onto the undo stack; one entry per call. */
  readonly entry: UndoEntry;
  /** What the rule pass found on the graph as it now is. */
  readonly rules: RuleRunResult;
}

export type DispatchResult = Result<DispatchSuccess, DispatchFailure>;

/* -------------------------------------------------------------------------- */
/* Step 1 — validation.                                                        */
/* -------------------------------------------------------------------------- */

const KNOWN_KINDS: ReadonlySet<string> = new Set(Object.keys(ID_PREFIX_BY_KIND));

const isFilled = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

/**
 * Everything wrong with a batch of commands, in Vietnamese; empty when the
 * batch may be applied.
 *
 * Commands are checked in the order they would run, against a projection of
 * what the drawing will hold at that point, so a command may legitimately build
 * on what an earlier command in the same batch created or removed.
 *
 * Reads only. Nothing here touches the store — that is the whole point of the
 * step being first.
 */
export function validateCommands(commands: readonly Command[], graph: NormalizedSpatial): string[] {
  const reasons: string[] = [];

  if (commands.length === 0) {
    reasons.push('Không có lệnh nào để chạy.');

    return reasons;
  }

  // `null` means "removed by an earlier command in this batch"; a missing key
  // means "nothing staged, ask the graph".
  const staged = new Map<string, SpatialEntity | null>();

  const lookup = (entityId: string): SpatialEntity | null => {
    const pending = staged.get(entityId);

    return pending === undefined ? (graph.byId[entityId] ?? null) : pending;
  };

  for (const command of commands) {
    const code = isFilled(command.id) ? command.id : '(không mã)';
    const rejectCommand = (text: string): void => {
      reasons.push(`Lệnh ${code}: ${text}`);
    };

    if (!isFilled(command.id) || !command.id.startsWith('C-')) {
      rejectCommand('mã lệnh phải bắt đầu bằng "C-".');
    }

    if (!isFilled(command.type)) {
      rejectCommand('thiếu loại lệnh.');
    }

    if (!isFilled(command.actorId)) {
      rejectCommand('thiếu người thực hiện.');
    }

    if (!isFilled(command.description)) {
      rejectCommand('thiếu mô tả để hiện trên nhật ký và nút hoàn tác.');
    }

    if (!isFilled(command.timestamp) || Number.isNaN(Date.parse(command.timestamp))) {
      rejectCommand('thời điểm không đọc được.');
    }

    if (!Array.isArray(command.changes) || command.changes.length === 0) {
      rejectCommand('không có thay đổi nào để áp.');

      continue;
    }

    const scopeEntityIds = new Set<string>(command.scope?.entityIds ?? []);
    const scopeKinds = new Set<string>(command.scope?.kinds ?? []);

    for (const [index, change] of command.changes.entries()) {
      const rejectChange = (text: string): void => {
        reasons.push(`Lệnh ${code}, thay đổi ${index + 1}: ${text}`);
      };

      if (!KNOWN_KINDS.has(change.kind)) {
        rejectChange(`loại đối tượng "${change.kind}" không có trong hệ thống.`);

        continue;
      }

      if (!isIdOfKind(change.kind, change.id)) {
        rejectChange(`mã ${change.id} không phải mã hợp lệ của loại ${change.kind}.`);

        continue;
      }

      if (change.before === null && change.after === null) {
        rejectChange('không có ảnh chụp nào nên không thể hoàn tác.');

        continue;
      }

      for (const snapshot of [change.before, change.after]) {
        if (snapshot !== null && snapshot.id !== change.id) {
          rejectChange(`ảnh chụp mang mã ${snapshot.id}, khác mã ${change.id} của thay đổi.`);
        }
      }

      // The scope routes undo, sync and cache invalidation, so a scope that
      // does not cover the changes would quietly misroute all three.
      if (!scopeEntityIds.has(change.id) || !scopeKinds.has(change.kind)) {
        rejectChange(`phạm vi ảnh hưởng của lệnh bỏ sót đối tượng ${change.id}.`);
      }

      const existing = lookup(change.id);

      if (change.before === null && existing !== null) {
        rejectChange(`đối tượng ${change.id} đã có trong bản vẽ nên không tạo mới được.`);
      }

      if (change.before !== null && existing === null) {
        rejectChange(`đối tượng ${change.id} không còn trong bản vẽ.`);
      }

      if (existing !== null && !isEntityOfKind(change.kind, existing)) {
        rejectChange(`đối tượng ${change.id} trong bản vẽ không phải loại ${change.kind}.`);
      }

      staged.set(change.id, change.after);
    }
  }

  return reasons;
}

/** Everything wrong with one command, in Vietnamese; empty when it may be applied. */
export function validateCommand(command: Command, graph: NormalizedSpatial): string[] {
  return validateCommands([command], graph);
}

/* -------------------------------------------------------------------------- */
/* Step 4 — working out what the change made stale.                            */
/* -------------------------------------------------------------------------- */

/**
 * The level a snapshot sits on.
 *
 * A level is not "on" a level, but editing one makes its own floor stale, so it
 * reports itself. An opening carries no level of its own and is resolved
 * through its wall, which is why the graph is needed and why the snapshot has
 * to be read against the graph it belongs to.
 */
const levelOfSnapshot = (snapshot: SpatialEntity, graph: NormalizedSpatial): LevelId | null =>
  isEntityOfKind('level', snapshot) ? snapshot.id : resolveLevelId(snapshot, graph.byId);

/**
 * What the batch changed, in the shape the rule runner re-runs from.
 *
 * The `before` snapshot is read against the graph as it was and the `after`
 * snapshot against the graph as it is, so an entity moved between levels is
 * reported twice — once for the floor it left, once for the floor it joined —
 * and both floors are re-checked. A deletion still reports its kind and level,
 * which the graph can no longer supply.
 */
function changedEntitiesOf(
  commands: readonly Command[],
  before: NormalizedSpatial,
  after: NormalizedSpatial,
): ChangedEntity[] {
  const seen = new Set<string>();
  const changed: ChangedEntity[] = [];

  const remember = (entityId: string, kind: EntityKind, levelId: LevelId | null): void => {
    const key = `${entityId} ${kind} ${levelId ?? ''}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    // An unresolved level re-runs the rule on every floor, which is slower than
    // needed but never misses a violation.
    changed.push(levelId === null ? { entityId, kind } : { entityId, kind, levelId });
  };

  for (const command of commands) {
    for (const change of command.changes) {
      if (change.before !== null) {
        remember(change.id, change.kind, levelOfSnapshot(change.before, before));
      }

      if (change.after !== null) {
        remember(change.id, change.kind, levelOfSnapshot(change.after, after));
      }
    }
  }

  return changed;
}

export interface IncrementalRuleRunnerOptions {
  /** The rule book to run; the shared one when left out. */
  readonly registry?: RuleRegistry;
  /** Called with every published pass, e.g. to put the violations in the store. */
  readonly onResult?: (result: RuleRunResult) => void;
}

/**
 * The standard rules port: `runRules`, with the previous pass's state kept
 * between calls so each dispatch re-runs only the rules its change made stale.
 *
 * The state advances on `write`, never on `run`, so a pass that is thrown away
 * because a later step failed does not poison the next one.
 */
export function createIncrementalRuleRunner(options: IncrementalRuleRunnerOptions = {}): RulesPort {
  let state: RuleRunState = EMPTY_RUN_STATE;

  return {
    run: (graph, changes) =>
      options.registry === undefined
        ? runRules(graph, { previous: state, changes })
        : runRules(graph, { registry: options.registry, previous: state, changes }),
    write: (result) => {
      state = result.state;
      options.onResult?.(result);
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Running the pipeline.                                                       */
/* -------------------------------------------------------------------------- */

type Attempt<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly cause: unknown };

const attempt = <T>(action: () => T): Attempt<T> => {
  try {
    return { ok: true, value: action() };
  } catch (cause) {
    return { ok: false, cause };
  }
};

const attemptAsync = async <T>(action: () => MaybePromise<T>): Promise<Attempt<T>> => {
  try {
    return { ok: true, value: await action() };
  } catch (cause) {
    return { ok: false, cause };
  }
};

const describeCause = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

/** The patches that undo a run of commands: each inverted, in reverse order. */
const undoPatchesOf = (commands: readonly Command[]): SpatialPatch[] =>
  [...commands].reverse().flatMap((command) => commandToPatches(invertCommand(command)));

const createUndoEntryId = (): UndoEntryId => `U-${createUuid().toUpperCase()}`;

/** What `dispatch` and `runTransaction` both hand to the pipeline. */
export interface PipelineInput {
  readonly commands: readonly Command[];
  /** Vietnamese label of the single undo entry the batch produces. */
  readonly label: string;
}

/**
 * The five steps, run once, in order.
 *
 * Internal to the command layer: it holds no lock, so calling it from anywhere
 * but `dispatch` or `runTransaction` would let two edits interleave between
 * applying and queueing.
 */
export async function runCommandPipeline(input: PipelineInput, deps: DispatchDeps): Promise<DispatchResult> {
  const now = deps.now ?? ((): string => new Date().toISOString());

  /** Commands handed to the store, whether or not the store finished with them. */
  const applied: Command[] = [];
  let pushedEntry: UndoEntry | null = null;
  let rulesPublished = false;
  let staleEntities: readonly ChangedEntity[] = [];

  /**
   * Puts back everything the finished steps did, worst case included.
   *
   * Undoing a command the store never finished applying is a no-op — an inverse
   * that removes what is not there, or restores what was never changed, is
   * skipped by `applyPatch` — so it is safer to undo one command too many than
   * one too few.
   */
  const rollback = (): { rolledBack: boolean; issues: RollbackIssue[] } => {
    const issues: RollbackIssue[] = [];
    let rolledBack = true;

    if (applied.length > 0) {
      const reverted = attempt(() => {
        deps.spatial.applyPatches(undoPatchesOf(applied));
      });

      if (!reverted.ok) {
        rolledBack = false;
        issues.push({
          stage: 'apply',
          // The cause carries its own punctuation, as it does in `reasons`.
          message: `Không trả được bản vẽ về trạng thái trước lệnh: ${describeCause(reverted.cause)}`,
          cause: reverted.cause,
        });
      }
    }

    const entry = pushedEntry;

    if (entry !== null) {
      const dropped = attempt(() => {
        deps.history.drop(entry.id);
      });

      if (!dropped.ok) {
        issues.push({
          stage: 'history',
          message: `Không gỡ được mục hoàn tác ${entry.id} vừa đẩy vào: ${describeCause(dropped.cause)}`,
          cause: dropped.cause,
        });
      }
    }

    // Violations computed for a graph that no longer exists would be worse than
    // none, so a published pass is recomputed against the restored graph.
    if (rulesPublished && rolledBack) {
      const restored = deps.spatial.read();

      if (restored !== null) {
        const rerun = attempt(() => {
          deps.rules.write(deps.rules.run(restored, staleEntities));
        });

        if (!rerun.ok) {
          issues.push({
            stage: 'rules',
            message: `Không chạy lại được luật sau khi hoàn tác: ${describeCause(rerun.cause)}`,
            cause: rerun.cause,
          });
        }
      }
    }

    return { rolledBack, issues };
  };

  const fail = (stage: DispatchStage, message: string, reasons: readonly string[], cause: unknown): DispatchResult => {
    const undone = rollback();

    return err({
      stage,
      message,
      reasons,
      cause,
      rolledBack: undone.rolledBack,
      rollbackIssues: undone.issues,
    });
  };

  /* -- Step 1: kiểm hợp lệ. Nothing below this line has run yet. ------------ */

  const graphBefore = attempt(() => deps.spatial.read());

  if (!graphBefore.ok) {
    return fail(
      'validate',
      'Không đọc được bản vẽ nên chưa kiểm được lệnh.',
      [describeCause(graphBefore.cause)],
      graphBefore.cause,
    );
  }

  const before = graphBefore.value;

  if (before === null) {
    return fail('validate', 'Lệnh bị chặn ở bước kiểm hợp lệ.', ['Chưa tải xong bản vẽ nên chưa áp được lệnh nào.'], null);
  }

  const reasons = validateCommands(input.commands, before);

  if (reasons.length > 0) {
    return fail('validate', 'Lệnh không hợp lệ nên đã bị chặn trước khi chạm vào dữ liệu.', reasons, null);
  }

  /* -- Step 2: áp vào store. -------------------------------------------------- */

  for (const command of input.commands) {
    // Recorded before the call, so a store that fails half-way through is still
    // rolled back.
    applied.push(command);

    const patched = attempt(() => {
      deps.spatial.applyPatches(commandToPatches(command));
    });

    if (!patched.ok) {
      return fail(
        'apply',
        `Không áp được lệnh ${command.id} vào bản vẽ.`,
        [describeCause(patched.cause)],
        patched.cause,
      );
    }
  }

  /* -- Step 3: đẩy vào ngăn xếp hoàn tác. ------------------------------------ */

  const batch: DispatchBatch = {
    id: createUndoEntryId(),
    label: input.label,
    commands: [...input.commands],
    timestamp: now(),
  };
  const entry: UndoEntry = { ...batch, undoPatches: undoPatchesOf(input.commands) };

  pushedEntry = entry;

  const pushed = attempt(() => {
    deps.history.push(entry);
  });

  if (!pushed.ok) {
    return fail(
      'history',
      `Không đẩy được "${input.label}" vào ngăn xếp hoàn tác.`,
      [describeCause(pushed.cause)],
      pushed.cause,
    );
  }

  /* -- Step 4: chạy lại luật liên quan. -------------------------------------- */

  const graphAfter = attempt(() => deps.spatial.read());

  if (!graphAfter.ok) {
    return fail(
      'rules',
      'Không đọc lại được bản vẽ để chạy luật.',
      [describeCause(graphAfter.cause)],
      graphAfter.cause,
    );
  }

  const after = graphAfter.value;

  if (after === null) {
    return fail('rules', 'Không chạy lại được luật.', ['Bản vẽ biến mất ngay sau khi áp lệnh.'], null);
  }

  staleEntities = changedEntitiesOf(input.commands, before, after);

  const ruleRun = attempt(() => deps.rules.run(after, staleEntities));

  if (!ruleRun.ok) {
    return fail('rules', 'Không chạy lại được luật liên quan.', [describeCause(ruleRun.cause)], ruleRun.cause);
  }

  rulesPublished = true;

  const published = attempt(() => {
    deps.rules.write(ruleRun.value);
  });

  if (!published.ok) {
    return fail(
      'rules',
      'Không ghi lại được kết quả soát luật.',
      [describeCause(published.cause)],
      published.cause,
    );
  }

  /* -- Step 5: xếp hàng đồng bộ. --------------------------------------------- */

  const queued = await attemptAsync(() => deps.sync.enqueue(batch));

  if (!queued.ok) {
    return fail(
      'sync',
      `Không xếp được "${input.label}" vào hàng đợi đồng bộ.`,
      [describeCause(queued.cause)],
      queued.cause,
    );
  }

  return ok({ entry, rules: ruleRun.value });
}

/**
 * The lock the whole pipeline runs under.
 *
 * One key for the whole spatial graph, so two edits never interleave between
 * applying and queueing however many entities they touch.
 */
export const SPATIAL_PIPELINE_KEY = 'spatial-command-pipeline';

/**
 * Runs one command through the five steps.
 *
 * Never rejects: a step that fails comes back as `{ ok: false, error }` with
 * the step named, the Vietnamese reasons, and the original `cause`.
 */
export function dispatch(command: Command, deps: DispatchDeps): Promise<DispatchResult> {
  return runExclusive(SPATIAL_PIPELINE_KEY, () =>
    runCommandPipeline({ commands: [command], label: command.description }, deps),
  );
}
