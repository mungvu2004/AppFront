/**
 * Several commands that have to stand or fall together.
 *
 * A transaction is not a second pipeline. It is the same five steps of
 * `dispatch`, run once over a list instead of once over a single command:
 * every command is checked before any of them is applied, the batch produces
 * **one** undo entry, one rule pass and one queued item. So a user who splits a
 * wall and re-labels the two halves presses hoàn tác once, not three times.
 *
 * All or nothing. Any command rejected at step one stops the batch with the
 * store untouched, and a step that throws after some commands have landed puts
 * the graph back the way it was before undoing the rest — see
 * `runCommandPipeline`, which owns both.
 */

import {
  runCommandPipeline,
  SPATIAL_PIPELINE_KEY,
  type DispatchDeps,
  type DispatchResult,
} from './dispatch';
import type { Command } from './types';
import { runExclusive } from '@/lib/mutations/entityQueue';

export interface TransactionOptions {
  /**
   * Vietnamese label of the single undo entry.
   *
   * Left out, a lone command lends its own description and a group is labelled
   * by how many changes it carries.
   */
  readonly label?: string;
}

const defaultLabel = (commands: readonly Command[]): string => {
  const only = commands[0];

  if (commands.length === 1 && only !== undefined) {
    return only.description;
  }

  return `Gộp ${commands.length} thay đổi`;
};

/**
 * Runs a list of commands as one unit: all succeed, or none does.
 *
 * Never rejects: a failure comes back as `{ ok: false, error }` naming the step
 * that stopped it, the Vietnamese reasons, and the original `cause`. On failure
 * the graph is back to what it was, no undo entry is left behind, and nothing
 * is queued for the server.
 */
export function runTransaction(
  commands: readonly Command[],
  deps: DispatchDeps,
  options: TransactionOptions = {},
): Promise<DispatchResult> {
  const batch = [...commands];

  return runExclusive(SPATIAL_PIPELINE_KEY, () =>
    runCommandPipeline({ commands: batch, label: options.label ?? defaultLabel(batch) }, deps),
  );
}
