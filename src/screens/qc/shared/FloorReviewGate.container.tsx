import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { FlowGate } from '@/components/shell/FlowGate';
import { getButtonStyles } from '@/components/ui/buttonVariants';
import { cn } from '@/lib/utils';

import { LAYER_ROUTES, useFloorNextTarget } from './useFloorNextTarget';

/**
 * Cổng CHUNG của mọi màn trong tầng: MỘT nút ở khe cổng của header. Tiến độ từng bước
 * (Tỷ lệ · Tường a/b · Cửa c/d · Phòng e/f) đã nằm trên thanh bước của tầng (`QcFloorNav`),
 * nên cổng không vẽ lại hàng điều kiện (UX-R1 K25).
 *
 * Nút luôn đi TỚI (UX-R2 K22/K04). Chỉ tầng "Chưa có tỷ lệ" (đỏ) bị khoá: ngoài màn Tỷ lệ nút là
 * "Đặt tỷ lệ", ở màn Tỷ lệ là "Tiếp: Tường" bị khoá kèm lý do. Tỷ lệ "cần kiểm" (vàng) không kéo
 * người dùng về màn Tỷ lệ — chấm vàng trên thanh bước đã nói việc đó. Đang ở lớp bắt buộc chưa
 * xong mà màn truyền `onNext` → nút mở mục kế tiếp của lớp này. Còn lại nút trỏ bước NGAY SAU
 * màn đang mở còn việc (Tỷ lệ → Tường → Cửa và nội thất → Phòng; bước đã xong bị bỏ qua), không bao giờ lùi về lớp trước còn dở;
 * sau Phòng → "Sang <tầng kế>" nếu còn tầng chưa biết là xong, không thì "Sang Mô hình 3D".
 * Màn phụ đi theo bước cha (Kích thước → bước Tỷ lệ, Độ dày → bước Tường); Trục coi như trước Tường.
 */
export interface FloorReviewGateProps {
  readonly projectId: string;
  readonly floorId: string;
  readonly onNext?: (() => void) | undefined;
  readonly nextLabel?: string | undefined;
  /** Bố cục L23: vẽ tại chỗ (đáy cột việc), chỉ còn nút mở mục kế tiếp; đổi bước ở `QcStepPager`. */
  readonly inline?: boolean | undefined;
}

const DEFAULT_NEXT_LABEL = 'Xem mục kế tiếp';

export function FloorReviewGate({ projectId, floorId, onNext, nextLabel, inline = false }: FloorReviewGateProps) {
  const { pathname } = useLocation();
  const target = useFloorNextTarget(projectId, floorId, pathname);

  /* Màn công cụ (tỷ lệ, trục, độ dày…) có nút chính của riêng nó: cổng lùi xuống nút phụ để màn chỉ có một nút chính. */
  const onRequiredLayer = Object.values(LAYER_ROUTES).some((route) => route(projectId, floorId) === pathname);
  const buttonClass = cn(getButtonStyles({ variant: onRequiredLayer ? 'primary' : 'secondary', size: 'sm' }), 'shrink-0 gap-2 whitespace-nowrap');

  let action: ReactNode;
  if (target.reason === null && onNext !== undefined && target.hereUnfinished) {
    action = (
      <button className={buttonClass} onClick={onNext} type="button">
        {nextLabel ?? DEFAULT_NEXT_LABEL}
      </button>
    );
  } else if (inline) {
    /* Đáy cột việc: đổi bước là việc của `QcStepPager` ngay dưới; cổng chỉ còn nút mở mục kế tiếp của bước. */
    action = null;
  } else if (target.kind === 'blocked') {
    /* Đang ở màn Tỷ lệ, tỷ lệ còn thiếu: các bước sau khoá; nút nói rõ vì sao. */
    action = (
      <button aria-disabled="true" className={cn(buttonClass, 'cursor-not-allowed opacity-60')} title={target.reason} type="button">
        {target.action}
        <span className="sr-only">{`: ${target.reason}`}</span>
      </button>
    );
  } else {
    /* UX-22: cho sang 3D nhưng nói rõ còn bao nhiêu mục chưa duyệt, tỷ lệ chưa xác nhận. */
    action = (
      <>
        {target.pending === null ? null : (
          <span className="min-w-0 truncate text-[13px] text-state-attention-text" title={target.pending}>
            {target.pending}
          </span>
        )}
        <Link className={buttonClass} to={target.to}>
          {target.action}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </>
    );
  }

  return inline ? action : <FlowGate>{action}</FlowGate>;
}
