import { useMemo } from 'react';

import { SCALE_STATE_VIEWS } from '@/lib/viewmodel/provisionalScale';
import { ROUTES } from '@/routes/paths';

import { floorPendingText, floorReviewCountsOf, floorReviewGateOf, SCALE_LOCK_REASON, type RequiredLayerKey } from './floorReviewGateModel';
import { stepAfter } from './stepAfter';
import { useFloorReview, useNextFloor } from './useFloorReview';

export const LAYER_ROUTES: Readonly<Record<RequiredLayerKey, (projectId: string, floorId: string) => string>> = {
  walls: ROUTES.project.walls,
  objects: ROUTES.project.objects,
  rooms: ROUTES.project.rooms,
};

const VIEWER_NAME = 'Mô hình 3D';

/**
 * Đích "đi tiếp" của một màn trong tầng, MỘT nguồn cho cổng (`FloorReviewGate`) và cặp nút bước (`QcStepPager`):
 * - `go`: sang được; `name` là tên đích ("Phòng", "Mô hình 3D", "Tầng 2"); `action` là chữ nút riêng của cổng;
 *   `reason` khác null = đích là màn Tỷ lệ vì tầng chưa có tỷ lệ;
 * - `blocked`: đang ở màn Tỷ lệ mà tầng chưa có tỷ lệ: các bước sau khoá, `reason` nói cần gì.
 * `pending`: câu nhắc phần chưa xong khi đích là Mô hình 3D (cho sang nhưng nói rõ, UX-22).
 */
export type FloorNextTarget =
  | { readonly kind: 'go'; readonly to: string; readonly name: string; readonly action: string; readonly pending: string | null; readonly reason: string | null }
  | { readonly kind: 'blocked'; readonly name: string; readonly action: string; readonly reason: string };

const nextStepLabel = (label: string): string => `Tiếp: ${label}`;

export function useFloorNextTarget(projectId: string, floorId: string, pathname: string): FloorNextTarget & { readonly hereUnfinished: boolean } {
  const { graph, scale } = useFloorReview(projectId, floorId);
  const nextFloor = useNextFloor(projectId, floorId);
  const gate = useMemo(() => floorReviewGateOf(floorReviewCountsOf(graph, floorId)), [floorId, graph]);
  const scaleRoute = ROUTES.project.scale(projectId, floorId);
  /* Đang đứng ở một lớp bắt buộc chưa xong: làm tiếp lớp này trước (khi màn có mục kế tiếp). */
  const hereUnfinished = gate.layers.some((layer) => !layer.done && LAYER_ROUTES[layer.key](projectId, floorId) === pathname);
  // Chưa có đồ thị thì mọi lớp đếm 0 mục, trông như "xong": chỉ bỏ qua bước đã xong khi dữ liệu đã về.
  const afterKey = stepAfter(pathname, projectId, floorId, (key) => graph !== null && gate.layers.some((layer) => layer.key === key && layer.done));
  const after = afterKey === undefined ? null : (gate.layers.find((layer) => layer.key === afterKey) ?? null);

  if (scale === 'missing' && pathname !== scaleRoute) {
    const name = SCALE_STATE_VIEWS.missing.action;
    return { kind: 'go', to: scaleRoute, name, action: name, pending: null, reason: SCALE_LOCK_REASON, hereUnfinished };
  }
  if (scale === 'missing' && after !== null) {
    return { kind: 'blocked', name: after.label, action: nextStepLabel(after.label), reason: SCALE_LOCK_REASON, hereUnfinished };
  }
  if (after !== null) {
    return { kind: 'go', to: LAYER_ROUTES[after.key](projectId, floorId), name: after.label, action: nextStepLabel(after.label), pending: null, reason: null, hereUnfinished };
  }
  if (nextFloor === null) {
    return { kind: 'go', to: ROUTES.project.viewer(projectId), name: VIEWER_NAME, action: `Sang ${VIEWER_NAME}`, pending: graph === null ? null : floorPendingText(gate, scale), reason: null, hereUnfinished };
  }
  return { kind: 'go', to: ROUTES.project.walls(projectId, nextFloor.id), name: nextFloor.label, action: `Sang ${nextFloor.label}`, pending: null, reason: null, hereUnfinished };
}
