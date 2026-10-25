/**
 * Màn S-17 "Kiểm kích thước đọc được" (`DimensionOcrReview`) — VIEW THUẦN, khung bàn làm
 * việc S-15 (demo Z/S-17): panel trái (đầu panel + danh sách), bản vẽ giữa, chi tiết phải.
 *
 * Nhận HẾT qua props ({@link DimensionOcrReviewViewProps}) và chỉ dựng thẻ. Không
 * `@/api`, không `@/store`, không `@/domain`, không `@/lib/http` (R-60). Không tính
 * hình học, không so ngưỡng, không định dạng số: mọi chuỗi tới nơi đã xong ở hook (A15).
 *
 * ## Ba câu (HOP-DONG-V6)
 * 1. Làm gì: `QcPanelHead` — eyebrow "Bước 3 · Kiểm tra tầng", H1 "Kiểm kích thước".
 * 2. Trạng thái: Badge + câu có số ("18/34 kích thước đã duyệt", hoặc "OCR đọc được 0
 *    chuỗi") + trạng thái lưu. Bộ đếm chỉ ở đây, không lặp trong danh sách.
 * 3. Bước tiếp: `FlowGate` ở thanh bước. Kích thước KHÔNG chặn sang 3D nên cổng không đếm
 *    nó; nút phụ "Về duyệt tường" dẫn về việc chặn thật.
 *
 * ## Bảy trạng thái (A11)
 * | `state`     | vẽ ở đâu                                                                    |
 * |-------------|------------------------------------------------------------------------------|
 * | `empty`     | thẻ góc trên trái bản vẽ: nguyên nhân + "Hiệu chỉnh tỷ lệ" + "Về duyệt tường" |
 * | `loading`   | panel trái: bốn dòng `Skeleton`                                              |
 * | `partial`   | mặc định — danh sách, chọn một chuỗi thì chi tiết phải có dải đối chiếu      |
 * | `error`     | thẻ lỗi trên bản vẽ ("Thử lại" + "Hiệu chỉnh tỷ lệ"); bản vẽ vẫn xem được    |
 * | `success`   | danh sách + câu "Tất cả kích thước đã duyệt" ở chân panel                    |
 * | `forbidden` | bản vẽ chỉ xem, hàng mất nút sửa/duyệt, chân panel nói vì sao                |
 * | `collapsed` | panel trái chỉ còn đầu panel + nút bung lại, không cột chi tiết              |
 *
 * Chế độ duyệt bàn phím: khi CÒN chuỗi để duyệt, cả màn thu về `DimensionOcrKeyboardMode`.
 */

import { Link } from 'react-router-dom';

import { FlowGate } from '@/components/shell/FlowGate';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getButtonStyles } from '@/components/ui/buttonVariants';
import { cn } from '@/lib/utils';

import { FloorLayerSaveBanner } from '../WallLayerReview/FloorLayerSaveBanner';
import { FloorLayerReadFailureScreen } from '../shared/FloorLayerReadFailureScreen';
import { QcFloorNav, type QcFloorNavProps } from '../shared/QcFloorNav';
import { QcPanelHead } from '../shared/QcPanelHead';
import { QC_BODY_CLASS, QcScreenFrame, QcStatusBar, QcWorkspace } from '../shared/QcScreenFrame';
import { DIMENSION_INSPECTOR_TEXT, DIMENSION_OCR_TEXT } from './dimensionOcrText';
import { DimensionOcrCanvas } from './DimensionOcrCanvas';
import { DimensionOcrCanvasCard, DimensionOcrInspector } from './DimensionOcrInspector';
import { DimensionOcrKeyboardMode } from './DimensionOcrKeyboardMode';
import { DimensionOcrList } from './DimensionOcrList';
import type { DimensionOcrReviewModel } from './useDimensionOcrReview';

/**
 * Props của view: cả mô hình `useDimensionOcrReview`, cộng các lối ra. Lối ra là chuỗi
 * đường dẫn (liên kết thật: bàn phím, chuột giữa, trình đọc màn hình — A12).
 */
