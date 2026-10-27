/**
 * Dải "tỷ lệ tạm" của màn một tầng (F-04x-2 bước 4) — dùng chung cho bốn màn QC,
 * cùng khuôn `FloorLayerSaveBanner`: hook màn dựng `{ message, onCalibrate }`, view vẽ.
 */
import { useMemo } from 'react';

import { isScaleMissing, MISSING_SCALE_MESSAGE, provisionalScaleNoticeOf } from '@/lib/viewmodel/provisionalScale';
import { ROUTES } from '@/routes/paths';
import { useStore } from '@/store';

import { useScaleLock } from './useScaleLock';

/** Máy có đo tỷ lệ nhưng hình ra vô lý (tường < 50 mm, khung < 3 m): thanh bước và cổng đã khoá. */
export const IMPLAUSIBLE_SCALE_MESSAGE =
  'Tỷ lệ máy đo cho ra kích thước vô lý nên kích thước và mô hình 3D đang sai. Đặt tỷ lệ trước khi duyệt tiếp.';

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
 * `null` khi tầng không ở tỷ lệ tạm; `onCalibrate` mở màn Tỷ lệ bản vẽ của tầng.
 * `canCalibrate` = false (người xem) thì bỏ nút. Dải đỏ đi theo `useScaleLock` (cùng nguồn với
 * thanh bước và cổng): máy không đo được tỷ lệ (UX-R1 K12), hoặc đo ra hình vô lý — không còn
 * dải vàng trong khi thanh bước báo thiếu tỷ lệ.
 */
export function useProvisionalScaleNotice(
  scaleStatus: 'unresolved' | undefined,
  projectId: string,
  floorId: string,
  onNavigate: ((path: string) => void) | undefined,
  canCalibrate = true,
): ProvisionalScaleNotice | null {
  const scaleSource = useStore((state) => state.floorMeta[floorId]?.scaleSource);
  const { locked } = useScaleLock(projectId, floorId);

  return useMemo(() => {
    const missingMessage = isScaleMissing(scaleSource) ? MISSING_SCALE_MESSAGE : IMPLAUSIBLE_SCALE_MESSAGE;
    const notice = locked
      ? { level: 'violation' as const, message: missingMessage }
      : provisionalScaleNoticeOf(scaleStatus, scaleSource);

    if (notice === null) {
      return null;
    }

    return {
      dismissKey: `${projectId}/${floorId}`,
      message: notice.message,
      ...(notice.level === 'violation' ? { level: notice.level } : {}),
      ...(canCalibrate
        ? {
            onCalibrate: () => {
              onNavigate?.(ROUTES.project.scale(projectId, floorId));
            },
          }
        : {}),
    };
  }, [canCalibrate, floorId, locked, onNavigate, projectId, scaleSource, scaleStatus]);
}
