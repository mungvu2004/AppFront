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
 * Ba mảnh, đúng thứ tự đặc tả: canvas giữa bo 16 px thụt 12 px, panel phải
 * 344 px, thanh trạng thái 32 px dính đáy. Dưới 1024 px panel thành tấm trượt
 * đáy — nhưng CSS đó nằm trong `ScaleCalibrationPanel.tsx`, không nhân bản ở
 * đây; `model.isCompact` chỉ đi tiếp xuống panel để nó chọn đúng `aria-label`.
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
 * Không `Modal`, không `role="dialog"`: mục [CẤM TUYỆT ĐỐI] cấm hộp thoại ở màn
 * này, và cảnh báo tỷ lệ thì không chặn nên lại càng không cần một cái.
 */

import { useEffect, useRef } from 'react';

import { InlineAlert, type InlineAlertLevel } from '@/components/feedback/InlineAlert';
import { StatusBar } from '@/components/shell/StatusBar';
import { Button } from '@/components/ui/Button';

import { ScaleCalibrationCanvas } from './ScaleCalibrationCanvas';
import { ScaleCalibrationPanel } from './ScaleCalibrationPanel';
import type { ScaleCalibrationProps, ScaleCalibrationState, ScaleCalibrationViewModel } from './types';

const SCREEN_ARIA_LABEL = 'Màn hiệu chỉnh tỷ lệ';
const CANVAS_REGION_ARIA_LABEL = 'Khung bản vẽ để hiệu chỉnh tỷ lệ';
const NOTICE_REGION_ARIA_LABEL = 'Trạng thái của màn hiệu chỉnh tỷ lệ';

const EMPTY_TITLE = 'Chưa có chuỗi kích thước nào để đối chiếu';
const PARTIAL_TITLE = 'Chưa đủ dữ liệu để chốt tỷ lệ';
const ERROR_TITLE = 'Nắn ảnh thất bại nên bản vẽ có thể méo';
const SUCCESS_TITLE = 'Đã áp tỷ lệ cho bản vẽ';
const FORBIDDEN_TITLE = 'Bạn không có quyền hiệu chỉnh tỷ lệ';

const BACK_TO_PREPROCESSING_LABEL = 'Quay lại bước tiền xử lý';
const RETRY_LABEL = 'Tải lại ảnh';

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

export function ScaleCalibration({ actions, model }: ScaleCalibrationProps) {
  const { onCanvasSizeChange } = actions;
  const canvasHostRef = useRef<HTMLDivElement | null>(null);

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

  const noticeMessage = messageFor(model);
  const noticeLevel = NOTICE_LEVELS[model.state];
  const isError = model.state === 'error';

  return (
    <div
      aria-label={SCREEN_ARIA_LABEL}
      className="flex h-full min-h-0 w-full flex-col bg-bg-app"
      role="region"
    >
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:items-stretch">
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-3">
          {noticeLevel !== null && noticeMessage !== null && (
            <section aria-label={NOTICE_REGION_ARIA_LABEL} className="flex flex-col gap-2">
              <InlineAlert
                level={noticeLevel}
                message={
                  isError && model.errorCode !== null
                    ? `${noticeMessage} ${ERROR_CODE_PREFIX}${model.errorCode}`
                    : noticeMessage
                }
                title={NOTICE_TITLES[model.state]}
              />
              {isError && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={actions.onGoToPreprocessing} size="sm" variant="ghost">
                    {BACK_TO_PREPROCESSING_LABEL}
                  </Button>
                  <Button onClick={actions.onRetry} size="sm" variant="secondary">
                    {RETRY_LABEL}
                  </Button>
                </div>
              )}
            </section>
          )}

          <section
            aria-label={CANVAS_REGION_ARIA_LABEL}
            className="min-h-0 flex-1"
            ref={canvasHostRef}
          >
            <ScaleCalibrationCanvas
              actions={actions}
              canvas={model.canvas}
              prefersReducedMotion={model.prefersReducedMotion}
            />
          </section>
        </div>

        <ScaleCalibrationPanel
          actions={actions}
          isCollapsed={model.isPanelCollapsed}
          isCompact={model.isCompact}
          panel={model.panel}
          prefersReducedMotion={model.prefersReducedMotion}
          state={model.state}
        />
      </div>

      <StatusBar {...model.statusBar} />
    </div>
  );
}
