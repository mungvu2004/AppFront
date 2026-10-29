import { useState, useCallback, useEffect } from 'react';

const MIN_ZOOM_PCT = 10;
const MAX_ZOOM_PCT = 400;
/** G4b-05: bước 25% (10% thì phải bấm quá nhiều lần mới soi được số nhỏ). Mức lẻ (85% "vừa khung") bắt về bậc 25 kế tiếp. */
const STEP = 25;
const STORAGE_PREFIX = 'zoom-cluster:';

export interface ZoomClusterState {
  zoomLevel: number;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fitToScreen: () => void;
  /** Đặt thẳng một mức (%), kẹp trong 10–400 — màn tự phóng tới mục (L23 Từng việc). */
  setZoom: (zoomPct: number) => void;
  zoomLabel: string;
}

const clamp = (z: number) => Math.max(MIN_ZOOM_PCT, Math.min(MAX_ZOOM_PCT, z));

const readStored = (persistKey: string | undefined): number | null => {
  if (persistKey === undefined) return null;
  try {
    const raw = globalThis.sessionStorage.getItem(STORAGE_PREFIX + persistKey);
    const value = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(value) ? clamp(value) : null;
  } catch {
    return null;
  }
};

/**
 * Hook thuần — quản lý trạng thái zoom cluster.
 *
 * `persistKey` (G4b-30): truyền khoá theo (route, tầng), ví dụ `dimensions:${floorId}`, thì mức phóng
 * được giữ trong `sessionStorage` khi chuyển màn rồi bấm Back. Bỏ trống thì không nhớ gì.
 * Đổi khoá thì nạp lại mức đã lưu của khoá mới ngay lúc render, trước khi effect ghi (không ghi mức cũ sang khoá mới).
 */
export function useZoomCluster(initialZoom = 100, persistKey?: string): ZoomClusterState {
  const [zoomLevel, setZoomLevel] = useState(() => readStored(persistKey) ?? initialZoom);
  const [loadedKey, setLoadedKey] = useState(persistKey);

  if (loadedKey !== persistKey) {
    setLoadedKey(persistKey);
    setZoomLevel(readStored(persistKey) ?? initialZoom);
  }

  useEffect(() => {
    if (persistKey === undefined) return;
    try {
      globalThis.sessionStorage.setItem(STORAGE_PREFIX + persistKey, String(zoomLevel));
    } catch {
      // Trình duyệt chặn bộ nhớ: chỉ mất phần nhớ mức phóng, màn vẫn chạy.
    }
  }, [persistKey, zoomLevel]);

  const zoomIn = useCallback(() => setZoomLevel((z) => clamp(Math.floor(z / STEP) * STEP + STEP)), []);
  const zoomOut = useCallback(() => setZoomLevel((z) => clamp(Math.ceil(z / STEP) * STEP - STEP)), []);
  const resetZoom = useCallback(() => setZoomLevel(100), []);
  const fitToScreen = useCallback(() => setZoomLevel(85), []);
  const setZoom = useCallback((zoomPct: number) => setZoomLevel(clamp(zoomPct)), []);

  return {
    zoomLevel,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToScreen,
    setZoom,
    zoomLabel: `${zoomLevel}%`,
  };
}
