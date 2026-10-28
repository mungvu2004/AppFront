import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';

import { Kbd } from '@/components/ui/Kbd';
import type { CommandItem } from '@/hooks/useCommandPalette';
import { useScreenCommands } from '@/hooks/useScreenCommands';
import { cn } from '@/lib/utils';

import { QC_COMMAND_GROUP } from './qcLayout';
import { ASK_CARD_WIDTH, askCardPlacement, askNavOf, type QcAskRect } from './qcAsk';

/**
 * Thẻ hỏi neo cạnh đối tượng (bố cục L23, đợt 2): thay panel chi tiết phải. Màn đặt nội dung thẻ
 * (thanh tra sẵn có) vào `QcAskSlot`; bản vẽ đọc khe đó và đặt thẻ cạnh hộp chọn của nó
 * (`QcAskAnchor`), lật sang trái khi bên phải không đủ chỗ.
 */
/** Khung bản vẽ không nhận cú bấm/kéo/lăn bắt đầu trong thẻ (kéo nền, bỏ chọn, thu phóng). */
const stop = (event: SyntheticEvent) => event.stopPropagation();

/** Đặt thẻ ở khung toạ độ của hộp chọn; tự đo khung chứa (phần tử cha định vị). */
export function QcAskAnchor({ rect, children }: { readonly rect: QcAskRect | null; readonly children: ReactNode }) {
  const probeRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const probe = probeRef.current;
    if (probe === null || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => setFrame({ width: probe.clientWidth, height: probe.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(probe);
    return () => observer.disconnect();
  }, []);
  /* Khung đo luôn được vẽ (kể cả khi chưa có thẻ), để lần chọn đầu đã có khổ khung. */
  const place = children != null && rect !== null && frame !== null && frame.width > 0 ? askCardPlacement(rect, frame) : null;

  return (
    <>
      <div ref={probeRef} aria-hidden="true" className="pointer-events-none absolute inset-0" />
      {place === null ? null : (
        <div
          className="absolute z-20 flex"
          onClick={stop}
          onContextMenu={stop}
          onDoubleClick={stop}
          onPointerDown={stop}
          onWheel={stop}
          style={{ left: place.left, top: place.top, width: ASK_CARD_WIDTH, maxHeight: place.maxHeight }}
        >
          {children}
        </div>
      )}
    </>
  );
}

export interface QcAskCardProps {
  /** "Đoạn 1 trong 7 cần xem"; vắng khi mục đang chọn đã duyệt. */
  readonly eyebrow: string;
  /** Lý do máy nghi, bằng lời thường ("Ngắn hơn bề dày tường"). */
  readonly reason?: string | null | undefined;
  readonly code?: string | undefined;
  readonly onPrev?: (() => void) | undefined;
  readonly onNext?: (() => void) | undefined;
  /** Nội dung thẻ: thanh tra của màn. Khung thẻ của nó được bỏ để chỉ còn một thẻ. */
  readonly children: ReactNode;
}

const PREV_LABEL = 'Mục trước';
const NEXT_LABEL = 'Mục kế tiếp';
const CARD_LABEL = 'Thẻ hỏi của mục đang chọn';

function NavButton({ label, kbd, onClick, children }: { readonly label: string; readonly kbd: string; readonly onClick: (() => void) | undefined; readonly children: ReactNode }) {
  return (
    <button
      aria-label={label}
      className="flex h-7 items-center gap-1 rounded-md border border-border-control px-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-accent"
      disabled={onClick === undefined}
      onClick={onClick}
      title={`${label} (${kbd})`}
      type="button"
    >
      {children}
      <Kbd>{kbd}</Kbd>
    </button>
  );
}

export function QcAskCard({ eyebrow, reason, code, onPrev, onNext, children }: QcAskCardProps) {
  return (
    <section
      aria-label={CARD_LABEL}
      className={cn(
        'flex min-h-0 w-full flex-col overflow-hidden rounded-xl border border-border-default bg-bg-surface shadow-overlay',
        /* Thanh tra vốn là một thẻ (bo, bóng, cao hết cột): trong thẻ hỏi nó chỉ là thân. */
        '[&>div:last-child>div]:h-auto [&>div:last-child>div]:rounded-none [&>div:last-child>div]:shadow-none',
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border-default px-4 py-2.5">
        <p className="min-w-0 flex-1 truncate text-body-sm text-text-secondary">
          {eyebrow}
          {code === undefined ? null : <span className="ml-2 rounded-sm bg-bg-sunken px-1.5 py-0.5 font-mono text-[12px] text-text-primary">{code}</span>}
        </p>
        <NavButton kbd="K" label={PREV_LABEL} onClick={onPrev}>
          <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" />
        </NavButton>
        <NavButton kbd="J" label={NEXT_LABEL} onClick={onNext}>
          <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
        </NavButton>
      </div>
      {reason == null ? null : (
        <p className="shrink-0 border-b border-border-default bg-state-attention-tint px-4 py-2 text-body-sm font-medium text-state-attention-text">{reason}</p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}

export interface QcQueueAskCardProps<Id extends string> {
  /** Hàng đợi theo thứ tự danh sách; `pending` = còn cần xem. */
  readonly items: readonly { readonly id: Id; readonly pending: boolean }[];
  readonly selectedId: Id | null;
  /** Đơn vị trong đầu thẻ: "Đoạn", "Mục", "Phòng". */
  readonly unit: string;
  readonly onSelect: (id: Id) => void;
  readonly reason?: string | null | undefined;
  readonly children: ReactNode;
}

/** Thẻ hỏi của một hàng đợi: tự tính "k trong N" và ‹ K / › J từ thứ tự danh sách. */
export function QcQueueAskCard<Id extends string>({ items, selectedId, unit, onSelect, reason, children }: QcQueueAskCardProps<Id>) {
  const { position, total, prevId, nextId } = askNavOf(items, selectedId);
  const lower = unit.toLowerCase();
  const commands = useMemo<CommandItem[]>(
    () => [
      ...(nextId === null ? [] : [{ id: 'qc-ask-next', group: QC_COMMAND_GROUP, label: `${unit} cần xem tiếp theo`, shortcut: 'J', keywords: ['tiếp', lower], onSelect: () => onSelect(nextId) }]),
      ...(prevId === null ? [] : [{ id: 'qc-ask-prev', group: QC_COMMAND_GROUP, label: `${unit} cần xem trước đó`, shortcut: 'K', keywords: ['trước', lower], onSelect: () => onSelect(prevId) }]),
    ],
    [lower, nextId, onSelect, prevId, unit],
  );
  useScreenCommands(commands);
  const eyebrow = position !== null ? `${unit} ${position} trong ${total} cần xem` : total > 0 ? `Đã duyệt · còn ${total} cần xem` : 'Đã duyệt hết';
  return (
    <QcAskCard
      eyebrow={eyebrow}
      reason={reason}
      onNext={nextId === null ? undefined : () => onSelect(nextId)}
      onPrev={prevId === null ? undefined : () => onSelect(prevId)}
    >
      {children}
    </QcAskCard>
  );
}
