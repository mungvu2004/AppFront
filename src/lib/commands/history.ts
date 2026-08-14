/**
 * The undo stack, as a drafting tool rather than a text field.
 *
 * The expectation this is built against is AutoCAD's: Ctrl+Z takes back one
 * thing the user decided, not one thing the program did, and the drawing that
 * comes back is the drawing that was there — **including what was selected**.
 * A wall that returns with nothing highlighted has not really come back; the
 * next Ctrl+Z would then act on a different selection than the one the user was
 * looking at when they made the mistake. So a step records the selection on
 * both sides and hands it back on the way through.
 *
 * Four rules make the stack behave the way a drafter expects:
 *
 * - **Two directions.** Undone steps move to the redo side and come back
 *   unchanged; `redoPatches` are the command's own patches, `undoPatches` the
 *   inverted ones the pipeline already computed.
 * - **A hundred steps.** Past `MAX_HISTORY_STEPS` the oldest step falls off the
 *   bottom, the same depth the store keeps.
 * - **A new command cuts the redo branch.** Editing after undoing abandons what
 *   was undone; there is no tree, and no way to end up somewhere that was never
 *   drawn.
 * - **A run folds into one step.** Consecutive edits of the same type on the
 *   same entity within `MERGE_WINDOW_MS` become a single step, so a drag is one
 *   Ctrl+Z (see `./mergeCommands`).
 *
 * The stack is plain data and closures: no store, no React, no clock of its
 * own. It reads the time from the commands themselves, which is both testable
 * and more accurate than reading a clock at push time.
 */

import type { SpatialPatch } from '@/domain/spatial/applyPatch';
import type { EntityKind } from '@/domain/spatial/ids';
import type { EntityId } from '@/domain/spatial/types';

import type { UndoEntry, UndoEntryId } from './dispatch';
import { commandToPatches, invertCommand } from './invert';
import { canMergeCommands, mergeCommands, MERGE_WINDOW_MS } from './mergeCommands';
import type { Command, CommandScope } from './types';

/** How many steps the stack keeps before the oldest falls off. */
export const MAX_HISTORY_STEPS = 100;

/**
 * What was selected at one point in time.
 *
 * Only the selection itself: what is under the pointer is where the mouse
 * happens to be now, not part of what the user did, and putting a hover back
 * would make the drawing flicker on undo.
 */
export interface SelectionSnapshot {
  /** Ids selected, in selection order. */
  readonly selectedIds: readonly EntityId[];
}

/** The empty selection, for a step taken with nothing picked. */
export const NO_SELECTION: SelectionSnapshot = { selectedIds: [] };

export type HistoryDirection = 'undo' | 'redo';

/** One entry on the history screen, and one press of Ctrl+Z. */
export interface HistoryStep {
  /** The id the step started life with; a folded run keeps its first one. */
  readonly id: UndoEntryId;
  /** Vietnamese label for the history screen, e.g. `Kéo tường W-000014AAAA`. */
  readonly label: string;
  readonly commands: readonly Command[];
  /** Applied to go back one step. */
  readonly undoPatches: readonly SpatialPatch[];
  /** Applied to come forward again. */
  readonly redoPatches: readonly SpatialPatch[];
  /** What was selected before the step; restored on undo. */
  readonly selectionBefore: SelectionSnapshot;
  /** What was selected after it; restored on redo. */
  readonly selectionAfter: SelectionSnapshot;
  /** When the step last moved, as an ISO 8601 string. */
  readonly timestamp: string;
  /** Every entry folded into the step, oldest first; more than one is a run. */
  readonly entryIds: readonly UndoEntryId[];
}

/** What the store adapter hands over once the pipeline has published an entry. */
export interface HistoryPushInput {
  readonly entry: UndoEntry;
  /** The selection as it stood before the command was applied. */
  readonly selectionBefore: SelectionSnapshot;
  /** The selection as it stands now. */
  readonly selectionAfter: SelectionSnapshot;
}

/** Everything the caller has to do to move one step. */
export interface HistoryTransition {
  readonly direction: HistoryDirection;
  readonly step: HistoryStep;
  /** Apply these to the graph. */
  readonly patches: readonly SpatialPatch[];
  /** Then restore this selection. */
  readonly selection: SelectionSnapshot;
}

