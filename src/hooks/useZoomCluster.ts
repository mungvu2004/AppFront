import { useState, useCallback } from 'react';

const MIN_ZOOM_PCT = 10;
const MAX_ZOOM_PCT = 400;
const STEP = 10;

export interface ZoomClusterState {
  zoomLevel: number;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fitToScreen: () => void;
  zoomLabel: string;
}

/**
 * Hook thuần — quản lý trạng thái zoom cluster.
 */
export function useZoomCluster(initialZoom = 100): ZoomClusterState {
  const [zoomLevel, setZoomLevel] = useState(initialZoom);

  const clamp = (z: number) => Math.max(MIN_ZOOM_PCT, Math.min(MAX_ZOOM_PCT, z));

  const zoomIn = useCallback(() => setZoomLevel((z) => clamp(z + STEP)), []);
  const zoomOut = useCallback(() => setZoomLevel((z) => clamp(z - STEP)), []);
  const resetZoom = useCallback(() => setZoomLevel(100), []);
  const fitToScreen = useCallback(() => setZoomLevel(85), []);

  return {
    zoomLevel,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToScreen,
    zoomLabel: `${zoomLevel}%`,
  };
}
