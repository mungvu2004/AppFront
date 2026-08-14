import { StateCreator } from 'zustand';
import type { Point } from '../domain/spatial/types';

export type ViewMode = '2d' | '3d';

/** Canvas layers that can be hidden. */
export type ViewLayer = 'wall' | 'opening' | 'furniture' | 'room' | 'axis' | 'dimension' | 'note';

/** How entities on the canvas are coloured. */
export type ColorMode = 'plain' | 'byKind' | 'byReviewState' | 'byConfidence';

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 20;

/**
 * How the user is looking at the plan: zoom, view centre, 2D/3D, layer
 * visibility and colouring.
 *
 * The whole slice is persisted to localStorage between sessions; the wiring
 * lives in the store composition.
 */
export interface ViewSlice {
  /** Zoom factor; 1 renders at 100%. */
  zoom: number;
  /** Point of the plan at the middle of the viewport, in millimetres. */
  viewCenter: Point;
  viewMode: ViewMode;
  hiddenLayers: readonly ViewLayer[];
  colorMode: ColorMode;
  /** Sets the zoom, clamped to [MIN_ZOOM, MAX_ZOOM]. */
  setZoom: (zoom: number) => void;
  setViewCenter: (viewCenter: Point) => void;
  setViewMode: (viewMode: ViewMode) => void;
  toggleLayerVisibility: (layer: ViewLayer) => void;
  setColorMode: (colorMode: ColorMode) => void;
}

export const createViewSlice: StateCreator<ViewSlice> = (set) => ({
  zoom: 1,
  viewCenter: { x: 0, y: 0 },
  viewMode: '2d',
  hiddenLayers: [],
  colorMode: 'plain',
  setZoom: (zoom) => set({ zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) }),
  setViewCenter: (viewCenter) => set({ viewCenter }),
  setViewMode: (viewMode) => set({ viewMode }),
  toggleLayerVisibility: (layer) =>
    set((state) => ({
      hiddenLayers: state.hiddenLayers.includes(layer)
        ? state.hiddenLayers.filter((hidden) => hidden !== layer)
        : [...state.hiddenLayers, layer],
    })),
  setColorMode: (colorMode) => set({ colorMode }),
});