export interface HistoryStack {
  /**
   * Records a step, or folds it into the run in progress.
   *
   * Returns the step as it now stands — the same object the history screen
   * lists, which for a folded run is the whole run, not the last edit.
   */
  push: (input: HistoryPushInput) => HistoryStep;
  /** The next step back, or `null` when there is nothing left to undo. */
  undo: () => HistoryTransition | null;
  /** The next step forward, or `null` when the redo branch is empty. */
  redo: () => HistoryTransition | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  /** Steps that can be undone, oldest first — the history screen's order. */
  undoSteps: () => readonly HistoryStep[];
  /** Steps that can be redone, next one first. */
  redoSteps: () => readonly HistoryStep[];
  /**
   * Takes an entry back off the top, for a pipeline step that failed after the
   * push. Un-folds a run rather than dropping the whole thing.
   *
   * Returns whether anything was removed: only the newest entry can be taken
   * back, which is the only case the pipeline produces.
   */
  drop: (entryId: UndoEntryId) => boolean;
  /** Forgets everything, e.g. on opening another drawing. */
  clear: () => void;
}

/* -------------------------------------------------------------------------- */
/* Labels.                                                                     */
/* -------------------------------------------------------------------------- */

/** What each action verb is called, keyed by the last segment of a command type. */
const ACTION_LABELS: Readonly<Record<string, string>> = {
  add: 'Thêm',
  remove: 'Xoá',
  move: 'Kéo',
  resize: 'Đổi kích thước',
  rotate: 'Xoay',
  rename: 'Đổi tên',
  split: 'Tách',
  merge: 'Gộp',
  join: 'Nối',
  review: 'Duyệt',
  update: 'Sửa',
};

/** What each kind of entity is called, in the vocabulary the rule book uses. */
const KIND_LABELS: Readonly<Record<EntityKind, string>> = {
  level: 'tầng',
  wall: 'tường',
  opening: 'lỗ mở',
  furniture: 'đồ đạc',
  room: 'phòng',
  axis: 'trục',
  dimension: 'kích thước',
};

/**
 * What the action was done to: one entity by code, several of a kind by count.
 *
 * Vietnamese does not inflect for number, so the count reads straight onto the
 * kind: `3 đồ đạc`. Mixed kinds have no shared noun and fall back to `đối tượng`.
 */
const describeTarget = (scope: CommandScope): string | null => {
  const firstId = scope.entityIds[0];
  const firstKind = scope.kinds[0];

  if (firstId === undefined || firstKind === undefined) {
    return null;
  }

  if (scope.kinds.length > 1) {
    return `${scope.entityIds.length} đối tượng`;
  }

  return scope.entityIds.length === 1
    ? `${KIND_LABELS[firstKind]} ${firstId}`
    : `${scope.entityIds.length} ${KIND_LABELS[firstKind]}`;
};

/**
 * The Vietnamese label the history screen shows for a step.
 *
 * Built from the command's own type and scope — `Kéo tường W-000014AAAA`,
 * `Xoá 3 đồ đạc` — so a new command type gets a readable label without anybody
 * writing one. An unknown verb, or a step holding several commands, has no
 * single action to name and falls back to the description the command already
 * carries, which is Vietnamese by contract.
 */
export function buildHistoryLabel(commands: readonly Command[], fallback: string): string {
  const only = commands.length === 1 ? commands[0] : undefined;

  if (only === undefined) {
    return fallback;
  }

  const action = ACTION_LABELS[only.type.split('.').pop() ?? ''];
  const target = action === undefined ? null : describeTarget(only.scope);

  return target === null ? fallback : `${action} ${target}`;
}

/* -------------------------------------------------------------------------- */
/* The stack.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A step plus the version it replaced when the newest entry folded into it.
 *
 * Kept so `drop` can un-fold: taking back an edit that merged into a run has to
 * restore the run as it was, not remove the run.
 */
interface StackRecord {
  readonly step: HistoryStep;
  readonly replaced: StackRecord | null;
}

const redoPatchesOf = (commands: readonly Command[]): SpatialPatch[] =>
  commands.flatMap((command) => commandToPatches(command));

/** The lone command of a step, or `null` when the step is a transaction. */
const soleCommand = (commands: readonly Command[]): Command | null =>
  commands.length === 1 ? (commands[0] ?? null) : null;

