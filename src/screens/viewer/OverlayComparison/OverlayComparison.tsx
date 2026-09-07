/**
 * Màn Đối chiếu bản vẽ (`OverlayComparison`) — khung của route
 * `ROUTE_PATTERNS.projectOverlay`.
 *
 * View THUẦN (mục D, R-60): chỉ nhận {@link OverlayComparisonProps} và ghép ba
 * mảnh — canvas, thanh công cụ nổi, panel phải — bằng cách phân phát đúng
 * trường của `model` và `actions` xuống props của từng mảnh. Không
 * `@/api`, không `@/store`, không `@/domain`, không `@/lib/http`. Mọi câu tiếng
 * Việt và mọi con số đã định dạng xong ở `useOverlayComparison` (A15) — file
 * này không gọi `toFixed`, không `toLocaleString`.
 *
 * **Ba file nó ghép — `OverlayComparisonCanvas.tsx`, `OverlayComparisonToolbar.tsx`,
 * `OverlayComparisonPanel.tsx` — được viết song song trên nhánh khác và có thể
 * chưa có trong worktree này.** Đó là cố ý (xem `types.ts`, chú thích đầu file):
 * file này chỉ cần hình dạng props đã khai ở `types.ts`, không cần bản dựng
 * thật của ba file kia để biên dịch ĐÚNG khi chúng tồn tại.
 *
 * ## Bố cục
 *
 * Canvas rộng toàn vùng còn lại; panel phải rộng 344px (panel tự đặt bề rộng
 * của chính nó, xem `ScaleCalibrationPanel.tsx` — khuôn tương tự); thanh công cụ
 * nổi trên cùng giữa (cao 40, bo 12 — do chính `OverlayComparisonToolbar.tsx`
 * dựng), đè lên canvas bằng định vị tuyệt đối. Lớp bọc thanh công cụ mang
 * `pointer-events-none` còn nội dung bên trong mang `pointer-events-auto`, để
 * phần canvas không bị thanh công cụ (vốn hẹp hơn cả chiều rộng) chặn mất thao
 * tác chuột ở hai bên.
 *
 * ## `stateNotice` — câu giải thích nổi trên canvas, dưới thanh công cụ
 *
 * `model.stateNotice` khác `null` thì hiện một khối nổi ngay dưới thanh công cụ.
 * Bốn trong bảy trạng thái đóng băng ở `overlayComparisonScenarios.ts` mang câu
 * này (`empty`, `loading`, `partial`, `error`, `forbidden`); `success` và
 * `collapsed` không — câu "đã xác nhận" của `success` sống trong
 * {@link ConfirmationViewModel.confirmedNotice}, không phải ở đây (A5: xanh "đã
 * xác minh" chỉ đánh dấu việc người duyệt, không phải trạng thái chung của màn).
 * `loading` không có màu cảnh báo nào trong đúng ba màu của A4 nên nó hiện dưới
 * dạng chữ thường, không phải `InlineAlert`.
 *
 * Trạng thái `error` kèm thêm một liên kết THẬT sang màn Hiệu chỉnh tỷ lệ
 * (`model.scaleFixHref` — đã là đường dẫn dựng sẵn từ hook, R-65). Một `<a href>`
 * chứ không một callback: liên kết thật mở được bằng bàn phím, bằng chuột giữa,
 * và đọc được bởi trình đọc màn hình — ba thứ một `onClick` lấy mất (A12), cùng
 * lý lẽ `DimensionOcrReview.tsx`.
 *
 * ## Bảy trạng thái (A11)
 *
 * Không nhánh nào trả `null`: canvas, thanh công cụ và panel luôn được vẽ, kể cả
 * `loading` và `forbidden` — chúng chỉ khác NỘI DUNG các prop nhận được, không
 * khác CÓ được vẽ hay không. Màn trắng — thất bại duy nhất A11 tồn tại để chặn —
 * không có chỗ xảy ra.
 *
 * ## `canEdit` — vì sao suy ra tại đây, và từ đâu
 *
 * `OverlayComparisonToolbarProps.canEdit`, `OverlayComparisonPanelProps.canEdit`
 * và `OverlayComparisonCanvasProps.isInteractive` không có mặt trong
 * {@link OverlayComparisonViewModel}: mô hình chỉ mang `role`. Cùng khuôn
 * `canEdit = can('edit', ...)` mà `WallLayerReview`, `PropertyInspector`,
 * `RoomAreaPanel` đều tính từ vai — vai `'viewer'` (và vai `null`, tức CHƯA BIẾT
 * vai) là hai trường hợp duy nhất không sửa được ở màn này (xem kịch bản
 * `forbidden`) — chỗ này tính đúng MỘT lần và truyền cùng một giá trị xuống cả
 * ba nơi, vì cả ba đều hỏi cùng một câu: "người đang xem có sửa được không".
 * `isAlignmentLocked` là một trường KHÁC — trạng thái của cái khoá mà chính
 * thanh công cụ vẽ và bật/tắt qua `actions.toggleAlignmentLock`, không phải điều
 * kiện cho quyền sửa.
 */

import { InlineAlert, type InlineAlertLevel } from '@/components/feedback/InlineAlert';

import { OverlayComparisonCanvas } from './OverlayComparisonCanvas';
import { OverlayComparisonPanel } from './OverlayComparisonPanel';
import { OverlayComparisonToolbar } from './OverlayComparisonToolbar';
import type { OverlayComparisonProps, OverlayComparisonState } from './types';

