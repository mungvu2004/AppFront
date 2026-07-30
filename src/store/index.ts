import { create } from 'zustand';
import { temporal } from 'zundo';
import { createProjectSlice, ProjectSlice } from './projectSlice';
import { createSpatialSlice, SpatialSlice } from './spatialSlice';
import { createSelectionSlice, SelectionSlice } from './selectionSlice';
import { createHistorySlice, HistorySlice } from './historySlice';
import { createUiSlice, UiSlice } from './uiSlice';
import { createPipelineSlice, PipelineSlice } from './pipelineSlice';

export type RootState = ProjectSlice &
  SpatialSlice &
  SelectionSlice &
  HistorySlice &
  UiSlice &
  PipelineSlice;

export const useStore = create<RootState>()(
  temporal(
    (...a) => ({
      ...createProjectSlice(...a),
      ...createSpatialSlice(...a),
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
