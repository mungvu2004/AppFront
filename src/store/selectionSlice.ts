import { StateCreator } from 'zustand';
import type { EntityId } from '../domain/spatial/types';

/** Layer a pointer pick or keyboard shortcut is restricted to; null picks from every layer. */
export type SelectionLayer = 'wall' | 'door' | 'window' | 'furniture' | 'dimension' | 'room';

/** How the next pick extends the selection. */
export type SelectionMode = 'single' | 'multiple' | 'byKind';

/**
 * What the user currently has selected or hovered on the canvas.
 *
 * Only prefixed entity ids are stored, never the entities themselves; the
 * entities live in the spatial data and are resolved by selectors. Expanding a
 * `byKind` pick into the full id list needs that data too, so a coordinator
 * computes the ids and hands them to `setSelection`.
 *
 * This slice is per-session state and is never persisted.
 */
export interface SelectionSlice {
  /** Ids of the selected entities, in selection order. */
  selectedIds: readonly EntityId[];
  /** Id under the pointer; null when nothing is hovered. */
  hoveredId: EntityId | null;
  selectionMode: SelectionMode;
  activeLayer: SelectionLayer | null;
  /** Picks one id: `multiple` mode adds to the selection, the other modes replace it. */
  select: (id: EntityId) => void;
  deselect: (id: EntityId) => void;
  /** Replaces the whole selection, e.g. with every id of one kind. */
  setSelection: (ids: readonly EntityId[]) => void;
  clearSelection: () => void;
  setHovered: (id: EntityId | null) => void;
  setSelectionMode: (selectionMode: SelectionMode) => void;
  setActiveLayer: (activeLayer: SelectionLayer | null) => void;
}

export const createSelectionSlice: StateCreator<SelectionSlice> = (set) => ({
  selectedIds: [],
  hoveredId: null,
  selectionMode: 'single',
  activeLayer: null,
  select: (id) =>
    set((state) => ({
      selectedIds:
        state.selectionMode === 'multiple' ? [...new Set([...state.selectedIds, id])] : [id],
    })),
  deselect: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.filter((selectedId) => selectedId !== id),
    })),
  setSelection: (ids) => set({ selectedIds: [...new Set(ids)] }),
  clearSelection: () => set({ selectedIds: [] }),
  setHovered: (hoveredId) => set({ hoveredId }),
  setSelectionMode: (selectionMode) => set({ selectionMode }),
  setActiveLayer: (activeLayer) => set({ activeLayer }),
});
