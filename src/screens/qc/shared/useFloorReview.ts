import { useQuery, useQueryClient, type QueryFunction } from '@tanstack/react-query';
import { useMemo } from 'react';

import { floorLayerToGraph } from '@/api/floorLayerGraph';
import type { FloorLayerDocument } from '@/api/schemas/spatialLayer';
import { normalizeSpatial, type NormalizedSpatial } from '@/domain/spatial/normalize';
import { entitiesOfKind } from '@/lib/commands/business/shared';
import { useStore } from '@/store';

import { floorScaleStateOf, scaleImplausibleOf, type FloorScaleState } from './floorReviewGateModel';
import { floorLayerQuery, floorScaleKeysOf } from './floorScaleKeys';

/** Tài liệu thiếu `layer` (chỉ có ở bộ mẫu rút gọn) thì coi như chưa đọc, không sập. */
export const graphOfDocument = (document: FloorLayerDocument | undefined): NormalizedSpatial | null =>
  document?.layer === undefined ? null : normalizeSpatial(floorLayerToGraph(document));

/**
 * N16 của tầng đang mở, đọc bằng CHÍNH hàm đọc của màn khi màn đã dựng khoá này (`useFloorLayer`
 * chạy ở hook màn, trước thanh bước/cổng). Không vậy thì lượt đọc của thanh bước (con, đăng ký
 * trước) thắng và đè cổng dữ liệu màn tiêm vào (story, bài kiểm) trên cùng khoá cache.
 * ponytail: dựa vào thứ tự dựng cha-trước-con; cần chắc hơn thì cho màn truyền hàm đọc xuống.
 */
function useFloorLayerDocument(projectId: string, floorId: string): FloorLayerDocument | undefined {
  const base = floorLayerQuery(projectId, floorId);
  const screenRead = useQueryClient().getQueryCache().find({ queryKey: base.queryKey, exact: true })?.options.queryFn;
  const queryFn = typeof screenRead === 'function' ? (screenRead as QueryFunction<FloorLayerDocument>) : base.queryFn;
  return useQuery({ queryKey: base.queryKey, queryFn }).data;
}

export interface FloorReview {
  /** Đồ thị có tầng này: từ kho khi kho đang giữ tầng, không thì từ N16; `null` khi chưa đọc được. */
  readonly graph: NormalizedSpatial | null;
  /** Đồ thị trong kho của dự án này (có thể không giữ tầng này). */
  readonly storeSpatial: NormalizedSpatial | null;
  /** Bước 0 Tỷ lệ; `null` khi chưa đọc được tầng hoặc tỷ lệ của nó (không đoán). */
  readonly scale: FloorScaleState | null;
}

/**
 * Nguồn số chung của thanh bước tầng và cổng tầng: cùng đồ thị, cùng trạng thái tỷ lệ.
 * Kho giữ tầng thì đồ thị đọc kho (màn duyệt ghi cờ `reviewed` vào kho trước khi lưu), không thì
 * N16. Tỷ lệ luôn cần N16 (xem `floorScaleKeysOf`).
 */
export function useFloorReview(projectId: string, floorId: string): FloorReview {
  const storeSpatial = useStore((state) => (state.spatialProjectId === projectId ? state.spatial : null));
  const storeMeta = useStore((state) => (state.spatialProjectId === projectId ? state.floorMeta[floorId] : undefined));
  const fromStore = storeSpatial !== null && storeSpatial.byId[floorId] !== undefined;
  const data = useFloorLayerDocument(projectId, floorId);
  const graph = useMemo(() => (fromStore ? storeSpatial : graphOfDocument(data)), [data, fromStore, storeSpatial]);
  const keys = floorScaleKeysOf(data, storeMeta);
  const scale = useMemo(() => {
    if (graph === null || keys === null) return null;
    const level = entitiesOfKind(graph, 'level').find((item) => item.id === floorId);
    if (level === undefined) return null;
    const implausible = scaleImplausibleOf(graph, floorId);
    return floorScaleStateOf(keys.scaleStatus, keys.scaleSource, level.scaleMillimetresPerPixel, implausible);
  }, [floorId, graph, keys]);

  return { graph, storeSpatial, scale };
}

