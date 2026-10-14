/**
 * Màn S-13 "Lớp đối tượng" (`ObjectLayerReview`) — VIEW THUẦN, ghép năm vùng:
 * ray công cụ trái (56), panel trái (280) gồm bộ đếm/cây lớp/chip lọc và danh
 * sách gộp, canvas giữa, thanh tra phải (344), thanh trạng thái (32) dính đáy.
 *
 * Nhận HẾT qua props ({@link ObjectLayerReviewViewProps}) và chỉ dựng thẻ.
 * Không `@/api`, không `@/store`, không `@/domain`, không `@/lib/http` (R-60,
 * `local/no-data-layer-in-view`). Không tính hình học, không định dạng một con
 * số nào: mọi chuỗi số tới nơi đã xong ở hook (A15).
 *
 * ## Vỏ QC là khuôn của màn QC anh em, KHÔNG phải `src/components/shell`
 *
 * `WallLayerReview.tsx` không nhập `AppShell`/`Panel`/`StatusBar`: nó tự dựng
 * layout ba cột bằng `div` trần, và `StatusBar` dùng chung thì tự làm tròn số
 * thô bên trong view — thứ `local/no-raw-number` cấm và `CLAUDE.md` xếp vào sổ
 * nợ. Vỏ QC của repo này là khuôn ấy, nên file này chép đúng cấu trúc đó với
 * tiền tố của riêng màn (`ObjectLayer*`) và không nhập một mảnh nào của màn
 * tường.
 *
 * ## Bảy trạng thái (A11) — nơi từng trạng thái được vẽ
 *
 * | `state`     | vẽ ở đâu                                                          |
 * |-------------|--------------------------------------------------------------------|
 * | `empty`     | panel trái: `EmptyState` — tiêu đề, câu giải thích, nút thêm tay    |
 * | `loading`   | panel trái: bốn dòng `Skeleton`; canvas tự vẽ nền chờ của nó        |
 * | `partial`   | mặc định — hàng "5 mục dưới ngưỡng…" cộng danh sách ba nhóm         |
 * | `error`     | `InlineAlert` trong panel trái; đọc lớp hỏng khi chưa có tài liệu → cả màn là `FloorLayerReadFailureScreen` (BUG-326) |
 * | `success`   | 21/21 — bộ đếm đổi hình thức, danh sách bình thường                  |
 * | `forbidden` | ray ẩn công cụ sửa, canvas bỏ mọi callback nên chuột phải không mở  |
 * | `collapsed` | hai panel ẩn; ray công cụ nổi trên canvas; thanh trạng thái còn      |
 *
 * Không nhánh nào trả `null`: canvas, ray công cụ và thanh trạng thái luôn được
 * vẽ, nên màn trắng — thất bại duy nhất A11 tồn tại để chặn — không có chỗ xảy
 * ra.
 */

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { cn } from '@/lib/utils';

import { FloorLayerSaveBanner } from '../WallLayerReview/FloorLayerSaveBanner';
import { FloorLayerReadFailureScreen } from '../shared/FloorLayerReadFailureScreen';
import { ProvisionalScaleBanner } from '../shared/ProvisionalScaleBanner';

import { ObjectLayerCanvas } from './ObjectLayerCanvas';
import { ObjectLayerInspector } from './ObjectLayerInspector';
import { ObjectLayerLeftPanel } from './ObjectLayerLeftPanel';
import { ObjectLayerList } from './ObjectLayerList';
import { ObjectLayerStatusBar } from './ObjectLayerStatusBar';
import { ObjectLayerToolRail } from './ObjectLayerToolRail';
import type { ObjectLayerReviewModel } from './objectLayerTypes';

/**
 * Props của view.
 *
 * Đúng một nhóm: cả mô hình mà `useObjectLayerReview` trả về. Màn này không có
 * lối ra nào (không nút "sang lớp khác", không đổi tầng), nên nó KHÔNG nhận một
 * callback điều hướng nào — R-73 cấm prop tuỳ chọn không ai truyền, và một lối
 * ra không có trong đặc tả thì không được bịa ra ở đây.
 */
export type ObjectLayerReviewViewProps = ObjectLayerReviewModel;

