/**
 * Màn S-17 "Duyệt tên phòng" (`RoomLabelReview`) — VIEW THUẦN, vỏ QC ba cột:
 * panel trái 280 (tóm tắt + vòng hở + danh sách phòng), canvas giữa, cột phải
 * 344 (thanh tra phòng đang chọn), cộng một đầu màn mang breadcrumb, tiêu đề
 * và mô tả, và hộp thoại xem trước "Chuẩn hoá tên" treo ở cuối cây.
 *
 * Nhận HẾT qua props ({@link RoomLabelReviewProps} của `roomLabelTypes.ts`, đã
 * đóng băng) và chỉ dựng thẻ. Không `@/api`, không `@/store`, không `@/domain`,
 * không `@/lib/http` (R-60). Không tính hình học, không so ngưỡng, không định
 * dạng một con số nào: mọi chuỗi tới đây đã xong ở `useRoomLabelReview` (A15).
 *
 * ## Vì sao view nhập thẳng ba mảnh con, không nhận qua khe
 *
 * `WallLayerReview.tsx` nhận `canvasSlot?: ReactNode` vì canvas của nó do một
 * worker khác viết SONG SONG và chưa tồn tại lúc view ấy được viết. Ở đây cả ba
 * mảnh (canvas của T6, hai panel cộng hai hộp thoại của T7) đã có sẵn trên
 * nhánh, nên một khe tuỳ chọn mà không nơi gọi nào truyền chỉ còn là một prop
 * chết — đúng thứ R-73 cấm. Cùng lựa chọn `AxisGridManager.tsx` đã chốt.
 *
 * ## Bảy trạng thái (A11, R-63) — nơi từng trạng thái được vẽ
 *
 * | `state`     | vẽ ở đâu                                                             |
 * |-------------|----------------------------------------------------------------------|
 * | `empty`     | cột trái: `EmptyState` mang `emptyNotice`, nút "Kiểm tra lại vòng hở" |
 * | `loading`   | cột trái: sáu dòng `Skeleton`; canvas vẫn vẽ khung chờ của nó         |
 * | `partial`   | mặc định — tóm tắt, vòng hở, danh sách phòng, thanh tra               |
 * | `error`     | cột trái: `InlineAlert` + nút "Thử lại"; canvas VẪN xem được          |
 * | `success`   | mặc định, và mọi dòng danh sách mang chấm xanh "đã duyệt"             |
 * | `forbidden` | canvas chỉ xem (`isInteractive={false}`), cột trái thêm câu giải thích |
 * | `collapsed` | ẩn cột trái + thanh tra; canvas chiếm cả khung, còn nút bung lại      |
 *
 * Không nhánh nào trả `null` cho cả màn: canvas luôn được vẽ, nên màn trắng —
 * thất bại duy nhất A11 tồn tại để chặn — không có chỗ xảy ra.
 *
 * ## Vì sao cột trái đọc BA CÂU chứ không đọc `state`
 *
 * `deriveRoomLabelScreenState` xếp `forbidden` và `collapsed` TRƯỚC `error` và
 * `loading` (vai trò đi trước vì nó vô hiệu mọi hàm sửa). Nên một người xem
 * đang gặp lỗi đọc lớp phòng vẫn mang `state === 'forbidden'`, và một cột trái
 * phân nhánh theo `state` sẽ nuốt mất câu lỗi. Ba câu `errorMessage`,
 * `emptyNotice`, `viewerRoleNotice` là thứ nói đúng sự thật ở mọi tổ hợp, đúng
 * cách `AxisGridManager.tsx` đọc `viewModel.errorMessage`/`emptyNotice`.
 *
 * ## "Thử lại" của trạng thái lỗi là `onCheckWallGaps`, không phải một prop mới
 *
 * Hợp đồng đã đóng băng không có `onRetry`, và thêm một prop cho nó là sửa file
 * đã khoá. Không cần: `onCheckWallGaps` gọi `refetchRoomLayer()` trong hook
 * (`useRoomLabelReview.ts:857-860`), tức nó ĐÚNG LÀ lượt đọc lại lớp phòng —
 * một nút "Thử lại" trỏ vào đó không hứa gì nó không làm (E.10).
 */

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { cn } from '@/lib/utils';

