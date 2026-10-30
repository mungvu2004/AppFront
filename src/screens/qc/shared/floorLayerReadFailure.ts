/**
 * Lượt đọc lớp của tầng (N16) hỏng khi chưa có tài liệu nào — dùng chung cho các màn QC
 * một tầng (BUG-326). Thay cả màn bằng MỘT trạng thái lỗi có MỘT lối ra, thay vì dựng bộ
 * lọc, chip và thống kê 0/0 giả quanh một dải đỏ lặp lại ở thanh dưới.
 *
 * Cùng khuôn `provisionalScaleNotice.ts`: hook dựng `{ title, description, action }`,
 * `FloorLayerReadFailure.tsx` vẽ.
 */
import { useMemo } from 'react';

import {
  BACK_TO_PROJECTS_LABEL,
  PROJECT_NOT_FOUND_DESCRIPTION,
  PROJECT_NOT_FOUND_TITLE,
} from '@/components/feedback/ProjectSpatialGate';
import { FLOOR_NOT_FOUND_MESSAGE } from '@/hooks/useFloorLayer';
import { describeError, toAppError } from '@/lib/errors';
import { readWireError } from '@/lib/errors/wireError';
import { ROUTES } from '@/routes/paths';

export const FLOOR_MISSING_TITLE = 'Không mở được tầng này';
/** Câu đầu là `FLOOR_NOT_FOUND_MESSAGE` của `useFloorLayer` — một nguồn cho câu "không còn tồn tại". */
export const FLOOR_MISSING_DESCRIPTION = `${FLOOR_NOT_FOUND_MESSAGE} Mở Quản lý tầng để chọn một tầng khác.`;
export const BACK_TO_FLOORS_LABEL = 'Về quản lý tầng';
export const RETRY_READ_LABEL = 'Thử lại';

export interface FloorLayerReadFailure {
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly onAction: () => void;
}

export interface FloorLayerReadState {
  readonly data: unknown;
  readonly error: unknown;
  readonly refetch: () => void;
}

/** Tầng của route không tồn tại (N16 404, hoặc kho đã nạp mà không có tầng đó) → một lối về Quản lý tầng. */
export function floorMissingFailureOf(
  projectId: string,
  onNavigate: ((path: string) => void) | undefined,
): FloorLayerReadFailure {
  return {
    title: FLOOR_MISSING_TITLE,
    description: FLOOR_MISSING_DESCRIPTION,
    actionLabel: BACK_TO_FLOORS_LABEL,
    onAction: () => onNavigate?.(ROUTES.project.floors(projectId)),
  };
}

/**
 * `null` khi đã có tài liệu (lượt đọc lại hỏng không xoá màn đang dùng) hoặc không lỗi.
 * 404 dự án → về danh sách dự án; 404 khác (tầng) → về Quản lý tầng; lỗi khác → "Thử lại".
 */
export function floorLayerReadFailureOf(
  floorLayer: FloorLayerReadState,
  projectId: string,
  onNavigate: ((path: string) => void) | undefined,
): FloorLayerReadFailure | null {
  if (floorLayer.error === null || floorLayer.error === undefined || floorLayer.data !== undefined) {
    return null;
  }

  const wire = readWireError(floorLayer.error);

  if (wire?.status === 404 && wire.resource === 'project') {
    return {
      title: PROJECT_NOT_FOUND_TITLE,
      description: PROJECT_NOT_FOUND_DESCRIPTION,
      actionLabel: BACK_TO_PROJECTS_LABEL,
      onAction: () => onNavigate?.(ROUTES.dashboard),
    };
  }

  if (wire?.status === 404) {
    return floorMissingFailureOf(projectId, onNavigate);
  }

  const { title, description } = describeError(toAppError(floorLayer.error));

  return { title, description, actionLabel: RETRY_READ_LABEL, onAction: floorLayer.refetch };
}

export function useFloorLayerReadFailure(
  floorLayer: FloorLayerReadState,
  projectId: string,
  onNavigate: ((path: string) => void) | undefined,
): FloorLayerReadFailure | null {
  const { data, error, refetch } = floorLayer;

  return useMemo(
    () => floorLayerReadFailureOf({ data, error, refetch }, projectId, onNavigate),
    [data, error, onNavigate, projectId, refetch],
  );
}

/** P02: tầng đang bị khoá lưu (xung đột/từ chối) thì thanh trạng thái không hứa "sẽ thử lưu lại"; chỉ về dải báo phía trên. */
export const SAVE_BLOCKED_LABEL = 'Chưa lưu. Xem dải báo phía trên.';
