/**
 * Dạng thu gọn của cây bước — dùng thay `ProcessingStepList` khi màn hẹp
 * (`isCompact`) hoặc khi trạng thái là `collapsed`.
 *
 * Đặc tả: "dưới 1024 thì stepper thành MỘT thanh ngang duy nhất kèm tên bước
 * hiện tại". Sáu hàng có thanh riêng, khối chi tiết mở được và ba hàng con thụt
 * vào không đọc được trên khung hẹp — nên bản thu gọn giữ đúng một dòng chữ và
 * đúng một thanh.
 *
 * ## Vì sao là file riêng chứ không phải một prop của `ProcessingStepList`
 *
 * `ProcessingStepListProps` (`types.ts`) đã ĐÓNG BĂNG và không có `isCompact`.
 * Thêm trường vào đó là sửa hợp đồng props, việc phải hỏi điều phối viên. Chọn
 * giữa hai cách vẽ vì thế là việc của khung màn: `ProcessingScreen.tsx` dựng
 * component nào là quyết định của nó, và cả hai component cùng nhận đúng một
 * `ProcessingStepListProps` nên hợp đồng không đổi một dòng nào.
 *
 * Bước "hiện tại" là bước đang chạy; chưa có bước nào chạy thì là bước đang chờ
 * đầu tiên; tất cả đã xong thì là bước cuối. Đây là phép CHỌN một phần tử có
 * sẵn, không phải phép tính ra dữ liệu mới — không con số nào bị định dạng ở đây
 * (A15), và thanh vẫn chỉ vẽ đúng `percent` được truyền xuống.
 */

import { clsx } from 'clsx';

import { STAGE_BAR_CLASS, STAGE_TEXT_CLASS } from './processingStatusTokens';
import type { ProcessingStepListProps, ProcessingStepViewModel } from './types';

const COMPACT_ARIA_LABEL = 'Bước đang xử lý';

/** Hàng con thay cha khi có: cha chỉ là cái tên nhóm, tiến độ thật nằm ở con. */
function leavesOf(steps: readonly ProcessingStepViewModel[]): readonly ProcessingStepViewModel[] {
  return steps.flatMap((step) =>
    step.children !== undefined && step.children.length > 0 ? leavesOf(step.children) : [step],
  );
}

function currentStepOf(steps: readonly ProcessingStepViewModel[]): ProcessingStepViewModel | undefined {
  const leaves = leavesOf(steps);

  return (
    leaves.find((step) => step.status === 'running') ??
    leaves.find((step) => step.status === 'failed') ??
    leaves.find((step) => step.status === 'queued') ??
    leaves[leaves.length - 1]
  );
}

export function ProcessingStepBar({ prefersReducedMotion, steps }: ProcessingStepListProps) {
  const step = currentStepOf(steps);

  if (step === undefined) {
    return null;
  }

  return (
    <div aria-label={COMPACT_ARIA_LABEL} className="rounded-[8px] border border-border-default bg-bg-surface p-3" role="group">
      <div className="flex items-baseline justify-between gap-2">
        <span className={clsx('text-[14px] font-medium', STAGE_TEXT_CLASS[step.status])}>{step.name}</span>
        {step.remainingLabel !== undefined ? (
          <span className="whitespace-nowrap text-[13px] text-text-secondary">{step.remainingLabel}</span>
        ) : null}
      </div>

      <div
        aria-label={step.name}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={step.percent}
        className="relative mt-2.5 h-[3px] w-full overflow-hidden rounded-full bg-bg-sunken"
        role="progressbar"
      >
        <div
          className={clsx(
            'absolute inset-y-0 left-0 rounded-full transition-[width] duration-standard ease-enter',
            STAGE_BAR_CLASS[step.status],
          )}
          style={{ width: `${String(step.percent)}%` }}
        />
        {step.isScanning && !prefersReducedMotion ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-1/4 animate-pipeline-sweep motion-reduce:animate-none"
          >
            <span className={clsx('absolute inset-y-0 right-0 w-[2px]', STAGE_BAR_CLASS.running)} />
          </div>
        ) : null}
      </div>

      {step.errorMessage !== undefined ? (
        <p className="mt-2 text-[13px] leading-snug text-state-violation-text">
          {step.errorMessage}
          {step.errorCode !== undefined ? (
            <span className="ml-2 font-mono text-[12px] font-medium text-state-violation">{step.errorCode}</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
