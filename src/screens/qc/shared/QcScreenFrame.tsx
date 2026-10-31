import { PanelLeftOpen } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { QC_COLUMN_DRAWER_CLASS, QC_COLUMN_ID } from './qcLayout';

/**
 * Khung chung của các màn QC (BUG-413, AES-01/AES-04): một gốc lấp phần còn lại dưới header và
 * thanh bước của `AppLayout` (vỏ nội dung là cột flex có chiều cao; `ScreenMain` là `contents`) —
 * không dùng `h-screen`, vốn cộng thêm chiều cao header nên trang cuộn ở 1920×1080 (UX-R2),
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
      className={cn('flex min-h-0 w-full flex-1 flex-col bg-bg-app', scroll && 'overflow-y-auto')}
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
  /** Cột trái rộng 320 thay 240 ở >=1024 (thẻ có ảnh cắt + ô nhập). */
  readonly wideLeft?: boolean;
  /** Bố cục L23 (`qcLayout.ts`): cột việc 300 ở 1024-1279, 360 từ 1280. Thắng `wideLeft`. */
  readonly column?: boolean;
  /** Chrome nổi góc trên phải bản vẽ (nút "Hiển thị"), đứng trước nút ẩn/hiện chi tiết. */
  readonly chromeTopRight?: ReactNode;
  readonly canvasLabel: string;
  readonly canvas: ReactNode;
  /** Thẻ nổi trên bản vẽ không gắn với mục nào (bố cục L23: thẻ Xong tầng). */
  readonly canvasOverlay?: ReactNode;
  /** Panel chi tiết phải. 1024-1279: lớp phủ trên mép phải bản vẽ, không rơi xuống dưới. */
  readonly inspector?: ReactNode;
  /**
   * Khoá đối tượng đang chọn (null/vắng = chưa chọn). 1024-1279: ngăn chi tiết đóng khi chưa
   * chọn gì (không che bản vẽ), tự mở khi chọn; người dùng ẩn/hiện tay theo từng lần chọn.
   */
  readonly selectionKey?: string | null | undefined;
}

const DRAWER_HIDE_LABEL = 'Ẩn chi tiết';
const DRAWER_SHOW_LABEL = 'Hiện chi tiết';
const COLUMN_OPEN_LABEL = 'Mở cột việc';
const COLUMN_OPEN_TEXT = 'Việc';
const COLUMN_CLOSE_LABEL = 'Đóng cột việc';

/**
 * Hàng làm việc: rail | panel trái | bản vẽ | chi tiết.
 * - ≥1280: bốn cột, panel trái 240, chi tiết 240 (bản vẽ ≥ 60 % ở 1440).
 * - 1024-1279: chi tiết thành ngăn kéo phủ mép phải bản vẽ (ẩn/hiện được), panel trái giữ cột.
 * - <1024: rail + bản vẽ ở hàng đầu (bản vẽ trước danh sách), hai panel xuống dòng, cả vùng cuộn dọc.
 *   Bố cục L23 (`column`) thì khác: bản vẽ chiếm hết, cột việc thành ngăn kéo phủ từ trái — mở khi
 *   chưa chọn gì (việc nằm ở cột), tự đóng khi chọn một mục (thẻ hỏi trên bản vẽ cần chỗ), mở lại bằng
 *   nút "Việc" ở góc trên trái bản vẽ.
 */
