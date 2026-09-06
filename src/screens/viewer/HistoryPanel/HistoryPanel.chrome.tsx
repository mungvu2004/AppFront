/**
 * Các mảnh phụ của S-34 — file anh em của `HistoryPanel.tsx`.
 *
 * VIEW THUẦN (R-60): không `@/api`, không `@/store`, không `@/domain`, không
 * `@/lib/http`. Tách ra theo mục D của CLAUDE.md — `HistoryPanel.tsx` giữ đúng
 * bảy nhánh trạng thái, `HistoryPanel.rows.tsx` giữ dòng thời gian, còn hàng
 * chip lọc, bộ chọn người, nhãn nhóm ngày/phiên, khung xương và ba trạng thái
 * rỗng/lỗi/cấm ở đây. Toàn bộ chuỗi tĩnh của màn cũng sống ở đây; màn này KHÔNG
 * tự sửa `src/i18n/vi.json` (R-67 — worker khác sở hữu file đó).
 *
 * ## Không mảnh nào ở đây tự chọn một mã màu hay tự định dạng một con số
 *
 * Màu tới qua token (A1, `local/no-raw-color`); mọi chuỗi hiển thị tới qua props
 * và đã định dạng xong ở viewmodel (A15, `local/no-raw-number`).
 *
 * ## Song lưng dùng `border-border-default`, không phải `--border-hairline`
 *
 * Đặc tả gọi tên một token KHÔNG có thật: `grep '--border' src/styles/globals.css`
 * ra đúng hai dòng (96 và 156), cả hai là `--border-default`, và
 * `tailwind.config.ts:42-44` chỉ phơi ra một lớp viền duy nhất là
 * `border-border-default`. R-68 cấm thêm token vào `src/styles`, A1 cấm viết hex,
 * nên song lưng giữ đúng độ dày 1px của đặc tả và đổi nguồn màu sang token có
 * thật. Ba token còn lại đặc tả nêu (`--accent`, `--text-muted`, `--text-primary`,
 * `--bg-selected`) đều có thật và được dùng nguyên như đặc tả viết.
 */

import { AlertCircle, History } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';

import {
  HISTORY_CATEGORY_LABELS,
  HISTORY_CATEGORY_ORDER,
  HISTORY_PANEL_TEST_IDS,
  type HistoryActor,
  type HistoryCategoryFilter,
  type HistoryPanelProps,
} from './historyPanelTypes';

/* -------------------------------------------------------------------------- */
/* Chuỗi tĩnh của màn.                                                         */
/* -------------------------------------------------------------------------- */

export const REGION_LABEL = 'Lịch sử chỉnh sửa';
export const SHEET_REGION_LABEL = 'Tấm trượt lịch sử chỉnh sửa';
export const TIMELINE_LABEL = 'Dòng thời gian các bước đã làm';
export const CATEGORY_CHIPS_LABEL = 'Lọc theo loại việc';
const ACTOR_SELECT_LABEL = 'Lọc theo người thực hiện';
const ACTOR_ALL_LABEL = 'mọi người';
export const LOADING_LABEL = 'Đang tải lịch sử…';
export const EMPTY_TITLE = 'Chưa có bước nào';
export const EMPTY_DESCRIPTION =
  'Mọi thay đổi bạn làm trên mô hình sẽ hiện ở đây theo thứ tự thời gian, và bước nào cũng quay lại được.';
export const ERROR_TITLE = 'Không tải được lịch sử';
export const ERROR_DESCRIPTION =
  'Danh sách các bước đã làm chưa lấy về được. Mô hình vẫn nguyên vẹn, chỉ riêng phần lịch sử là chưa đọc được.';
export const RETRY_LABEL = 'Tải lại';
export const FORBIDDEN_TITLE = 'Chỉ xem được lịch sử';
export const FORBIDDEN_DESCRIPTION =
  'Vai của bạn trong dự án này xem được các bước đã làm, nhưng chưa quay ngược mô hình về một bước cũ được. Tên người thực hiện cũng được ẩn đi.';
const STEP_LIMIT_TITLE = 'Lịch sử sắp đầy';
export const STEP_LIMIT_DESCRIPTION =
  'Lịch sử giữ một trăm bước gần nhất. Bước cũ nhất sẽ rời khỏi danh sách khi bạn làm thêm một thao tác nữa, và không quay lại được nó nữa.';
