/**
 * Màn S-18 "Chuẩn hoá độ dày tường" (`ThicknessStandardization`) — VIEW THUẦN.
 *
 * Bố cục đúng đặc tả, một cột dọc rộng tối đa {@link CONTENT_MAX_WIDTH_CLASS}:
 *
 * ```
 * ┌ đầu màn: breadcrumb · tiêu đề · mô tả ─────────────────────────────┐
 * ├ biểu đồ phân bố (ba ngưỡng kéo được) ──────────────────────────────┤
 * ├ hàng tóm tắt bốn số ───────────────────────────────────────────────┤
 * ├ cột trái: bảng nhóm → bảng chi tiết 48 đoạn │ cột phải 320: canvas ┤
 * ├ thanh áp dụng: dung sai · xem trước · áp · hoàn tác ───────────────┘
 * ```
 *
 * Canvas bên phải CHỈ là xem trước phụ: nó không nhận thao tác sửa nào, và màn
 * vẫn dùng được đủ khi nó bị thu gọn.
 *
 * Nhận HẾT qua props ({@link ThicknessStandardizationViewProps}) và chỉ dựng
 * thẻ. Không `@/api`, không `@/store`, không `@/domain`, không `@/lib/http`
 * (R-60). Không nhóm, không so ngưỡng, không định dạng một con số nào: mọi
 * chuỗi tới đây đã xong ở `useThicknessStandardization` (A15).
 *
 * ## Bảy trạng thái (A11, R-63) — nơi từng trạng thái được vẽ
 *
 * | `state`     | vẽ ở đâu                                                        |
 * |-------------|-----------------------------------------------------------------|
 * | `empty`     | cột trái: câu rỗng; còn bảng thì VẪN vẽ nếu đồ thị có đoạn tường |
 * | `loading`   | biểu đồ tự vẽ khung xương; cột trái sáu dòng `Skeleton`          |
 * | `partial`   | mặc định — biểu đồ, tóm tắt, hai bảng, canvas, thanh áp dụng     |
 * | `error`     | `InlineAlert` trên đầu; biểu đồ và bảng VẪN xem được             |
 * | `success`   | mặc định, ô "vượt dung sai" của tóm tắt chuyển sang mức đã duyệt |
 * | `forbidden` | thêm câu giải thích, và thanh áp dụng KHÔNG được dựng            |
 * | `collapsed` | canvas ẩn, chỗ nó là nút bung lại; hai bảng chiếm cả bề ngang    |
 *
 * Không nhánh nào trả `null` cho cả màn: đầu màn, biểu đồ và hàng tóm tắt luôn
 * được vẽ, nên màn trắng — thất bại duy nhất A11 tồn tại để chặn — không có
 * chỗ xảy ra.
 *
 * ## Vì sao câu rỗng KHÔNG nuốt mất hai bảng
 *
 * `emptyNotice` của hook mang hai câu khác nhau: "chưa có số đo nào" (đồ thị
 * rỗng) và "mọi đoạn đã ở đúng nhóm chuẩn" (48 đoạn vẫn còn đó, chỉ là không
 * còn gì để áp). Câu thứ hai đi cùng dữ liệu ĐẦY ĐỦ, nên thay bảng bằng một
 * `EmptyState` ở đó sẽ giấu mất chính thứ người dùng vừa chuẩn hoá xong. View
 * vì thế phân nhánh theo `segmentRows.length`, không theo `state`.
 *
 * ## Vì sao câu ấy không dùng `InlineAlert`
 *
 * `InlineAlertLevel` chỉ có `verified` / `attention` / `violation` — ba mã
 * trạng thái của A4. "Không còn gì để áp" không phải việc người duyệt xác nhận
 * (A5 cấm mượn xanh đó), cũng không phải cảnh báo hay vi phạm. Nên câu ấy là
 * một đoạn chữ trung tính trên nền `--bg-sunken`, không mượn mã trạng thái nào.
 *
 * ## Thanh áp dụng vắng mặt ở vai Người xem, không phải bị vô hiệu
 *
 * CẤM TUYỆT ĐỐI của đặc tả: không áp thay đổi nào trước khi người dùng bấm. Ở
 * vai Người xem thì mọi hàm sửa đã tắt từ hook; dựng thanh áp dụng rồi khoá
 * từng nút chỉ mời người ta bấm vào một thứ không chạy. Câu
 * {@link ThicknessStandardizationViewProps.viewerRoleNotice} nói ra vì sao.
 */

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { cn } from '@/lib/utils';

import { ThicknessApplyBar } from './ThicknessApplyBar';
import { ThicknessGroupTable } from './ThicknessGroupTable';
import { ThicknessHistogram } from './ThicknessHistogram';
import { ThicknessPreviewCanvas } from './ThicknessPreviewCanvas';
import { ThicknessSegmentTable } from './ThicknessSegmentTable';
import { ThicknessSummary } from './ThicknessSummary';
import type {
  ThicknessApplyBarProps,
  ThicknessSegmentTableProps,
  ThicknessStandardizationProps,
} from './thicknessTypes';

