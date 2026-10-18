/**
 * Dải "tỷ lệ tạm" của màn một tầng (F-04x-2 bước 4) — dùng chung cho bốn màn QC,
 * cùng khuôn `FloorLayerSaveBanner`: hook màn dựng `{ message, onCalibrate }`, view vẽ.
 */
import { useMemo } from 'react';

import { provisionalScaleNoticeOf } from '@/lib/viewmodel/provisionalScale';
import { ROUTES } from '@/routes/paths';

export interface ProvisionalScaleNotice {
  readonly message: string;
  /** Khoá "đã ẩn trong phiên" — theo tầng. */
  readonly dismissKey: string;
  /** Không có khi vai không được hiệu chỉnh (người xem) — dải không mời bấm (G2-22). */
  readonly onCalibrate?: () => void;
}

/**
 * `null` khi tầng không ở tỷ lệ tạm; `onCalibrate` mở màn Hiệu chỉnh tỷ lệ của tầng.
 * `canCalibrate` = false (người xem) thì bỏ nút.
 */
export function useProvisionalScaleNotice(
  scaleStatus: 'unresolved' | undefined,
  projectId: string,
  floorId: string,
  onNavigate: ((path: string) => void) | undefined,
  canCalibrate = true,
): ProvisionalScaleNotice | null {
  return useMemo(() => {
    const notice = provisionalScaleNoticeOf(scaleStatus);

    if (notice === null) {
      return null;
    }

    return {
      dismissKey: `${projectId}/${floorId}`,
      message: notice.message,
      ...(canCalibrate
        ? {
            onCalibrate: () => {
              onNavigate?.(ROUTES.project.scale(projectId, floorId));
            },
          }
        : {}),
    };
  }, [canCalibrate, floorId, onNavigate, projectId, scaleStatus]);
}