export interface DimensionOcrReviewViewProps extends DimensionOcrReviewModel {
  /** Hiệu chỉnh tỷ lệ thủ công: lối ra của trạng thái rỗng và của chuỗi lệch > 2 %. */
  readonly scaleCalibrationHref: string;
  /** Lớp tường của tầng — nút cổng "Về duyệt tường". Vắng (story) thì cổng không có nút. */
  readonly wallReviewHref?: string | undefined;
  /** Breadcrumb dự án › tầng › lớp + thanh lớp (N0-01, N2-06). */
  readonly floorNav?: Omit<QcFloorNavProps, 'layer'> | undefined;
}

const SCREEN_ARIA_LABEL = DIMENSION_OCR_TEXT.screen.title;
const PANEL_ARIA_LABEL = DIMENSION_OCR_TEXT.panel.title;
const EXPAND_PANEL_LABEL = DIMENSION_OCR_TEXT.states.collapsed.title;
const PANEL_TITLE = 'Kiểm kích thước';

/** Chữ của dòng trạng thái và panel khi chưa có hàng nào. */
const STATUS_TEXT = {
  loading: 'Đang đọc',
  empty: 'Chưa có kích thước',
  error: 'Không đọc được kích thước',
  unreviewed: 'Chưa duyệt xong',
  done: 'Đã duyệt hết',
  viewer: 'Chỉ xem',
  noData: 'Chưa có số liệu kích thước',
  emptyCount: (floor: string): string => `OCR đọc được 0 chuỗi trên ${floor}`,
  emptyList: 'Chưa có chuỗi nào. Chuỗi kích thước đọc được hiện ở đây, kèm ảnh cắt gốc và độ lệch so với tỷ lệ.',
  errorList: 'Chưa có chuỗi kích thước để hiện. Danh sách có ngay khi đọc lại được.',
} as const;
const FLOOR_FALLBACK = 'tầng này';

const SKELETON_ROWS = [0, 1, 2, 3];
const GATE_LINK_CLASS = getButtonStyles({ variant: 'secondary', size: 'sm' });

type StatusVariant = 'verified' | 'attention' | 'violation' | 'neutral';

/** Chip + câu: đọc từ `state`/cờ của hook, không so ngưỡng nào ở đây. */
function statusOf(model: DimensionOcrReviewModel, floorLabel: string): { variant: StatusVariant; chip: string; line: string } {
  if (model.errorMessage !== null) return { variant: 'violation', chip: STATUS_TEXT.error, line: STATUS_TEXT.noData };
  if (model.emptyNotice !== null) return { variant: 'attention', chip: STATUS_TEXT.empty, line: STATUS_TEXT.emptyCount(floorLabel) };
  if (model.state === 'loading') return { variant: 'neutral', chip: STATUS_TEXT.loading, line: DIMENSION_OCR_TEXT.states.loading.description };
  if (model.isViewerRole) return { variant: 'neutral', chip: STATUS_TEXT.viewer, line: model.reviewProgressLabel };
  const isDone = model.reviewCounter.total > 0 && model.reviewCounter.reviewed === model.reviewCounter.total;
  return isDone
    ? { variant: 'verified', chip: STATUS_TEXT.done, line: model.reviewProgressLabel }
    : { variant: 'attention', chip: STATUS_TEXT.unreviewed, line: model.reviewProgressLabel };
}

function DimensionOcrStatus({ model, floorLabel }: { readonly model: DimensionOcrReviewModel; readonly floorLabel: string }) {
  const status = statusOf(model, floorLabel);

  return (
    <>
      <Badge variant={status.variant}>{status.chip}</Badge>
      {/* A7: không có nút lưu — bộ đếm đổi ngay sau một thao tác đã tự lưu, nên nó nói ra. */}
      <p aria-live="polite" className="w-full" data-testid="dimension-ocr-progress">
        {status.line}
      </p>
      {model.saveLabel === null ? null : (
        <p
          className="w-full text-text-secondary"
          data-save-state={model.saveState ?? undefined}
          data-testid="dimension-ocr-save-status"
        >
          {model.saveLabel}
        </p>
      )}
    </>
  );
}

