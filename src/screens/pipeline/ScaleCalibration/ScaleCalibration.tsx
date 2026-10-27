/**
 * Màn Hiệu chỉnh tỷ lệ (`ScaleCalibration`) — khung của route
 * `ROUTE_PATTERNS.projectScale`.
 *
 * View THUẦN (mục D, R-60): chỉ nhận {@link ScaleCalibrationProps} và vẽ. Không
 * `@/api`, không `@/store`, không `@/domain`, không `@/lib/http`. Mọi câu tiếng
 * Việt động và mọi con số đã định dạng xong ở `useScaleCalibration` (A15) — file
 * này không gọi `toFixed`, không `toLocaleString`, không một phép chia nào.
 *
 * ## Bố cục
 *
 * Theo demo Z/S-11: panel trái 280 (H1 + trạng thái + cách đặt), canvas giữa,
 * panel phải 288 "Kiểm tra con số", thanh trạng thái 32 px dính đáy. Dưới 1280
 * hai panel gộp một cột 312 bên phải; dưới 768 xếp dưới bản vẽ (BUG-333).
 *
 * Bo góc 16 px là của chính canvas (`ScaleCalibrationCanvas.tsx`), nên phần
 * việc còn lại của khung là khoảng thụt 12 px quanh nó.
 *
 * ## Ba mảnh, ba chủ sở hữu
 *
 * - Canvas và panel là hai file anh em trong cùng thư mục màn.
 * - Thanh trạng thái là `src/components/shell/StatusBar.tsx` **đã có sẵn**:
 *   "không tạo component mới" nghĩa là màn này tái sử dụng nó. Vì
 *   {@link ScaleStatusBarViewModel} khớp từng chữ với `StatusBarProps`, chỗ này
 *   viết đúng một dòng `<StatusBar {...model.statusBar} />` — không ánh xạ lại,
 *   không đặt tên lần thứ hai cho cùng một thứ.
 *
 * ## Vì sao khung canvas tự đo mình
 *
 * `flyToBounds` của `hooks/useCanvasViewport` tính `ViewportState` từ bề rộng và
 * bề cao canvas ĐÃ RENDER, bằng pixel CSS. Hook không có cách nào biết con số đó
 * và `ScaleCalibrationCanvasProps.actions` không mang `onCanvasSizeChange`, nên
 * khung bọc ở đây đo và báo lên. Thiếu đường này thì R-07 (bay khung nhìn
 * 340 ms) hỏng ÂM THẦM: hook coi kích thước là `0 × 0` và bỏ qua lượt bay, chọn
 * hàng vẫn tính tỷ lệ nhưng khung nhìn không nhúc nhích.
 *
 * ## Bảy trạng thái (A11)
 *
 * | `state`     | khối trạng thái riêng                                          |
 * |-------------|----------------------------------------------------------------|
 * | `empty`     | `emptyNotice`                                                   |
 * | `loading`   | — (canvas tự dựng khung chờ)                                    |
 * | `partial`   | `partialNotice`                                                 |
 * | `error`     | `errorMessage` + `errorCode` + lối về tiền xử lý + nút tải lại   |
 * | `success`   | `successNotice`                                                 |
 * | `forbidden` | `forbiddenNotice`                                               |
 * | `collapsed` | — (canvas rộng ra vì panel thu lại)                             |
 *
 * Không nhánh nào trả `null`: canvas, panel và thanh trạng thái luôn được vẽ,
 * nên màn trắng — thất bại duy nhất A11 tồn tại để chặn — không có chỗ xảy ra.
 * Cảnh báo tỷ lệ không chặn nên không có hộp thoại. `Modal` duy nhất là hộp A9 của
 * "Áp cho mọi tầng" (F-04x-2): tỉ lệ thành "do bạn chọn" trên nhiều tầng một lượt.
 */

import { useEffect, useRef } from 'react';

