import { useMemo } from 'react';

import { useStore } from '@/store';

import { floorReviewCountsOf, floorReviewGateOf, type FloorReviewLayerState } from './floorReviewGateModel';

/** Tiến độ (đã duyệt/tổng, xong) từng lớp bắt buộc của tầng; rỗng khi kho chưa giữ tầng này. Đọc từ kho khi kho đang giữ tầng này (cùng nguồn số với FloorReviewGate). */
export function useDoneLayers(projectId: string, floorId: string): ReadonlyMap<string, FloorReviewLayerState> {
  const graph = useStore((state) =>
    state.spatialProjectId === projectId && state.spatial?.byId[floorId] !== undefined ? state.spatial : null,
  );
  return useMemo(() => {
    if (graph === null) return new Map<string, FloorReviewLayerState>();
    const gate = floorReviewGateOf(floorReviewCountsOf(graph, floorId));
    return new Map<string, FloorReviewLayerState>(gate.layers.map((item) => [item.key, item]));
  }, [floorId, graph]);
}
