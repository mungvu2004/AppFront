import { StateCreator } from 'zustand';
import { SpatialProject } from '../types/spatial';

// We extract just the spatial data that we want undoable in zundo.
// Typically only the spatial geometry changes need to be undoable.
export interface SpatialSlice {
  spatial: SpatialProject | null;
  activeLevelId: string | null;
  setSpatialData: (data: SpatialProject) => void;
  setActiveLevel: (levelId: string) => void;
  // Raw mutation function for commit
  _applyPatch: (patchFn: (draft: SpatialProject) => void) => void;
}

export const createSpatialSlice: StateCreator<SpatialSlice> = (set) => ({
  spatial: null,
  activeLevelId: null,
  setSpatialData: (data) => set({ spatial: data }),
  setActiveLevel: (levelId) => set({ activeLevelId: levelId }),
  _applyPatch: (patchFn) => set((state) => {
    if (!state.spatial) return state;
    // Poor man's immer for this headless layer, or we can just deep clone.
    // Zundo works with zustand. We just need to return a new object.
    const newSpatial = JSON.parse(JSON.stringify(state.spatial)); // naive deep clone for patch application
    patchFn(newSpatial);
    return { spatial: newSpatial };
  }),
});
