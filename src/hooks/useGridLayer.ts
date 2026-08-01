import { useState, useCallback } from 'react';

export interface GridConfig {
  /** Bước lưới nhỏ tính bằng mm (mặc định 100) */
  minorStepMm: number;
  /** Bước lưới lớn tính bằng mm (mặc định 1000) */
  majorStepMm: number;
  /** Ẩn lưới nhỏ khi zoom thấp hơn ngưỡng này */
  minorHideZoomThreshold: number;
}

const DEFAULT_CONFIG: GridConfig = {
  minorStepMm: 100,
  majorStepMm: 1000,
  minorHideZoomThreshold: 0.4,
};

export interface GridLayerState {
  showMinorGrid: boolean;
  minorStepPx: number;
  majorStepPx: number;
  config: GridConfig;
}

/**
 * Hook thuần — tính toán bước lưới theo zoom và scaleRatio.
 * Không import token, không biết về JSX.
 *
 * @param zoom - Zoom level hiện tại (1.0 = 100%)
 * @param scaleRatioMmPerPx - Tỉ lệ mm/px từ ProjectMetadata
 * @param config - Tuỳ chỉnh bước lưới (tuỳ chọn)
 */
export function useGridLayer(
  zoom: number,
  scaleRatioMmPerPx: number,
  config: Partial<GridConfig> = {}
): GridLayerState {
  const merged: GridConfig = { ...DEFAULT_CONFIG, ...config };

  const mmToPx = (mm: number): number =>
    scaleRatioMmPerPx > 0 ? (mm / scaleRatioMmPerPx) * zoom : 0;

  const minorStepPx = mmToPx(merged.minorStepMm);
  const majorStepPx = mmToPx(merged.majorStepMm);
  const showMinorGrid = zoom >= merged.minorHideZoomThreshold;

  return {
    showMinorGrid,
    minorStepPx,
    majorStepPx,
    config: merged,
  };
}

export function useGridLayerInteractive(
  initialZoom = 1,
  scaleRatioMmPerPx = 12,
  config: Partial<GridConfig> = {}
) {
  const [zoom, setZoom] = useState(initialZoom);

  const gridState = useGridLayer(zoom, scaleRatioMmPerPx, config);

  const setZoomLevel = useCallback((z: number) => {
    setZoom(Math.max(0.1, Math.min(10, z)));
  }, []);

  return { ...gridState, zoom, setZoomLevel };
}
