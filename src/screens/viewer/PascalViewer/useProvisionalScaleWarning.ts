/**
 * Tầng nào của mô hình đang ở tỷ lệ tạm (`scaleStatus: 'unresolved'`, N16).
 *
 * Đồ thị N15 mà màn 3D nạp KHÔNG mang cờ này, nên hook đọc N16 một lần cho mỗi
 * tầng khi đồ thị sẵn sàng. Lượt đọc hỏng thì bỏ qua: thiếu cảnh báo còn hơn
 * chặn màn 3D vì một lời nhắc.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { ApiClient } from '@/api/client';
import type { SpatialGraph } from '@/domain/spatial/types';
import { provisionalFloorsMessageOf } from '@/lib/viewmodel/provisionalScale';
import { ROUTES } from '@/routes/paths';

import type { PascalViewerProps } from './pascalViewerTypes';

/**
 * Chip của thanh trên cùng: câu cảnh báo, và nút mở màn Hiệu chỉnh tỷ lệ của
 * tầng tạm đầu tiên — tỷ lệ tạm (1 mm/px đoán) làm nhà 3D sai kích thước.
 * `null` khi không tầng nào ở tỷ lệ tạm.
 */
export function useProvisionalScaleWarning(
  graph: SpatialGraph | null,
  projectId: string,
  apiClient: Pick<ApiClient, 'spatial'> | undefined,
): PascalViewerProps['scaleWarning'] {
  const navigate = useNavigate();
  const floorIds = useProvisionalScaleFloors(graph, projectId, apiClient);

  return useMemo(() => {
    const [firstFloorId] = floorIds;
    const names = floorIds.map((id) => graph?.levels.find((level) => level.id === id)?.name ?? id);
    const message = provisionalFloorsMessageOf(names);

    if (message === null || firstFloorId === undefined) return null;

    return { message, onCalibrate: () => navigate(ROUTES.project.scale(projectId, firstFloorId)) };
  }, [floorIds, graph, navigate, projectId]);
}

/** Mã các tầng ở tỷ lệ tạm, theo thứ tự tầng của đồ thị. */
function useProvisionalScaleFloors(
  graph: SpatialGraph | null,
  projectId: string,
  apiClient: Pick<ApiClient, 'spatial'> | undefined,
): readonly string[] {
  const [floorIds, setFloorIds] = useState<readonly string[]>([]);
  // Khoá theo mã tầng chứ không theo `graph`: đồ thị dựng lại sau mỗi lượt sửa, tầng thì không đổi.
  const levelKey = graph === null ? '' : graph.levels.map((level) => level.id).join('|');

  useEffect(() => {
    if (levelKey === '' || projectId === '') {
      setFloorIds([]);
      return undefined;
    }

    const controller = new AbortController();
    const levelIds = levelKey.split('|');

    void (async () => {
      // Nạp động như `useAutosave`, để màn 3D không kéo cả `appClient` vào chunk.
      const api = apiClient ?? (await import('@/api/appClient')).createAppApiClient();
      const results = await Promise.all(
        levelIds.map((floorId) =>
          api.spatial.readLayer({ floorId, projectId, signal: controller.signal }).catch(() => null),
        ),
      );

      if (controller.signal.aborted) return;
      setFloorIds(
        levelIds.filter((_, index) => {
          const result = results[index];
          return result?.ok === true && result.data.scaleStatus === 'unresolved';
        }),
      );
    })().catch(() => undefined);

    return () => controller.abort();
  }, [levelKey, projectId, apiClient]);

  return floorIds;
}