/** Hàng DUY NHẤT đang mang câu "giá trị vô lý" — tra cứu trên `rows`, hook đã so ngưỡng. */
function outlierNoticeOf(model: DimensionOcrReviewModel): { readonly dimensionId: string; readonly message: string } | null {
  const row = model.rows.find((entry) => entry.outlierMessage !== null);

  return row === undefined || row.outlierMessage === null ? null : { dimensionId: row.id, message: row.outlierMessage };
}

/** Thân panel trái: đang tải / chưa có hàng / danh sách. Rỗng và lỗi có thẻ riêng trên bản vẽ. */
function DimensionOcrPanelBody({ model }: { readonly model: DimensionOcrReviewModel }) {
  if (model.state === 'loading') {
    return (
      <div className="flex flex-col gap-1 p-3">
        <p className="px-1 text-body-sm text-text-secondary" role="status">
          Đang đọc kích thước…
        </p>
        {SKELETON_ROWS.map((row) => (
          <Skeleton key={row} preset="table-row" />
        ))}
      </div>
    );
  }

  if (model.emptyNotice !== null || model.errorMessage !== null) {
    return (
      <p className="p-4 text-body-sm text-text-secondary">
        {model.errorMessage !== null ? STATUS_TEXT.errorList : STATUS_TEXT.emptyList}
      </p>
    );
  }

  return (
    <DimensionOcrList
      activeFilter={model.activeFilter}
      isSelectedApproveDemoted={model.compare?.isSignificant === true}
      isViewerRole={model.isViewerRole}
      onApprove={model.onApprove}
      onCancelEdit={model.onCancelEdit}
      onEdit={model.onEdit}
      onFilterChange={model.onFilterChange}
      onSelect={model.onSelect}
      outlierNotice={outlierNoticeOf(model)}
      presetNotice={model.presetNotice ?? null}
      reviewCounter={model.reviewCounter}
      reviewProgressLabel={model.reviewProgressLabel}
      rows={model.rows}
      selectedDimensionId={model.selectedDimensionId}
    />
  );
}

/** Chân panel trái: câu "xong", câu vai chỉ xem, hoặc cửa vào chế độ duyệt bàn phím. */
function DimensionOcrPanelFooter({ model }: { readonly model: DimensionOcrReviewModel }) {
  const hasNothingToReview =
    model.state === 'loading' || model.state === 'error' || model.rows.length === 0;

  return (
    <>
      {model.state === 'success' ? (
        <div className="border-t border-border-default px-4 py-2" role="status">
          <p className="text-body-sm font-medium text-text-primary">{DIMENSION_OCR_TEXT.states.done.title}</p>
          <p className="text-caption text-text-secondary">{DIMENSION_OCR_TEXT.states.done.description}</p>
        </div>
      ) : null}
      {model.isViewerRole ? (
        <div className="border-t border-border-default px-4 py-2 text-caption text-text-secondary">
          <p className="font-medium">{DIMENSION_OCR_TEXT.states.forbidden.title}</p>
          <p>{model.viewerRoleNotice}</p>
        </div>
      ) : !model.keyboardReview.isActive && hasNothingToReview ? null : (
        /* Không có gì để duyệt thì không mời "bật duyệt bàn phím" (BUG-630, G4b-04). */
        <div className="border-t border-border-default px-4 py-2">
          <DimensionOcrKeyboardMode
            isActive={model.keyboardReview.isActive}
            onApprove={model.keyboardReview.onApprove}
            onCancelEdit={model.keyboardReview.onCancelEdit}
            onEdit={model.keyboardReview.onEdit}
            onToggle={model.keyboardReview.onToggle}
            outlierMessage={model.keyboardReview.outlierMessage}
            row={model.keyboardReview.row}
          />
        </div>
      )}
    </>
  );
}

