import { useStore } from './index';
import type { RootState } from './index';
import { MERGE_WINDOW_MS } from '../lib/commands/mergeCommands';
import type { SpatialPatch } from '../domain/spatial/applyPatch';

export interface CommitResult {
  undo: () => void;
  label: string;
  timestamp: number;
}

/* -------------------------------------------------------------------------- */
/* One drag, one undo step.                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The two undo stacks used to disagree, and the user felt it.
 *
 * `MERGE_WINDOW_MS` (= `COALESCE_WINDOW_MS`) folds a run of same-kind edits
 * into one command in `lib/commands/history`, but the undo the application
 * actually performs is zundo's `temporal` on the store, and zundo had never
 * heard of that window: two writes 200 ms apart — well inside the 400 ms run —
 * left two zundo steps, so one Ctrl+Z gave back half a drag.
 *
 * The fold happens here rather than in a `handleSet` option on `temporal`
 * because the window is a **command-layer** rule, and `commit` is the command
 * layer's only door into the store (invariant A10). A `handleSet` throttle sees
 * every write to `spatial` with no idea where it came from, so it would also
 * fold a test seeding the graph together with the first edit that follows it,
 * and fold two unrelated edits that merely landed in the same tick. What is
 * folded has to be what `canMergeCommands` folds: the same operation, on the
 * same entities, over the same fields, close enough in time — and nothing else
 * touching the graph in between.
 *
 * Suppression uses zundo's own `pause`/`resume`, not a hand-rolled timer: the
 * continuing write still happens, it just does not open a new past state, so
 * the step the run started with stays the one undo returns to. Which is the
 * same thing `mergeCommands` keeps — the **first** command's `before`.
 */
interface OpenRun {
  /** What the run is: same op, same entities, same fields. */
  readonly key: string;
  /** When the run's most recent write landed; the gap is measured from here. */
  readonly at: number;
  /** The graph the run left behind, so a foreign write closes the run. */
  readonly spatial: RootState['spatial'];
}

let openRun: OpenRun | null = null;

/** One patch as its identity: what it does, to what, to which fields. */
const patchKey = (patch: SpatialPatch): string => {
  if (patch.op === 'add') {
    return `add:${patch.kind}:${patch.entity.id}`;
  }

  if (patch.op === 'remove') {
    return `remove:${patch.kind}:${patch.id}`;
  }

  return `update:${patch.kind}:${patch.id}:${Object.keys(patch.changes).sort().join(',')}`;
};

const runKey = (patches: readonly SpatialPatch[]): string => patches.map(patchKey).join('|');

/**
 * Does this write continue the run that is already open?
 *
 * The gap is measured against the previous write, not the start of the run —
 * the rule `canMergeCommands` uses — so a continuous drag folds however long it
 * lasts and a pause of `MERGE_WINDOW_MS` closes it. The graph identity is the
 * fourth condition: anything else that wrote to `spatial` in between (a screen
 * seeding it, an undo, another commit) means the run is over, whatever the
 * clock says.
 */
const continuesRun = (key: string, timestamp: number, spatial: RootState['spatial']): boolean =>
  openRun !== null &&
  openRun.key === key &&
  openRun.spatial === spatial &&
  timestamp - openRun.at >= 0 &&
  timestamp - openRun.at < MERGE_WINDOW_MS;

/** Forgets the open run, so the next commit starts a fresh undo step. */
export function resetCommitRun(): void {
  openRun = null;
}

/**
 * The single gateway for all spatial data mutations.
 * Returns an object allowing undo, plus metadata for toasts.
 *
 * @param patch One patch, or an ordered batch applied as a single undo step.
 * @param label The Vietnamese label describing the action (e.g. "Xoá tường").
 */
export function commit(
  patch: SpatialPatch | readonly SpatialPatch[],
  label: string
): CommitResult {
  const store = useStore.getState();
  const timestamp = Date.now();
  const patches = Array.isArray(patch) ? (patch as readonly SpatialPatch[]) : [patch as SpatialPatch];
  const key = runKey(patches);

  const temporal = useStore.temporal.getState();
  const folds = continuesRun(key, timestamp, store.spatial) && temporal.isTracking;

  // Apply the patch batch to the spatial slice
  if (folds) {
    temporal.pause();
  }

  try {
    store._applyPatches(patches);
  } finally {
    if (folds) {
      useStore.temporal.getState().resume();
    }
  }

  openRun = { key, at: timestamp, spatial: useStore.getState().spatial };

  // Update history slice for UI to react
  store.setLastCommit(label, timestamp);

  // Return the interface as requested
  return {
    undo: () => {
      // zundo provides temporal api on useStore
      useStore.temporal.getState().undo();
    },
    label,
    timestamp,
  };
}
