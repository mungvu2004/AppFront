/**
 * Unconfirmed edits, staged on top of the saved data and never mixed into it.
 *
 * A draft is what the screen shows while a gesture is still happening: the wall
 * following the cursor, the table halfway through being dragged, the door being
 * placed. It exists so that nothing has to be written to the real drawing before
 * the user lets go — which is what makes Esc free, and what stops one drag from
 * putting two hundred entries in the undo history.
 *
 * **An operation carries a whole entity, never a partial diff.** This is the
 * same discipline the command layer keeps (`lib/commands/types`) and it is kept
 * for the same reason: a consumer draws a previewed wall exactly the way it
 * draws a saved one, with no second code path and no field-by-field merge to get
 * wrong. It also keeps the union from growing a member per verb — dragging,
 * turning and resizing a wall are all "this wall, but different", and the shape
 * that says so is the wall.
 *
 * So there are two operations and there is no room for a third:
 *
 * - {@link EditEntityDraft} — something that exists, shown as it would look.
 * - {@link CreateEntityDraft} — something that does not exist yet, so it has no
 *   saved version to be shown instead of.
 *
 * Confirming a draft is not this slice's job: a coordinator turns the staged
 * operations into `commit(patch, label)` calls and then discards the draft.
 * Viewing another floor also discards it; that wiring lives in the store
 * composition so no slice has to know about another.
 */

import type { StateCreator } from 'zustand';
import type { SpatialEntity } from '../domain/spatial/normalize';
import type { EntityId } from '../domain/spatial/types';

/**
 * An existing entity, as it would be once the edit is confirmed.
 *
 * Covers every edit to a thing that is already on the drawing: a wall dragged
 * onto a new centreline, a wall pulled thicker, a table moved or turned, a door
 * slid along its host. `entityId` is stated separately from `preview.id` so a
 * consumer can find what is being replaced without unpacking the snapshot, and
 * so a rename can never make the two disagree about which entity this is.
 */
export interface EditEntityDraft {
  kind: 'editEntity';
  /** The saved entity this stands in for. */
  entityId: EntityId;
  /** The whole entity as it would look. Never a partial diff. */
  preview: SpatialEntity;
}

/** An entity being drawn, which the saved data does not hold yet. */
export interface CreateEntityDraft {
  kind: 'createEntity';
  entity: SpatialEntity;
}

/** One unconfirmed edit staged on top of the saved data. */
export type DraftOperation = EditEntityDraft | CreateEntityDraft;

/** The entity a staged operation is about, whichever kind of operation it is. */
export const draftEntityId = (operation: DraftOperation): EntityId =>
  operation.kind === 'editEntity' ? operation.entityId : operation.entity.id;

export interface DraftSlice {
  /** Staged operations in the order the user made them. */
  draftOperations: readonly DraftOperation[];
  /** Appends one operation to the draft. */
  stageDraftOperation: (operation: DraftOperation) => void;
  /** Replaces the operation at `index`, e.g. while a drag is still moving; ignores an unknown index. */
  amendDraftOperation: (index: number, operation: DraftOperation) => void;
  /** Throws the whole draft away; the saved data is untouched. */
  discardDraft: () => void;
}

export const createDraftSlice: StateCreator<DraftSlice> = (set) => ({
  draftOperations: [],
  stageDraftOperation: (operation) =>
    set((state) => ({ draftOperations: [...state.draftOperations, operation] })),
  amendDraftOperation: (index, operation) =>
    set((state) => {
      if (index < 0 || index >= state.draftOperations.length) {
        return state;
      }

      const draftOperations = [...state.draftOperations];

      draftOperations[index] = operation;

      return { draftOperations };
    }),
  discardDraft: () => set({ draftOperations: [] }),
});