import { RoomLabelCanvas } from './RoomLabelCanvas';
import { RoomLabelInspector } from './RoomLabelInspector';
import { RoomLabelLeftPanel } from './RoomLabelLeftPanel';
import { RoomLabelNormalizePreview } from './RoomLabelNormalizePreview';
import type { RoomLabelReviewProps } from './roomLabelTypes';

/**
 * Props của view: ĐÚNG hợp đồng đã đóng băng, không thêm một lát nào.
 *
 * `useRoomLabelReview` trả về chính kiểu này (`UseRoomLabelReviewResult`), nên
 * container chuyền thẳng kết quả hook xuống đây mà không phải nắn hình dạng —
 * và story dựng view bằng cùng một vật.
 */
export type RoomLabelReviewViewProps = RoomLabelReviewProps;

/* -------------------------------------------------------------------------- */
/* Chuỗi tĩnh của vỏ màn (A6 — chữ thường kiểu câu, trừ tên riêng và mã).      */
/* -------------------------------------------------------------------------- */

const SCREEN_BREADCRUMB = 'Dự án > Tầng 01 > Nhãn phòng';
const SCREEN_TITLE = 'duyệt tên phòng';
const SCREEN_DESCRIPTION =
  'Đối chiếu tên và công năng từng phòng với bản vẽ gốc, rồi xác nhận từng phòng một.';
const CANVAS_SECTION_LABEL = 'Khung xem bản vẽ duyệt tên phòng';
const EMPTY_TITLE = 'chưa dò ra phòng nào';
const EMPTY_ACTION_LABEL = 'Kiểm tra lại vòng hở';
const ERROR_TITLE = 'không đọc được lớp phòng';
const ERROR_ACTION_LABEL = 'Thử lại';
const FORBIDDEN_TITLE = 'không có quyền sửa lớp phòng';
const EXPAND_PANEL_LABEL = 'bảng phòng đang thu gọn';

/** Sáu dòng khung xương của cột trái lúc đang tải — đúng khuôn `AxisGridManager`. */
const SKELETON_ROWS = [0, 1, 2, 3, 4, 5];

/** Nút chữ của màn: cùng khuôn nút bung bảng của `AxisGridManager` (A1, A2). */
const LINK_CLASS_NAME = cn(
  'self-center rounded-[6px] px-1.5 py-0.5 text-[13px] text-accent',
  'transition-colors duration-120 hover:bg-accent-wash',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
);

/** Khung chung của cột trái, để bốn nhánh thay thế không mỗi chỗ một bề rộng. */
const LEFT_COLUMN_CLASS_NAME =
  'flex h-full w-[280px] shrink-0 flex-col gap-3 overflow-y-auto rounded-[12px] bg-bg-surface p-4 shadow-panel';

/* -------------------------------------------------------------------------- */
/* Cột trái — bốn nhánh loại trừ nhau, nhánh cuối là panel phòng thật.         */
/* -------------------------------------------------------------------------- */