/* Chuỗi tiếng Việt tĩnh — chép từ `.orca-notes/S13-SPEC-GOC.md` phần IV (A6). */

const SCREEN_ARIA_LABEL = 'Lớp đối tượng';
const CANVAS_REGION_LABEL = 'Mặt bằng lớp đối tượng';
const EMPTY_TITLE = 'Chưa nhận ra đối tượng nào';
const EMPTY_ACTION = 'Thêm thủ công';
const OPEN_WALL_LAYER_ACTION = 'Sang duyệt tường';
const LOW_CONFIDENCE_FILTER = 'Chỉ hiện mục dưới ngưỡng';
const LOW_CONFIDENCE_DONE = 'Đã duyệt hết mục dưới ngưỡng.';
const SHOW_ALL = 'Hiện tất cả';
/* Chưa có số đếm thật thì không in "0/0 đối tượng đã duyệt" (BUG-618). */
const LOADING_PROGRESS_LABEL = 'Đang đọc lớp đối tượng…';

/** Số dòng khung xương của panel trái lúc đang tải — một dòng cho mỗi nhóm, cộng một. */
const SKELETON_ROWS = [0, 1, 2, 3];

/**
 * Phần dưới của panel trái: khung xương, câu rỗng, câu lỗi, hoặc danh sách.
 *
 * Bốn nhánh loại trừ nhau và nhánh cuối là mặc định, nên không trạng thái nào
 * để chỗ này trống — kể cả `forbidden`, nơi danh sách vẫn xem được và chỉ các
 * nút sửa biến mất (việc của từng view con).
 */
function ObjectLayerListRegion({ model }: { readonly model: ObjectLayerReviewModel }) {
  if (model.state === 'loading') {
    return (
      <div className="flex flex-col gap-1">
        {SKELETON_ROWS.map((row) => (
          <Skeleton key={row} preset="table-row" />
        ))}
      </div>
    );
  }

  if (model.emptyNotice !== null) {
    /* Người xem không thêm được gì: không đưa nút "Thêm thủ công" chết (BUG-601). */
    const action =
      model.onOpenWallLayer !== null
        ? { label: OPEN_WALL_LAYER_ACTION, onClick: model.onOpenWallLayer }
        : model.isViewerRole
          ? null
          : { label: EMPTY_ACTION, onClick: model.onAddManually };

    return (
      <EmptyState
        {...(action === null ? {} : { action })}
        description={model.emptyNotice}
        icon={<div aria-hidden="true" className="h-8 w-8 rounded-full bg-bg-sunken" />}
        title={EMPTY_TITLE}
      />
    );
  }

  if (model.errorMessage !== null) {
    return <InlineAlert level="violation" message={model.errorMessage} />;
  }

  return (
    <div className="flex flex-col gap-2">
      {/*
        Nhánh (a) của trạng thái một phần: năm mục dưới ngưỡng tin cậy đã lọc
        sẵn, và người duyệt phải BỎ được bộ lọc đó — một bộ lọc bật sẵn mà không
        tắt được là một danh sách thiếu mục mà không ai giải thích.
      */}
      {/*
        BUG-584: còn bộ lọc bật thì nút tắt nó còn — duyệt hết mục dưới ngưỡng làm câu báo biến
        mất, và bản cũ ẩn luôn nút, để lại danh sách rỗng không lối ra.
      */}
      {model.partialNotice === null && !model.isLowConfidenceOnly ? null : (
        <div className="flex flex-col gap-1 px-2">
          {model.partialNotice === null ? null : (
            <p className="text-[12px] text-state-attention-text">{model.partialNotice}</p>
          )}
          <button
            aria-pressed={model.isLowConfidenceOnly}
            className={cn(
              'self-start rounded-full border px-2.5 py-1 text-[12px]',
              'transition-colors duration-120',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              model.isLowConfidenceOnly
                ? 'border-accent bg-accent-wash text-accent'
                : 'border-border-default text-text-secondary hover:bg-bg-hover hover:text-text-primary',
            )}
            onClick={model.onToggleLowConfidenceOnly}
            type="button"
          >
            {LOW_CONFIDENCE_FILTER}
          </button>
        </div>
      )}

      {model.isLowConfidenceOnly && model.rows.length === 0 ? (
        <div className="flex items-center justify-between gap-2 px-2 py-2">
          <p className="text-[13px] text-text-secondary">{LOW_CONFIDENCE_DONE}</p>
          <button
            className="inline-flex h-8 shrink-0 items-center rounded px-2 text-[13px] font-medium text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            onClick={model.onToggleLowConfidenceOnly}
            type="button"
          >
            {SHOW_ALL}
          </button>
        </div>
      ) : null}

      <ObjectLayerList
        collapsedGroups={model.collapsedGroups}
        onAttachToNearestWall={model.onAttachToNearestWall}
        onHover={model.onHover}
        onSelect={model.onSelect}
        onToggleGroupCollapsed={model.onToggleGroupCollapsed}
        rows={model.rows}
        selectedObjectId={model.selectedObjectId}
      />
    </div>
  );
}

