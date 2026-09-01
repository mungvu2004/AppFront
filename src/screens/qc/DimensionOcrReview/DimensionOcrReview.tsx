/**
 * Màn S-14 "Đọc kích thước OCR" (`DimensionOcrReview`) — VIEW THUẦN, khung chia
 * đôi: 60% trái là bản vẽ gốc với 34 chuỗi kích thước OCR đọc được, 40% phải là
 * danh sách duyệt cộng dải đối chiếu dính đáy.
 *
 * Nhận HẾT qua props ({@link DimensionOcrReviewViewProps}) và chỉ dựng thẻ.
 * Không `@/api`, không `@/store`, không `@/domain`, không `@/lib/http` (R-60,
 * `local/no-data-layer-in-view`). Không tính hình học, không so ngưỡng, không
 * định dạng một con số nào: mọi chuỗi tới nơi đã xong ở hook (A15).
 *
 * ## Vì sao KHÔNG dùng vỏ QC chuẩn ba cột
 *
 * Ngoại lệ bố cục đã được điều phối viên xác nhận. Việc của màn này là ĐỐI CHIẾU
 * ảnh gốc với số đã đọc, nên ảnh cắt phải nằm ngay cạnh ô nhập; panel phải 344
 * của vỏ QC (`WallLayerReview`, `ObjectLayerReview`) quá hẹp cho một hàng gồm
 * ảnh cắt + ô nhập + thước tin cậy. Khung 60/40, nội dung tối đa 1440, là hình
 * dạng đặc tả đòi và là thứ duy nhất chứa nổi cả hai nửa.
 *
 * ## Bảy trạng thái (A11, R-63) — nơi từng trạng thái được vẽ
 *
 * | `state`     | vẽ ở đâu                                                            |
 * |-------------|----------------------------------------------------------------------|
 * | `empty`     | nửa phải: `EmptyState` + LIÊN KẾT THẬT sang hiệu chỉnh tỷ lệ thủ công |
 * | `loading`   | nửa phải: bốn dòng `Skeleton`; canvas tự vẽ nền chờ của nó            |
 * | `partial`   | mặc định — danh sách 34 chuỗi cộng dải đối chiếu                      |
 * | `error`     | nửa phải: `InlineAlert`; canvas VẪN xem được ảnh gốc                   |
 * | `success`   | 34/34 — danh sách bình thường, bộ đếm nói ra điều đó                   |
 * | `forbidden` | canvas chỉ xem (`isInteractive={false}`), danh sách ẩn nút sửa/duyệt   |
 * | `collapsed` | ẩn danh sách + dải đối chiếu, canvas chiếm cả khung, còn nút bung lại  |
 *
 * Không nhánh nào trả `null` cho cả màn: canvas luôn được vẽ, nên màn trắng —
 * thất bại duy nhất A11 tồn tại để chặn — không có chỗ xảy ra. Chế độ duyệt bàn
 * phím là ngoại lệ có chủ đích: ở đó cả màn THU VỀ `DimensionOcrKeyboardMode`,
 * và chính nó vẽ ảnh cắt, ô nhập và bảng phím, nên vẫn không có gì trắng.
 *
 * ## Dưới 1024px
 *
 * Hai nửa xếp dọc (`flex-col lg:flex-row`), và ảnh cắt của mỗi hàng thu về ô
 * vuông `displayHeightPx` — 96 theo `DIMENSION_CROP_DISPLAY_HEIGHT_PX` của
 * `dimensionOcrTypes.ts`. Việc thu ấy do `DimensionOcrCrop` làm bằng cặp lớp
 * `w-[var(--dim-crop-h)] lg:w-[var(--dim-crop-w)]`; ở đây chỉ có điểm ngắt của
 * khung, và không một con số nào viết thô ngoài bề rộng khung (R-71).
 */

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { cn } from '@/lib/utils';

import { DIMENSION_OCR_TEXT } from './dimensionOcrText';
import { DimensionOcrCanvas } from './DimensionOcrCanvas';
import { DimensionOcrCompareBar } from './DimensionOcrCompareBar';
import { DimensionOcrKeyboardMode } from './DimensionOcrKeyboardMode';
import { DimensionOcrList } from './DimensionOcrList';
import type { DimensionOcrReviewModel } from './useDimensionOcrReview';

/**
 * Props của view: cả mô hình `useDimensionOcrReview` trả về, cộng ĐÚNG MỘT lối
 * ra.
 *
 * R-73 cấm prop tuỳ chọn không ai truyền, nên `scaleCalibrationHref` là BẮT
 * BUỘC và container nối nó thật bằng `ROUTES.project.scale(...)`. Nó là một
 * chuỗi chứ không phải callback vì đích đến là một trang khác, và một liên kết
 * thật thì mở được bằng bàn phím, bằng chuột giữa, và đọc được bởi trình đọc
 * màn hình — ba thứ một `onClick` lấy mất (A12).
 */
