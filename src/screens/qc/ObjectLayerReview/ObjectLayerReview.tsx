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
import { QcFloorNav, type QcFloorNavProps } from '../shared/QcFloorNav';
import { QcScreenFrame, QcWorkspace } from '../shared/QcScreenFrame';
import { QcAskCard } from '../shared/QcAskCard';
import { QcAskSlot, askNavOf } from '../shared/qcAsk';
import { QcDisplayPopover } from '../shared/QcDisplayPopover';
import { QcStepColumn } from '../shared/QcStepColumn';
import { isL23Layout } from '../shared/qcLayout';

import { ObjectLayerCanvas } from './ObjectLayerCanvas';
import { ObjectLayerGate, ObjectLayerPanelHead } from './ObjectLayerHead';
import { ObjectLayerInspector } from './ObjectLayerInspector';
import { ObjectLayerLeftPanel } from './ObjectLayerLeftPanel';
import { ObjectLayerList } from './ObjectLayerList';
import { ObjectLayerStatusBar } from './ObjectLayerStatusBar';
import { ObjectLayerSuggestionBar } from './ObjectLayerSuggestionBar';
import { ObjectLayerToolRail } from './ObjectLayerToolRail';
import { OBJECT_LAYER_TEXT } from './objectLayerReviewGateway';
import type { ObjectLayerReviewModel } from './objectLayerTypes';
import { OBJECT_LAYER_IDS, OBJECT_LAYER_LABELS } from './objectLayerTypes';

/**
 * Props của view.
 *
 * Đúng một nhóm: cả mô hình mà `useObjectLayerReview` trả về. Màn này không có
 * lối ra nào (không nút "sang lớp khác", không đổi tầng), nên nó KHÔNG nhận một
 * callback điều hướng nào — R-73 cấm prop tuỳ chọn không ai truyền, và một lối
 * ra không có trong đặc tả thì không được bịa ra ở đây.
 */
export type ObjectLayerReviewViewProps = ObjectLayerReviewModel & {
  /** Breadcrumb dự án › tầng › lớp + thanh lớp ở đầu màn (N0-01, N2-06). */
  readonly floorNav?: Omit<QcFloorNavProps, 'layer'>;
};

/* Chuỗi tiếng Việt tĩnh — chép từ `.orca-notes/S13-SPEC-GOC.md` phần IV (A6). */

const SCREEN_ARIA_LABEL = 'Lớp đối tượng';
const L23_TASK = 'Duyệt cửa và nội thất máy tìm thấy. Đúng thì duyệt, sai thì sửa.';
const L23_LAYER_GROUP = 'Lớp của bước';
const askEyebrow = (position: number | null, total: number): string =>
  position !== null ? `Mục ${position} trong ${total} cần xem` : total > 0 ? `Đã duyệt · còn ${total} cần xem` : 'Đã duyệt hết';
const CANVAS_REGION_LABEL = 'Mặt bằng lớp đối tượng';
const EMPTY_TITLE = 'Chưa nhận ra đối tượng nào';
const EMPTY_ACTION = 'Thêm thủ công';
const OPEN_WALL_LAYER_ACTION = 'Sang duyệt tường';
const LOW_CONFIDENCE_FILTER = 'Chỉ hiện chỗ máy chưa chắc';
const LOW_CONFIDENCE_DONE = 'Đã duyệt hết chỗ máy chưa chắc.';
const SHOW_ALL = 'Hiện tất cả';
/* Chưa có số đếm thật thì không in "0/0 đối tượng đã duyệt" (BUG-618). */
const LOADING_PROGRESS_LABEL = 'Đang đọc lớp đối tượng…';

