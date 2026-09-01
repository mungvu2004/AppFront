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
 * | `error`     | `InlineAlert` trong panel trái; canvas VẪN xem được ảnh nền          |
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

const SCREEN_ARIA_LABEL = 'lớp đối tượng';
const CANVAS_REGION_LABEL = 'mặt bằng lớp đối tượng';
const EMPTY_TITLE = 'chưa nhận ra đối tượng nào';
const EMPTY_ACTION = 'thêm thủ công';
const LOW_CONFIDENCE_FILTER = 'chỉ hiện mục dưới ngưỡng';

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
    return (
      <EmptyState
        action={{ label: EMPTY_ACTION, onClick: model.onAddManually }}
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
      {model.partialNotice === null ? null : (
        <div className="flex flex-col gap-1 px-2">
          <p className="text-[12px] text-state-attention-text">{model.partialNotice}</p>
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
      hoveredObjectId={model.hoveredObjectId}
      isInteractive={!model.isViewerRole}
      layerVisibility={model.layerVisibility}
      millimetresPerPixel={model.millimetresPerPixel}
      objects={model.objects}
      onHover={model.onHover}
      onSelect={model.onSelect}
      placements={model.placements}
      selectedObjectId={model.selectedObjectId}
      wallOutlines={model.wallOutlines}
      {...editing}
    />
  );
}

export function ObjectLayerReview(model: ObjectLayerReviewViewProps) {
  const isCollapsed = model.state === 'collapsed';

  return (
    <div
      aria-label={SCREEN_ARIA_LABEL}
      className="flex h-full min-h-0 w-full flex-col bg-bg-app"
      role="region"
    >
      <div className="relative flex min-h-0 flex-1 gap-2 p-2">
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
          <div className="flex h-full w-[280px] shrink-0 flex-col gap-2 overflow-y-auto">
            <div className="shrink-0">
              <ObjectLayerLeftPanel
                counts={model.counts}
                furnitureAttentionNotice={model.furnitureAttentionNotice}
                layerVisibility={model.layerVisibility}
                onToggleLayer={model.onToggleLayer}
                onToggleSubtypeFilter={model.onToggleSubtypeFilter}
                reviewCounter={model.reviewCounter}
                reviewProgressLabel={model.reviewProgressLabel}
                subtypeFilters={model.subtypeFilters}
              />
            </div>

            <div className="shrink-0 rounded-[12px] bg-bg-surface px-3 py-3 shadow-panel">
              <ObjectLayerListRegion model={model} />
            </div>
          </div>
        )}

        <section
          aria-label={CANVAS_REGION_LABEL}
          className="relative min-h-0 min-w-[640px] flex-1 overflow-hidden rounded-[16px] bg-bg-sunken"
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
        reviewProgressLabel={model.reviewProgressLabel}
        state={model.state}
        viewerRoleNotice={model.viewerRoleNotice}
      />
    </div>
  );
}
