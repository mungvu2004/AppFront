/**
 * Màn Đối chiếu bản vẽ (`OverlayComparison`) — khung của route `ROUTE_PATTERNS.projectOverlay`.
 *
 * View THUẦN (mục D, R-60): chỉ nhận {@link OverlayComparisonProps}. Mọi câu tiếng Việt và mọi
 * con số đã định dạng ở `useOverlayComparison` (A15) hoặc `overlayStatus.ts`.
 *
 * ## Bố cục (bản Z S-28, vòng 6)
 *
 * Panel trái 296 (đầu màn + dung sai + danh sách vùng lệch) · canvas ở giữa với thanh công cụ nổi
 * trên cùng giữa (tầng, ba kiểu đối chiếu, độ mờ, khoá căn) · panel phải 264 cho vùng đang chọn
 * (dưới 1280 thành ngăn kéo). Ba câu của màn: H1 + trạng thái ở đầu panel trái; cổng sang bước
 * sau (`FlowGate`) bay vào thanh bước của header. Chip, câu có số, ba điều kiện và nút của cổng
 * cùng đọc MỘT đối tượng `overlayStatusOf(model)`.
 *
 * Một nút chính: lệch → "Sửa … ở lớp …" trong panel phải, cổng có nút phụ "Vùng kế" (phím J);
 * khớp hoặc chưa đo → cổng có "Xác nhận khớp bản vẽ" (xác nhận luôn là việc người bấm, A5);
 * đã xác nhận → cổng dẫn sang bước sau.
 *
 * ## Bảy trạng thái (A11)
 *
 * Không nhánh nào trả `null`: canvas, thanh công cụ và hai panel luôn được vẽ; trạng thái chỉ đổi
 * NỘI DUNG. `stateNotice` (rỗng, đang tải, một phần, lỗi, không quyền) nằm ở đầu panel trái, kèm
 * "Thử lại", liên kết sang Hiệu chỉnh tỷ lệ (lỗi) và "Tải bản vẽ lên" (chưa có bản vẽ).
 *
 * `canEdit` suy một lần từ vai (vai 'viewer' và vai `null` không sửa được) và truyền xuống cả
 * canvas, thanh công cụ, panel — cùng khuôn `WallLayerReview`/`PropertyInspector`.
 */

import { useRef } from 'react';
import { Link } from 'react-router-dom';

import { ZoomCluster } from '@/components/canvas/ZoomCluster';
import { InlineAlert, type InlineAlertLevel } from '@/components/feedback/InlineAlert';
import { FlowGate } from '@/components/shell/FlowGate';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getButtonStyles } from '@/components/ui/buttonVariants';
import { Kbd } from '@/components/ui/Kbd';

import { FloorLayerReadFailureScreen } from '../../qc/shared/FloorLayerReadFailureScreen';
import { QcPanelHead } from '../../qc/shared/QcPanelHead';
import { OverlayComparisonCanvas } from './OverlayComparisonCanvas';
import { OverlayComparisonInspector } from './OverlayComparisonInspector';
import { OverlayComparisonPanel } from './OverlayComparisonPanel';
import { OverlayComparisonToolbar } from './OverlayComparisonToolbar';
import { overlayStatusOf, type OverlayStatus } from './overlayStatus';
import type { OverlayComparisonActions, OverlayComparisonProps, OverlayComparisonState, OverlayComparisonViewModel } from './types';

const SCREEN_ARIA_LABEL = 'Màn đối chiếu bản vẽ';
const CANVAS_REGION_ARIA_LABEL = 'Khung đối chiếu bản vẽ gốc và mô hình';
const NOTICE_REGION_ARIA_LABEL = 'Trạng thái của màn đối chiếu bản vẽ';

const ERROR_LINK_LABEL = 'Sang màn hiệu chỉnh tỷ lệ';
const LEGEND_ARIA_LABEL = 'Chú giải nét';
/** BUG-420: lối ra của tầng chưa có bản vẽ — cùng nhãn nút của màn Hiệu chỉnh tỷ lệ. */
const UPLOAD_LINK_LABEL = 'Tải bản vẽ lên';
const RETRY_LABEL = 'Thử lại';
/** Bước nút +/− — số tương tác giao diện, như bước lăn chuột của canvas. */
const ZOOM_BUTTON_STEP = 1.25;

/** Nút chữ của liên kết lỗi: cùng khuôn `DimensionOcrReview.tsx` (A1, A2). */
const ERROR_LINK_CLASS_NAME =
  'self-center rounded-md px-1.5 py-0.5 text-[13px] text-accent ' +
  'transition-colors duration-120 hover:bg-accent-wash ' +
  'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/** Chữ thường của trạng thái đang tải: không có màu nào trong ba màu A4 phù hợp. */