/**
 * Canvas đã cắm props.
 *
 * Bốn callback sửa VẮNG MẶT ở vai Người xem thay vì mang `undefined`: hợp đồng
 * của canvas nói vắng cả bốn thì bấm chuột phải không mở gì, và
 * `exactOptionalPropertyTypes` đòi vắng là vắng thật.
 */
function ObjectLayerCanvasRegion({ model }: { readonly model: ObjectLayerReviewModel }) {
  const editing = model.isViewerRole
    ? {}
    : {
        onApprove: model.onApprove,
        onAttachToNearestWall: model.onAttachToNearestWall,
        onChangeSubtype: model.onChangeSubtype,
        onDelete: model.onDelete,
      };

  return (
    <ObjectLayerCanvas
      backgroundImageAlt={model.backgroundImageAlt}
      backgroundImageUrl={model.backgroundImageUrl}
      dragMeasurement={model.dragMeasurement}
      haloRectPx={model.haloRectPx}
      highlightedWallId={model.highlightedWallId}
      hoveredObjectId={model.hoveredObjectId}
      isInteractive={!model.isViewerRole}
      isLoading={model.state === 'loading'}
      layerVisibility={model.layerVisibility}
      millimetresPerPixel={model.millimetresPerPixel}
      objects={model.objects}
      onFrameResize={model.onFrameResize}
      onHover={model.onHover}
      onSelect={model.onSelect}
      placements={model.placements}
      selectedObjectId={model.selectedObjectId}
      surfaceRectPx={model.surfaceRectPx}
      unitPx={model.unitPx}
      viewBoxPx={model.viewBoxPx}
      wallOutlines={model.wallOutlines}
      {...editing}
    />
  );
}

