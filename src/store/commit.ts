import { useStore } from './index';
import { SpatialProject } from '../types/spatial';

export interface CommitResult {
  undo: () => void;
  label: string;
  timestamp: number;
}

/**
 * The single gateway for all spatial data mutations.
 * Returns an object allowing undo, plus metadata for toasts.
 * 
 * @param patchFn A function that mutates the draft spatial state directly.
 * @param label The Vietnamese label describing the action (e.g. "Xoá tường").
 */
export function commit(
  patchFn: (draft: SpatialProject) => void,
  label: string
): CommitResult {
  const store = useStore.getState();
  const timestamp = Date.now();
  
  // Apply patch to the spatial slice
  store._applyPatch(patchFn);
  
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
