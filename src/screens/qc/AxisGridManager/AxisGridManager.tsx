/**
 * Màn S-15 "Trục và gốc toạ độ" (`AxisGridManager`) — VIEW THUẦN, vỏ QC ba cột:
 * panel trái 280 (danh sách trục), canvas giữa, cột phải 344 (gốc toạ độ +
 * căn chỉnh giữa các tầng), cộng một đầu màn mang breadcrumb, tiêu đề và mô tả.
 *
 * Nhận HẾT qua props ({@link AxisGridManagerViewProps}) và chỉ dựng thẻ. Không
 * `@/api`, không `@/store`, không `@/domain`, không `@/lib/http` (R-60,
 * `local/no-data-layer-in-view`). Không tính hình học, không so ngưỡng, không
 * định dạng một con số nào: mọi chuỗi tới đây đã xong ở `useAxisGridManager`
 * (A15) — kể cả bốn trường lệch gốc toạ độ, vốn có sẵn CẢ pixel LẪN milimét
 * bằng chữ, đúng CẤM TUYỆT ĐỐI "mọi độ lệch hiện bằng chữ đều, đủ cả pixel và
 * milimét".
 *
 * ## Vì sao view nhập thẳng `AxisGridCanvas`, không nhận qua khe
 *
 * `WallLayerReview.tsx` nhận `canvasSlot?: ReactNode` vì canvas của nó do một
 * worker khác viết SONG SONG và chưa tồn tại lúc view ấy được viết. Ở đây cả ba
 * mảnh (T6 canvas, T7 hai panel) đã có sẵn trên nhánh, nên một khe tuỳ chọn mà
 * không nơi gọi nào truyền chỉ còn là một prop chết — đúng thứ R-73 cấm.
 *
 * ## Bảy trạng thái (A11, R-63) — nơi từng trạng thái được vẽ
 *
 * | `state`     | vẽ ở đâu                                                             |
 * |-------------|----------------------------------------------------------------------|
 * | `empty`     | cột trái: `EmptyState` mang `emptyNotice`, nút "Thêm trục ngang"      |
 * | `loading`   | cột trái: sáu dòng `Skeleton`; canvas vẫn vẽ khung rỗng của nó        |
 * | `partial`   | mặc định — danh sách trục cộng hai mục của cột phải                   |
 * | `error`     | cột trái: `InlineAlert` + nút "Thử lại"; canvas VẪN xem được          |
 * | `success`   | mặc định, và mục căn tầng tự gắn nhãn "đã duyệt" của nó               |
 * | `forbidden` | canvas chỉ xem (`isInteractive={false}`), cột trái thêm câu giải thích |
 * | `collapsed` | ẩn cột trái + cột phải; canvas chiếm cả khung, còn nút bung lại       |
 *
 * Không nhánh nào trả `null` cho cả màn: canvas luôn được vẽ, nên màn trắng —
 * thất bại duy nhất A11 tồn tại để chặn — không có chỗ xảy ra.
 *
 * ## Câu chặn khoảng cách tối thiểu đi ra bằng prop riêng
 *
 * `AxisGridViewModel` đã đóng băng và không có trường nào mang câu chặn 100 mm;
 * nhét nó vào `errorMessage` sẽ lật màn sang trạng thái `error` (bất biến 4 của
 * `axisGridTypes.ts`), tức nói dối. Nên nó là {@link
 * AxisGridManagerViewProps.spacingMessage} — cùng hình dạng mà
 * `UseAxisGridManagerResult` đã thoả thuận với người tích hợp — và được vẽ
 * thành `InlineAlert` có `role="status"` ngay dưới đầu màn, song song với lượt
 * đọc `aria-live` mà hook đã phát lúc bị chặn.
 */

import { Grid3x3 } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

import { FloorLayerReadFailureScreen } from '../shared/FloorLayerReadFailureScreen';
import type { FloorLayerReadFailure } from '../shared/floorLayerReadFailure';