/**
 * Props của view: hợp đồng toàn màn cộng đúng bảy trường chọn hàng của bảng
 * chi tiết, cộng `onDismissReapplyWarning` của thanh áp dụng — cùng kiểu mà
 * `useThicknessStandardization` trả về, nên container chuyền thẳng kết quả hook
 * xuống đây bằng một phép trải.
 */
export type ThicknessStandardizationViewProps = ThicknessStandardizationProps &
  Pick<ThicknessApplyBarProps, 'onDismissReapplyWarning'> &
  Pick<
    ThicknessSegmentTableProps,
    | 'selectedWallIds'
    | 'onToggleRowSelected'
    | 'onToggleAllSelected'
    | 'onClearSelection'
    | 'onChangeNormalizedGroup'
    | 'onApplySelectedGroup'
    | 'flashingWallIds'
  >;

/* -------------------------------------------------------------------------- */
/* Chuỗi tĩnh của vỏ màn (A6 — chữ thường kiểu câu, trừ tên riêng và mã).      */
/* -------------------------------------------------------------------------- */

const SCREEN_BREADCRUMB = 'Dự án > Tầng 01 > Độ dày tường';
const SCREEN_TITLE = 'chuẩn hoá độ dày tường';
const SCREEN_DESCRIPTION =
  'Đối chiếu số đo độ dày của từng đoạn tường với bốn nhóm chuẩn, xem trước rồi áp một lượt duy nhất.';
const HISTOGRAM_SECTION_LABEL = 'Phân bố độ dày đo được';
const TABLES_SECTION_LABEL = 'Bảng nhóm và bảng chi tiết từng đoạn';
const ERROR_TITLE = 'không đọc được lớp số đo độ dày';
const FORBIDDEN_TITLE = 'không có quyền sửa độ dày tường';
const EMPTY_TITLE = 'chưa có đoạn tường nào để chuẩn hoá';
const COLLAPSE_PREVIEW_LABEL = 'Thu gọn khung xem trước';
const EXPAND_PREVIEW_LABEL = 'khung xem trước đang thu gọn';

/** Trần bề rộng nội dung của đặc tả — một chỗ viết duy nhất (R-71). */
const CONTENT_MAX_WIDTH_CLASS = 'max-w-[1280px]';

/** Sáu dòng khung xương của cột trái lúc đang tải — đúng khuôn `RoomLabelReview`. */
const SKELETON_ROWS = [0, 1, 2, 3, 4, 5];

/** Nút chữ của màn: cùng khuôn nút bung bảng của `RoomLabelReview` (A1, A2). */
const LINK_CLASS_NAME = cn(
  'self-start rounded-[6px] px-1.5 py-0.5 text-[13px] text-accent',
  'transition-colors duration-120 hover:bg-accent-wash',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
);

/* -------------------------------------------------------------------------- */
/* Cột trái — hai bảng, hoặc khung xương, hoặc câu rỗng.                       */
/* -------------------------------------------------------------------------- */

