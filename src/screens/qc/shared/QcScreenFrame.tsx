import { useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Khung chung của các màn QC (BUG-413, AES-01/AES-04): một gốc cao bằng khung nhìn,
 * một lề trang (`QC_BODY_CLASS`: p-2, gap-2), một khung bản vẽ (`bg-bg-sunken`, bo 16).
 * Chỉ là lớp bọc: vùng (role/aria-label) do màn truyền vào, không đổi tên truy cập.
 */
export const QC_BODY_CLASS = 'gap-2 p-2';

interface QcScreenFrameProps {
  readonly label: string;
  readonly children: ReactNode;
  /** Màn dạng trang cuộn (Độ dày): gốc tự cuộn thay vì chia cột. */
  readonly scroll?: boolean;
}

export function QcScreenFrame({ label, children, scroll = false }: QcScreenFrameProps) {
  return (
    <div
      aria-label={label}
      className={cn('flex h-screen min-h-0 w-full flex-col bg-bg-app', scroll && 'overflow-y-auto')}
      role="region"
    >
      {children}
    </div>
  );
}

interface QcCanvasFrameProps {
  readonly label: string;
  readonly children: ReactNode;
  readonly className?: string;
}

/** Khung bản vẽ: nền và viền bo thống nhất cho cả trạng thái rỗng / đang tải / lỗi. */
export function QcCanvasFrame({ label, children, className }: QcCanvasFrameProps) {
  return (
    <section
      aria-label={label}
      className={cn('min-h-0 min-w-0 overflow-hidden rounded-2xl bg-bg-sunken', className)}
    >
      {children}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Khung bố cục chung của sáu màn duyệt lớp (A3: một bố cục, khe cố định).      */
/* -------------------------------------------------------------------------- */

interface QcWorkspaceProps {
  /** Rail công cụ trái (icon + nhãn chữ). Vắng thì ẩn gọn. */
  readonly rail?: ReactNode;
  /** Panel trái (bộ lọc, danh sách). Vắng thì ẩn gọn. */
  readonly left?: ReactNode;
  readonly canvasLabel: string;
  readonly canvas: ReactNode;
  /** Panel chi tiết phải. 1024-1279: lớp phủ trên mép phải bản vẽ, không rơi xuống dưới. */
  readonly inspector?: ReactNode;
}

const DRAWER_HIDE_LABEL = 'Ẩn chi tiết';
const DRAWER_SHOW_LABEL = 'Hiện chi tiết';

/**
 * Hàng làm việc: rail | panel trái | bản vẽ | chi tiết.
 * - ≥1280: bốn cột, panel trái 280, chi tiết 344.
 * - 1024-1279: chi tiết thành ngăn kéo phủ mép phải bản vẽ (ẩn/hiện được), panel trái giữ cột.
 * - <1024: rail + bản vẽ ở hàng đầu (bản vẽ trước danh sách), hai panel xuống dòng, cả vùng cuộn dọc.
 */
export function QcWorkspace({ rail, left, canvasLabel, canvas, inspector }: QcWorkspaceProps) {
  const [isDrawerOpen, setDrawerOpen] = useState(true);
  const hasInspector = inspector != null && inspector !== false;
  const hasLeft = left != null && left !== false;

  return (
    <div className="relative flex min-h-0 flex-1 gap-2 p-2 max-lg:flex-wrap max-lg:content-start max-lg:overflow-y-auto">
      {rail}
      {hasLeft ? (
        <div className="flex min-h-0 shrink-0 flex-col gap-2 max-lg:order-1 max-lg:w-full lg:w-[280px] lg:overflow-y-auto">
          {left}
        </div>
      ) : null}
      <section
        aria-label={canvasLabel}
        className="relative h-[60vh] min-h-80 min-w-0 flex-1 overflow-hidden rounded-2xl bg-bg-sunken lg:h-auto lg:min-h-0"
      >
        {canvas}
        {hasInspector ? (
          <button
            aria-expanded={isDrawerOpen}
            className="absolute right-3 top-3 z-30 hidden rounded-lg bg-bg-surface px-2.5 py-1 text-body-sm text-text-secondary shadow-float hover:text-text-primary focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-accent lg:max-xl:block"
            onClick={() => setDrawerOpen((open) => !open)}
            type="button"
          >
            {isDrawerOpen ? DRAWER_HIDE_LABEL : DRAWER_SHOW_LABEL}
          </button>
        ) : null}
      </section>
      {hasInspector ? (
        <div
          className={cn(
            'flex min-h-0 flex-col max-lg:order-2 max-lg:w-full xl:w-[344px] xl:shrink-0 xl:overflow-y-auto',
            'lg:max-xl:absolute lg:max-xl:bottom-4 lg:max-xl:right-4 lg:max-xl:top-14 lg:max-xl:z-20 lg:max-xl:w-[344px] lg:max-xl:overflow-y-auto lg:max-xl:rounded-xl lg:max-xl:shadow-overlay',
            !isDrawerOpen && 'lg:max-xl:hidden',
          )}
        >
          {inspector}
        </div>
      ) : null}
    </div>
  );
}

export const QC_UNDO_LABEL = 'Hoàn tác';
export const QC_NO_CHANGES_LABEL = 'Chưa có thay đổi';
const QC_UNDO_EMPTY_HINT = 'Chưa có thao tác để hoàn tác';
const QC_STATUS_BAR_LABEL = 'Thanh trạng thái';

interface QcStatusBarProps {
  /** Vắng: nút "Hoàn tác" vẫn đứng cùng chỗ nhưng tắt (màn chưa có ngăn hoàn tác). */
  readonly onUndo?: (() => void) | undefined;
  /** Trạng thái lưu đã định dạng; vắng thì "Chưa có thay đổi". */
  readonly saveLabel?: string | null | undefined;
  readonly saveFailed?: boolean;
  /** Mục riêng của màn (toạ độ, tỷ lệ…), nằm giữa nút hoàn tác và trạng thái lưu. */
  readonly children?: ReactNode;
}

/** Thanh trạng thái đáy chung: Hoàn tác trái, trạng thái lưu phải, cùng chỗ ở cả sáu màn. */
export function QcStatusBar({ onUndo, saveLabel, saveFailed = false, children }: QcStatusBarProps) {
  return (
    <div
      aria-label={QC_STATUS_BAR_LABEL}
      className="flex h-9 shrink-0 select-none items-center gap-3 whitespace-nowrap border-t border-border-default bg-bg-surface px-4"
      role="status"
    >
      <button
        className="rounded-md px-2 py-0.5 text-body-sm font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:text-text-muted disabled:hover:bg-transparent"
        disabled={onUndo === undefined}
        onClick={onUndo}
        title={onUndo === undefined ? QC_UNDO_EMPTY_HINT : undefined}
        type="button"
      >
        {QC_UNDO_LABEL}
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
      <span
        aria-live="polite"
        className={cn(
          'min-w-0 truncate text-body-sm font-medium',
          saveFailed ? 'text-state-violation-text' : 'text-text-secondary',
        )}
      >
        {saveLabel ?? QC_NO_CHANGES_LABEL}
      </span>
    </div>
  );
}