import { AxisGridCanvas, type AxisGridCanvasProps } from './AxisGridCanvas';
import { AxisGridFloorAlignList } from './AxisGridFloorAlignList';
import { AxisGridLeftPanel } from './AxisGridLeftPanel';
import { AxisGridOriginPanel } from './AxisGridOriginPanel';
import type { AxisGridManagerProps } from './axisGridTypes';

/**
 * Props của view: hợp đồng đã đóng băng của T3, cộng ĐÚNG MỘT trường thoả
 * thuận thêm (xem "Câu chặn khoảng cách tối thiểu" ở đầu file).
 *
 * `spacingMessage` là BẮT BUỘC chứ không tuỳ chọn: `useAxisGridManager` luôn
 * trả nó (`null` khi lượt vừa rồi hợp lệ), nên một dấu `?` ở đây chỉ tạo ra một
 * đường đi mà không nơi gọi nào dùng (R-73).
 *
 * ## `onAxisDrag` lấy hình dạng của CANVAS, không của hợp đồng T3
 *
 * Hai file nói hai kiểu về cùng một tham số: `AxisGridManagerProps.onAxisDrag`
 * của T3 nhận `Pixels` (số đã gắn nhãn đơn vị), còn
 * `AxisGridCanvasProps.onAxisDrag` của T6 nhận `number` — vì thứ canvas đọc
 * được từ `getScreenCTM().inverse()` là một số thô của DOM, chưa phải một số
 * đã gắn nhãn.
 *
 * Chỗ gắn nhãn đúng là CONTAINER, không phải view: gắn nhãn ở đây buộc view
 * nhập `Pixels` từ `@/domain/units/scale`, và R-60 cấm view chạm `@/domain`.
 * Nên view khai đúng hình dạng thô mà canvas đưa lên, và
 * `AxisGridManager.container.tsx` bọc `pixels()` quanh nó trước khi giao cho
 * hook. Không một phép tính nào bị mất: gắn nhãn đơn vị không phải phép tính.
 */
export interface AxisGridManagerViewProps
  extends Omit<AxisGridManagerProps, 'onAxisDrag'> {
  /** Toạ độ thô của canvas; container gắn nhãn `Pixels` trước khi vào hook. */
  readonly onAxisDrag: AxisGridCanvasProps['onAxisDrag'];
  readonly spacingMessage: string | null;
  /** BUG-578: câu "chỉ giữ trong phiên" — `null` ở vai chỉ xem. */
  readonly unsavedNotice: string | null;
  /** BUG-594/601: vì sao "Căn chỉnh tự động" bị khoá; `null` khi bấm được. */
  readonly autoAlignBlockedReason: string | null;
  /** Đọc lớp hỏng khi chưa có tài liệu → cả màn là một trạng thái lỗi (BUG-326). */
  readonly readFailure?: FloorLayerReadFailure | null | undefined;
}

/* -------------------------------------------------------------------------- */
/* Chuỗi tĩnh — nguyên văn `.orca-notes/S15-T4-copy.md`, không gõ câu mới (A6). */
/* -------------------------------------------------------------------------- */

const SCREEN_BREADCRUMB = 'Dự án > Trục và gốc toạ độ';
const SCREEN_TITLE = 'Quản lý trục và gốc toạ độ';
const SCREEN_DESCRIPTION =
  'Kiểm tra các trục nằm trùng khớp giữa các tầng và điều chỉnh khoảng cách nếu cần.';
const CANVAS_SECTION_LABEL = 'Khung xem bản vẽ quản lý trục và gốc toạ độ';
const EMPTY_TITLE = 'Chưa có trục nào';
/** BUG-594: nút làm được việc — "Suy ra từ tường bao" ở đây không bao giờ suy ra được gì. */
const EMPTY_ACTION_LABEL = 'Thêm trục ngang';
const ERROR_TITLE = 'Không tính được trục';
const ERROR_ACTION_LABEL = 'Thử lại';
const FORBIDDEN_TITLE = 'Không có quyền sửa trục';
const EXPAND_PANEL_LABEL = 'Bảng trục đang thu gọn';
/** BUG-330, BUG-336: tầng chưa có trục thì nói thẳng, không hiện số 0 hay "Đã duyệt" như dữ liệu thật. */
const ORIGIN_UNAVAILABLE_NOTICE = 'Chưa có trục nào nên chưa tính được gốc toạ độ.';
const ALIGN_UNAVAILABLE_NOTICE = 'Chưa có trục nào nên chưa căn chỉnh được giữa các tầng.';
const CANVAS_EMPTY_NOTICE = 'Chưa có trục nào để hiện trên bản vẽ.';
const CANVAS_ERROR_NOTICE = 'Chưa vẽ được trục vì lớp trục của tầng này chưa đọc được.';