export function DimensionOcrReview({
  scaleCalibrationHref,
  wallReviewHref,
  floorNav,
  ...model
}: DimensionOcrReviewViewProps) {
  if (model.readFailure != null) {
    return (
      <QcScreenFrame label={SCREEN_ARIA_LABEL}>
        {floorNav != null && <QcFloorNav {...floorNav} layer="dimensions" />}
        <FloorLayerReadFailureScreen failure={model.readFailure} />
      </QcScreenFrame>
    );
  }

  /* Chế độ duyệt bàn phím thu CẢ MÀN về một ảnh cắt và một ô nhập — đường nhanh nhất. */
  if (model.keyboardReview.isActive && model.keyboardReview.row !== null) {
    return (
      <QcScreenFrame label={SCREEN_ARIA_LABEL}>
        <FloorLayerSaveBanner saveBlock={model.saveBlock} />
        <div className={cn('flex min-h-0 w-full flex-1 flex-col', QC_BODY_CLASS)}>
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
      </QcScreenFrame>
    );
  }

  const isCollapsed = model.state === 'collapsed';
  const currentFloorId = floorNav?.floorId;
  const floorLabel = floorNav?.floors?.find((floor) => floor.id === currentFloorId)?.label ?? FLOOR_FALLBACK;

  const left = (
    <aside
      aria-label={PANEL_ARIA_LABEL}
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-bg-surface shadow-panel max-lg:flex-none"
    >
      <QcPanelHead status={<DimensionOcrStatus floorLabel={floorLabel} model={model} />} title={PANEL_TITLE} />
      {isCollapsed ? (
        <div className="p-4">
          <Button onClick={model.onToggleCollapsed} size="sm" type="button" variant="secondary">
            {EXPAND_PANEL_LABEL}
          </Button>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-hidden max-lg:overflow-visible">
            <DimensionOcrPanelBody model={model} />
          </div>
          <DimensionOcrPanelFooter model={model} />
        </>
      )}
    </aside>
  );

  return (
    <QcScreenFrame label={SCREEN_ARIA_LABEL}>
      {floorNav != null && <QcFloorNav {...floorNav} layer="dimensions" titled />}
      {/* Câu 3: kích thước không chặn sang 3D — cổng chỉ dẫn về việc chặn thật (duyệt tường). */}
      <FlowGate>
        {wallReviewHref === undefined ? null : (
          <Link className={GATE_LINK_CLASS} to={wallReviewHref}>
            {DIMENSION_INSPECTOR_TEXT.backToWallsLabel}
          </Link>
        )}
      </FlowGate>
      {model.saveBlock === null ? null : (
        <div className="shrink-0 px-4 pb-1">
          <FloorLayerSaveBanner saveBlock={model.saveBlock} />
        </div>
      )}
      <QcWorkspace
        canvas={
          <>
            <DimensionOcrCanvas
              backgroundImageAlt={model.backgroundImageAlt}
              backgroundImageUrl={model.backgroundImageUrl}
              chains={model.chains}
              drawingSizePx={model.drawingSizePx}
              emptyNotice={null}
              isInteractive={!model.isViewerRole}
              millimetresPerPixel={model.millimetresPerPixel}
              onSelect={model.onSelect}
              selectedDimensionId={model.selectedDimensionId}
              zoom={model.canvasZoom}
            />
            <DimensionOcrCanvasCard model={model} scaleCalibrationHref={scaleCalibrationHref} wallReviewHref={wallReviewHref} />
          </>
        }
        canvasLabel={DIMENSION_OCR_TEXT.screen.canvasAriaLabel}
        inspector={isCollapsed ? null : <DimensionOcrInspector model={model} scaleCalibrationHref={scaleCalibrationHref} />}
        left={left}
        selectionKey={model.selectedDimensionId}
      />
      <QcStatusBar saveLabel={false}>
        {model.scaleLabel == null ? null : (
          <span className="text-body-sm tabular-nums text-text-secondary">{model.scaleLabel}</span>
        )}
      </QcStatusBar>
    </QcScreenFrame>
  );
}
