import { useState, useCallback } from 'react';

export function useZoomCluster() {
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const zoomIn = useCallback(() => {
    setZoomLevel((z) => Math.min(z + 10, 400));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomLevel((z) => Math.max(z - 10, 10));
  }, []);

  const resetZoom = useCallback(() => {
    setZoomLevel(100);
  }, []);

  const fitToScreen = useCallback(() => {
    setZoomLevel(85); // Arbitrary "fit" value for demo
  }, []);

  return {
    zoomLevel,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToScreen,
  };
}