export const LOAD_MORE_LABEL = 'Tải thêm';
const ARCHIVED_CAPTION = 'Những bước cũ hơn đã được lưu trữ.';
export const COLLAPSED_CAPTION = 'bước đã làm';
export const EXPAND_LABEL = 'mở bảng lịch sử';

/** `Select` khai `value: string`, nên "mọi người" mang một chuỗi rỗng. */
const ALL_ACTORS_VALUE = '';

/** Bao nhiêu hàng khung xương vẽ trong lúc chờ — sức chứa của panel, không phải ngưỡng. */
const SKELETON_ROW_COUNT = 6;

/* -------------------------------------------------------------------------- */
/* Vỏ panel.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Panel 344 trong viewer.
 *
 * Bốn lớp bắt buộc chung của mọi panel 344 trong repo — `w-[344px]`, cột flex
 * cao hết khung, `overflow-hidden rounded-xl`, `bg-bg-surface` — chép đúng
 * `RoomAreaPanel.chrome.tsx:116-117` và `PropertyInspector.tsx:84-86`.
 */
export const PANEL_CLASS =
  'flex h-full min-h-0 w-[344px] flex-col overflow-hidden rounded-xl bg-bg-surface shadow-panel';

/**
 * Tấm trượt đáy dưới 1024px.
 *
 * Chép khuôn `ScaleCalibrationPanel.tsx:65-70`: container luôn mang cả hai bộ
 * lớp, bộ `lg:` đưa nó về đúng panel tĩnh 344 ở màn rộng. CSS thuần, không media
 * query viết tay và không hằng số breakpoint lặp lại (R-71).
 */
export const SHEET_CLASS =
  'fixed inset-x-0 bottom-0 z-10 flex max-h-[70vh] w-full flex-col overflow-hidden ' +
  'rounded-t-[16px] border-t border-border-default bg-bg-surface shadow-overlay ' +
  'lg:static lg:z-auto lg:h-full lg:min-h-0 lg:w-[344px] lg:max-h-none lg:flex-shrink-0 ' +
  'lg:rounded-xl lg:border-0 lg:shadow-panel';

/** Vòng tiêu điểm 2px, lệch 2px — đúng A12, lấy hẳn từ token. */
export const FOCUS_RING_CLASS =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface';

/* -------------------------------------------------------------------------- */
/* Đầu panel.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Hàng chip lọc theo loại việc.
 *
 * Đúng BA chip cộng "tất cả", vì `HISTORY_CATEGORY_ORDER` của hợp đồng đã chốt
 * thế — chip "nhập xuất" của đặc tả không có dữ liệu nào đứng sau nên không được
 * dựng (phán quyết 2 ở đầu `historyPanelTypes.ts`).
 *
 * Chip là `<button>` thật chứ không phải `Badge`: `Badge` là một `<span>` không
 * bấm được, và R-68 cấm sửa `src/components`. Nền chip đang chọn lấy `bg-selected`
 * cộng chữ `accent-active` — đúng cách `IconButton` tô trạng thái hoạt động, và
 * A2 chỉ dành màu nhấn cho thứ tương tác được.
 */