/** Sáu dòng khung xương của cột trái lúc đang tải — hai nhóm trục, ba hàng mỗi nhóm. */
const SKELETON_ROWS = [0, 1, 2, 3, 4, 5];

/** Khung chung của cột trái, để ba nhánh thay thế không mỗi chỗ một bề rộng. */
const LEFT_COLUMN_CLASS_NAME =
  'flex h-full w-[280px] shrink-0 flex-col gap-3 overflow-y-auto rounded-[12px] bg-bg-surface p-4 shadow-panel max-lg:h-auto max-lg:w-full';

/* -------------------------------------------------------------------------- */
/* Cột trái — bốn nhánh loại trừ nhau, nhánh cuối là danh sách trục thật.      */
/* -------------------------------------------------------------------------- */

function AxisGridLeftColumn({
  viewModel,
  onAxisAdd,
  onAxisRemove,
  onAxisToggleVisibility,
  onGhostToggle,
  onRetry,
  onViewOnDrawing,
}: AxisGridManagerViewProps) {
  const isViewerRole = viewModel.isViewerRole;

  if (viewModel.errorMessage !== null) {
    return (
      <div className={LEFT_COLUMN_CLASS_NAME}>
        <InlineAlert
          action={{ label: ERROR_ACTION_LABEL, onClick: onRetry }}
          level="violation"
          message={viewModel.errorMessage}
          title={ERROR_TITLE}
        />
      </div>
    );
  }

  if (viewModel.emptyNotice !== null) {
    return (
      <div className={LEFT_COLUMN_CLASS_NAME}>
        <EmptyState
          {...(isViewerRole ? {} : { action: { label: EMPTY_ACTION_LABEL, onClick: () => onAxisAdd('horizontal') } })}
          description={viewModel.emptyNotice}
          icon={<Grid3x3 />}
          title={EMPTY_TITLE}
        />
      </div>
    );
  }

  if (viewModel.state === 'loading') {
    return (
      <div className={LEFT_COLUMN_CLASS_NAME}>
        {SKELETON_ROWS.map((row) => (
          <Skeleton key={row} preset="table-row" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 shrink-0 flex-col gap-2 max-lg:h-auto">
      {viewModel.viewerRoleNotice === null ? null : (
        <InlineAlert
          className="w-[280px] shrink-0 max-lg:w-full"
          level="attention"
          message={viewModel.viewerRoleNotice}
          title={FORBIDDEN_TITLE}
        />
      )}

      <div className="min-h-0 flex-1">
        <AxisGridLeftPanel
          ghostEnabled={viewModel.ghostEnabled}
          groups={viewModel.groups}
          isViewerRole={viewModel.isViewerRole}
          onAxisAdd={onAxisAdd}
          onAxisRemove={onAxisRemove}
          onAxisToggleVisibility={onAxisToggleVisibility}
          onGhostToggle={onGhostToggle}
          onViewOnDrawing={onViewOnDrawing}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Màn.                                                                        */
/* -------------------------------------------------------------------------- */

export function AxisGridManager(props: AxisGridManagerViewProps) {
  const { viewModel, spacingMessage } = props;
  const isCollapsed = viewModel.isCollapsed;
  const hasNoAxis = viewModel.hasNoAxes;
  const canvasNotice = !hasNoAxis ? null : viewModel.errorMessage !== null ? CANVAS_ERROR_NOTICE : CANVAS_EMPTY_NOTICE;

  if (props.readFailure != null) {
    return (
      <div aria-label={SCREEN_TITLE} className="flex h-full min-h-0 w-full flex-col bg-bg-app" role="region">
        <FloorLayerReadFailureScreen failure={props.readFailure} />
      </div>
    );
  }

  return (
    <div
      aria-label={SCREEN_TITLE}
      // Cao bằng khung nhìn: route nằm trong `ScreenMain` (display: contents) nên `h-full` không có chiều cao
      // để bám, panel trục không bao giờ cuộn và cả trang dài ra (G20) — cùng cách SCR-16/17.
      className="flex h-screen min-h-0 w-full flex-col bg-bg-app"
      role="region"
    >
      <header className="shrink-0 px-4 pb-1 pt-3">
        <p className="text-[12px] text-text-muted">{SCREEN_BREADCRUMB}</p>
        <h2 className="text-[18px] font-semibold text-text-primary">{SCREEN_TITLE}</h2>
        <p className="text-[13px] text-text-secondary">{SCREEN_DESCRIPTION}</p>
      </header>

      {/* BUG-578: nói thật, cố định — chưa có chỗ lưu lưới trục lên máy chủ. */}
      {props.unsavedNotice === null ? null : (
        <div className="shrink-0 px-4 pb-1">
          <InlineAlert level="attention" message={props.unsavedNotice} role="note" />
        </div>
      )}

      {/* Câu chặn 100 mm — nói ra ngay, và không lật màn sang trạng thái lỗi. */}
      {spacingMessage === null ? null : (
        <div className="shrink-0 px-4 pb-1">
          <InlineAlert level="violation" message={spacingMessage} role="status" />
        </div>
      )}

      <div
        className={cn(
          'flex min-h-0 flex-1 gap-2 p-2',
          viewModel.isCompact ? 'flex-col' : 'flex-row',
          // BUG-319/393/404: dưới 1024 ba cột cố định (280 + canvas + 344) tràn ngang hoặc bóp canvas còn ~110 px — xếp dọc và cuộn dọc.
          'max-lg:flex-col max-lg:overflow-y-auto',
        )}
      >
        {isCollapsed ? null : <AxisGridLeftColumn {...props} />}

        <section
          aria-label={CANVAS_SECTION_LABEL}
          className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-[16px] bg-bg-sunken max-lg:h-[360px] max-lg:flex-none"
        >
          <AxisGridCanvas
            canvas={viewModel.canvas}
            isInteractive={!viewModel.isViewerRole}
            onAxisDrag={props.onAxisDrag}
            onAxisSelect={props.onAxisSelect}
            viewerRoleNotice={viewModel.viewerRoleNotice}
          />
          {canvasNotice === null ? null : (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-[13px] text-text-secondary">
              {canvasNotice}
            </p>
          )}
        </section>

        {isCollapsed ? (
          <div className="flex shrink-0 items-start justify-end p-1">
            <Button onClick={props.onToggleCollapsed} size="sm" type="button" variant="secondary">
              {EXPAND_PANEL_LABEL}
            </Button>
          </div>
        ) : (
          <div className="flex h-full min-h-0 shrink-0 flex-col gap-2 overflow-y-auto max-lg:h-auto max-lg:overflow-visible">
            <AxisGridOriginPanel
              onAnchorChange={props.onAnchorChange}
              origin={viewModel.origin}
              unavailableNotice={hasNoAxis ? ORIGIN_UNAVAILABLE_NOTICE : null}
            />
            <AxisGridFloorAlignList
              blockedReason={props.autoAlignBlockedReason}
              floors={viewModel.floors}
              onAutoAlign={props.onAutoAlign}
              onFloorRowHover={props.onFloorRowHover}
              onViewFloorOnDrawing={props.onViewFloorOnDrawing}
              unavailableNotice={hasNoAxis ? ALIGN_UNAVAILABLE_NOTICE : null}
              warningBanner={viewModel.warningBanner}
            />
          </div>
        )}
      </div>
    </div>
  );
}