export interface DimensionOcrReviewViewProps extends DimensionOcrReviewModel {
  /** Đích của lối ra duy nhất: hiệu chỉnh tỷ lệ thủ công ở trạng thái Rỗng. */
  readonly scaleCalibrationHref: string;
}

/* Chuỗi tiếng Việt tĩnh — chép từ `dimensionOcrText.ts`, không gõ câu mới (A6). */

const SCREEN_ARIA_LABEL = DIMENSION_OCR_TEXT.screen.title;
const PANEL_ARIA_LABEL = DIMENSION_OCR_TEXT.panel.title;
const EXPAND_PANEL_LABEL = DIMENSION_OCR_TEXT.states.collapsed.title;

/** Số dòng khung xương của nửa phải lúc đang tải — một dòng cho mỗi nhóm, cộng một. */
const SKELETON_ROWS = [0, 1, 2, 3];

/** Nút chữ của màn: cùng khuôn nút "duyệt" của `DimensionOcrRow` (A1, A2). */
const LINK_CLASS_NAME = cn(
  'self-center rounded-[6px] px-1.5 py-0.5 text-[13px] text-accent',
  'transition-colors duration-120 hover:bg-accent-wash',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
);

/* -------------------------------------------------------------------------- */
/* Nửa phải — danh sách duyệt, hoặc câu nói thay cho nó.                       */
/* -------------------------------------------------------------------------- */

interface DimensionOcrPanelProps {
  readonly model: DimensionOcrReviewModel;
  readonly scaleCalibrationHref: string;
}

/**
 * Hàng DUY NHẤT đang mang câu "giá trị vô lý", đúng hình dạng
 * `DimensionOcrListViewProps.outlierNotice` đòi.
 *
 * Chỉ là một lượt TRA CỨU trên `rows`: câu đã được hook ghép sẵn bằng
 * `outlierHint()` và ngưỡng đã so ở `splitOutliers` (QĐ-4). View không so gì.
 */
function outlierNoticeOf(
  model: DimensionOcrReviewModel,
): { readonly dimensionId: string; readonly message: string } | null {
  const row = model.rows.find((entry) => entry.outlierMessage !== null);

  if (row === undefined || row.outlierMessage === null) {
    return null;
  }

  return { dimensionId: row.id, message: row.outlierMessage };
}

/**
 * Bốn nhánh loại trừ nhau, nhánh cuối là mặc định — không trạng thái nào để nửa
 * phải trống.
 *
 * `forbidden` đi vào nhánh mặc định có chủ đích: vai Người xem vẫn ĐỌC được
 * danh sách, chỉ mất nút sửa và nút duyệt (việc của `DimensionOcrRow`). Khoá mờ
 * cả nửa phải sẽ biến "không có quyền sửa" thành "không có gì để xem".
 */
