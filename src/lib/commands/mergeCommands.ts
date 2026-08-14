/**
 * Folding a run of small edits into one command.
 *
 * Dragging a wall does not produce one edit, it produces one per animation
 * frame. Pressing Ctrl+Z after a two-second drag and getting the wall back a
 * pixel at a time — forty times — is not undo, it is a scrub bar. So a run of
 * edits of the same type, on the same entity, by the same person, with less
 * than `MERGE_WINDOW_MS` between them, is folded into a single command before
 * it ever reaches the undo stack.
 *
 * What survives the fold is what makes the result undoable: the **first**
 * command's `before` snapshots, so undo goes back to where the run started,
 * and the **last** command's `after` snapshots, so redo lands where it ended.
 * Everything in between was never a state the user meant to stop at.
 *
 * The window is measured between two consecutive commands, not from the start
 * of the run — the same rule `lib/mutations/coalesce` uses for the sync queue,
 * and the same constant. A continuous drag therefore folds however long it
 * lasts, and the moment the hand pauses for `MERGE_WINDOW_MS` the run is
 * closed and the next edit starts a new one.
 */

import { COALESCE_WINDOW_MS } from '@/lib/mutations/coalesce';

import { createCommand } from './createCommand';
import type { Command, EntityChange } from './types';

/**
 * How long a run stays open for folding, in milliseconds.
 *
 * The same 400 ms the sync queue coalesces over, so what the user sees as one
 * undo step and what leaves for the server are cut at the same places.
 */
export const MERGE_WINDOW_MS = COALESCE_WINDOW_MS;

/** The entities a command touches, as one comparable key. */
const targetKey = (command: Command): string => [...command.scope.entityIds].sort().join(' ');

const timeOf = (command: Command): number => Date.parse(command.timestamp);

/**
 * May these two commands become one undo step?
 *
 * Same action, same entities, same person, and close enough in time. The actor
 * is part of it because two people editing the same wall are two decisions, and
 * one person's undo must not take back the other's work.
 */
export function canMergeCommands(
  earlier: Command,
  later: Command,
  windowMs: number = MERGE_WINDOW_MS,
): boolean {
  if (earlier.type !== later.type || earlier.actorId !== later.actorId) {
    return false;
  }

  if (targetKey(earlier) !== targetKey(later)) {
    return false;
  }

  const gap = timeOf(later) - timeOf(earlier);

  // A gap of exactly the window closes the run. `NaN` from an unreadable
  // timestamp fails every comparison, which is the safe answer: a run whose
  // timing cannot be read is not folded.
  return gap >= 0 && gap < windowMs;
}

// Both changes carry the same id, and an id carries its kind in its prefix, so
// the two snapshots are of the same kind. TypeScript cannot follow that across
// the members of the `EntityChange` union, so the fold re-asserts it — the same
// re-statement `invert.ts` makes when it swaps snapshots.
const foldChange = (earlier: EntityChange, later: EntityChange): EntityChange =>
  ({ ...later, before: earlier.before }) as EntityChange;

/**
 * Folds two commands into the one command that has the same effect.
 *
 * The result keeps the earlier command's id and description — a run is still
 * the thing it started out as — and the later command's timestamp, so the next
 * edit is measured against when the run last moved.
 *
 * Changes are kept in the order they were first touched. A change that folds to
 * no change at all is dropped: an entity created and removed inside one run
 * leaves nothing to record, and nothing to invert.
 */
export function mergeCommands(earlier: Command, later: Command): Command {
  const folded = new Map<string, EntityChange>();

  for (const change of [...earlier.changes, ...later.changes]) {
    const previous = folded.get(change.id);

    folded.set(change.id, previous === undefined ? change : foldChange(previous, change));
  }

  return createCommand({
    type: later.type,
    actorId: later.actorId,
    description: earlier.description,
    changes: [...folded.values()].filter((change) => change.before !== null || change.after !== null),
    id: earlier.id,
    timestamp: later.timestamp,
  });
}

/**
 * Folds a whole run, left to right.
 *
 * Every pair is checked against `canMergeCommands`, so a command that does not
 * belong to the run in progress opens a new one instead of being folded into
 * something it has nothing to do with. Returns the commands the run collapsed
 * to, in order; an empty input gives an empty result.
 */
export function mergeCommandRun(
  commands: readonly Command[],
  windowMs: number = MERGE_WINDOW_MS,
): Command[] {
  const runs: Command[] = [];

  for (const command of commands) {
    const open = runs[runs.length - 1];

    if (open !== undefined && canMergeCommands(open, command, windowMs)) {
      runs[runs.length - 1] = mergeCommands(open, command);

      continue;
    }

    runs.push(command);
  }

  return runs;
}