export function ObjectLayerReview(model: ObjectLayerReviewViewProps) {
  /* Đọc cờ của vỏ màn, không `state`: ở vai người xem `forbidden` đứng trước `collapsed`, và nút thu gọn đổi nhãn mà panel không thu (BUG-601). */
  const isCollapsed = model.isCollapsed;

  if (model.readFailure != null) {
    return (
      <div aria-label={SCREEN_ARIA_LABEL} className="flex h-screen min-h-0 w-full flex-col bg-bg-app" role="region">
        <FloorLayerReadFailureScreen failure={model.readFailure} />
      </div>
    );
  }

  return (
    <div
      aria-label={SCREEN_ARIA_LABEL}
      // Cao bằng khung nhìn: route nằm trong `ScreenMain` (display: contents) nên `h-full` không có chiều cao
      // để bám, và thanh trạng thái trôi lên giữa trang (BUG-324) — cùng cách SCR-22 (OverlayComparison).
      className="flex h-screen min-h-0 w-full flex-col bg-bg-app"
      role="region"
    >
      {model.saveBlock != null && (
        <div className="px-2 pt-2">
          <FloorLayerSaveBanner saveBlock={model.saveBlock} />
        </div>
      )}
      {model.provisionalScaleNotice != null && (
        <div className="px-2 pt-2">
          <ProvisionalScaleBanner notice={model.provisionalScaleNotice} />
        </div>
      )}
      {/*
        Dưới 1280px bốn cột (ray + 280 + bản vẽ + 344) không vừa: hàng đầu là ray + bản vẽ, hai panel
        xuống dòng (\`order-*\` trên gốc của chúng), cả vùng cuộn dọc — không cuộn ngang (BUG-317).
      */}
      <div className="relative flex min-h-0 flex-1 flex-wrap content-start gap-2 overflow-y-auto p-2 xl:flex-nowrap xl:overflow-visible">
        {isCollapsed ? (
          <div className="absolute left-4 top-4 z-10 rounded-[12px] bg-bg-surface shadow-panel">
            <ObjectLayerToolRail
              activeLayer={model.activeLayer}
              activeSubtype={model.activeSubtype}
              isViewerRole={model.isViewerRole}
              onSelectLayer={model.onSelectLayer}
              onSelectSubtypeSlot={model.onSelectSubtypeSlot}
            />
          </div>
        ) : (
          <ObjectLayerToolRail
            activeLayer={model.activeLayer}
            activeSubtype={model.activeSubtype}
            isViewerRole={model.isViewerRole}
            onSelectLayer={model.onSelectLayer}
            onSelectSubtypeSlot={model.onSelectSubtypeSlot}
          />
        )}

        {isCollapsed ? null : (
          /* Dưới 1280 panel cao theo nội dung, vùng ngoài cuộn — không nén danh sách còn ~3 hàng (BUG-395). */
          <div className="order-1 flex w-full shrink-0 flex-col gap-2 xl:order-none xl:h-full xl:w-[280px] xl:overflow-y-auto">
            <div className="shrink-0">
              {/* Đang tải: khung xương thay bộ đếm "0/0" và "Tổng 0" như thể dữ liệu thật (BUG-618). */}
              {model.state === 'loading' ? (
                <div aria-hidden="true" className="flex flex-col gap-2 rounded-[12px] bg-bg-surface px-5 py-4 shadow-panel">
                  {SKELETON_ROWS.map((row) => (
                    <Skeleton key={row} preset="table-row" />
                  ))}
                </div>
              ) : (
              <ObjectLayerLeftPanel
                counts={model.counts}
                furnitureAttentionNotice={model.furnitureAttentionNotice}
                layerVisibility={model.layerVisibility}
                onToggleLayer={model.onToggleLayer}
                onToggleSubtypeFilter={model.onToggleSubtypeFilter}
                availableSubtypes={model.availableSubtypes}
                reviewCounter={model.reviewCounter}
                reviewProgressLabel={model.reviewProgressLabel}
                subtypeFilters={model.subtypeFilters}
              />
              )}
            </div>

            <div className="shrink-0 rounded-[12px] bg-bg-surface px-3 py-3 shadow-panel">
              <ObjectLayerListRegion model={model} />
            </div>
          </div>
        )}

        <section
          aria-label={CANVAS_REGION_LABEL}
          className="relative h-[60vh] min-h-[320px] min-w-0 flex-1 overflow-hidden rounded-[16px] bg-bg-sunken xl:h-auto xl:min-h-0"
        >
          <ObjectLayerCanvasRegion model={model} />
        </section>

        {isCollapsed ? null : (
          <ObjectLayerInspector
            inspector={model.inspector}
            isViewerRole={model.isViewerRole}
            onApprove={model.onApprove}
            onAttachToNearestWall={model.onAttachToNearestWall}
            onChangeSubtype={model.onChangeSubtype}
            onChangeSwing={model.onChangeSwing}
            onDelete={model.onDelete}
            onDragPosition={model.onDragPosition}
            onSelectHostWall={model.onSelectHostWall}
          />
        )}
      </div>

      <ObjectLayerStatusBar
        emptyNotice={model.emptyNotice}
        errorMessage={model.errorMessage}
        furnitureAttentionNotice={model.furnitureAttentionNotice}
        isCollapsed={model.isCollapsed}
        onToggleCollapsed={model.onToggleCollapsed}
        onUndo={model.onUndo}
        reviewCounter={model.reviewCounter}
        reviewProgressLabel={model.state === 'loading' ? LOADING_PROGRESS_LABEL : model.reviewProgressLabel}
        state={model.state}
        viewerRoleNotice={model.viewerRoleNotice}
      />
    </div>
  );
}
