import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

import type { FloorLayerDocument } from '@/api/schemas/spatialLayer';
import { FlowGate } from '@/components/shell/FlowGate';
import { getButtonStyles } from '@/components/ui/buttonVariants';
import { useProjectFloors } from '@/hooks/useProjectFloors';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/query/queryKeys';
import { ROUTES } from '@/routes/paths';

import {
  floorReviewCountsOf,
  floorReviewGateOf,
  nextFloorOf,
  SCALE_LOCK_REASON,
  type RequiredLayerKey,
} from './floorReviewGateModel';
import { graphOfDocument, useFloorReview } from './useFloorReview';

/**
 * Cổng CHUNG của mọi màn trong tầng: MỘT nút ở khe cổng của header. Tiến độ từng bước
 * (Tỷ lệ · Tường a/b · Cửa c/d · Phòng e/f) đã nằm trên thanh bước của tầng (`QcFloorNav`),
 * nên cổng không vẽ lại hàng điều kiện (UX-R1 K25).
 *
 * Thứ tự nút: tỷ lệ chưa xác nhận → "Đặt tỷ lệ" (máy không đo được) / "Kiểm tỷ lệ" (máy đo,
 * cần kiểm) đi trước mọi nút khác; đang ở màn Tỷ lệ mà tỷ lệ còn thiếu → "Duyệt tiếp: Tường"
 * bị khoá kèm lý do. Sau đó lớp bắt buộc đầu tiên chưa xong → "Duyệt tiếp: <lớp>" (đang đứng ở
 * lớp đó mà màn truyền `onNext` thì nút mở mục kế tiếp); cả ba xong → "Sang <tầng kế>" nếu còn
 * tầng chưa biết là xong, không thì "Sang Mô hình 3D".
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
const SCALE_SET_ACTION = 'Đặt tỷ lệ';
const SCALE_CHECK_ACTION = 'Kiểm tỷ lệ';

export function FloorReviewGate({ projectId, floorId, onNext, nextLabel }: FloorReviewGateProps) {
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const floors = useProjectFloors(projectId);
  const { graph, storeSpatial, scale } = useFloorReview(projectId, floorId);
  const storeHolds = (id: string) => storeSpatial !== null && storeSpatial.byId[id] !== undefined;
  const gate = useMemo(() => floorReviewGateOf(floorReviewCountsOf(graph, floorId)), [floorId, graph]);
  const scaleRoute = ROUTES.project.scale(projectId, floorId);

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
  if (scale !== null && scale !== 'confirmed' && pathname !== scaleRoute) {
    action = linkTo(scaleRoute, scale === 'missing' ? SCALE_SET_ACTION : SCALE_CHECK_ACTION);
  } else if (scale === 'missing' && gate.next !== null) {
    /* Đang ở màn Tỷ lệ, tỷ lệ còn thiếu: các bước sau khoá; nút nói rõ vì sao. */
    action = (
      <button aria-disabled="true" className={cn(buttonClass, 'cursor-not-allowed opacity-60')} title={SCALE_LOCK_REASON} type="button">
        {`Duyệt tiếp: ${gate.next.label}`}
        <span className="sr-only">{`: ${SCALE_LOCK_REASON}`}</span>
      </button>
    );
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

  return <FlowGate>{action}</FlowGate>;
}
