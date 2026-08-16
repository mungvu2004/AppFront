import { StateCreator } from 'zustand';
import { COLORING_MODE_IDS, type ColoringModeId } from '../lib/coloring/modes';
import type { Point } from '../domain/spatial/types';

export type ViewMode = '2d' | '3d';

/** Canvas layers that can be hidden. */
export type ViewLayer = 'wall' | 'opening' | 'furniture' | 'room' | 'axis' | 'dimension' | 'note';

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 20;

/**
 * The colouring a fresh session starts in: the model untinted.
 *
 * `src/lib/coloring`'s `default` mode, not a fifth word for the same idea. This
 * slice used to declare four colouring ids of its own — `plain`, `byKind`,
 * `byReviewState`, `byConfidence` — beside the seven that module already owns.
 * Nothing rendered from the store's four, so the two lists were free to drift,
 * and they had: `byKind` existed only here, while `roomUsage`, `area`,
 * `violationSeverity` and `level` existed only there. A colouring mode is a
 * question asked of the model, and the module that answers it owns the list of
 * questions; this slice records which one is being asked.
 */
export const DEFAULT_COLOR_MODE: ColoringModeId = 'default';

/**
 * What builds before the two lists were merged wrote into `colorMode`.
 *
 * `byKind` has no equivalent among the seven and becomes `default`: inventing an
 * eighth colouring mode to receive it would mean choosing tokens for it, and
 * that is a design decision under invariants A1–A4 rather than a migration. No
 * behaviour is lost, because nothing ever painted from this field.
 */
const LEGACY_COLOR_MODES: Readonly<Record<string, ColoringModeId>> = {
  plain: 'default',
  byKind: 'default',
  byReviewState: 'reviewState',
  byConfidence: 'aiConfidence',
};

/**
 * Read a `colorMode` out of an older session's localStorage.
 *
 * Anything unrecognised — a value from a build that no longer exists, or a
 * hand-edited entry — falls back to {@link DEFAULT_COLOR_MODE}. A stored
 * preference is not worth refusing to start over.
 */
export function migrateColorMode(stored: unknown): ColoringModeId {
  if (typeof stored !== 'string') {
    return DEFAULT_COLOR_MODE;
  }
  if ((COLORING_MODE_IDS as readonly string[]).includes(stored)) {
    return stored as ColoringModeId;
  }
  return LEGACY_COLOR_MODES[stored] ?? DEFAULT_COLOR_MODE;
}

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
  /** Which question `src/lib/coloring` is painting the model by. */
  colorMode: ColoringModeId;
  /** Sets the zoom, clamped to [MIN_ZOOM, MAX_ZOOM]. */
  setZoom: (zoom: number) => void;
  setViewCenter: (viewCenter: Point) => void;
  setViewMode: (viewMode: ViewMode) => void;
  toggleLayerVisibility: (layer: ViewLayer) => void;
  setColorMode: (colorMode: ColoringModeId) => void;
}

export const createViewSlice: StateCreator<ViewSlice> = (set) => ({
  zoom: 1,
  viewCenter: { x: 0, y: 0 },
  viewMode: '2d',
  hiddenLayers: [],
  colorMode: DEFAULT_COLOR_MODE,
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
