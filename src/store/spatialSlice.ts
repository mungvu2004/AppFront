import type { StateCreator } from 'zustand';
import { applyPatch, type SpatialPatch } from '../domain/spatial/applyPatch';
import type { NormalizedSpatial } from '../domain/spatial/normalize';

/**
 * Saved spatial data of the floor being viewed, in the normalized form built
 * by `domain/spatial/normalize`.
 *
 * The slice stores no derived measurements (areas, violations, …); those are
 * computed by selectors over `spatial`. Patching goes through the pure
 * `applyPatch` from the domain layer, so the slice itself contains no
 * geometry logic.
 */
export interface SpatialSlice {
  /** Normalized spatial data of the floor being viewed; null before load. */
  spatial: NormalizedSpatial | null;
  /** True while the floor's spatial data is being fetched. */
  spatialLoading: boolean;
  /** Id of the version the loaded data belongs to; null before load. */
  versionId: string | null;
  /** Stores freshly loaded data; arriving data always ends the loading state. */
  setSpatial: (spatial: NormalizedSpatial | null, versionId: string | null) => void;
  setSpatialLoading: (spatialLoading: boolean) => void;
  setVersionId: (versionId: string | null) => void;
  /** Mutation gateway reserved for `commit(patch, label)`; never call it from a component. */
  _applyPatches: (patches: readonly SpatialPatch[]) => void;
}

export const createSpatialSlice: StateCreator<SpatialSlice> = (set) => ({
  spatial: null,
  spatialLoading: false,
  versionId: null,
  setSpatial: (spatial, versionId) => set({ spatial, versionId, spatialLoading: false }),
  setSpatialLoading: (spatialLoading) => set({ spatialLoading }),
  setVersionId: (versionId) => set({ versionId }),
  _applyPatches: (patches) =>
    set((state) => {
      if (state.spatial === null) {
        return state;
      }

      const next = applyPatch(state.spatial, patches);

      return next === state.spatial ? state : { spatial: next };
    }),
});
