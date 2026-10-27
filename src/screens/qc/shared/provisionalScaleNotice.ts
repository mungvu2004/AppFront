/**
 * Dải "tỷ lệ tạm" của màn một tầng (F-04x-2 bước 4) — dùng chung cho bốn màn QC,
 * cùng khuôn `FloorLayerSaveBanner`: hook màn dựng `{ message, onCalibrate }`, view vẽ.
 */
import { useMemo } from 'react';

import { isScaleMissing, MISSING_SCALE_MESSAGE } from '@/lib/viewmodel/provisionalScale';
import { ROUTES } from '@/routes/paths';
import { useStore } from '@/store';

import { useScaleLock } from './useScaleLock';

/** Máy có đo tỷ lệ nhưng hình ra vô lý (tường < 50 mm, khung < 3 m): thanh bước và cổng đã khoá. */
export const IMPLAUSIBLE_SCALE_MESSAGE =
  'Chưa có tỷ lệ: tỷ lệ máy đo cho ra kích thước vô lý nên kích thước và mô hình 3D đang sai. Đặt tỷ lệ trước khi duyệt tiếp.';

export interface ProvisionalScaleNotice {
  readonly message: string;
  /** `violation`: tầng chưa có tỷ lệ đúng (đỏ, không ẩn được); vắng = tỷ lệ máy đo cần kiểm (vàng). */
  readonly level?: 'violation';
  /** Khoá "đã ẩn trong phiên" — theo tầng. */
  readonly dismissKey: string;
  /** Không có khi vai không được hiệu chỉnh (người xem) — dải không mời bấm (G2-22). */
  readonly onCalibrate?: () => void;
}

/**
 * Dải chỉ còn cho tầng "Chưa có tỷ lệ" (đỏ), đi theo `useScaleLock` (cùng nguồn với thanh bước và
 * cổng): máy không đo được tỷ lệ (UX-R1 K12), hoặc đo ra hình vô lý. Tỷ lệ "cần kiểm" (vàng) không
 * còn dải lặp lại ở mọi màn (UX-R2 K22/K04) — chấm vàng của bước Tỷ lệ trên thanh bước nói việc đó.
 * `onCalibrate` mở màn Tỷ lệ bản vẽ của tầng; `canCalibrate` = false (người xem) thì bỏ nút.
 * `_scaleStatus` giữ để nơi gọi cũ không vỡ kiểu.
 */
export function useProvisionalScaleNotice(
  _scaleStatus: 'unresolved' | undefined,
  projectId: string,
  floorId: string,
  onNavigate: ((path: string) => void) | undefined,
  canCalibrate = true,
): ProvisionalScaleNotice | null {
  const scaleSource = useStore((state) => state.floorMeta[floorId]?.scaleSource);
  const { locked } = useScaleLock(projectId, floorId);

  return useMemo(() => {
    if (!locked) {
      return null;
    }

    return {
      dismissKey: `${projectId}/${floorId}`,
      message: isScaleMissing(scaleSource) ? MISSING_SCALE_MESSAGE : IMPLAUSIBLE_SCALE_MESSAGE,
      level: 'violation' as const,
      ...(canCalibrate
        ? {
            onCalibrate: () => {
              onNavigate?.(ROUTES.project.scale(projectId, floorId));
            },
          }
        : {}),
    };
  }, [canCalibrate, floorId, locked, onNavigate, projectId, scaleSource]);
}