export function QcWorkspace({
  rail,
  left,
  wideLeft = false,
  column = false,
  chromeTopRight,
  canvasLabel,
  canvas,
  canvasOverlay,
  inspector,
  selectionKey = null,
}: QcWorkspaceProps) {
  // Ẩn/hiện tay chỉ áp cho lần chọn đang có; đổi lựa chọn thì về mặc định (mở khi có chọn).
  const [manual, setManual] = useState<{ readonly key: string | null; readonly open: boolean } | null>(null);
  const isDrawerOpen = manual?.key === selectionKey ? manual.open : selectionKey != null;
  const hasInspector = inspector != null && inspector !== false;
  const hasLeft = left != null && left !== false;
  const [columnManual, setColumnManual] = useState<{ readonly key: string | null; readonly open: boolean } | null>(null);
  // U58: dưới 1024 cột việc là ngăn kéo, mặc định đóng để không che bản vẽ; từ 1024 nó luôn hiện (class chỉ áp max-lg).
  const isColumnOpen = columnManual?.key === selectionKey ? columnManual.open : false;
  const setColumnOpen = (open: boolean) => setColumnManual({ key: selectionKey, open });
  const columnDrawer = column && hasLeft;

  return (
    <div className={cn('relative flex min-h-0 flex-1 gap-2 p-2', !columnDrawer && 'max-lg:flex-wrap max-lg:content-start max-lg:overflow-y-auto')}>
      {rail}
      {hasLeft ? (
        <div
          className={cn(
            'flex min-h-0 shrink-0 flex-col gap-2 lg:overflow-y-auto',
            columnDrawer ? QC_COLUMN_DRAWER_CLASS : 'max-lg:order-1 max-lg:w-full',
            columnDrawer && !isColumnOpen && 'max-lg:hidden',
            column ? 'lg:w-[300px] xl:w-[360px]' : wideLeft ? 'lg:w-[320px]' : 'lg:w-[240px]',
          )}
          id={columnDrawer ? QC_COLUMN_ID : undefined}
        >
          {left}
        </div>
      ) : null}
      {columnDrawer && isColumnOpen ? <QcColumnScrim onClose={() => setColumnOpen(false)} /> : null}
      <section
        aria-label={canvasLabel}
        className={cn('relative min-w-0 flex-1 overflow-hidden rounded-2xl bg-bg-sunken lg:h-auto lg:min-h-0', columnDrawer ? 'min-h-0' : 'h-[60vh] min-h-80')}
      >
        {canvas}
        {canvasOverlay}
        {columnDrawer ? <QcColumnHandle open={isColumnOpen} onOpen={() => setColumnOpen(true)} /> : null}
        {chromeTopRight != null || hasInspector ? (
          <div className="absolute right-3 top-3 z-30 flex items-center gap-2">
            {chromeTopRight}
            {hasInspector ? (
              <button
                aria-expanded={isDrawerOpen}
                className="hidden rounded-lg bg-bg-surface px-2.5 py-1 text-body-sm text-text-secondary shadow-float hover:text-text-primary focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-accent lg:max-xl:block"
                onClick={() => setManual({ key: selectionKey, open: !isDrawerOpen })}
                type="button"
              >
                {isDrawerOpen ? DRAWER_HIDE_LABEL : DRAWER_SHOW_LABEL}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
      {hasInspector ? (
        <div
          className={cn(
            'flex min-h-0 flex-col max-lg:order-2 max-lg:w-full xl:w-[240px] xl:shrink-0 xl:overflow-y-auto',
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
  /** Trạng thái lưu đã định dạng; vắng thì "Chưa có thay đổi"; `false` = màn đã nói ở QcPanelHead, không lặp. */
  readonly saveLabel?: string | false | null | undefined;
  readonly saveFailed?: boolean;
  /** Mục riêng của màn (toạ độ, tỷ lệ…), nằm giữa nút hoàn tác và trạng thái lưu. */
  readonly children?: ReactNode;
}

/** Thanh trạng thái đáy chung: Hoàn tác trái, trạng thái lưu phải, cùng chỗ ở cả sáu màn. */
export function QcStatusBar({ onUndo, saveLabel, saveFailed = false, children }: QcStatusBarProps) {
  return (
    <div
      aria-label={QC_STATUS_BAR_LABEL}
      // Toast neo trên thanh này theo dấu này, không theo chữ hiển thị (U22).
      data-qc-status-bar=""
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
      {saveLabel === false ? null : <span
        aria-live="polite"
        className={cn(
          'min-w-0 truncate text-body-sm font-medium',
          saveFailed ? 'text-state-violation-text' : 'text-text-secondary',
        )}
      >
        {saveLabel ?? QC_NO_CHANGES_LABEL}
      </span>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Cột việc L23 dưới 1024: ngăn kéo phủ từ trái (QcWorkspace, màn Tỷ lệ).      */
/* -------------------------------------------------------------------------- */

/** Nền mờ sau ngăn kéo cột việc; bấm là đóng. Chỉ có dưới 1024. */
export function QcColumnScrim({ onClose }: { readonly onClose: () => void }) {
  return <button aria-label={COLUMN_CLOSE_LABEL} className="absolute inset-0 z-30 cursor-default bg-bg-overlay lg:hidden" onClick={onClose} type="button" />;
}

/**
 * Nút "Việc" mở lại ngăn kéo cột việc. Chỉ có dưới 1024. Đứng ở góc trên trái, ngay dưới nút
 * Từng việc/Tổng thể (cùng hàng công cụ nổi), không giữa mép trái — chỗ đó đè nét vẽ (U47).
 */
export function QcColumnHandle({ open, onOpen }: { readonly open: boolean; readonly onOpen: () => void }) {
  return (
    <button
      aria-controls={QC_COLUMN_ID}
      aria-expanded={open}
      aria-label={COLUMN_OPEN_LABEL}
      className="absolute left-3 top-14 z-30 flex items-center gap-1.5 rounded-lg bg-bg-surface px-2.5 py-1.5 text-body-sm font-medium text-text-primary shadow-float hover:bg-bg-hover focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-accent lg:hidden"
      onClick={onOpen}
      type="button"
    >
      <PanelLeftOpen aria-hidden="true" className="h-4 w-4" />
      {COLUMN_OPEN_TEXT}
    </button>
  );
}
