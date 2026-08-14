import { useStore } from './index';
import type { SpatialPatch } from '../domain/spatial/applyPatch';

export interface CommitResult {
  undo: () => void;
  label: string;
  timestamp: number;
}

/**
 * The single gateway for all spatial data mutations.
 * Returns an object allowing undo, plus metadata for toasts.
 *
 * @param patch One patch, or an ordered batch applied as a single undo step.
 * @param label The Vietnamese label describing the action (e.g. "Xoá tường").
 */
export function commit(
  patch: SpatialPatch | readonly SpatialPatch[],
  label: string
): CommitResult {
  const store = useStore.getState();
  const timestamp = Date.now();

  // Apply the patch batch to the spatial slice
  store._applyPatches(Array.isArray(patch) ? patch : [patch as SpatialPatch]);

  // Update history slice for UI to react
  store.setLastCommit(label, timestamp);

  // Return the interface as requested
  return {
    undo: () => {
      // zundo provides temporal api on useStore
      useStore.temporal.getState().undo();
    },
    label,
    timestamp,
  };
}
