/**
 * Cây bước xử lý của màn Xử lý — sáu bước, trong đó ba bước nhận diện là ba
 * hàng con thụt vào dưới một hàng cha.
 *
 * ## Vì sao không dùng stepper dùng chung của `src/components/feedback`
 *
 * Stepper đó nhận một mảng PHẲNG (`PipelineStepData[]`) và không có khái
 * niệm cha/con, không có khối chi tiết mở được, không có số đếm — ba trong bốn
 * yêu cầu của màn này. Vạch quét sẵn có của nó còn dựng bằng `bg-white` cộng
 * `blur-[2px]`, tức vừa là mã màu thô (A1) vừa là một vệt sáng mờ, đúng thứ mục
 * [CẤM TUYỆT ĐỐI] gọi là glow. Sửa nó thì phạm ranh giới `src/components`.
 * Nên phần trình bày này ở lại trong thư mục màn, ghép từ nguyên thuỷ cộng
 * token — cùng tiền lệ với `InputQualityGateImagePanel.tsx`.
 *
 * ## Vạch quét
 *
 * Một đường 2px đặc, màu token, chạy bằng lớp `animate-pipeline-sweep` đã khai
 * sẵn ở `tailwind.config.ts:190`. Không con số mili-giây nào được viết trong
 * file này. Không gradient, không blur, không glow, không `bg-white`.
 * `prefersReducedMotion` bật thì vạch quét không được dựng ra — còn lại đúng
 * thanh tiến độ tĩnh.
 *
 * ## Không có tiến độ giả
 *
 * Thanh chỉ vẽ đúng `step.percent`. Không nội suy, không tự bò lên khi không có
 * dữ liệu mới về.
 */

import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { IconButton } from '@/components/ui/IconButton';
import { durationMs } from '@/lib/motion';

import {
  STAGE_BAR_CLASS,
  STAGE_DOT_CLASS,
  STAGE_ICON_CLASS,
  STAGE_TEXT_CLASS,
} from './processingStatusTokens';
import type { ProcessingStageStatus, ProcessingStepListProps, ProcessingStepViewModel } from './types';

const STEPS_ARIA_LABEL = 'Các bước xử lý';
const OPEN_DETAIL_PREFIX = 'Mở chi tiết bước';
const CLOSE_DETAIL_PREFIX = 'Đóng chi tiết bước';

/**
 * Nền hàng nháy một nhịp `slow` khi bước vừa chuyển sang xong.
 *
 * Cùng khuôn stepper dùng chung ở `src/components/feedback` (dòng 34-44): thời
 * lượng lấy qua `durationMs('slow')` chứ không viết số, và
 * `prefersReducedMotion` thì không nháy lần nào.
 */
function useDoneFlash(status: ProcessingStageStatus, prefersReducedMotion: boolean): boolean {
  const [isFlashing, setIsFlashing] = useState(false);
  const previousStatus = useRef<ProcessingStageStatus>(status);

  useEffect(() => {
    const justFinished = status === 'done' && previousStatus.current !== 'done';
    previousStatus.current = status;

    if (!justFinished || prefersReducedMotion) {
      return undefined;
    }

    setIsFlashing(true);
    const timer = setTimeout(() => {
      setIsFlashing(false);
    }, durationMs('slow'));

    return () => {
      clearTimeout(timer);
    };
  }, [status, prefersReducedMotion]);

  return isFlashing;
}

/** Dấu tích tự vẽ trong slot `standard`; hỏng thì là dấu nhân; còn lại là chấm. */
function StepIcon({ status }: { readonly status: ProcessingStageStatus }) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center transition-colors duration-standard',
        STAGE_ICON_CLASS[status],
      )}
    >
      {status === 'done' ? (
        <svg
          className="h-full w-full animate-step-icon-draw motion-reduce:animate-none"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
          style={{ strokeDasharray: 24, strokeDashoffset: 0 }}
          viewBox="0 0 24 24"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : status === 'failed' ? (
        <svg
          className="h-full w-full"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" x2="9" y1="9" y2="15" />
          <line x1="9" x2="15" y1="9" y2="15" />
        </svg>
      ) : (
        <span className={clsx('h-1.5 w-1.5 rounded-full', STAGE_DOT_CLASS[status])} />
      )}
    </span>
  );
}

