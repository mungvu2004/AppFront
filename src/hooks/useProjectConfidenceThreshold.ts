import { useQuery } from '@tanstack/react-query';

import type { ProjectSettingsApi } from '@/api/client';
import { CONFIDENCE_SUGGESTED_THRESHOLD } from '@/lib/format/semantic';
import { queryKeys } from '@/lib/query/queryKeys';

import { readProjectSettingsShared } from './useProjectUnits';

/**
 * Ngưỡng tin cậy của dự án (N5, Cài đặt › Đơn vị đo) cho các màn đánh dấu "độ tin cậy thấp" —
 * cùng nguồn với câu đếm của màn Xử lý (FIX-1603), thay hằng toàn cục 0,70 (BUG-354).
 */
export interface ReadConfidenceThresholdInput {
  readonly projectId: string;
  readonly signal?: AbortSignal;
}

export type ReadConfidenceThreshold = (input: ReadConfidenceThresholdInput) => Promise<number | null>;

/** Bản thật cho cổng của màn: cài đặt đọc hỏng → `null` (màn rơi về ngưỡng mặc định). */
export async function readProjectConfidenceThreshold(
  settings: ProjectSettingsApi,
  { projectId }: ReadConfidenceThresholdInput,
): Promise<number | null> {
  // Chung lượt với `useProjectUnits` (P11a); bỏ `signal` vì lượt ấy có thể đang phục vụ người khác.
  const result = await readProjectSettingsShared({ projectSettings: settings }, projectId);

  return result.ok ? result.data.confidenceThreshold : null;
}

/** Khoá riêng một hình dạng (số), dưới `project.detail` để lượt lưu cài đặt làm mới nó theo tiền tố. */
export const projectConfidenceThresholdKey = (projectId: string) =>
  [...queryKeys.project.detail(projectId), 'confidenceThreshold'] as const;

/**
 * Ngưỡng đang áp. Chưa đọc xong, không có cổng đọc, hoặc đọc hỏng → `CONFIDENCE_SUGGESTED_THRESHOLD`:
 * màn vẫn phải phân loại được, khác câu đếm của màn Xử lý (bỏ câu khi không biết ngưỡng).
 */
export function useProjectConfidenceThreshold(
  projectId: string,
  read: ReadConfidenceThreshold | undefined,
  /** Ngưỡng khi chưa/không đọc được — màn có ngưỡng đặc tả riêng (SCR-17: 0,75) truyền nó. */
  fallback: number = CONFIDENCE_SUGGESTED_THRESHOLD,
): number {
  const query = useQuery({
    queryKey: projectConfidenceThresholdKey(projectId),
    queryFn: ({ signal }) => (read === undefined ? null : read({ projectId, signal })),
    enabled: read !== undefined,
  });

  return query.data ?? fallback;
}