function DimensionOcrPanelBody({ model, scaleCalibrationHref }: DimensionOcrPanelProps) {
  if (model.state === 'loading') {
    return (
      <div className="flex flex-col gap-1 p-3">
        {SKELETON_ROWS.map((row) => (
          <Skeleton key={row} preset="table-row" />
        ))}
      </div>
    );
  }

  if (model.emptyNotice !== null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-3">
        <EmptyState
          description={model.emptyNotice}
          icon={<div aria-hidden="true" className="h-8 w-8 rounded-full bg-bg-sunken" />}
          title={DIMENSION_OCR_TEXT.states.empty.title}
        />
        {/*
          Lối ra DUY NHẤT của màn, nối thật (R-73). Một `<a href>` chứ không một
          callback: đích là trang hiệu chỉnh tỷ lệ, và container dựng đường dẫn
          bằng `ROUTES.project.scale(...)` nên không có chuỗi thô nào ở đây (R-65).
        */}
        <a className={LINK_CLASS_NAME} href={scaleCalibrationHref}>
          {DIMENSION_OCR_TEXT.states.empty.actionLabel}
        </a>
      </div>
    );
  }

  if (model.errorMessage !== null) {
    return (
      <div className="p-3">
        <InlineAlert
          level="violation"
          message={model.errorMessage}
          title={DIMENSION_OCR_TEXT.states.error.title}
        />
      </div>
    );
  }

  return (
    <DimensionOcrList
      activeFilter={model.activeFilter}
      isViewerRole={model.isViewerRole}
      onApprove={model.onApprove}
      onCancelEdit={model.onCancelEdit}
      onEdit={model.onEdit}
      onFilterChange={model.onFilterChange}
      onSelect={model.onSelect}
      outlierNotice={outlierNoticeOf(model)}
      reviewCounter={model.reviewCounter}
      reviewProgressLabel={model.reviewProgressLabel}
      rows={model.rows}
      selectedDimensionId={model.selectedDimensionId}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Màn.                                                                        */
/* -------------------------------------------------------------------------- */

export function DimensionOcrReview({
  scaleCalibrationHref,
  ...model
}: DimensionOcrReviewViewProps) {
  /*
    Chế độ duyệt bàn phím thu CẢ MÀN về một ảnh cắt và một ô nhập — đường nhanh
    nhất của màn, và đặc tả đòi nó không còn thứ gì khác trên màn hình để nhìn.
  */
  if (model.keyboardReview.isActive) {
    return (
      <div
        aria-label={SCREEN_ARIA_LABEL}
        className="flex h-full min-h-0 w-full flex-col bg-bg-app"
        role="region"
      >
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[1440px] flex-col p-2">
          <DimensionOcrKeyboardMode
            isActive
            onApprove={model.keyboardReview.onApprove}
            onCancelEdit={model.keyboardReview.onCancelEdit}
            onEdit={model.keyboardReview.onEdit}
            onToggle={model.keyboardReview.onToggle}
            outlierMessage={model.keyboardReview.outlierMessage}
            row={model.keyboardReview.row}
          />
        </div>
      </div>
    );
  }

  const isCollapsed = model.state === 'collapsed';

  return (
    <div
      aria-label={SCREEN_ARIA_LABEL}
      className="flex h-full min-h-0 w-full flex-col bg-bg-app"
      role="region"
    >
      <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col gap-2 p-2 lg:flex-row">
        {/* Nửa trái 60% — bản vẽ gốc. Bung ra cả khung khi bảng duyệt thu gọn. */}
        <section
          aria-label={DIMENSION_OCR_TEXT.screen.canvasAriaLabel}
          className={cn(
            'relative flex min-h-0 min-w-0 flex-col',
            isCollapsed ? 'lg:w-full' : 'lg:w-[60%]',
          )}
        >
          <DimensionOcrCanvas
            backgroundImageAlt={model.backgroundImageAlt}
            backgroundImageUrl={model.backgroundImageUrl}
            chains={model.chains}
            isInteractive={!model.isViewerRole}
            millimetresPerPixel={model.millimetresPerPixel}
            onSelect={model.onSelect}
            selectedDimensionId={model.selectedDimensionId}
          />
        </section>

        {/* Nửa phải 40% — danh sách duyệt, dải đối chiếu dính đáy, cửa vào bàn phím. */}
        {isCollapsed ? (
          <div className="flex shrink-0 items-start justify-end p-1">
            <button className={LINK_CLASS_NAME} onClick={model.onToggleCollapsed} type="button">
              {EXPAND_PANEL_LABEL}
            </button>
          </div>
        ) : (
          <aside
            aria-label={PANEL_ARIA_LABEL}
            className={cn(
              'flex min-h-0 min-w-0 flex-col overflow-hidden lg:w-[40%]',
              'rounded-[16px] border border-border-default bg-bg-surface',
            )}
          >
            <div className="min-h-0 flex-1 overflow-hidden">
              <DimensionOcrPanelBody model={model} scaleCalibrationHref={scaleCalibrationHref} />
            </div>

            {/*
              Dải đối chiếu dính đáy. Nó tự trả `null` khi chưa chọn chuỗi nào,
              nhưng nơi gọi vẫn phải cấp hai trường của QĐ-7 — nên nó chỉ được
              dựng khi `compare` có thật, và mỗi lượt chọn mới là một lượt chạy
              số 260 ms mới.
            */}
            {model.compare === null ? null : (
              <DimensionOcrCompareBar
                compare={model.compare}
                deviationPercentValue={model.compare.deviationPercentValue}
                formatDeviation={model.compare.formatDeviation}
              />
            )}

            {/* Cửa vào chế độ duyệt bàn phím — vai Người xem không có gì để duyệt. */}
            {model.isViewerRole ? (
              <p className="border-t border-border-default px-3 py-2 text-[12px] text-text-muted">
                {model.viewerRoleNotice}
              </p>
            ) : (
              <div className="border-t border-border-default px-3 py-2">
                <DimensionOcrKeyboardMode
                  isActive={false}
                  onApprove={model.keyboardReview.onApprove}
                  onCancelEdit={model.keyboardReview.onCancelEdit}
                  onEdit={model.keyboardReview.onEdit}
                  onToggle={model.keyboardReview.onToggle}
                  outlierMessage={model.keyboardReview.outlierMessage}
                  row={model.keyboardReview.row}
                />
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
