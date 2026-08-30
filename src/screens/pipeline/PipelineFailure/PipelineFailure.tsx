/**
 * Màn S-11 "Một bước AI hỏng" (`PipelineFailure`) — view THUẦN.
 *
 * Chỉ nhận {@link PipelineFailureProps} và vẽ. Không api, không store, không
 * domain, không tầng http (R-60, ép bằng `local/no-data-layer-in-view`). Mọi câu
 * tiếng Việt, mọi con số và mọi nhãn nút sao chép đã ghép xong ở hook — file này
 * không `toFixed`, không `toLocaleString`, không đếm lần thử, không đặt một
 * `setTimeout` nào (A15, R-71).
 *
 * ## Màn này không phải một trang
 *
 * Nó dựng NGAY TRONG khung của màn S-10 `ProcessingScreen`: cùng nền `--bg-app`,
 * cùng trần 1280px, cùng hàng đường dẫn, cùng dải tầng chạy ngang, và cùng cột
 * trái 60%. Không đổi trang, không hộp thoại, không trang lỗi toàn màn — dải
 * cảnh báo chỉ chiếm chỗ PHẦN ĐẦU cột trái, đúng chỗ `ProcessingStepList` đứng ở
 * S-10. Cột phải 344px của khung đó không được dựng lại ở đây: nó là hai tấm
 * "Xem trước" / "Nhật ký" của màn cha, và bịa ra nội dung cho nó là dựng một màn
 * thứ hai chứ không phải gắn vào màn đã có.
 *
 * ## Bảy trạng thái (A11)
 *
 * | `state`     | thân màn                                                       |
 * |-------------|----------------------------------------------------------------|
 * | `empty`     | band `idle` — một câu nói chưa bước nào hỏng                    |
 * | `loading`   | band `retrying` — stepper thay TẠI CHỖ, thử lại ngay tại đây    |
 * | `partial`   | **ca chính** — dải cảnh báo, ba tầng xong, một tầng hỏng        |
 * | `error`     | cả bốn tầng hỏng; khối kết quả rút còn một dòng                 |
 * | `success`   | band `resolved` — toast rồi màn cha chuyển tiếp                 |
 * | `forbidden` | `nextSteps` và `technicalDetails` đều `null`: nút và nhật ký biến mất |
 * | `collapsed` | còn đúng câu tóm tắt và nút mở lại                              |
 *
 * Không nhánh nào trả `null`: hàng đường dẫn và nút thu gọn luôn được vẽ, và
 * thân màn luôn còn ít nhất một câu. Màn trắng — thất bại duy nhất A11 tồn tại
 * để chặn — không có chỗ xảy ra.
 *
 * ## Bốn phần con
 *
 * `PipelineFailureBand` (bốn nhánh của cái ô đổi tại chỗ), `PipelineFailureAlert`
 * (dải cảnh báo và ba hướng đi tiếp), `PipelineFailureProgress` (dải tầng + khối
 * "Kết quả đã có"), `PipelineFailureDetails` (khối gấp). Chúng là mảnh của một
 * view, không phải API của màn, nên `index.ts` không tái xuất mảnh nào — cùng lý
 * lẽ `ProcessingScreen/index.ts`.
 */

import { Button } from '@/components/ui/Button';

import { PipelineFailureBandRegion } from './PipelineFailureBand';
import { PipelineFailureDetails } from './PipelineFailureDetails';
import { PipelineFailureFloorStrip, PipelineFailureKeptWorkBlock } from './PipelineFailureProgress';
import type { PipelineFailureProps } from './types';

const BREADCRUMB_PROJECTS = 'Dự án';
const BREADCRUMB_PIPELINE = 'Xử lý';

/** Nút thu gọn trỏ vào thân màn, nên nó nói được mình đang mở hay đóng cái gì. */
const BODY_ID = 'pipeline-failure-body';

/** Màn S-11 như một hàm của props (mục D) — test và story dựng thẳng cái này. */
export function PipelineFailure(props: PipelineFailureProps) {
  const isCollapsed = props.state === 'collapsed';

  return (
    <div className="min-h-screen bg-bg-app">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <nav aria-label={BREADCRUMB_PIPELINE} className="text-[13px] text-text-secondary">
            <span>{BREADCRUMB_PROJECTS}</span>
            <span aria-hidden="true"> › </span>
            <span className="text-text-primary">{BREADCRUMB_PIPELINE}</span>
          </nav>

          <Button
            aria-controls={BODY_ID}
            aria-expanded={!isCollapsed}
            onClick={props.onToggleCollapse}
            size="sm"
            variant="ghost"
          >
            {props.collapseToggleLabel}
          </Button>
        </div>

        <div className="flex flex-col gap-6" id={BODY_ID}>
          {isCollapsed ? (
            <p className="text-[14px] text-text-primary">{props.collapsedSummaryLine}</p>
          ) : (
            <>
              <PipelineFailureFloorStrip floors={props.floors} />

              <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                <div className="flex w-full flex-col gap-4 lg:w-[60%]">
                  <PipelineFailureBandRegion
                    band={props.band}
                    motionDurationName={props.motionDurationName}
                    prefersReducedMotion={props.prefersReducedMotion}
                  />

                  <PipelineFailureKeptWorkBlock keptWork={props.keptWork} />

                  {props.technicalDetails === null ? null : (
                    <PipelineFailureDetails
                      details={props.technicalDetails}
                      motionDurationName={props.motionDurationName}
                      prefersReducedMotion={props.prefersReducedMotion}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
