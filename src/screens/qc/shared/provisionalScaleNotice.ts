/**
 * Dải "tỉ lệ tạm" của màn một tầng (F-04x-2 bước 4) — dùng chung cho bốn màn QC,
 * cùng khuôn `FloorLayerSaveBanner`: hook màn dựng `{ message, onCalibrate }`, view vẽ.
 */
import { useMemo } from 'react';

import { provisionalScaleNoticeOf } from '@/lib/viewmodel/provisionalScale';
import { ROUTES } from '@/routes/paths';

export interface ProvisionalScaleNotice {
  readonly message: string;
  readonly onCalibrate: () => void;
}

/** `null` khi tầng không ở tỉ lệ tạm; `onCalibrate` mở màn Hiệu chỉnh tỉ lệ của tầng. */
export function useProvisionalScaleNotice(
  scaleStatus: 'unresolved' | undefined,
  projectId: string,
  floorId: string,
  onNavigate: ((path: string) => void) | undefined,
): ProvisionalScaleNotice | null {
  return useMemo(() => {
    const notice = provisionalScaleNoticeOf(scaleStatus);

    if (notice === null) {
      return null;
    }

    return {
      message: notice.message,
      onCalibrate: () => {
        onNavigate?.(ROUTES.project.scale(projectId, floorId));
      },
    };
  }, [floorId, onNavigate, projectId, scaleStatus]);
}