const LOADING_NOTICE_CLASS_NAME = 'rounded-lg bg-bg-sunken px-3 py-2 text-[13px] text-text-secondary';

/** Mức màu của khối thông báo, đúng ba màu của A4; `loading` hiện bằng chữ thường. */
const NOTICE_LEVELS: Readonly<Partial<Record<OverlayComparisonState, InlineAlertLevel>>> = {
  empty: 'attention',
  partial: 'attention',
  error: 'violation',
  forbidden: 'attention',
};

/** Nút của cổng: đúng MỘT nút, không nút chết (HOP-DONG-V6 câu 3). */
function GateAction({
  status,
  model,
  actions,
  nextStep,
}: {
  readonly status: OverlayStatus;
  readonly model: OverlayComparisonViewModel;
  readonly actions: OverlayComparisonActions;
  readonly nextStep: OverlayComparisonProps['nextStep'];
}) {
  const { confirmation } = model;

  if (confirmation.isConfirmed) {
    return nextStep === undefined ? null : (
      <Link className={getButtonStyles({ variant: 'primary', size: 'sm' })} to={nextStep.href}>
        {nextStep.label}
      </Link>
    );
  }
  if (status.kind === 'noModel') return null;
  if (status.kind === 'noDrawing') {
    return model.uploadHref === null ? null : (
      <Link className={getButtonStyles({ variant: 'secondary', size: 'sm' })} to={model.uploadHref}>
        {UPLOAD_LINK_LABEL}
      </Link>
    );
  }
  if (status.kind === 'deviating') {
    const next = status.nextOverRow;
    return next === null ? null : (
      <Button
        aria-keyshortcuts="J"
        aria-label={`Vùng kế ${next.affectedObjectCode}`}
        onClick={() => actions.selectRegion(next.id)}
        size="sm"
        title={`Vùng kế ${next.affectedObjectCode} (J)`}
        variant="secondary"
      >
        {`Vùng kế ${next.affectedObjectCode}`}
        <Kbd className="ml-2">J</Kbd>
      </Button>
    );
  }
  // Không có quyền thì nói vì sao thay cho một nút tắt (BUG-599).
  if (!confirmation.canConfirm && confirmation.disabledReason !== null) {
    return <span className="whitespace-nowrap text-[13px] text-text-secondary">{confirmation.disabledReason}</span>;
  }
  return (
    <Button disabled={!confirmation.canConfirm} onClick={() => actions.confirmMatch()} size="sm" variant="primary">
      {confirmation.buttonLabel}
    </Button>
  );
}