function RoomLabelLeftColumn(props: RoomLabelReviewViewProps) {
  const {
    emptyNotice,
    errorMessage,
    gaps,
    onCheckWallGaps,
    onHover,
    onNavigateToWalls,
    onOpenNormalizePreview,
    onSelect,
    onToggleUnnamedFilter,
    rooms,
    selectedRoomId,
    showOnlyUnnamed,
    state,
    summary,
    isViewerRole,
    viewerRoleNotice,
  } = props;

  if (errorMessage !== null) {
    return (
      <div className={LEFT_COLUMN_CLASS_NAME}>
        <InlineAlert
          action={{ label: ERROR_ACTION_LABEL, onClick: onCheckWallGaps }}
          level="violation"
          message={errorMessage}
          title={ERROR_TITLE}
        />
      </div>
    );
  }

  if (emptyNotice !== null) {
    return (
      <div className={LEFT_COLUMN_CLASS_NAME}>
        <EmptyState
          action={{ label: EMPTY_ACTION_LABEL, onClick: onCheckWallGaps }}
          description={emptyNotice}
          icon={<div aria-hidden="true" className="h-8 w-8 rounded-full bg-bg-sunken" />}
          title={EMPTY_TITLE}
        />
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div className={LEFT_COLUMN_CLASS_NAME}>
        {SKELETON_ROWS.map((row) => (
          <Skeleton key={row} preset="table-row" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 shrink-0 flex-col gap-2">
      {viewerRoleNotice === null ? null : (
        <InlineAlert
          className="w-[280px] shrink-0"
          level="attention"
          message={viewerRoleNotice}
          title={FORBIDDEN_TITLE}
        />
      )}

      <div className="min-h-0 flex-1">
        <RoomLabelLeftPanel
          list={{ rooms, selectedRoomId, onSelect, onHover, isViewerRole }}
          panel={{
            summary,
            gaps,
            showOnlyUnnamed,
            onToggleUnnamedFilter,
            onOpenNormalizePreview,
            onCheckWallGaps,
            onNavigateToWalls,
            isViewerRole,
          }}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Màn.                                                                        */
/* -------------------------------------------------------------------------- */

export function RoomLabelReview(props: RoomLabelReviewViewProps) {
  const {
    areaCaption,
    backgroundImageAlt,
    backgroundImageUrl,
    hoveredRoomId,
    isCollapsed,
    isCompact,
    isViewerRole,
    mergeCandidates,
    millimetresPerPixel,
    nameSuggestions,
    normalizePreview,
    onApplyNormalize,
    onApprove,
    onCancelNormalize,
    onChangeUsage,
    onHover,
    onMerge,
    onRename,
    onSelect,
    onSplit,
    onToggleCollapsed,
    rooms,
    selectedRoomId,
    splitPointMm,
    usageOptions,
    viewerRoleNotice,
  } = props;

  /*
   * Thanh tra nhận PHÒNG ĐÃ CHỌN, không nhận cả mảng: lát
   * `RoomLabelInspectorProps` cố ý chỉ mang một `room | null` (xem docstring
   * `roomLabelTypes.ts`). Phép tìm này là tra một phần tử theo khoá, không phải
   * một phép tính bị R-60 cấm — cùng cách `RoomLabelCanvas.tsx` tra phòng đang
   * chọn để đặt vòng sáng.
   */
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;

  return (
    <div
      aria-label={SCREEN_TITLE}
      className="flex h-full min-h-0 w-full flex-col bg-bg-app"
      role="region"
    >
      <header className="shrink-0 px-4 pb-1 pt-3">
        <p className="text-[12px] text-text-muted">{SCREEN_BREADCRUMB}</p>
        <h2 className="text-[18px] font-semibold text-text-primary">{SCREEN_TITLE}</h2>
        <p className="text-[13px] text-text-secondary">{SCREEN_DESCRIPTION}</p>
      </header>

      <div className={cn('flex min-h-0 flex-1 gap-2 p-2', isCompact ? 'flex-col' : 'flex-row')}>
        {isCollapsed ? null : <RoomLabelLeftColumn {...props} />}

        <section
          aria-label={CANVAS_SECTION_LABEL}
          className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-[16px] bg-bg-sunken"
        >
          <RoomLabelCanvas
            backgroundImageAlt={backgroundImageAlt}
            backgroundImageUrl={backgroundImageUrl}
            hoveredRoomId={hoveredRoomId}
            isInteractive={!isViewerRole}
            millimetresPerPixel={millimetresPerPixel}
            onHover={onHover}
            onSelect={onSelect}
            rooms={rooms}
            selectedRoomId={selectedRoomId}
          />
        </section>

        {isCollapsed ? (
          <div className="flex shrink-0 items-start justify-end p-1">
            <button className={LINK_CLASS_NAME} onClick={onToggleCollapsed} type="button">
              {EXPAND_PANEL_LABEL}
            </button>
          </div>
        ) : (
          <RoomLabelInspector
            extras={{
              nameSuggestions,
              usageOptions,
              areaCaption,
              mergeCandidates,
              splitPointMm,
              viewerRoleNotice,
            }}
            inspector={{
              room: selectedRoom,
              isViewerRole,
              onRename,
              onChangeUsage,
              onMerge,
              onSplit,
              onApprove,
            }}
          />
        )}
      </div>

      {/*
       * Hộp thoại xem trước treo NGOÀI ba cột và luôn được gắn: nó tự đóng khi
       * `preview === null` (`Modal.Root isOpen`), nên "thao tác hàng loạt luôn
       * xem trước trước khi áp" không phụ thuộc vào việc cột trái có đang hiện
       * hay không — kể cả ở trạng thái thu gọn.
       */}
      <RoomLabelNormalizePreview
        onApply={onApplyNormalize}
        onCancel={onCancelNormalize}
        preview={normalizePreview}
      />
    </div>
  );
}
