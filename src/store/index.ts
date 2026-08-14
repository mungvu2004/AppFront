import { create } from 'zustand';
import { temporal } from 'zundo';
import { createProjectSlice, ProjectSlice } from './projectSlice';
import { createSpatialSlice, SpatialSlice } from './spatialSlice';
import { createDraftSlice, DraftSlice } from './draftSlice';
import { createSelectionSlice, SelectionSlice } from './selectionSlice';
import { createHistorySlice, HistorySlice } from './historySlice';
import { createUiSlice, UiSlice } from './uiSlice';
import { createPipelineSlice, PipelineSlice } from './pipelineSlice';

export type RootState = ProjectSlice &
  SpatialSlice &
  DraftSlice &
  SelectionSlice &
  HistorySlice &
  UiSlice &
  PipelineSlice;

export const useStore = create<RootState>()(
  temporal(
    (...a) => ({
      ...createProjectSlice(...a),
      ...createSpatialSlice(...a),
      ...createDraftSlice(...a),
      ...createSelectionSlice(...a),
      ...createHistorySlice(...a),
      ...createUiSlice(...a),
      ...createPipelineSlice(...a),
    }),
    {
      partialize: (state) => {
        // Only spatial data is tracked for undo/redo
        return { spatial: state.spatial };
      },
      equality: (a, b) => a.spatial === b.spatial,
      limit: 100, // keep last 100 states
    }
  )
);

// Viewing another floor abandons the unconfirmed draft. Wired here, not in a
// slice, so no slice ever imports another.
useStore.subscribe((state, previousState) => {
  if (state.activeFloorId !== previousState.activeFloorId && state.draftOperations.length > 0) {
    state.discardDraft();
  }
});
