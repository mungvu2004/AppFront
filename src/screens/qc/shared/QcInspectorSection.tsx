import { ChevronDown } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Mảnh của panel phải neo (bố cục hai panel kiểu Figma, `docs/figma-layout-spec.md`): một khối
 * `bg-surface` không bóng, các mục xếp dọc, kẻ mảnh giữa mục, không thẻ lồng thẻ.
 * - `QcInspectorShell`: khung panel + thanh đầu mang trigger "Hiển thị" (chế độ nhìn ở danh sách phóng `QcZoomMenu`) (dùng chung với `QcAskCard`);
 * - `QcInspectorEmpty`: chưa chọn gì ("Tầng này"): tiêu đề, gợi ý, các mục bên dưới;
 * - `QcInspectorSection`: một mục ("Kích thước", "Độ tin cậy"…) kiểu panel Design của Figma.
 */

const FOCUS_RING = 'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-accent';

interface QcInspectorShellProps {
  readonly label: string;
  /** Trigger "Hiển thị" (popover, biến thể không nổi): ở thanh đầu panel. Vắng thì không có thanh. */
  readonly display?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}

/** Khung panel phải: thanh đầu (nếu có) + phần còn lại do người gọi chia (đầu dính, thân cuộn, chân ghim). */
export function QcInspectorShell({ label, display, children, className }: QcInspectorShellProps) {
  return (
    <section aria-label={label} className={cn('flex h-full min-h-0 w-full flex-col overflow-hidden bg-bg-surface', className)}>
      {display == null ? null : (
        <div className="flex h-11 shrink-0 items-center justify-end gap-2 border-b border-border-default px-3">{display}</div>
      )}
      {children}
    </section>
  );
}

export interface QcInspectorEmptyProps {
  /** "Tầng này". Cũng là tên vùng truy cập của panel. */
  readonly title: string;
  /** "Chọn một đoạn tường trên bản vẽ hoặc trong danh sách để duyệt." */
  readonly hint?: ReactNode;
  readonly display?: ReactNode;
  /** Nút phụ + các `QcInspectorSection` ("Chú giải"…). */
  readonly children?: ReactNode;
}

/** Panel phải khi chưa chọn gì: thuộc tính của tầng thay cho thuộc tính của mục (như Figma hiện "Page"). */
export function QcInspectorEmpty({ title, hint, display, children }: QcInspectorEmptyProps) {
  return (
    <QcInspectorShell display={display} label={title}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex flex-col gap-1.5 px-4 pb-4 pt-3">
          <h2 className="text-body-sm font-semibold text-text-primary">{title}</h2>
          {hint == null ? null : <p className="text-body-sm text-text-secondary">{hint}</p>}
        </div>
        {children}
      </div>
    </QcInspectorShell>
  );
}

export interface QcInspectorSectionProps {
  readonly title: string;
  /** Gập/mở được bằng tiêu đề. Mặc định `false` (luôn mở). */
  readonly collapsible?: boolean;
  /** Trạng thái đầu khi `collapsible`. Mặc định `true`. */
  readonly defaultOpen?: boolean;
  /** Nút nhỏ ở cuối dòng tiêu đề ("+", "Khác…"), như "Styles +" của Figma. */
  readonly action?: ReactNode;
  readonly children: ReactNode;
}

/** Một mục của panel phải: tiêu đề 13 px đậm, kẻ mảnh trên, đệm 12×16, dòng nội dung 32 px. */
export function QcInspectorSection({ title, collapsible = false, defaultOpen = true, action, children }: QcInspectorSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const isOpen = !collapsible || open;
  const heading = <span className="min-w-0 flex-1 truncate text-left text-body-sm font-semibold text-text-primary">{title}</span>;

  return (
    <section aria-label={title} className="border-t border-border-default px-4 py-3 first:border-t-0">
      <div className="flex h-8 items-center gap-2">
        {collapsible ? (
          <button
            aria-controls={bodyId}
            aria-expanded={open}
            className={cn('-ml-1 flex h-8 min-w-0 flex-1 items-center gap-1 rounded-md pl-1 hover:text-text-primary', FOCUS_RING)}
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            {heading}
            <ChevronDown
              aria-hidden="true"
              className={cn('h-3.5 w-3.5 shrink-0 text-text-muted transition-transform duration-180', !open && '-rotate-90')}
            />
          </button>
        ) : (
          heading
        )}
        {action == null ? null : <div className="flex shrink-0 items-center">{action}</div>}
      </div>
      {isOpen ? (
        <div className="flex flex-col text-body-sm text-text-secondary [&>*]:min-h-8" id={bodyId}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