function ThicknessTablesColumn(props: ThicknessStandardizationViewProps) {
  const {
    emptyNotice,
    flashingWallIds,
    groupRows,
    hoveredGroup,
    hoveredWallId,
    onApplySelectedGroup,
    onChangeNormalizedGroup,
    onChangeSortKey,
    onClearSelection,
    onHoverGroup,
    onHoverWall,
    onToggleAccepted,
    onToggleAllSelected,
    onToggleRowSelected,
    segmentRows,
    selectedWallIds,
    sortKey,
    state,
  } = props;

  if (state === 'loading') {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {SKELETON_ROWS.map((row) => (
          <Skeleton key={row} preset="table-row" />
        ))}
      </div>
    );
  }

  /* Đồ thị chưa có đoạn nào: không có bảng để vẽ, nên câu rỗng đứng một mình. */
  if (segmentRows.length === 0) {
    return (
      <div className="flex min-w-0 flex-1 flex-col">
        <EmptyState
          description={emptyNotice ?? SCREEN_DESCRIPTION}
          icon={<div aria-hidden="true" className="h-8 w-8 rounded-full bg-bg-sunken" />}
          title={EMPTY_TITLE}
        />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      {emptyNotice === null ? null : (
        <p className="rounded-[8px] bg-bg-sunken p-3 text-[13px] text-text-secondary">
          {emptyNotice}
        </p>
      )}

      <ThicknessGroupTable
        hoveredGroup={hoveredGroup}
        onHoverGroup={onHoverGroup}
        onToggleAccepted={onToggleAccepted}
        rows={groupRows}
      />

      <ThicknessSegmentTable
        flashingWallIds={flashingWallIds}
        hoveredWallId={hoveredWallId}
        onApplySelectedGroup={onApplySelectedGroup}
        onChangeNormalizedGroup={onChangeNormalizedGroup}
        onChangeSortKey={onChangeSortKey}
        onClearSelection={onClearSelection}
        onHoverRow={onHoverWall}
        onToggleAllSelected={onToggleAllSelected}
        onToggleRowSelected={onToggleRowSelected}
        rows={segmentRows}
        selectedWallIds={selectedWallIds}
        sortKey={sortKey}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Cột phải — canvas xem trước, hoặc nút bung lại.                             */
/* -------------------------------------------------------------------------- */

function ThicknessPreviewColumn(props: ThicknessStandardizationViewProps) {
  const {
    hoveredGroup,
    hoveredWallId,
    isCollapsed,
    legend,
    onHoverWall,
    onToggleCollapsed,
    shapes,
  } = props;

  if (isCollapsed) {
    return (
      <div className="flex shrink-0 items-start">
        <button className={LINK_CLASS_NAME} onClick={onToggleCollapsed} type="button">
          {EXPAND_PREVIEW_LABEL}
        </button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col gap-1.5">
      <ThicknessPreviewCanvas
        hoveredGroup={hoveredGroup}
        hoveredWallId={hoveredWallId}
        isCollapsed={false}
        legend={legend}
        onHoverWall={onHoverWall}
        shapes={shapes}
      />
      <button className={LINK_CLASS_NAME} onClick={onToggleCollapsed} type="button">
        {COLLAPSE_PREVIEW_LABEL}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Màn.                                                                        */
/* -------------------------------------------------------------------------- */

export function ThicknessStandardization(props: ThicknessStandardizationViewProps) {
  const {
    bins,
    errorMessage,
    hoveredBinIndex,
    isLoading,
    isViewerRole,
    onApplyPreview,
    onCancelPreview,
    onChangeTolerance,
    onDismissReapplyWarning,
    onHoverBin,
    onOpenPreview,
    onReapplyFilter,
    onThresholdDrag,
    onUndo,
    preview,
    reapplyWarning,
    summary,
    thresholdLabels,
    thresholds,
    toleranceMm,
    viewerRoleNotice,
  } = props;

  return (
    <div
      aria-label={SCREEN_TITLE}
      className="h-full min-h-0 w-full overflow-y-auto bg-bg-app"
      role="region"
    >
      <div className={cn('mx-auto flex w-full flex-col gap-4 p-4', CONTENT_MAX_WIDTH_CLASS)}>
        <header className="shrink-0">
          <p className="text-[12px] text-text-muted">{SCREEN_BREADCRUMB}</p>
          <h2 className="text-[18px] font-semibold text-text-primary">{SCREEN_TITLE}</h2>
          <p className="text-[13px] text-text-secondary">{SCREEN_DESCRIPTION}</p>
        </header>

        {errorMessage === null ? null : (
          <InlineAlert level="violation" message={errorMessage} title={ERROR_TITLE} />
        )}

        {viewerRoleNotice === null ? null : (
          <InlineAlert level="attention" message={viewerRoleNotice} title={FORBIDDEN_TITLE} />
        )}

        <section
          aria-label={HISTOGRAM_SECTION_LABEL}
          className="rounded-[12px] bg-bg-surface p-4 shadow-panel"
        >
          <ThicknessHistogram
            bins={bins}
            hoveredBinIndex={hoveredBinIndex}
            isLoading={isLoading}
            onHoverBin={onHoverBin}
            onThresholdDrag={onThresholdDrag}
            thresholdLabels={thresholdLabels}
            thresholds={thresholds}
          />
        </section>

        <ThicknessSummary summary={summary} />

        <section
          aria-label={TABLES_SECTION_LABEL}
          className="flex min-h-0 flex-row gap-4 rounded-[12px] bg-bg-surface p-4 shadow-panel"
        >
          <ThicknessTablesColumn {...props} />
          <ThicknessPreviewColumn {...props} />
        </section>

        {/*
         * Thanh áp dụng đứng NGOÀI hai cột và dưới cùng: nó nói về cả lượt áp,
         * không riêng bảng nào. Vắng mặt hẳn ở vai Người xem — xem đầu file.
         */}
        {isViewerRole ? null : (
          <div className="overflow-hidden rounded-[12px] bg-bg-surface shadow-panel">
            <ThicknessApplyBar
              onApplyPreview={onApplyPreview}
              onCancelPreview={onCancelPreview}
              onChangeTolerance={onChangeTolerance}
              onDismissReapplyWarning={onDismissReapplyWarning}
              onOpenPreview={onOpenPreview}
              onReapplyFilter={onReapplyFilter}
              onUndo={onUndo}
              preview={preview}
              reapplyWarning={reapplyWarning}
              toleranceMm={toleranceMm}
            />
          </div>
        )}
      </div>
    </div>
  );
}
