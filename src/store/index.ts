import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { temporal } from 'zundo';
import { isStateTrackingEnabled, nameActions, STATE_TRACKING_NAME } from './devtools';
import type { ProjectSlice } from './projectSlice';
import { createProjectSlice } from './projectSlice';
import type { SpatialSlice } from './spatialSlice';
import { createSpatialSlice } from './spatialSlice';
import type { DraftSlice } from './draftSlice';
import { createDraftSlice } from './draftSlice';
import type { SelectionSlice } from './selectionSlice';
import { createSelectionSlice } from './selectionSlice';
import type { ToolSlice } from './toolSlice';
import { createToolSlice } from './toolSlice';
import type { ViewSlice } from './viewSlice';
import { createViewSlice, migrateColorMode } from './viewSlice';
import type { HistorySlice } from './historySlice';
import { createHistorySlice } from './historySlice';
import type { UiSlice } from './uiSlice';
import { createUiSlice } from './uiSlice';
import type { PipelineSlice } from './pipelineSlice';
import { createPipelineSlice } from './pipelineSlice';

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

/**
 * Shape version of what is persisted. Bumped when a stored field changes
 * meaning, so `migrate` below can tell an old entry from a current one.
 *
 * 2 — `colorMode` moved off this slice's own four ids onto the seven
 * `src/lib/coloring` owns.
 */
export const PERSIST_VERSION = 2;

export const useStore = create<RootState>()(
  devtools(
    nameActions(
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
          version: PERSIST_VERSION,
          // A reload must not be the thing that loses somebody's session. An
          // entry written before PERSIST_VERSION 2 carries a colouring id from a
          // vocabulary this build no longer has; it is translated rather than
          // dropped, and anything unreadable falls back to the default.
          migrate: (persisted, version) => {
            const stored = (persisted ?? {}) as Record<string, unknown>;
            if (version >= PERSIST_VERSION) {
              return stored as unknown as RootState;
            }
            return {
              ...stored,
              colorMode: migrateColorMode(stored.colorMode),
            } as unknown as RootState;
          },
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
    ),
    { name: STATE_TRACKING_NAME, enabled: isStateTrackingEnabled() }
  )
);

// Viewing another floor abandons the unconfirmed draft. Wired here, not in a
// slice, so no slice ever imports another.
useStore.subscribe((state, previousState) => {
  if (state.activeFloorId !== previousState.activeFloorId && state.draftOperations.length > 0) {
    state.discardDraft();
  }
});
