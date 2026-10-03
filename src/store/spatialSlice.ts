import type { StateCreator, StoreApi } from 'zustand';
import type { TemporalState } from 'zundo';
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
  /**
   * Stores freshly loaded data; arriving data always ends the loading state.
   * Also empties the undo history: a load replaces the graph, it is not an edit
   * the user made, so Ctrl+Z must never "undo" it back to an empty screen (B-V7-04).
   */
  setSpatial: (spatial: NormalizedSpatial | null, versionId: string | null) => void;
  setSpatialLoading: (spatialLoading: boolean) => void;
  setVersionId: (versionId: string | null) => void;
  /** Mutation gateway reserved for `commit(patch, label)`; never call it from a component. */
  _applyPatches: (patches: readonly SpatialPatch[]) => void;
}

/** `temporal` is attached to the store api by the zundo middleware in `store/index.ts`. */
interface MaybeTemporalApi {
  temporal?: StoreApi<TemporalState<unknown>>;
}

export const createSpatialSlice: StateCreator<SpatialSlice> = (set, _get, api) => ({
  spatial: null,
  spatialLoading: false,
  versionId: null,
  setSpatial: (spatial, versionId) => {
    set({ spatial, versionId, spatialLoading: false });
    (api as MaybeTemporalApi).temporal?.getState().clear();
  },
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