export function HistoryCategoryChips({
  category,
  onCategoryChange,
}: Pick<HistoryPanelProps, 'onCategoryChange'> & {
  readonly category: HistoryCategoryFilter;
}) {
  return (
    <div
      aria-label={CATEGORY_CHIPS_LABEL}
      className="flex flex-wrap gap-1.5"
      data-testid={HISTORY_PANEL_TEST_IDS.categoryChips}
      role="group"
    >
      {HISTORY_CATEGORY_ORDER.map((value) => {
        const isActive = value === category;

        return (
          <button
            aria-pressed={isActive}
            className={cn(
              'h-[22px] rounded-[6px] px-2 text-[13px] leading-none',
              'transition-colors duration-fast motion-reduce:transition-none',
              isActive
                ? 'bg-bg-selected text-accent-active'
                : 'bg-bg-sunken text-text-secondary hover:bg-bg-hover',
              FOCUS_RING_CLASS,
            )}
            key={value}
            onClick={() => onCategoryChange(value)}
            type="button"
          >
            {HISTORY_CATEGORY_LABELS[value]}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Bộ chọn lọc theo người.
 *
 * `Select` dùng đúng API cũ (`label`/`options`/`value`/`onChange`) — hình dạng đã
 * chạy thật ở `RoomAreaPanel.chrome.tsx:198-206` và đã chứng minh đạt cả
 * `expectAccessible` lẫn `expectVietnamese`. `null` nghĩa là mọi người, và
 * `Select` không nhận `null` nên nó đi qua một chuỗi rỗng.
 */
export function HistoryActorSelect({
  people,
  actorId,
  onActorChange,
}: Pick<HistoryPanelProps, 'people' | 'onActorChange'> & {
  readonly actorId: string | null;
}) {
  return (
    <div data-testid={HISTORY_PANEL_TEST_IDS.actorSelect}>
      <Select
        label={ACTOR_SELECT_LABEL}
        onChange={(value) => onActorChange(value === ALL_ACTORS_VALUE ? null : value)}
        options={[
          { label: ACTOR_ALL_LABEL, value: ALL_ACTORS_VALUE },
          ...people.map((person: HistoryActor) => ({ label: person.label, value: person.id })),
        ]}
        value={actorId ?? ALL_ACTORS_VALUE}
      />
    </div>
  );
}

/** Đầu panel: hàng chip lọc và bộ chọn người, xếp trên dưới trong bề rộng 344. */
export function HistoryPanelHeader({
  filters,
  people,
  onCategoryChange,
  onActorChange,
}: Pick<HistoryPanelProps, 'filters' | 'people' | 'onCategoryChange' | 'onActorChange'>) {
  return (
    <div className="flex flex-col gap-2 px-4 pb-3 pt-4">
      <HistoryCategoryChips category={filters.category} onCategoryChange={onCategoryChange} />
      <HistoryActorSelect
        actorId={filters.actorId}
        onActorChange={onActorChange}
        people={people}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Nhãn nhóm.                                                                  */
/* -------------------------------------------------------------------------- */

/** Nhãn một ngày — `hôm nay`, `hôm qua`, `12 tháng 8`. Chuỗi tới sẵn từ props. */
export function HistoryDayHeading({ label }: { readonly label: string }) {
  return (
    <h3 className="px-4 pb-1 pt-2 text-[13px] font-medium leading-[18px] text-text-secondary">
      {label}
    </h3>
  );
}

/** Nhãn một phiên làm việc trong ngày — `phiên chiều`, `phiên lúc 14:05`. */
export function HistorySessionHeading({ label }: { readonly label: string }) {
  return <h4 className="px-4 pb-1 text-[13px] leading-[18px] text-text-muted">{label}</h4>;
}

/* -------------------------------------------------------------------------- */
/* Trạng thái.                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Song lưng: nét mảnh 1px chạy dọc suốt danh sách.
 *
 * `w-px` là đúng một pixel. Màu lấy `border-border-default` — xem ghi chú đầu
 * file về `--border-hairline`.
 */
export const SPINE_CLASS = 'pointer-events-none absolute bottom-0 left-[11px] top-0 w-px bg-border-default';

/**
 * Chấm 8px trên song lưng.
 *
 * `left-[8px]` đặt tâm chấm trùng song lưng ở `left-[11px]`: 8 + 8/2 = 12, lệch
 * nửa pixel của chính nét vẽ. `top-[14px]` đưa chấm vào giữa dòng đầu của một
 * mục cao 36.
 */
export const DOT_BASE_CLASS =
  'pointer-events-none absolute left-[8px] top-[14px] h-2 w-2 rounded-full';

/**
 * Khung xương lúc chờ: đúng hình dạng DÒNG THỜI GIAN sẽ hiện ra.
 *
 * Song lưng và các chấm được vẽ sẵn ở đây, nên lúc dữ liệu về, thứ duy nhất
 * thay đổi là chữ — không có cú nhảy bố cục nào. `Skeleton` chỉ có bốn preset cố
 * định và không preset nào tên "lịch sử"; `table-row` là cái gần nhất, đúng cách
 * `RoomAreaPanel.chrome.tsx:279-283` lặp nó. R-68 cấm thêm preset mới.
 */
export function HistoryPanelSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label={LOADING_LABEL}
      className="flex min-h-0 flex-1 flex-col"
      data-testid={HISTORY_PANEL_TEST_IDS.skeleton}
    >
      <div className="px-4 pb-3 pt-4">
        <div className="h-[22px] w-40 animate-pulse rounded-[6px] bg-bg-sunken motion-reduce:animate-none" />
        <div className="mt-2 h-9 w-full animate-pulse rounded-lg bg-bg-sunken motion-reduce:animate-none" />
      </div>
      <div className="relative flex flex-col gap-1 pl-6 pr-2">
        <span aria-hidden="true" className={SPINE_CLASS} />
        {Array.from({ length: SKELETON_ROW_COUNT }, (_unused, index) => (
          <div className="relative" key={index}>
            <span aria-hidden="true" className={cn(DOT_BASE_CLASS, 'bg-border-default')} />
            <Skeleton preset="table-row" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Trạng thái rỗng: chưa ai làm gì, nên không có hành động nào để mời. */
export function HistoryEmpty() {
  return (
    <div className="flex min-h-0 flex-1" data-testid={HISTORY_PANEL_TEST_IDS.emptyState}>
      <EmptyState description={EMPTY_DESCRIPTION} icon={<History />} title={EMPTY_TITLE} />
    </div>
  );
}

/** Trạng thái lỗi. Không in nội dung `error` ra màn: cấm hiện id lệnh hay JSON. */
export function HistoryError({ onRetry }: Pick<HistoryPanelProps, 'onRetry'>) {
  return (
    <div className="flex min-h-0 flex-1" data-testid={HISTORY_PANEL_TEST_IDS.errorState}>
      <EmptyState
        action={{ label: RETRY_LABEL, onClick: onRetry }}
        description={ERROR_DESCRIPTION}
        icon={<AlertCircle />}
        title={ERROR_TITLE}
      />
    </div>
  );
}

/**
 * Băng nhắc của trạng thái không có quyền.
 *
 * Không thay dòng thời gian bằng một ô trắng: người xem VẪN đọc được lịch sử,
 * chỉ là không quay ngược được và không biết ai đã làm. Đúng khuôn
 * `PropertyInspector` — thân panel như thường, cộng một băng nhắc.
 */
export function HistoryForbiddenNotice() {
  return (
    <div className="px-4 pb-3">
      <InlineAlert
        level="attention"
        message={FORBIDDEN_DESCRIPTION}
        title={FORBIDDEN_TITLE}
      />
    </div>
  );
}

/**
 * Lời nhắc chạm trần một trăm bước.
 *
 * Đây là một trong hai lối vào trạng thái "một phần", và nó nói câu khác hẳn lối
 * kia: bước cũ nhất SẮP BỊ BỎ, chứ không phải còn ở đâu đó chờ tải về.
 */
export function HistoryStepLimitNotice() {
  return (
    <div className="px-4 pb-3" data-testid={HISTORY_PANEL_TEST_IDS.stepLimitNotice}>
      <InlineAlert level="attention" message={STEP_LIMIT_DESCRIPTION} title={STEP_LIMIT_TITLE} />
    </div>
  );
}

/** Lối vào thứ hai của "một phần": lịch sử cũ đã lưu trữ, tải thêm được. */
export function HistoryLoadMore({ onLoadMore }: Pick<HistoryPanelProps, 'onLoadMore'>) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 pb-3 pt-1">
      <p className="text-[13px] leading-[18px] text-text-muted">{ARCHIVED_CAPTION}</p>
      <Button
        data-testid={HISTORY_PANEL_TEST_IDS.loadMore}
        fullWidth
        onClick={onLoadMore}
        size="sm"
        variant="secondary"
      >
        {LOAD_MORE_LABEL}
      </Button>
    </div>
  );
}

/**
 * Trạng thái thu gọn.
 *
 * Panel nhường chỗ cho khung nhìn 3D, giữ lại đúng một dòng: có bao nhiêu bước
 * đang đứng sau nó, và một đường mở lại. `visibleCount` là một con số đếm chứ
 * không phải một số đo, nên nó in thẳng — không có phép định dạng nào ở đây
 * (A15).
 */
export function HistoryCollapsedBar({
  visibleCount,
  onToggleCollapse,
}: Pick<HistoryPanelProps, 'visibleCount' | 'onToggleCollapse'>) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2 px-4 py-3 text-left text-text-secondary',
        'transition-colors duration-fast motion-reduce:transition-none hover:bg-bg-hover',
        FOCUS_RING_CLASS,
      )}
      onClick={onToggleCollapse}
      title={EXPAND_LABEL}
      type="button"
    >
      <History aria-hidden="true" size={18} strokeWidth={1.5} />
      <span className="text-[13px] leading-[18px]">
        <span className="font-mono tabular-nums text-text-primary">{visibleCount}</span>{' '}
        {COLLAPSED_CAPTION}
      </span>
    </button>
  );
}
