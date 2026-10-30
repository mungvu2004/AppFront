import { ArrowRight } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { FlowGate } from '@/components/shell/FlowGate';
import { getButtonStyles } from '@/components/ui/buttonVariants';
import { cn } from '@/lib/utils';
import { SCALE_STATE_VIEWS } from '@/lib/viewmodel/provisionalScale';
import { ROUTES } from '@/routes/paths';

import {
  floorReviewCountsOf,
  floorReviewGateOf,
  SCALE_LOCK_REASON,
  type RequiredLayerKey,
} from './floorReviewGateModel';
import { QC_LAYERS, qcStepOf } from './qcLayers';
import { useFloorReview, useNextFloor } from './useFloorReview';

/**
 * Cổng CHUNG của mọi màn trong tầng: MỘT nút ở khe cổng của header. Tiến độ từng bước
 * (Tỷ lệ · Tường a/b · Cửa c/d · Phòng e/f) đã nằm trên thanh bước của tầng (`QcFloorNav`),
 * nên cổng không vẽ lại hàng điều kiện (UX-R1 K25).
 *
 * Nút luôn đi TỚI (UX-R2 K22/K04). Chỉ tầng "Chưa có tỷ lệ" (đỏ) bị khoá: ngoài màn Tỷ lệ nút là
 * "Đặt tỷ lệ", ở màn Tỷ lệ là "Tiếp: Tường" bị khoá kèm lý do. Tỷ lệ "cần kiểm" (vàng) không kéo
 * người dùng về màn Tỷ lệ — chấm vàng trên thanh bước đã nói việc đó. Đang ở lớp bắt buộc chưa
 * xong mà màn truyền `onNext` → nút mở mục kế tiếp của lớp này. Còn lại nút trỏ bước NGAY SAU
 * màn đang mở (Tỷ lệ → Tường → Cửa và nội thất → Phòng), không bao giờ lùi về lớp trước còn dở;
 * sau Phòng → "Sang <tầng kế>" nếu còn tầng chưa biết là xong, không thì "Sang Mô hình 3D".
 * Màn phụ đi theo bước cha (Kích thước → bước Tỷ lệ, Độ dày → bước Tường); Trục coi như trước Tường.
 */
export interface FloorReviewGateProps {
  readonly projectId: string;
  readonly floorId: string;
  readonly onNext?: (() => void) | undefined;
  readonly nextLabel?: string | undefined;
  /** Bố cục L23: vẽ nút tại chỗ (đáy cột việc) thay vì đẩy vào khe cổng của header. */
  readonly inline?: boolean | undefined;
}

const LAYER_ROUTES: Readonly<Record<RequiredLayerKey, (projectId: string, floorId: string) => string>> = {
  walls: ROUTES.project.walls,
  objects: ROUTES.project.objects,
  rooms: ROUTES.project.rooms,
};

const DEFAULT_NEXT_LABEL = 'Xem mục kế tiếp';
const VIEWER_LABEL = 'Sang Mô hình 3D';
const SCALE_SET_ACTION = SCALE_STATE_VIEWS.missing.action;
const nextStepLabel = (label: string): string => `Tiếp: ${label}`;
const STEP_KEYS = QC_LAYERS.filter((layer) => layer.group === 'step').map((layer) => layer.key);

/** Bước bắt buộc ngay sau màn đang mở; `undefined` khi màn là Phòng (hết bước của tầng). */
function stepAfter(pathname: string, projectId: string, floorId: string): RequiredLayerKey | undefined {
  const here = QC_LAYERS.find((layer) => layer.route(projectId, floorId) === pathname);
  const step = here === undefined ? null : qcStepOf(here.key);
  return STEP_KEYS[(step === null ? 0 : STEP_KEYS.indexOf(step)) + 1] as RequiredLayerKey | undefined;
}

export function FloorReviewGate({ projectId, floorId, onNext, nextLabel, inline = false }: FloorReviewGateProps) {
  const { pathname } = useLocation();
  const { graph, scale } = useFloorReview(projectId, floorId);
  const nextFloor = useNextFloor(projectId, floorId);
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

  /* Đang đứng ở một lớp bắt buộc chưa xong: làm tiếp lớp này trước (khi màn có mục kế tiếp). */
  const hereUnfinished = gate.layers.some((layer) => !layer.done && LAYER_ROUTES[layer.key](projectId, floorId) === pathname);
  const afterKey = stepAfter(pathname, projectId, floorId);
  const after = afterKey === undefined ? null : (gate.layers.find((layer) => layer.key === afterKey) ?? null);

  let action: ReactNode;
  if (scale === 'missing' && pathname !== scaleRoute) {
    action = linkTo(scaleRoute, SCALE_SET_ACTION);
  } else if (scale === 'missing' && after !== null) {
    /* Đang ở màn Tỷ lệ, tỷ lệ còn thiếu: các bước sau khoá; nút nói rõ vì sao. */
    action = (
      <button aria-disabled="true" className={cn(buttonClass, 'cursor-not-allowed opacity-60')} title={SCALE_LOCK_REASON} type="button">
        {nextStepLabel(after.label)}
        <span className="sr-only">{`: ${SCALE_LOCK_REASON}`}</span>
      </button>
    );
  } else if (onNext !== undefined && hereUnfinished) {
    action = (
      <button className={buttonClass} onClick={onNext} type="button">
        {nextLabel ?? DEFAULT_NEXT_LABEL}
      </button>
    );
  } else if (after !== null) {
    action = linkTo(LAYER_ROUTES[after.key](projectId, floorId), nextStepLabel(after.label));
  } else {
    action =
      nextFloor === null
        ? linkTo(ROUTES.project.viewer(projectId), VIEWER_LABEL)
        : linkTo(ROUTES.project.walls(projectId, nextFloor.id), `Sang ${nextFloor.label}`);
  }

  return inline ? action : <FlowGate>{action}</FlowGate>;
}