/** Người xem, hoặc tầng bị khoá vì thiếu tỷ lệ: xem được hết, không nút sửa nào (UX-R1 r3). */
function isReadOnly(model: ObjectLayerReviewModel): boolean {
  return model.isViewerRole || model.scaleLock != null;
}

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
        ? {
            label:
              model.emptyNotice === OBJECT_LAYER_TEXT.emptyNoDrawing
                ? OBJECT_LAYER_TEXT.openFloorsAction
                : OPEN_WALL_LAYER_ACTION,
            onClick: model.onOpenWallLayer,
          }
        : isReadOnly(model)
          ? null
          : { label: EMPTY_ACTION, onClick: () => model.onAddManually('door') };

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
      {/* Số mục dưới ngưỡng đã ở dòng trạng thái đầu panel: ở đây chỉ còn công tắc lọc (không lặp số). */}
      {model.partialNotice === null && !model.isLowConfidenceOnly ? null : (
        <div className="flex flex-col gap-1 px-2">
          <button
            aria-pressed={model.isLowConfidenceOnly}
            className={cn(
              'self-start rounded-full border px-2.5 py-1 text-[12px]',
              'transition-colors duration-120',
              'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
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
            className="inline-flex h-8 shrink-0 items-center rounded-sm px-2 text-[13px] font-medium text-accent outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            onClick={model.onToggleLowConfidenceOnly}
            type="button"
          >
            {SHOW_ALL}
          </button>
        </div>
      ) : null}

      {(model.suggestionCount ?? 0) === 0 ||
      model.onAcceptAllSuggestions === undefined ||
      model.onRejectAllSuggestions === undefined ? null : (
        <ObjectLayerSuggestionBar
          label={model.suggestionLabel ?? ''}
          onAcceptAll={model.onAcceptAllSuggestions}
          onRejectAll={model.onRejectAllSuggestions}
        />
      )}

      {model.filteredLabel === null ? null : (
        <p aria-live="polite" className="px-2 text-[12px] tabular-nums text-text-secondary">
          {model.filteredLabel}
        </p>
      )}

      <ObjectLayerList
        collapsedGroups={model.collapsedGroups}
        isFiltered={model.filteredLabel !== null}
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
function ObjectLayerCanvasRegion({ model, l23 = false }: { readonly model: ObjectLayerReviewModel; readonly l23?: boolean }) {
  const readOnly = isReadOnly(model);
  const editing = readOnly
    ? {}
    : {
        onApprove: model.onApprove,
        onAttachToNearestWall: model.onAttachToNearestWall,
        onChangeSubtype: model.onChangeSubtype,
        onDelete: model.onDelete,
        drawLayer: model.drawLayer,
        onPlaceAt: model.onPlaceAt,
      };

  return (
    <ObjectLayerCanvas
      backgroundImageAlt={model.backgroundImageAlt}
      backgroundImageUrl={model.backgroundImageUrl}
      dragMeasurement={model.dragMeasurement}
      haloRectPx={model.haloRectPx}
      highlightedWallId={model.highlightedWallId}
      hoveredObjectId={model.hoveredObjectId}
      isInteractive={!readOnly}
      isLoading={model.state === 'loading'}
      layerVisibility={model.layerVisibility}
      millimetresPerPixel={model.millimetresPerPixel}
      objects={model.objects}
      onFrameResize={model.onFrameResize}
      onHover={model.onHover}
      onSelect={model.onSelect}
      /* Bố cục L23: công tắc lớp nằm trong popover Hiển thị, không lặp ở đáy bản vẽ. */
      onToggleLayer={l23 ? undefined : model.onToggleLayer}
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

/** MỘT khung cho panel trái (NGUYEN-TAC-BO-CUC §2): đầu panel, lọc theo loại, rồi hàng đợi cuộn riêng. */
function ObjectLayerLeftColumn({ model, embedded = false }: { readonly model: ObjectLayerReviewModel; readonly embedded?: boolean }) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', !embedded && 'rounded-xl bg-bg-surface shadow-panel max-lg:flex-none')}>
      {embedded ? null : <ObjectLayerPanelHead model={model} />}
      <div className="shrink-0">
        {/* Đang tải: khung xương thay bộ lọc "0" như thể dữ liệu thật (BUG-618). */}
        {model.state === 'loading' ? null : (
          <ObjectLayerLeftPanel
            availableSubtypes={model.availableSubtypes}
            counts={model.counts}
            furnitureAttentionNotice={model.furnitureAttentionNotice}
            layerVisibility={model.layerVisibility}
            listLayerFilter={model.listLayerFilter}
            onFilterLayer={model.onFilterLayer}
            onToggleLayer={model.onToggleLayer}
            onToggleSubtypeFilter={model.onToggleSubtypeFilter}
            reviewCounter={model.reviewCounter}
            reviewProgressLabel={model.reviewProgressLabel}
            subtypeFilters={model.subtypeFilters}
          />
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <ObjectLayerListRegion model={model} />
      </div>
    </div>
  );
}

export function ObjectLayerReview(model: ObjectLayerReviewViewProps) {
  /* Đọc cờ của vỏ màn, không `state`: ở vai người xem `forbidden` đứng trước `collapsed`, và nút thu gọn đổi nhãn mà panel không thu (BUG-601). */
  const isCollapsed = model.isCollapsed;
  const nav = model.floorNav;
  const l23 = isL23Layout() && nav != null;
  const inspectorView = (
    <ObjectLayerInspector
        inspector={model.inspector}
        isViewerRole={isReadOnly(model)}
        onApprove={model.onApprove}
        onAttachToNearestWall={model.onAttachToNearestWall}
        onChangeFurnitureKind={model.onChangeFurnitureKind}
        onChangeSubtype={model.onChangeSubtype}
        onChangeSwing={model.onChangeSwing}
        onDelete={model.onDelete}
        onDragPosition={model.onDragPosition}
        onSelectHostWall={model.onSelectHostWall}
        scaleLock={model.scaleLock ?? null}
        focusKindToken={model.focusKindToken}
        onResize={model.onResize}
        onRotate={model.onRotate}
      />
  );
  const selectedId = model.inspector?.id ?? null;
  const askNav = askNavOf(model.rows.map((row) => ({ id: row.id, pending: !row.isReviewed })), selectedId);
  const selectedRow = model.rows.find((row) => row.id === selectedId);
  const ask =
    l23 && !isCollapsed && selectedRow !== undefined ? (
      <QcAskCard
        eyebrow={askEyebrow(askNav.position, askNav.total)}
        onNext={askNav.nextId === null ? undefined : () => model.onSelect(askNav.nextId!)}
        onPrev={askNav.prevId === null ? undefined : () => model.onSelect(askNav.prevId!)}
      >
        {inspectorView}
      </QcAskCard>
    ) : null;

  if (model.readFailure != null) {
    return (
      <QcScreenFrame label={SCREEN_ARIA_LABEL}>
        {model.floorNav != null && <QcFloorNav {...model.floorNav} layer="objects" />}
        <FloorLayerReadFailureScreen failure={model.readFailure} />
      </QcScreenFrame>
    );
  }

  return (
    <QcScreenFrame label={SCREEN_ARIA_LABEL}>
      {model.floorNav != null && (
        <QcFloorNav {...model.floorNav} layer="objects" minimal={l23} titled={l23 || !isCollapsed} />
      )}
      {l23 ? null : <ObjectLayerGate model={model} />}
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
      {/* Khe chung (A3): rail | panel trái | bản vẽ | chi tiết; 1024-1279 chi tiết phủ mép phải bản vẽ. */}
      <QcAskSlot value={ask}>
      <QcWorkspace
        column={l23}
        chromeTopRight={
          l23 ? (
            <QcDisplayPopover
              groups={[
                {
                  title: L23_LAYER_GROUP,
                  items: OBJECT_LAYER_IDS.map((layer) => ({
                    key: layer,
                    label: OBJECT_LAYER_LABELS[layer],
                    checked: model.layerVisibility[layer],
                    onToggle: () => model.onToggleLayer(layer),
                  })),
                },
              ]}
            />
          ) : undefined
        }
        canvas={<ObjectLayerCanvasRegion l23={l23} model={model} />}
        canvasLabel={CANVAS_REGION_LABEL}
        inspector={isCollapsed || l23 ? null : inspectorView}
        left={
          isCollapsed ? null : l23 && nav != null ? (
            <QcStepColumn
              activeStep="objects"
              floorId={nav.floorId}
              gate={<ObjectLayerGate inline model={model} />}
              projectId={nav.projectId}
              task={L23_TASK}
            >
              <ObjectLayerLeftColumn embedded model={model} />
            </QcStepColumn>
          ) : (
            <ObjectLayerLeftColumn model={model} />
          )
        }
        selectionKey={model.inspector?.id ?? null}
        rail={
          <ObjectLayerToolRail
            activeLayer={model.activeLayer}
            activeSubtype={model.activeSubtype}
            drawLayer={model.drawLayer}
            isViewerRole={isReadOnly(model)}
            onStartDraw={model.onStartDraw}
            onSelectSubtypeSlot={model.onSelectSubtypeSlot}
          />
        }
      />
      </QcAskSlot>

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
    </QcScreenFrame>
  );
}
