import { StateCreator } from 'zustand';

export type SelectionLayer = 'wall' | 'door' | 'window' | 'furniture' | 'dimension' | 'room';

export interface SelectionSlice {
  selectedIds: string[];
  activeLayer: SelectionLayer | null;
  select: (id: string, multi?: boolean) => void;
  deselect: (id: string) => void;
  clearSelection: () => void;
  setActiveLayer: (layer: SelectionLayer | null) => void;
}

export const createSelectionSlice: StateCreator<SelectionSlice> = (set) => ({
  selectedIds: [],
  activeLayer: null,
  select: (id, multi = false) => set((state) => ({
    selectedIds: multi ? [...new Set([...state.selectedIds, id])] : [id]
  })),
  deselect: (id) => set((state) => ({
    selectedIds: state.selectedIds.filter(selectedId => selectedId !== id)
  })),
  clearSelection: () => set({ selectedIds: [] }),
  setActiveLayer: (layer) => set({ activeLayer: layer }),
});
