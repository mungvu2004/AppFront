import { StateCreator } from 'zustand';
import type { Millimetres, WallKind } from '../domain/spatial/types';

/** Tool the user is working with on the canvas. */
export type ToolKind = 'select' | 'pan' | 'drawWall' | 'placeOpening' | 'placeFurniture' | 'measure';

/** Options the active tool reads; a tool simply ignores the ones it does not use. */
export interface ToolOptions {
  wallThicknessMm: Millimetres;
  wallKind: WallKind;
  snapEnabled: boolean;
  gridSizeMm: Millimetres;
}

const DEFAULT_TOOL_OPTIONS: ToolOptions = {
  wallThicknessMm: 110,
  wallKind: 'partition',
  snapEnabled: true,
  gridSizeMm: 100,
};

/**
 * The active tool and the state of its current gesture.
 *
 * This slice is per-session state and is never persisted.
 */
export interface ToolSlice {
  activeTool: ToolKind;
  toolOptions: ToolOptions;
  /** True while a gesture is in flight (dragging, drawing a run, …). */
  toolInteracting: boolean;
  /** Switches tools; whatever gesture was in flight ends with the old tool. */
  setActiveTool: (activeTool: ToolKind) => void;
  /** Merges a partial change into the options. */
  setToolOptions: (options: Partial<ToolOptions>) => void;
  setToolInteracting: (toolInteracting: boolean) => void;
}

export const createToolSlice: StateCreator<ToolSlice> = (set) => ({
  activeTool: 'select',
  toolOptions: DEFAULT_TOOL_OPTIONS,
  toolInteracting: false,
  setActiveTool: (activeTool) => set({ activeTool, toolInteracting: false }),
  setToolOptions: (options) =>
    set((state) => ({ toolOptions: { ...state.toolOptions, ...options } })),
  setToolInteracting: (toolInteracting) => set({ toolInteracting }),
});
