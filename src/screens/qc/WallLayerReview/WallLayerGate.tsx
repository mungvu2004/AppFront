/**
 * Câu 3 của màn (HOP-DONG-V6): cổng sang lớp kế, bay vào thanh bước qua `FlowGate`.
 *
 * ≤3 điều kiện (Tường, Cửa/Phòng khi tầng có dữ liệu) + tiến độ + MỘT nút:
 * - chưa xong: nút PHỤ "Duyệt tiếp #W-xxx" mở đoạn kế trong hàng đợi (cùng thứ tự danh sách và
 *   phím J — Tab không gán được: sổ phím chặn Tab, bất biến A12);
 * - xong mọi tường: nút CHÍNH "Tiếp: Cửa" sang lớp Cửa và nội thất;
 * - lỗi đọc lớp: cổng khoá, nói lý do, không nút mời đi tiếp.
 */

import { ArrowRight, Lock } from 'lucide-react';
import type { ReactNode } from 'react';

import { FlowGate, type FlowGateCondition } from '@/components/shell/FlowGate';
import { Button } from '@/components/ui/Button';

import type { WallLayerViewProps } from './types';
import type { WallReviewQueue } from './wallReviewQueue';

const PROGRESS_LABEL = 'Tường đã duyệt';
const NEXT_LAYER_LABEL = 'Tiếp: Cửa';
const NEXT_WALL_PREFIX = 'Duyệt tiếp';
const LOCKED_TEXT = 'Khoá: cần tải được lớp tường';
const NO_WALL_TEXT = 'Chưa có tường để duyệt';
const FALLBACK_CONDITIONS: readonly FlowGateCondition[] = [{ label: 'Tường', done: false }];

export interface WallLayerGateProps {
  readonly panel: Pick<WallLayerViewProps, 'state' | 'reviewCounter' | 'onSelect'>;
  readonly queue?: WallReviewQueue | undefined;
  /** Lớp tường không đọc được (màn lỗi đọc thay cả màn) — cổng khoá. */
  readonly locked?: boolean;
  readonly onNextLayer?: (() => void) | undefined;
}

export function WallLayerGate({ panel, queue, locked = false, onNextLayer }: WallLayerGateProps) {
  const { reviewed, total } = panel.reviewCounter;
  const conditions = queue?.conditions ?? FALLBACK_CONDITIONS;
  const isLocked = locked || panel.state === 'error';
  const wallsDone = total > 0 && reviewed === total;

  let action: ReactNode = null;

  if (isLocked) {
    action = (
      <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-text-secondary">
        <Lock aria-hidden="true" className="h-3.5 w-3.5" />
        {LOCKED_TEXT}
      </span>
    );
  } else if (wallsDone) {
    action = (
      <Button iconAfter={<ArrowRight aria-hidden="true" className="h-4 w-4" />} onClick={onNextLayer} size="sm" variant="primary">
        {NEXT_LAYER_LABEL}
      </Button>
    );
  } else if (queue?.nextWallId != null && queue.nextWallLabel !== null) {
    const nextId = queue.nextWallId;
    const label = `${NEXT_WALL_PREFIX} ${queue.nextWallLabel}`;

    action = (
      <Button aria-keyshortcuts="J" aria-label={label} onClick={() => panel.onSelect(nextId)} shortcut="J" size="sm" variant="secondary">
        {label}
      </Button>
    );
  } else if (panel.state === 'empty') {
    action = <span className="whitespace-nowrap text-[13px] text-text-secondary">{NO_WALL_TEXT}</span>;
  }

  return (
    <FlowGate
      conditions={conditions}
      done={reviewed}
      progressLabel={PROGRESS_LABEL}
      {...(isLocked || panel.state === 'loading' ? {} : { total })}
    >
      {action}
    </FlowGate>
  );
}
