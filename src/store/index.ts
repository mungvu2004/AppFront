import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';
import { createProjectSlice, ProjectSlice } from './projectSlice';
import { createSpatialSlice, SpatialSlice } from './spatialSlice';
import { createDraftSlice, DraftSlice } from './draftSlice';
import { createSelectionSlice, SelectionSlice } from './selectionSlice';
import { createToolSlice, ToolSlice } from './toolSlice';
import { createViewSlice, ViewSlice } from './viewSlice';
import { createHistorySlice, HistorySlice } from './historySlice';
import { createUiSlice, UiSlice } from './uiSlice';
import { createPipelineSlice, PipelineSlice } from './pipelineSlice';

export type RootState = ProjectSlice &
  SpatialSlice &
  DraftSlice &
  SelectionSlice &
  ToolSlice &
  ViewSlice &
  HistorySlice &
  UiSlice &
  PipelineSlice;

/** localStorage key the view and ui slices are persisted under. */
export const PERSIST_STORAGE_KEY = 'appfront-view-ui';

export const useStore = create<RootState>()(
  persist(
    temporal(
      (...a) => ({
        ...createProjectSlice(...a),
        ...createSpatialSlice(...a),
        ...createDraftSlice(...a),
        ...createSelectionSlice(...a),
        ...createToolSlice(...a),
        ...createViewSlice(...a),
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
    ),
    {
      name: PERSIST_STORAGE_KEY,
      version: 1,
      // Only the view and ui slices survive a reload. `openDialog` stays out:
      // a blocking dialog must never reopen uninvited after a reload.
      partialize: (state) => ({
        zoom: state.zoom,
        viewCenter: state.viewCenter,
        viewMode: state.viewMode,
        hiddenLayers: state.hiddenLayers,
        colorMode: state.colorMode,
        theme: state.theme,
        leftPanelOpen: state.leftPanelOpen,
        rightPanelOpen: state.rightPanelOpen,
        leftPanelWidthPx: state.leftPanelWidthPx,
        rightPanelWidthPx: state.rightPanelWidthPx,
      }),
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