import { InlineAlert, type InlineAlertLevel } from '@/components/feedback/InlineAlert';
import { Modal } from '@/components/overlay/Modal';
import { StatusBar } from '@/components/shell/StatusBar';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

import { FloorLayerReadFailureScreen } from '../../qc/shared/FloorLayerReadFailureScreen';
import { FloorReviewGate } from '../../qc/shared/FloorReviewGate.container';
import { QcFloorNav } from '../../qc/shared/QcFloorNav';
import { QC_BODY_CLASS, QcScreenFrame } from '../../qc/shared/QcScreenFrame';
import { FloorLayerSaveBanner } from '../../qc/WallLayerReview/FloorLayerSaveBanner';

import { ScaleCalibrationCanvas } from './ScaleCalibrationCanvas';
import { ScaleCalibrationPanel } from './ScaleCalibrationPanel';
import { ScaleCalibrationSidebar } from './ScaleCalibrationSidebar';
import type { ScaleCalibrationProps, ScaleCalibrationState, ScaleCalibrationViewModel } from './types';

const SCREEN_ARIA_LABEL = 'Tỷ lệ bản vẽ';
const CANVAS_REGION_ARIA_LABEL = 'Khung bản vẽ để hiệu chỉnh tỷ lệ';
const NOTICE_REGION_ARIA_LABEL = 'Trạng thái của màn hiệu chỉnh tỷ lệ';

const EMPTY_TITLE = 'Chưa có số kích thước để làm mốc';
const PARTIAL_TITLE = 'Chưa đủ dữ liệu để chốt tỷ lệ';
// G3-31: tiền xử lý không thất bại (BE chỉ báo FRAME_NOT_FOUND mức cần chú ý, màn Xử lý đánh ✓),
// nên tiêu đề không nói "thất bại" và khối dùng màu cần chú ý, không màu vi phạm.
const ERROR_TITLE = 'Không tìm thấy khung bản vẽ, ảnh có thể chưa thẳng';
const SUCCESS_TITLE = 'Đã áp tỷ lệ cho bản vẽ';
const FORBIDDEN_TITLE = 'Bạn không có quyền hiệu chỉnh tỷ lệ';

const BACK_TO_PREPROCESSING_LABEL = 'Quay lại bước tiền xử lý';
const RETRY_LABEL = 'Tải lại ảnh';
const GO_TO_UPLOAD_LABEL = 'Tải bản vẽ lên';

/**
 * Mã máy đọc không bao giờ đứng một mình (A6).
 *
 * Nó là chuỗi cho máy, nên nó đi SAU câu tiếng Việt nói rõ hậu quả, trong cùng
 * một khối cảnh báo — cùng khuôn `ProcessingScreen.tsx`.
 */
const ERROR_CODE_PREFIX = 'Mã lỗi: ';

/** Mức màu của khối trạng thái. Đúng ba màu của A4, không có màu thứ tư. */
const NOTICE_LEVELS: Readonly<Record<ScaleCalibrationState, InlineAlertLevel | null>> = {
  empty: 'attention',
  loading: null,
  partial: 'attention',
  error: 'violation',
  success: 'verified',
  forbidden: 'attention',
  collapsed: null,
};

const NOTICE_TITLES: Readonly<Record<ScaleCalibrationState, string>> = {
  empty: EMPTY_TITLE,
  loading: '',
  partial: PARTIAL_TITLE,
  error: ERROR_TITLE,
  success: SUCCESS_TITLE,
  forbidden: FORBIDDEN_TITLE,
  collapsed: '',
};

/**
 * Câu của trạng thái đang mở.
 *
 * Sáu trường câu chữ trên mô hình loại trừ nhau theo bất biến 1 của `types.ts` —
 * đúng một trong số chúng khác `null` tại một thời điểm — nên chỗ này chỉ CHỌN,
 * không ghép và không dựng câu mới.
 */