const SCREEN_ARIA_LABEL = 'Màn đối chiếu bản vẽ';
const CANVAS_REGION_ARIA_LABEL = 'Khung đối chiếu bản vẽ gốc và mô hình';
const NOTICE_REGION_ARIA_LABEL = 'Trạng thái của màn đối chiếu bản vẽ';

const ERROR_LINK_LABEL = 'sang màn hiệu chỉnh tỷ lệ';

/** Nút chữ của liên kết lỗi: cùng khuôn `DimensionOcrReview.tsx` (A1, A2). */
const ERROR_LINK_CLASS_NAME =
  'self-center rounded-[6px] px-1.5 py-0.5 text-[13px] text-accent ' +
  'transition-colors duration-120 hover:bg-accent-wash ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/** Chữ thường của trạng thái đang tải: không có màu nào trong ba màu A4 phù hợp. */
const LOADING_NOTICE_CLASS_NAME =
  'rounded-[8px] bg-bg-surface px-3 py-2 text-center text-[13px] text-text-secondary shadow-overlay';

/**
 * Mức màu của khối thông báo nổi, đúng ba màu của A4.
 *
 * `success` và `collapsed` vắng mặt vì `stateNotice` của chúng luôn `null`
 * (xem `overlayComparisonScenarios.ts`); `loading` vắng mặt có chủ đích, vì
 * không màu nào trong ba màu hợp với "đang tải" — nó hiện bằng chữ thường.
 */
const NOTICE_LEVELS: Readonly<Partial<Record<OverlayComparisonState, InlineAlertLevel>>> = {
  empty: 'attention',
  partial: 'attention',
  error: 'violation',
  forbidden: 'attention',
};

export function OverlayComparison({ actions, model }: OverlayComparisonProps) {
  // Vai 'viewer', và vai null (CHƯA BIẾT vai) — hai trường hợp duy nhất không
  // sửa được ở màn này, cùng khuôn `canEdit` của WallLayerReview/PropertyInspector.
  const canEdit = model.role !== null && model.role !== 'viewer';
  const isStacked = model.state === 'collapsed';
  const isError = model.state === 'error';
  const noticeLevel = NOTICE_LEVELS[model.state];

  return (
    <div aria-label={SCREEN_ARIA_LABEL} className="relative flex h-full min-h-0 w-full bg-bg-app" role="region">
      <section aria-label={CANVAS_REGION_ARIA_LABEL} className="relative min-h-0 min-w-0 flex-1">
        <OverlayComparisonCanvas
          compareMode={model.compareMode}
          geometry={model.geometry}
          isInteractive={canEdit}
          layers={model.layers}
          marks={model.marks}
          measurement={model.measurement}
          onSelectRegion={actions.selectRegion}
          onSetSwipePosition={actions.setSwipePosition}
          onSetViewport={actions.setViewport}
          scanUrl={model.scanUrl}
          swipePosition={model.swipePosition}
          viewport={model.viewport}
        />

        {/*
          `pointer-events-none` trên lớp bọc, `pointer-events-auto` trên từng
          mảnh nội dung: cả thanh công cụ lẫn khối thông báo đều hẹp hơn bề rộng
          canvas, nên nếu lớp bọc giữ nguyên khả năng nhận chuột thì mọi cú nhấp
          hai bên rìa canvas — kéo khung nhìn, chọn vùng lệch — sẽ bị nó chặn dù
          không có gì để bấm ở đó.
        */}
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex flex-col items-center gap-2 px-3">
          <div className="pointer-events-auto">
            <OverlayComparisonToolbar
              activeFloorId={model.activeFloorId}
              canEdit={canEdit}
              compareMode={model.compareMode}
              disabledCompareModes={model.disabledCompareModes}
              floors={model.floors}
              isAlignmentLocked={model.isAlignmentLocked}
              isStacked={isStacked}
              onSelectFloor={actions.selectFloor}
              onSetCompareMode={actions.setCompareMode}
              onSetScanOpacity={actions.setScanOpacity}
              onToggleAlignmentLock={actions.toggleAlignmentLock}
              scanOpacityPercent={model.scanOpacityPercent}
              scanOpacityText={model.scanOpacityText}
            />
          </div>

          {model.stateNotice !== null && (
            <div
              aria-label={NOTICE_REGION_ARIA_LABEL}
              className="flex w-full max-w-[420px] flex-col items-center gap-2 pointer-events-auto"
            >
              {noticeLevel !== undefined ? (
                <InlineAlert level={noticeLevel} message={model.stateNotice} />
              ) : (
                <p className={LOADING_NOTICE_CLASS_NAME} role="status">
                  {model.stateNotice}
                </p>
              )}
              {isError && model.scaleFixHref !== null && (
                <a className={ERROR_LINK_CLASS_NAME} href={model.scaleFixHref}>
                  {ERROR_LINK_LABEL}
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      <OverlayComparisonPanel
        canEdit={canEdit}
        confirmation={model.confirmation}
        metrics={model.metrics}
        onConfirmMatch={actions.confirmMatch}
        onSelectRegion={actions.selectRegion}
        onSetToleranceMm={actions.setToleranceMm}
        rows={model.rows}
        toleranceLabel={model.toleranceLabel}
        toleranceMm={model.toleranceMm}
      />
    </div>
  );
}
