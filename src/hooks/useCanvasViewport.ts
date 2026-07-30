import { useState, useCallback } from 'react';

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;

/**
 * Manages 2D canvas pan and zoom state.
 */
export function useCanvasViewport(initialState?: Partial<ViewportState>) {
  const [viewport, setViewport] = useState<ViewportState>({
    x: initialState?.x ?? 0,
    y: initialState?.y ?? 0,
    zoom: initialState?.zoom ?? 1,
  });

  const pan = useCallback((dx: number, dy: number) => {
    setViewport((prev) => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy,
    }));
  }, []);

  const zoomTo = useCallback((zoomLevel: number, centerX?: number, centerY?: number) => {
    setViewport((prev) => {
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel));
      if (newZoom === prev.zoom) return prev;
      
      // If center is provided, adjust x/y to zoom into that point
      if (centerX !== undefined && centerY !== undefined) {
        const scaleChange = newZoom / prev.zoom;
        return {
          zoom: newZoom,
          x: centerX - (centerX - prev.x) * scaleChange,
          y: centerY - (centerY - prev.y) * scaleChange,
        };
      }

      return { ...prev, zoom: newZoom };
    });
  }, []);

  const fitToContent = useCallback((contentBounds: { minX: number, minY: number, maxX: number, maxY: number }, canvasWidth: number, canvasHeight: number, padding = 40) => {
    const contentWidth = contentBounds.maxX - contentBounds.minX;
    const contentHeight = contentBounds.maxY - contentBounds.minY;
    
    if (contentWidth <= 0 || contentHeight <= 0) return;

    const scaleX = (canvasWidth - padding * 2) / contentWidth;
    const scaleY = (canvasHeight - padding * 2) / contentHeight;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(scaleX, scaleY)));

    const contentCenterX = (contentBounds.minX + contentBounds.maxX) / 2;
    const contentCenterY = (contentBounds.minY + contentBounds.maxY) / 2;

    const newX = canvasWidth / 2 - contentCenterX * newZoom;
    const newY = canvasHeight / 2 - contentCenterY * newZoom;

    setViewport({ x: newX, y: newY, zoom: newZoom });
  }, []);

  return {
    viewport,
    pan,
    zoomTo,
    fitToContent,
  };
}
