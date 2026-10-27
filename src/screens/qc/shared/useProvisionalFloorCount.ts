import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useStore } from '@/store';

import { floorLayerQuery, floorScaleKeysOf } from './floorScaleKeys';

/**
 * Số tầng có tỷ lệ tạm (`scaleStatus: 'unresolved'`) trong `floorIds`, đọc N16 từng tầng qua cache
 * `layer.byFloor` như `useFloorReview`; tầng chưa đọc được thì chỉ tính khi kho đã biết là tạm.
 * Tách khỏi `useFloorReview` để màn Quy chuẩn không kéo đồ thị N16 và `useQueries` vào gói của nó.
 */
export function useProvisionalFloorCount(projectId: string, floorIds: readonly string[]): number {
  const queryClient = useQueryClient();
  const floorMeta = useStore((state) => (state.spatialProjectId === projectId ? state.floorMeta : null));
  const documents = useQuery({
    queryKey: ['provisionalFloors', projectId, ...floorIds] as const,
    queryFn: () =>
      Promise.all(floorIds.map((floorId) => queryClient.fetchQuery(floorLayerQuery(projectId, floorId)).catch(() => undefined))),
    enabled: floorIds.length > 0,
  }).data;
  return floorIds.filter(
    (floorId, index) => floorScaleKeysOf(documents?.[index], floorMeta?.[floorId])?.scaleStatus === 'unresolved',
  ).length;
}