export function OverlayComparison({ actions, alignHref, model, nav, fixTargetOf, nextStep }: OverlayComparisonProps) {
  const canEdit = model.role !== null && model.role !== 'viewer';
  const isStacked = model.state === 'collapsed';
  const isError = model.state === 'error';
  const noticeLevel = NOTICE_LEVELS[model.state];
  const canvasRef = useRef<HTMLElement | null>(null);
  const status = overlayStatusOf(model);
  const hasOverMarks = model.marks.some((mark) => mark.isOverTolerance);

  /** +/− neo ở tâm khung đang thấy. */
  const zoomAtCentre = (factor: number): void => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    actions.zoomBy(factor, (bounds?.width ?? 0) / 2, (bounds?.height ?? 0) / 2);
  };

  const notice =
    model.stateNotice === null ? undefined : (
      <div aria-label={NOTICE_REGION_ARIA_LABEL} className="flex flex-col items-start gap-2" role="group">
        {noticeLevel !== undefined ? (
          <InlineAlert level={noticeLevel} message={model.stateNotice} />
        ) : (
          <p className={LOADING_NOTICE_CLASS_NAME} role="status">
            {model.stateNotice}
          </p>
        )}
        {model.canRetry && (
          <Button onClick={actions.retry} size="sm" variant="secondary">
            {RETRY_LABEL}
          </Button>
        )}
        {isError && model.scaleFixHref !== null && (
          <Link className={ERROR_LINK_CLASS_NAME} to={model.scaleFixHref}>
            {ERROR_LINK_LABEL}
          </Link>
        )}
        {model.uploadHref !== null && (
          <Link className={ERROR_LINK_CLASS_NAME} to={model.uploadHref}>
            {UPLOAD_LINK_LABEL}
          </Link>
        )}
      </div>
    );

  if (model.readFailure != null) {
    return (
      <div aria-label={SCREEN_ARIA_LABEL} className="flex h-screen min-h-0 w-full flex-col bg-bg-app" role="region">
        {nav}
        <FloorLayerReadFailureScreen failure={model.readFailure} />
      </div>
    );
  }

  // Đã xác nhận: câu điềm đạm của hook (A5) thay câu số đo.
  const summary = model.confirmation.confirmedNotice?.text ?? status.summary;
  const head = (
    <QcPanelHead
      status={
        <>
          <Badge variant={status.badge.variant}>{status.badge.label}</Badge>
          {summary !== null && (
            <span className="tabular-nums" role="status">
              {summary}
            </span>
          )}
        </>
      }
      title="Đối chiếu bản vẽ với mô hình"
    />
  );

  return (
    <div
      aria-label={SCREEN_ARIA_LABEL}
      // Cao bằng khung nhìn: route nằm trong `ScreenMain` (display: contents) không cho `h-full` một chiều cao (QA-04 nợ B-3).
      className="flex h-screen min-h-0 w-full flex-col bg-bg-app"
      role="region"
    >
      {nav}
      <FlowGate conditions={status.conditions} done={status.doneCount} progressLabel="Điều kiện đối chiếu" total={status.conditions.length}>
        <GateAction actions={actions} model={model} nextStep={nextStep} status={status} />
      </FlowGate>
      {/* Dưới 1024 panel trái lên trên canvas (cao ≤ 40 %); panel phải là ngăn kéo đè lên canvas. */}
      <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-x-clip lg:flex-row">
        <OverlayComparisonPanel
          canEdit={canEdit}
          head={head}
          showUnmeasuredNotice={status.kind === 'unmeasured'}
          metrics={model.metrics}
          onSelectRegion={actions.selectRegion}
          onSetToleranceMm={actions.setToleranceMm}
          {...(notice === undefined ? {} : { notice })}
          rows={model.rows}
          toleranceLabel={model.toleranceLabel}
          toleranceMm={model.toleranceMm}
          {...(alignHref === undefined || model.uploadHref !== null ? {} : { alignHref })}
        />

        {/* Dưới 1024 thanh công cụ nằm TRÊN canvas (trong luồng), không đè khung vẽ (BUG-634). */}
        <section
          aria-label={CANVAS_REGION_ARIA_LABEL}
          className="relative flex min-h-0 min-w-0 flex-1 flex-col lg:block"
          ref={canvasRef}
        >
          <div className="relative min-h-0 flex-1 lg:h-full">
            <OverlayComparisonCanvas
              compareMode={model.compareMode}
              geometry={model.geometry}
              geometryFrame={model.geometryFrame ?? null}
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
          </div>

          {/* Lớp bọc không nhận chuột, chỉ thanh công cụ nhận: hai bên rìa canvas vẫn kéo/chọn được. */}
          <div className="pointer-events-none z-10 order-first flex flex-col items-center gap-2 px-3 py-2 lg:absolute lg:inset-x-0 lg:top-3 lg:order-0 lg:py-0">
            <div className="pointer-events-auto max-w-full">
              <OverlayComparisonToolbar
                activeFloorId={model.activeFloorId}
                canEdit={canEdit}
                canLockAlignment={model.canLockAlignment}
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
          </div>

          {/* G4b-27: ba lớp thị giác, không lớp thứ tư — nét bản vẽ, mô hình, vùng vượt dung sai. */}
          <ul
            aria-label={LEGEND_ARIA_LABEL}
            className="pointer-events-none absolute bottom-3 left-3 z-20 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-bg-surface px-3 py-1.5 text-[12px] text-text-secondary shadow-float"
          >
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-px w-4 bg-text-primary" />
              Bản vẽ gốc
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-1 w-4 rounded-full bg-accent" />
              Mô hình sinh ra
            </li>
            {hasOverMarks && (
              <li className="flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2.5 w-3.5 rounded-sm border border-state-attention bg-state-attention-tint" />
                {`Vùng vượt ${status.toleranceText}`}
              </li>
            )}
          </ul>

          {/* Về được toàn cảnh mà không tải lại trang (BUG-599); 100% ở màn này chính là vừa khung. */}
          <ZoomCluster
            onFitToScreen={actions.fitView}
            onResetZoom={actions.fitView}
            onZoomIn={() => zoomAtCentre(ZOOM_BUTTON_STEP)}
            onZoomOut={() => zoomAtCentre(1 / ZOOM_BUTTON_STEP)}
            zoomLevel={model.zoomPercent}
          />
        </section>

        <OverlayComparisonInspector
          confirmation={model.confirmation}
          fixTargetOf={fixTargetOf}
          onConfirmMatch={actions.confirmMatch}
          onSelectRegion={actions.selectRegion}
          status={status}
        />
      </div>
    </div>
  );
}
