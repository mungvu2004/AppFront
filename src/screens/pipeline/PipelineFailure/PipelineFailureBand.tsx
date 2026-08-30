/**
 * Cái ô đổi nội dung TẠI CHỖ — bốn nhánh của {@link PipelineFailureBand}.
 *
 * Không nhánh nào đổi trang, mở hộp thoại hay chiếm toàn màn: cả bốn vẽ vào đúng
 * một khoảng, đầu cột trái của khung S-10. Đó là lý do hợp đồng gói chúng thành
 * một union có thẻ phân biệt thay vì bốn prop tuỳ chọn — bốn prop tuỳ chọn cho
 * phép hai thứ cùng hiện, mà "cùng hiện" là chính thứ hình dạng này tồn tại để
 * chặn.
 *
 * | `kind`     | vẽ gì                                                          |
 * |------------|----------------------------------------------------------------|
 * | `idle`     | một câu: chưa bước nào hỏng (chỉ gặp ở story và `empty`)        |
 * | `alert`    | dải cảnh báo — {@link PipelineFailureAlert}                     |
 * | `retrying` | `Pipeline.Root` thay TẠI CHỖ, cộng một câu cho trình đọc màn hình |
 * | `resolved` | toast đã duyệt, rồi màn cha nhận `onContinue`                   |
 *
 * ## Chuyển động
 *
 * Cả bốn đi qua {@link PipelineFailureReveal}: mở chiều cao và mờ dần, 260ms lấy
 * từ token. `key={band.kind}` gắn lại mảnh đó mỗi lần band đổi nhánh, nên lượt
 * thay TẠI CHỖ có chuyển động của nó thay vì nhảy phắt sang nội dung mới.
 *
 * ## `Pipeline.Root` chứ không phải `PipelineStepper`
 *
 * Bản legacy `PipelineStepper` chỉ nhận `{ steps }`, nên không có chỗ đặt
 * `aria-label` và không có chỗ gỡ trần `max-w-md` (`PipelineStepper.tsx:169,194`).
 * Đối tượng gộp `Pipeline` nhận cả hai qua `className` và props thường. Không
 * sửa `src/components/**` — R-68, và không cần sửa.
 *
 * **BẪY ĐÃ ĐO, dành cho người viết test.** `Pipeline.Step` tự đặt
 * `aria-label={`${name} — ${status}`}` (`PipelineStepper.tsx:81`), mà `status` là
 * enum máy đọc: `done`, `running`, `queued`, `failed`. Nên `expectVietnamese`
 * trên nhánh `retrying` báo đúng ba lỗi "từ tiếng Anh còn sót lại", và chúng đến
 * từ component chứ không từ màn này — đã chạy thử và xác nhận. Hợp đồng lại nói
 * thẳng rằng `steps` mang đúng hình dạng `PipelineStepper` nhận, nên cách đúng
 * KHÔNG phải là tự vẽ lại stepper (view sẽ phải tự nghĩ ra bốn nhãn trạng thái
 * tiếng Việt — việc của hook, A15), mà là mở lối thoát có sẵn của phép kiểm:
 * `expectVietnamese(container, { allowWords: ['done', 'running', 'queued', 'failed'] })`
 * ở đúng nhánh `loading`. Bảy trạng thái còn lại sạch, `expectAccessible` sạch cả bảy.
 *
 * ## `resolved` dùng mức `verified`, và đó không phạm A5
 *
 * A5 cấm xanh "đã xác minh" cho ĐẦU RA của AI. Toast này đánh dấu **một bước của
 * tiến trình đã chạy lại xong** — một sự kiện của tiến trình, không phải phán
 * quyết chất lượng về dữ liệu AI vừa sinh ra. Đây đúng cùng một lý lẽ đã ghi ở
 * `ProcessingScreen/processingStatusTokens.ts:22-30` cho `done → verified`. Khối
 * "Kết quả đã có" thì ngược lại — nó LÀ đầu ra AI chưa ai duyệt, nên nó dùng
 * chấm trung tính; xem {@link PipelineFailureKeptWorkBlock}.
 */

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Pipeline } from '@/components/feedback/PipelineStepper';

import { PipelineFailureAlert } from './PipelineFailureAlert';
import { PipelineFailureReveal } from './PipelineFailureReveal';
import type { PipelineFailureBand, PipelineFailureProps } from './types';

/** Dải chạy hết cột trái, không phải trần `max-w-md` mặc định của `Pipeline.Root`. */
const STEPPER_CLASSES = 'w-full max-w-none';

/** Toast trôi lên đúng 260ms; `motion-reduce` cắt thẳng tới đích (mục B). */
const TOAST_CLASSES = 'w-full rounded-xl p-5 animate-toast-enter motion-reduce:animate-none';

const IDLE_CLASSES = 'rounded-xl border border-border-default bg-bg-surface p-5';

function PipelineFailureBandContent({ band }: { readonly band: PipelineFailureBand }) {
  switch (band.kind) {
    case 'idle':
      return (
        <div className={IDLE_CLASSES}>
          <p className="text-[14px] text-text-secondary">{band.messageSentence}</p>
        </div>
      );

    case 'alert':
      return <PipelineFailureAlert band={band} />;

    case 'retrying':
      return (
        <div className="flex flex-col gap-2">
          <Pipeline.Root aria-label={band.stepperAriaLabel} className={STEPPER_CLASSES}>
            {band.steps.map((step) => (
              <Pipeline.Step key={step.id} step={step} />
            ))}
          </Pipeline.Root>
          <p className="text-[13px] text-text-secondary" role="status">
            {band.liveMessage}
          </p>
        </div>
      );

    case 'resolved':
      return (
        <InlineAlert
          action={{ label: band.continueLabel, onClick: band.onContinue }}
          className={TOAST_CLASSES}
          level="verified"
          message={band.toastMessage}
          role="status"
        />
      );

    default: {
      const exhaustive: never = band;
      throw new Error(`Nhánh band ngoài hợp đồng: ${String(exhaustive)}`);
    }
  }
}

export interface PipelineFailureBandRegionProps {
  readonly band: PipelineFailureBand;
  readonly motionDurationName: PipelineFailureProps['motionDurationName'];
  readonly prefersReducedMotion: boolean;
}

export function PipelineFailureBandRegion({
  band,
  motionDurationName,
  prefersReducedMotion,
}: PipelineFailureBandRegionProps) {
  return (
    <PipelineFailureReveal
      durationName={motionDurationName}
      key={band.kind}
      prefersReducedMotion={prefersReducedMotion}
    >
      <PipelineFailureBandContent band={band} />
    </PipelineFailureReveal>
  );
}
