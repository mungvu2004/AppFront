import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { createAppApiClient } from '@/api/appClient';
import { floorLayerToGraph } from '@/api/floorLayerGraph';
import type { FloorLayerDocument } from '@/api/schemas/spatialLayer';
import { FlowGate } from '@/components/shell/FlowGate';
import { getButtonStyles } from '@/components/ui/buttonVariants';
import { normalizeSpatial, type NormalizedSpatial } from '@/domain/spatial/normalize';
import { useProjectFloors } from '@/hooks/useProjectFloors';
import { entitiesOfKind } from '@/lib/commands/business/shared';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/query/queryKeys';
import { ROUTES } from '@/routes/paths';
import { useStore } from '@/store';

import {
  floorReviewConditionLabel,
  floorReviewCountsOf,
  floorReviewGateOf,
  nextFloorOf,
  scaleIsConfirmed,
  type RequiredLayerKey,
} from './floorReviewGateModel';

/**
 * Cổng CHUNG của mọi màn trong tầng (CONTRACT ux-2610 mục 2): cùng 3 điều kiện
 * "Tường a/b · Cửa c/d · Phòng e/f" (chữ gọn cho 1024/768) ở mọi tab, và MỘT nút:
 * lớp bắt buộc đầu tiên chưa xong → "Duyệt tiếp: <lớp>" (đang đứng ở lớp đó mà màn truyền
 * `onNext` thì nút mở mục kế tiếp); cả ba xong → "Sang <tầng kế>" nếu còn tầng chưa biết là xong,
 * không thì "Sang Mô hình 3D". Tỷ lệ tầng chưa do người đặt → thêm điều kiện "Tỷ lệ chưa kiểm"
 * và nút "Đặt tỷ lệ" đi trước mọi nút khác. Cổng luôn có đúng một nút.
 *
 * Số đọc từ kho khi kho đang giữ tầng này (màn duyệt ghi cờ `reviewed` vào kho trước khi lưu),
 * không thì từ N16 dưới `layer.byFloor` (cùng khoá với `useFloorLayer`, dùng lại cache).
 */
export interface FloorReviewGateProps {
  readonly projectId: string;
  readonly floorId: string;
  readonly onNext?: (() => void) | undefined;
  readonly nextLabel?: string | undefined;
}

const LAYER_ROUTES: Readonly<Record<RequiredLayerKey, (projectId: string, floorId: string) => string>> = {
  walls: ROUTES.project.walls,
  objects: ROUTES.project.objects,
  rooms: ROUTES.project.rooms,
};

const DEFAULT_NEXT_LABEL = 'Duyệt mục kế tiếp';
const VIEWER_LABEL = 'Sang Mô hình 3D';
const SCALE_CONDITION = 'Tỷ lệ chưa kiểm';
const SCALE_ACTION = 'Đặt tỷ lệ';

const graphOfDocument = (document: FloorLayerDocument | undefined): NormalizedSpatial | null =>
  document === undefined ? null : normalizeSpatial(floorLayerToGraph(document));


export function FloorReviewGate({ projectId, floorId, onNext, nextLabel }: FloorReviewGateProps) {
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const floors = useProjectFloors(projectId);
  const storeSpatial = useStore((state) => (state.spatialProjectId === projectId ? state.spatial : null));
  const storeScaleStatus = useStore((state) => state.floorMeta[floorId]?.scaleStatus);
  const storeHolds = (id: string) => storeSpatial !== null && storeSpatial.byId[id] !== undefined;
  const fromStore = storeHolds(floorId);
  const { data } = useQuery({
    queryKey: queryKeys.layer.byFloor(projectId, floorId),
    queryFn: async ({ signal }) => {
      const result = await createAppApiClient().spatial.readLayer({ floorId, projectId, signal });
      if (!result.ok) throw result.error;
      return result.data;
    },
    enabled: !fromStore,
  });
  const graph = useMemo(() => (fromStore ? storeSpatial : graphOfDocument(data)), [data, fromStore, storeSpatial]);
  const gate = useMemo(() => floorReviewGateOf(floorReviewCountsOf(graph, floorId)), [floorId, graph]);

  /* Tỷ lệ: chỉ xét khi đã có tầng (kho hoặc N16); chưa đọc được thì bỏ qua, không đoán. */
  const level = graph === null ? undefined : entitiesOfKind(graph, 'level').find((item) => item.id === floorId);
  const scaleOk =
    level === undefined || scaleIsConfirmed(fromStore ? storeScaleStatus : data?.scaleStatus, level.scaleMillimetresPerPixel);
  const scaleRoute = ROUTES.project.scale(projectId, floorId);

  const conditions = [
    ...(scaleOk ? [] : [{ label: SCALE_CONDITION, done: false }]),
    ...gate.layers.map((layer) => ({ label: floorReviewConditionLabel(layer), done: layer.done })),
  ];
  /* Màn công cụ (tỷ lệ, trục, độ dày…) có nút chính của riêng nó: cổng lùi xuống nút phụ để màn chỉ có một nút chính. */
  const onRequiredLayer = Object.values(LAYER_ROUTES).some((route) => route(projectId, floorId) === pathname);
  const buttonClass = cn(getButtonStyles({ variant: onRequiredLayer ? 'primary' : 'secondary', size: 'sm' }), 'shrink-0 gap-2 whitespace-nowrap');
  const arrow = <ArrowRight aria-hidden="true" className="h-4 w-4" />;
  const linkTo = (to: string, label: string) => (
    <Link className={buttonClass} to={to}>
      {label}
      {arrow}
    </Link>
  );

  let action: ReactNode;
  if (!scaleOk && pathname !== scaleRoute) {
    action = linkTo(scaleRoute, SCALE_ACTION);
  } else if (gate.next !== null) {
    /* Đang đứng ở một lớp bắt buộc chưa xong và màn có mục kế tiếp: làm tiếp lớp này trước, không đẩy về lớp khác. */
    const here = gate.layers.find((layer) => !layer.done && LAYER_ROUTES[layer.key](projectId, floorId) === pathname);
    const route = LAYER_ROUTES[gate.next.key](projectId, floorId);
    action =
      onNext !== undefined && here !== undefined ? (
        <button className={buttonClass} onClick={onNext} type="button">
          {nextLabel ?? DEFAULT_NEXT_LABEL}
        </button>
      ) : (
        linkTo(route, `Duyệt tiếp: ${gate.next.label}`)
      );
  } else {
    /* ponytail: tầng khác chỉ biết "xong" khi kho hoặc cache N16 đã có nó; chưa đọc thì coi là chưa xong. */
    const isDone = (id: string) => {
      const other = storeHolds(id)
        ? storeSpatial
        : graphOfDocument(queryClient.getQueryData<FloorLayerDocument>(queryKeys.layer.byFloor(projectId, id)));
      return other !== null && floorReviewGateOf(floorReviewCountsOf(other, id)).next === null;
    };
    const nextFloor = nextFloorOf(floors, floorId, isDone);
    action =
      nextFloor === null
        ? linkTo(ROUTES.project.viewer(projectId), VIEWER_LABEL)
        : linkTo(ROUTES.project.walls(projectId, nextFloor.id), `Sang ${nextFloor.label}`);
  }

  return <FlowGate conditions={conditions}>{action}</FlowGate>;
}
