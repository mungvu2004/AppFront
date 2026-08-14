/**
 * Inversion of commands, the foundation of undo.
 *
 * Because every change carries full snapshots (`before`/`after`), inversion
 * is a pure data transform: swap the snapshots and replay the changes in
 * reverse order. It is an involution: `invertCommand(invertCommand(x))`
 * equals `x`.
 */

import type { SpatialPatch } from '@/domain/spatial/applyPatch';

import type { Command, EntityChange } from './types';

/** Prefix toggled on the description so the activity log reads naturally. */
export const UNDO_DESCRIPTION_PREFIX = 'Hoàn tác: ';

/**
 * Adds the undo prefix, or strips it when already present, so applying the
 * toggle twice returns the original description.
 */
export const toggleUndoDescription = (description: string): string =>
  description.startsWith(UNDO_DESCRIPTION_PREFIX)
    ? description.slice(UNDO_DESCRIPTION_PREFIX.length)
    : `${UNDO_DESCRIPTION_PREFIX}${description}`;

// TypeScript cannot keep `kind`, `id` and the snapshots correlated across
// the members of the `EntityChange` union, so the swap re-asserts what the
// input already guarantees: every field belongs to the same kind.
const invertChange = (change: EntityChange): EntityChange =>
  ({
    kind: change.kind,
    id: change.id,
    before: change.after,
    after: change.before,
  }) as EntityChange;

/**
 * Returns the command that undoes the given one.
 *
 * Everything that identifies the command (id, type, timestamp, actor, scope)
 * is preserved, so inverting twice restores the exact original command.
 */
export const invertCommand = (command: Command): Command => ({
  ...command,
  description: toggleUndoDescription(command.description),
  changes: [...command.changes].reverse().map((change) => invertChange(change)),
});

// The assertions below are the same kind-correlation re-statement as in
// `invertChange`: the change's own type already ties `kind` to the snapshot.
const changeToPatch = (change: EntityChange): SpatialPatch => {
  if (change.after !== null) {
    // `add` both inserts and replaces in `applyPatch`, and the snapshot is a
    // full entity, so it covers creation and update alike.
    return { op: 'add', kind: change.kind, entity: change.after } as Extract<SpatialPatch, { op: 'add' }>;
  }

  if (change.before !== null) {
    return { op: 'remove', kind: change.kind, id: change.id } as Extract<SpatialPatch, { op: 'remove' }>;
  }

  throw new Error(`Command change on ${change.id} has no snapshot at all; it cannot be applied.`);
};

/**
 * Translates a command into the patches that apply it to the graph.
 *
 * The patches that undo it are `commandToPatches(invertCommand(command))`.
 */
export const commandToPatches = (command: Command): readonly SpatialPatch[] =>
  command.changes.map((change) => changeToPatch(change));
