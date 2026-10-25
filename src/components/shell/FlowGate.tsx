import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, Circle } from 'lucide-react';

import { cn } from '@/lib/utils';

import { flowGateStore } from './flowGateStore';

// ─── FlowGate ─────────────────────────────────────────────────────────────────
// Câu 3 của mỗi màn trong dự án (NGUYEN-TAC-BO-CUC §1): cổng sang bước sau nằm bên
// phải thanh bước của header — ≤3 điều kiện + thanh tiến độ + MỘT nút, không nút chết.
// Màn gắn <FlowGate> ở bất cứ đâu; nội dung bay vào khe của thanh bước (portal) và
// thay nút "Tiếp: …" mặc định của header, để hai chỗ không mời hai kiểu.
// Ngoài dự án (không có thanh bước) thì không hiện gì: màn đặt cổng vào PageHead.

export interface FlowGateCondition {
  readonly label: string;
  readonly done: boolean;
}

export interface FlowGateProps {
  /** ≤3 điều kiện chặn; cảnh báo không đếm ở đây. Có điều kiện thì từ 1280 chỉ vẽ danh sách này
   *  (thanh + số ẩn cho đỡ rối); dưới 1280 danh sách ẩn, chỉ còn số. */
  readonly conditions?: readonly FlowGateCondition[];
  /** Tiến độ của việc đang làm (vd 2/81 tường). Vắng `total` thì không vẽ thanh. */
  readonly done?: number;
  readonly total?: number;
  readonly progressLabel?: string;
  /** MỘT nút: đủ điều kiện thì nút chính sang bước sau, chưa đủ thì nút phụ dẫn tới việc còn thiếu. */
  readonly children?: ReactNode;
}

export function FlowGate({ conditions = [], done = 0, total, progressLabel = 'Tiến độ', children }: FlowGateProps) {
  const { slot } = useSyncExternalStore(flowGateStore.subscribe, flowGateStore.getState);

  useEffect(() => {
    flowGateStore.addOwner(1);
    return () => flowGateStore.addOwner(-1);
  }, []);

  if (slot === null) return null;
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;

  return createPortal(
    <div className="flex shrink-0 items-center gap-4" data-testid="flow-gate">
      {conditions.length > 0 && (
        <ul aria-label="Điều kiện sang bước sau" className="hidden items-center gap-3 whitespace-nowrap text-[13px] xl:flex">
          {conditions.map((condition) => (
            <li
              key={condition.label}
              className={cn('flex items-center gap-1', condition.done ? 'text-state-verified-text' : 'text-text-primary')}
            >
              {condition.done ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <Circle size={12} aria-hidden="true" className="text-text-muted" />
              )}
              <span>{condition.label}</span>
              <span className="sr-only">{condition.done ? ': đã xong' : ': chưa xong'}</span>
            </li>
          ))}
        </ul>
      )}
      {total !== undefined && total > 0 && (
        <span className={cn('flex items-center gap-2', conditions.length > 0 && 'xl:hidden')}>
          <span
            aria-label={progressLabel}
            aria-valuemax={total}
            aria-valuemin={0}
            aria-valuenow={done}
            className="h-1 w-[72px] overflow-hidden rounded-full bg-bg-sunken max-xl:hidden"
            role="meter"
          >
            <span className="block h-full rounded-full bg-state-verified" style={{ width: `${pct}%` }} />
          </span>
          <span className="text-[13px] tabular-nums text-text-secondary" title={progressLabel}>
            <span className="sr-only">{progressLabel}: </span>
            {done}/{total}
          </span>
        </span>
      )}
      {children}
    </div>,
    slot,
  );
}