/** Thanh tiến độ 3px, cộng vạch quét khi bước đang quét và người dùng không tắt chuyển động. */
function StepProgressBar({
  prefersReducedMotion,
  step,
}: {
  readonly prefersReducedMotion: boolean;
  readonly step: ProcessingStepViewModel;
}) {
  return (
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
        // Khung rộng một phần tư đường chạy, vạch thật là cạnh phải 2px của nó:
        // dịch chuyển của keyframe tính theo bề rộng CHÍNH NÓ, nên một phần tư
        // là tỉ lệ đưa cạnh phải đi trọn từ đầu tới cuối đường chạy.
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-1/4 animate-pipeline-sweep motion-reduce:animate-none"
        >
          <span className={clsx('absolute inset-y-0 right-0 w-[2px]', STAGE_BAR_CLASS.running)} />
        </div>
      ) : null}
    </div>
  );
}

function StepRow({
  isChild,
  prefersReducedMotion,
  step,
}: {
  readonly isChild: boolean;
  readonly prefersReducedMotion: boolean;
  readonly step: ProcessingStepViewModel;
}) {
  const isFlashing = useDoneFlash(step.status, prefersReducedMotion);
  const detailId = `${step.id}-chi-tiet`;
  const hasDetail = step.detailLabels.length > 0;
  const children = step.children ?? [];

  return (
    <li className={clsx('flex flex-col gap-2', isChild && 'pl-6')}>
      <div
        className={clsx(
          'rounded-[8px] border border-border-default p-3 transition-colors duration-slow',
          isFlashing ? 'bg-bg-flash' : 'bg-bg-surface',
        )}
      >
        <div className="flex items-start gap-3">
          <StepIcon status={step.status} />
          <span
            className={clsx(
              'flex-1 text-[14px] font-medium leading-tight transition-colors duration-standard',
              STAGE_TEXT_CLASS[step.status],
            )}
          >
            {step.name}
          </span>
          {step.remainingLabel !== undefined ? (
            <span className="whitespace-nowrap text-[13px] text-text-secondary">{step.remainingLabel}</span>
          ) : null}
          {hasDetail ? (
            <IconButton
              aria-controls={detailId}
              aria-expanded={step.isDetailOpen}
              aria-label={`${step.isDetailOpen ? CLOSE_DETAIL_PREFIX : OPEN_DETAIL_PREFIX} ${step.name}`}
              icon={step.isDetailOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              onClick={step.onToggleDetail}
              size="sm"
              tooltip={false}
              type="button"
            />
          ) : null}
        </div>

        <StepProgressBar prefersReducedMotion={prefersReducedMotion} step={step} />

        {hasDetail && step.isDetailOpen ? (
          <ul className="mt-2 flex flex-col gap-1 pl-7" id={detailId}>
            {step.detailLabels.map((label, index) => (
              <li className="text-[13px] text-text-secondary" key={`${step.id}-chi-tiet-${String(index)}`}>
                {label}
              </li>
            ))}
          </ul>
        ) : null}

        {step.errorMessage !== undefined ? (
          <div className="mt-2 flex flex-col items-start gap-1 pl-7">
            <p className="text-[13px] leading-snug text-state-violation-text">{step.errorMessage}</p>
            {step.errorCode !== undefined ? (
              <span className="font-mono text-[12px] font-medium text-state-violation">{step.errorCode}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      {children.length > 0 ? (
        <ol className="flex flex-col gap-2">
          {children.map((child) => (
            <StepRow isChild key={child.id} prefersReducedMotion={prefersReducedMotion} step={child} />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

export function ProcessingStepList({ prefersReducedMotion, steps }: ProcessingStepListProps) {
  return (
    <ol aria-label={STEPS_ARIA_LABEL} className="flex flex-col gap-2">
      {steps.map((step) => (
        <StepRow isChild={false} key={step.id} prefersReducedMotion={prefersReducedMotion} step={step} />
      ))}
    </ol>
  );
}
