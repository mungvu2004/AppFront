import { useCallback } from 'react';

import { useZoomCluster } from '@/hooks/useZoomCluster';

import { useCanvasPan, type CanvasPanState } from './useCanvasPan';

export interface CanvasZoomPanState {
  readonly pan: CanvasPanState;
  /** Hệ số phóng của lớp nội dung (`scale(...)`): 1 là "vừa khung". */
  readonly scale: number;
  /** Đặt thẳng mức phóng (%), kẹp như nút +/−. */
  readonly setZoom: (zoomPct: number) => void;
  /** Trải thẳng vào `<ZoomCluster {...zoomCluster} />`. */
  readonly zoomCluster: {
    readonly zoomLevel: number;
    readonly onZoomIn: () => void;
    readonly onZoomOut: () => void;
    readonly onResetZoom: () => void;
    readonly onFitToScreen: () => void;
  };
}

/**
 * Kéo + phóng cục bộ cho canvas không có khung nhìn do hook màn làm chủ (Cửa & nội thất, Phòng):
 * `useCanvasPan` cho kéo và lăn chuột, `useZoomCluster` giữ mức phóng; "Vừa khung" về 100% và bỏ độ kéo.
 */
export function useCanvasZoomPan(): CanvasZoomPanState {
  const zoom = useZoomCluster();
  const { zoomIn, zoomOut, resetZoom } = zoom;
  const pan = useCanvasPan((direction) => (direction > 0 ? zoomIn() : zoomOut()));
  const { reset: resetPan } = pan;
  const fitToFrame = useCallback(() => {
    resetZoom();
    resetPan();
  }, [resetPan, resetZoom]);

  return {
    pan,
    scale: zoom.zoomLevel / 100,
    setZoom: zoom.setZoom,
    zoomCluster: {
      zoomLevel: zoom.zoomLevel,
      onZoomIn: zoomIn,
      onZoomOut: zoomOut,
      onResetZoom: resetZoom,
      onFitToScreen: fitToFrame,
    },
  };
}