const stepFromEntry = (input: HistoryPushInput): HistoryStep => ({
  id: input.entry.id,
  label: buildHistoryLabel(input.entry.commands, input.entry.label),
  commands: input.entry.commands,
  // The pipeline already inverted the commands; only the forward direction is
  // left to work out.
  undoPatches: input.entry.undoPatches,
  redoPatches: redoPatchesOf(input.entry.commands),
  selectionBefore: input.selectionBefore,
  selectionAfter: input.selectionAfter,
  timestamp: input.entry.timestamp,
  entryIds: [input.entry.id],
});

const foldIntoStep = (step: HistoryStep, input: HistoryPushInput, folded: Command): HistoryStep => ({
  id: step.id,
  label: buildHistoryLabel([folded], input.entry.label),
  commands: [folded],
  undoPatches: commandToPatches(invertCommand(folded)),
  redoPatches: commandToPatches(folded),
  // Where the run started, and where it now stands.
  selectionBefore: step.selectionBefore,
  selectionAfter: input.selectionAfter,
  timestamp: input.entry.timestamp,
  entryIds: [...step.entryIds, input.entry.id],
});

export interface CreateHistoryStackOptions {
  /** How many steps to keep; `MAX_HISTORY_STEPS` when left out. */
  readonly limit?: number;
  /** How long a run stays open for folding; `MERGE_WINDOW_MS` when left out. */
  readonly mergeWindowMs?: number;
}

/**
 * A fresh, empty undo stack.
 *
 * Stacks are instances rather than one global: a second drawing gets its own
 * history, and a test gets one nobody else has pushed to.
 */
export function createHistoryStack(options: CreateHistoryStackOptions = {}): HistoryStack {
  const limit = options.limit ?? MAX_HISTORY_STEPS;
  const mergeWindowMs = options.mergeWindowMs ?? MERGE_WINDOW_MS;

  let undoRecords: StackRecord[] = [];
  let redoRecords: StackRecord[] = [];

  /**
   * The command this push would fold into, or `null` to start a new step.
   *
   * A transaction never folds, in either direction: the user asked for those
   * commands to move as one unit, and quietly attaching the next edit to it
   * would make one Ctrl+Z take back more than they grouped.
   */
  const runInProgress = (input: HistoryPushInput): { open: Command; next: Command } | null => {
    const top = undoRecords[undoRecords.length - 1];

    if (top === undefined) {
      return null;
    }

    const open = soleCommand(top.step.commands);
    const next = soleCommand(input.entry.commands);

    if (open === null || next === null || !canMergeCommands(open, next, mergeWindowMs)) {
      return null;
    }

    return { open, next };
  };

  return {
    push: (input) => {
      // Drawing after undoing abandons what was undone; there is no branch to
      // come back to, which is what keeps the stack a line rather than a tree.
      redoRecords = [];

      const run = runInProgress(input);
      const topIndex = undoRecords.length - 1;
      const top = undoRecords[topIndex];

      if (run !== null && top !== undefined) {
        const step = foldIntoStep(top.step, input, mergeCommands(run.open, run.next));

        undoRecords[topIndex] = { step, replaced: top };

        return step;
      }

      const step = stepFromEntry(input);

      undoRecords.push({ step, replaced: null });

      while (undoRecords.length > limit) {
        undoRecords.shift();
      }

      return step;
    },

    undo: () => {
      const record = undoRecords.pop();

      if (record === undefined) {
        return null;
      }

      redoRecords.push(record);

      return {
        direction: 'undo',
        step: record.step,
        patches: record.step.undoPatches,
        selection: record.step.selectionBefore,
      };
    },

    redo: () => {
      const record = redoRecords.pop();

      if (record === undefined) {
        return null;
      }

      undoRecords.push(record);

      return {
        direction: 'redo',
        step: record.step,
        patches: record.step.redoPatches,
        selection: record.step.selectionAfter,
      };
    },

    canUndo: () => undoRecords.length > 0,
    canRedo: () => redoRecords.length > 0,
    undoSteps: () => undoRecords.map((record) => record.step),
    redoSteps: () => [...redoRecords].reverse().map((record) => record.step),

    drop: (entryId) => {
      const topIndex = undoRecords.length - 1;
      const top = undoRecords[topIndex];

      if (top === undefined || top.step.entryIds[top.step.entryIds.length - 1] !== entryId) {
        return false;
      }

      if (top.replaced === null) {
        undoRecords.pop();
      } else {
        undoRecords[topIndex] = top.replaced;
      }

      return true;
    },

    clear: () => {
      undoRecords = [];
      redoRecords = [];
    },
  };
}
