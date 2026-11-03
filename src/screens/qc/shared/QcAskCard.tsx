import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';

import type { CommandItem } from '@/hooks/useCommandPalette';
import { useScreenCommands } from '@/hooks/useScreenCommands';
import { cn } from '@/lib/utils';

import { QC_COMMAND_GROUP } from './qcLayout';
import { askNavOf } from './qcAsk';
import { QcInspectorShell } from './QcInspectorSection';

/**
 * Panel chi tiết phải của mục đang chọn (bố cục hai panel, `docs/figma-layout-spec.md`): neo cố định cạnh
 * bản vẽ (`QcWorkspace` chế độ `column`), cao hết cột, không bóng. Thanh đầu mang trigger "Hiển thị";
 * đầu dính 44 px: mã + huy hiệu + ‹ K › J × Esc; dòng mờ "Đoạn k trong N cần xem"; dải lý do (khi có);
 * thân cuộn; chân ghim ngoài vùng cuộn.
 */

/**
 * @deprecated Shim chuyển tiếp: panel đã neo ở `QcWorkspace` (prop `inspector`, hoặc khe `QcAskSlot`),
 * không còn nổi trên bản vẽ. Không vẽ gì; gỡ khỏi bản vẽ rồi xoá.
 */
export function QcAskAnchor(props: { readonly rect: unknown; readonly children?: ReactNode }) {
  void props;
  return null;
}

export interface QcAskCardProps {
  /** "Đoạn 1 trong 7 cần xem"; vắng khi mục đang chọn đã duyệt. */
  readonly eyebrow: string;
  /** Lý do máy nghi, bằng lời thường ("Ngắn hơn bề dày tường"). */
  readonly reason?: string | null | undefined;
  readonly code?: string | undefined;
  readonly onPrev?: (() => void) | undefined;
  readonly onNext?: (() => void) | undefined;
  /** × = bỏ chọn mục (như Esc). */
  readonly onClose?: (() => void) | undefined;
  /** Huy hiệu trạng thái cạnh mã ("Cần xem", "Đã duyệt"). */
  readonly badge?: ReactNode;
  /** Trigger "Hiển thị" ở thanh đầu panel. */
  readonly display?: ReactNode;
  /** Chân ghim ngoài vùng cuộn: Duyệt (A) · Để sau (S) · Xoá, hoặc thông báo khoá tỷ lệ. */
  readonly footer?: ReactNode;
  /** Thân: các `QcInspectorSection`. Thanh tra cũ (một thẻ) vẫn nhận được: khung thẻ của nó bị bỏ. */
  readonly children: ReactNode;
}

const PREV_LABEL = 'Mục trước';
const NEXT_LABEL = 'Mục kế tiếp';
export const QC_INSPECTOR_LABEL = 'Chi tiết mục đang chọn';
const CLOSE_LABEL = 'Bỏ chọn';

/* Nút vuông chỉ có biểu tượng: panel 260 px vẫn đủ chỗ cho mã + huy hiệu; phím ở `title` + `aria-keyshortcuts`. */
function NavButton({ label, kbd, onClick, children }: { readonly label: string; readonly kbd: string; readonly onClick: (() => void) | undefined; readonly children: ReactNode }) {
  return (
    <button
      aria-keyshortcuts={kbd === 'Esc' ? 'Escape' : kbd}
      aria-label={label}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border-control text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-accent"
      disabled={onClick === undefined}
      onClick={onClick}
      title={`${label} (${kbd})`}
      type="button"
    >
      {children}
    </button>
  );
}

export function QcAskCard({ eyebrow, reason, code, badge, display, footer, onPrev, onNext, onClose, children }: QcAskCardProps) {
  /* Không có mã thì vị trí trong hàng đợi lên đầu, không lặp ở dòng phụ. */
  const head = code ?? eyebrow;
  return (
    <QcInspectorShell
      className={cn(
        /* Chuyển tiếp: thanh tra cũ là một thẻ (bo, bóng, cao hết cột) — ở đây chỉ là thân, co theo panel để
           thân của nó tự cuộn và hàng nút đáy của nó luôn thấy. Gỡ khi màn đã dùng `QcInspectorSection` + `footer`. */
        '[&>[data-qc-body]>div]:h-auto [&>[data-qc-body]>div]:min-h-0 [&>[data-qc-body]>div]:shrink [&>[data-qc-body]>div]:rounded-none [&>[data-qc-body]>div]:shadow-none',
      )}
      display={display}
      label={QC_INSPECTOR_LABEL}
    >
      <header className="shrink-0 border-b border-border-default pb-2">
        <div className="flex h-11 items-center gap-1 pl-4 pr-2">
          <p
            className={cn('min-w-0 truncate', code === undefined ? 'text-body-sm font-semibold text-text-primary' : 'font-mono text-body-sm font-semibold text-text-primary')}
            title={head}
          >
            {head}
          </p>
          {badge == null ? null : <span className="ml-1 flex shrink-0 items-center">{badge}</span>}
          <span className="flex-1" />
          <NavButton kbd="K" label={PREV_LABEL} onClick={onPrev}>
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          </NavButton>
          <NavButton kbd="J" label={NEXT_LABEL} onClick={onNext}>
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </NavButton>
          {onClose === undefined ? null : (
            <NavButton kbd="Esc" label={CLOSE_LABEL} onClick={onClose}>
              <X aria-hidden="true" className="h-4 w-4" />
            </NavButton>
          )}
        </div>
        {code === undefined ? null : (
          <p className="-mt-1 truncate px-4 text-caption text-text-muted" title={eyebrow}>
            {eyebrow}
          </p>
        )}
      </header>
      {/* Dải lý do chỉ có khi máy nêu lý do. */}
      {reason == null ? null : (
        <p className="shrink-0 border-b border-border-default bg-state-attention-tint px-4 py-2 text-body-sm font-medium text-state-attention-text" title={reason}>{reason}</p>
      )}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" data-qc-body="">{children}</div>
      {footer == null ? null : <footer className="shrink-0 border-t border-border-default px-4 py-3">{footer}</footer>}
    </QcInspectorShell>
  );
}

export interface QcQueueAskCardProps<Id extends string> {
  /** Hàng đợi theo thứ tự danh sách; `pending` = còn cần xem. */
  readonly items: readonly { readonly id: Id; readonly pending: boolean }[];
  readonly selectedId: Id | null;
  /** Đơn vị trong đầu thẻ: "Đoạn", "Mục", "Phòng". */
  readonly unit: string;
  /** `null` = bỏ chọn (nút đóng thẻ). */
  readonly onSelect: (id: Id | null) => void;
  readonly reason?: string | null | undefined;
  /** Chuyển thẳng xuống `QcAskCard`. */
  readonly code?: string | undefined;
  readonly badge?: ReactNode;
  readonly display?: ReactNode;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
}

/** Panel chi tiết của một hàng đợi: tự tính "k trong N" và ‹ K / › J từ thứ tự danh sách. */
export function QcQueueAskCard<Id extends string>({ items, selectedId, unit, onSelect, reason, children, ...card }: QcQueueAskCardProps<Id>) {
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
      {...card}
      eyebrow={eyebrow}
      reason={reason}
      onClose={() => onSelect(null)}
      onNext={nextId === null ? undefined : () => onSelect(nextId)}
      onPrev={prevId === null ? undefined : () => onSelect(prevId)}
    >
      {children}
    </QcAskCard>
  );
}
