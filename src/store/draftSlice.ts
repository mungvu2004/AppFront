import { StateCreator } from 'zustand';
import type { Segment, Wall, WallId } from '../domain/spatial/types';

/** Dragging an existing wall onto a new centreline. */
export interface MoveWallDraft {
  kind: 'moveWall';
  wallId: WallId;
  centreline: Segment;
}

/** Drawing a wall that does not exist in the saved data yet. */
export interface DrawWallDraft {
  kind: 'drawWall';
  wall: Wall;
}

/** One unconfirmed edit staged on top of the saved data. */
export type DraftOperation = MoveWallDraft | DrawWallDraft;

/**
 * Unconfirmed edits, kept strictly apart from the saved spatial data.
 *
 * Confirming a draft is not this slice's job: a coordinator turns the staged
 * operations into `commit(patch, label)` calls and then discards the draft.
 * Viewing another floor also discards it; that wiring lives in the store
 * composition so no slice has to know about another.
 */
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