function messageFor(model: ScaleCalibrationViewModel): string | null {
  switch (model.state) {
    case 'empty':
      return model.emptyNotice;
    case 'partial':
      return model.partialNotice;
    case 'error':
      return model.errorMessage;
    case 'success':
      return model.successNotice;
    case 'forbidden':
      return model.forbiddenNotice;
    default:
      return null;
  }
}

export function ScaleCalibration({ actions, floorNav, model }: ScaleCalibrationProps) {
  const { onCanvasSizeChange } = actions;
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const applyButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const host = canvasHostRef.current;

    if (host === null) {
      return undefined;
    }

    // Đo ĐÚNG cái khung mà canvas dùng làm hệ toạ độ cho `transform`, không phải
    // khung bọc này. `ScaleCalibrationCanvas` dựng đúng một phần tử gốc — khung
    // `aspect-square` — và lớp mang `translate(x, y) scale(zoom)` nằm `inset-0`
    // bên trong nó. Khung bọc thì cao theo cột, còn khung kia thì vuông, nên đo
    // nhầm khung là đưa cho `flyToBounds` một chiều cao sai và khung nhìn bay
    // lệch mà không ai thấy.
    const frame = host.firstElementChild ?? host;

    // Lần đo đầu tiên phải có: `ResizeObserver` chỉ báo khi kích thước ĐỔI, còn
    // lượt bay đầu tiên có thể xảy ra trước lần đổi đầu tiên.
    const rect = frame.getBoundingClientRect();
    onCanvasSizeChange(rect.width, rect.height);

    // jsdom không khai `ResizeObserver`. Lượt đo đầu ở trên vẫn chạy, nên màn
    // dựng được trong test mà không cần bản giả nào.
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (entry !== undefined) {
        onCanvasSizeChange(entry.contentRect.width, entry.contentRect.height);
      }
    });

    observer.observe(frame);

    return () => {
      observer.disconnect();
    };
  }, [onCanvasSizeChange]);

  // Tầng ĐÃ có tỷ lệ (chip "Đã đặt"): "máy chưa đọc được số" không còn là lỗi, đừng dựng khung vàng.
  const hasStoredScale = model.panel.scaleCheck?.status.label.startsWith('Đã đặt') === true;
  const noticeMessage = model.state === 'empty' && hasStoredScale ? null : messageFor(model);
  const noticeLevel = NOTICE_LEVELS[model.state];
  const isError = model.state === 'error';
  // Ảnh méo là nhánh `'error'` không có tiêu đề riêng (lỗi đọc luôn mang `errorTitle`, B-V5-04).
  const isWarped = isError && model.errorTitle === undefined;

  if (model.readFailure != null) {
    return (
      <QcScreenFrame label={SCREEN_ARIA_LABEL}>
        {floorNav !== undefined && <QcFloorNav {...floorNav} layer="scale" />}
        <FloorLayerReadFailureScreen failure={model.readFailure} />
      </QcScreenFrame>
    );
  }

  return (
    <QcScreenFrame label={SCREEN_ARIA_LABEL}>
      {/* Panel trái đã có H1 thấy được ("Tỷ lệ bản vẽ"): bỏ H1 ẩn của nav để trang chỉ một H1. */}
      {floorNav !== undefined && <QcFloorNav {...floorNav} layer="scale" titled />}
      {floorNav !== undefined && <FloorReviewGate floorId={floorNav.floorId} projectId={floorNav.projectId} />}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row md:items-stretch md:overflow-hidden">
        <div className={cn('flex min-w-0 flex-1 flex-col xl:order-2', QC_BODY_CLASS)}>
          {/* Xung đột 409 / tầng khoá lưu: có "Tải lại", không thì mọi lượt áp sau hỏng im lặng (BUG-598). */}
          <FloorLayerSaveBanner saveBlock={model.saveBlock ?? null} />
          {/* G4b-11: no "Tỷ lệ tạm — hãy hiệu chỉnh" strip here — the user is already on the calibration screen. */}
          {/* K12: but a floor the server could not measure at all gets the red strip: every size and the 3D model are wrong. */}
          {model.missingScaleNotice !== undefined && <InlineAlert level="violation" message={model.missingScaleNotice} />}
          {noticeLevel !== null && noticeMessage !== null && (
            <section aria-label={NOTICE_REGION_ARIA_LABEL} className="flex flex-col gap-2">
              <InlineAlert
                level={isWarped ? 'attention' : noticeLevel}
                message={
                  isError && model.errorCode !== null
                    ? `${noticeMessage} ${ERROR_CODE_PREFIX}${model.errorCode}`
                    : noticeMessage
                }
                title={(isError ? model.errorTitle : undefined) ?? NOTICE_TITLES[model.state]}
              />
              {isError && model.isNoDrawing === true && (
                /* Lối ra DUY NHẤT của tầng chưa có bản vẽ nên là nút chính (BUG-411). */
                <Button onClick={actions.onGoToUpload} size="sm" variant="primary">
                  {GO_TO_UPLOAD_LABEL}
                </Button>
              )}
              {isError && model.isNoDrawing !== true && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={actions.onGoToPreprocessing} size="sm" variant="ghost">
                    {BACK_TO_PREPROCESSING_LABEL}
                  </Button>
                  {/* Tải lại không làm máy tìm ra khung — chỉ lỗi đọc mới cần nút này. */}
                  {!isWarped && (
                    <Button onClick={actions.onRetry} size="sm" variant="secondary">
                      {RETRY_LABEL}
                    </Button>
                  )}
                </div>
              )}
            </section>
          )}

          <section
            aria-label={CANVAS_REGION_ARIA_LABEL}
            className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-bg-sunken @container-size"
            ref={canvasHostRef}
          >
            <ScaleCalibrationCanvas
              actions={actions}
              canvas={model.canvas}
              prefersReducedMotion={model.prefersReducedMotion}
            />
          </section>
        </div>

        {/* S-11: dưới 1280 hai panel chung một cột 312 bên phải; từ 1280 cột này "tan" (`contents`)
            để panel trái 280 đứng trước canvas và panel phải 288 đứng sau (Z/S-11). */}
        <div
          className={cn(
            'flex flex-col md:min-h-0 md:shrink-0 md:overflow-hidden md:border-l md:border-border-default xl:contents',
            model.isPanelCollapsed ? 'md:w-12' : 'md:w-[312px]',
          )}
        >
          {/* Dưới 1280 panel trái cuộn riêng (tối đa nửa cột) để chân panel phải với nút Áp dụng luôn thấy. */}
          <div
            className={cn(
              'md:max-h-[50%] md:shrink-0 md:overflow-y-auto xl:order-1 xl:flex xl:max-h-none xl:overflow-visible',
              model.isPanelCollapsed && 'max-xl:hidden',
            )}
          >
            <ScaleCalibrationSidebar actions={actions} panel={model.panel} state={model.state} />
          </div>
          <ScaleCalibrationPanel
            actions={actions}
            applyButtonRef={applyButtonRef}
            isCollapsed={model.isPanelCollapsed}
            panel={model.panel}
            prefersReducedMotion={model.prefersReducedMotion}
            state={model.state}
          />
        </div>
      </div>

      <StatusBar {...model.statusBar} />

      {model.allFloorsConfirm !== undefined && (
        <Modal
          isOpen
          onClose={actions.onCancelAllFloors}
          primaryAction={{ label: model.allFloorsConfirm.confirmLabel, onClick: actions.onConfirmAllFloors }}
          returnFocusRef={applyButtonRef}
          secondaryAction={{ label: model.allFloorsConfirm.cancelLabel, onClick: actions.onCancelAllFloors }}
          title={model.allFloorsConfirm.title}
        >
          {model.allFloorsConfirm.message}
        </Modal>
      )}
    </QcScreenFrame>
  );
}
