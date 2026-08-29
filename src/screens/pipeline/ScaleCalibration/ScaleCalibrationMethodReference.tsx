/**
 * Khối "vẽ đường tham chiếu" của panel Hiệu chỉnh tỷ lệ — phương pháp 2, ba
 * bước rõ ràng: kéo đoạn, nhập chiều dài thật, xem kết quả.
 *
 * ## Vì sao ô "Chiều dài thật" dùng `Input`, không dùng `NumericField`
 *
 * `NumericField` (`src/components/ui/NumericField.tsx`) bọc
 * `useNumericField()`, hàm này gom phím gõ lại và chỉ bắn `onChange` ra ngoài
 * sau khi ngừng gõ 800 ms (`COMMIT_DEBOUNCE_MS`,
 * `src/hooks/useNumericField.ts:14`) — cùng 800 ms của A7, cố ý cho việc tự
 * lưu, không hợp cho một cảnh báo phải hiện NGAY KHI GÕ. Kiểu của nó cũng
 * không khớp: `value?: number` / `onChange?: (number|undefined) => void`,
 * còn hợp đồng ở đây là `realLengthText: string` /
 * `onChangeRealLength: (text: string) => void` — văn bản thô, không phải số
 * đã phân tích. Ép qua `NumericField` cần một bước đổi kiểu số → chuỗi, tức
 * đúng phép "định dạng số trong view" mà A15 cấm.
 *
 * `Input` (`src/components/ui/Input.tsx`) là primitive `NumericField` tự dựng
 * lên (`NumericField.tsx:2-3,50`) nên dùng thẳng nó không phải tạo component
 * mới: cùng khung nhãn/hint/suffix, cùng viền lỗi, chỉ khác là không có tầng
 * gom phím ở giữa. `className` chép nguyên văn từ `NumericField.tsx:64` để ô
 * số vẫn đứng chữ đều, căn phải, giống hệt mọi ô số khác trong sản phẩm.
 */

import { clsx } from 'clsx';

import { InlineAlert, type InlineAlertLevel } from '@/components/feedback/InlineAlert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Kbd } from '@/components/ui/Kbd';

import type { ScaleCalibrationMethodReferenceProps, ScaleReferenceStep } from './types';
import type { ViewStatusCode } from '@/lib/viewmodel/types';

const STEP_DRAW_TITLE = 'Kéo một đoạn dọc cạnh đã biết';
const STEP_ENTER_LENGTH_TITLE = 'Nhập chiều dài thật của đoạn đó';
const STEP_RESULT_TITLE = 'Kết quả';
const DRAW_HINT = 'Giữ Shift để khoá đoạn theo trục ngang hoặc dọc.';
const REAL_LENGTH_LABEL = 'Chiều dài thật';
const REAL_LENGTH_UNIT = 'mm';
const REAL_LENGTH_NO_HINT = 'Không có chuỗi kích thước nào gần đoạn này để gợi ý.';
const REMEASURE_LABEL = 'Đo lại';
const MISSING_VALUE = '—';

/** Cùng bảng ánh xạ `ViewStatusCode` → mức `InlineAlert` mà panel dùng — cảnh báo ở đây luôn `'attention'`. */
function toAlertLevel(statusCode: ViewStatusCode): InlineAlertLevel {
  return statusCode === 'neutral' ? 'attention' : statusCode;
}

function StepHeading({
  index,
  isActive,
  title,
}: {
  readonly index: number;
  readonly isActive: boolean;
  readonly title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={clsx(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold',
          isActive ? 'bg-accent text-bg-surface' : 'bg-bg-sunken text-text-muted',
        )}
      >
        {index}
      </span>
      <h4 className={clsx('text-[13px] font-medium', isActive ? 'text-text-primary' : 'text-text-muted')}>
        {title}
      </h4>
    </div>
  );
}

function isStepActive(activeStep: ScaleReferenceStep, step: ScaleReferenceStep): boolean {
  return activeStep === step;
}

export function ScaleCalibrationMethodReference({ actions, reference }: ScaleCalibrationMethodReferenceProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <StepHeading index={1} isActive={isStepActive(reference.activeStep, 'draw')} title={STEP_DRAW_TITLE} />
        <p className="text-[13px] text-text-secondary">{DRAW_HINT}</p>
        <p className="font-mono text-[16px] font-semibold tabular-nums text-text-primary">
          {reference.livePixelLengthLabel ?? MISSING_VALUE}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Kbd>Esc</Kbd>
          <Kbd>Shift</Kbd>
          <Kbd>R</Kbd>
          <Kbd>Enter</Kbd>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <Kbd>←</Kbd>
          <Kbd>→</Kbd>
        </div>
        <Button
          disabled={!reference.canRemeasure}
          onClick={actions.onRemeasure}
          size="sm"
          variant="secondary"
        >
          {REMEASURE_LABEL}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <StepHeading
          index={2}
          isActive={isStepActive(reference.activeStep, 'enterLength')}
          title={STEP_ENTER_LENGTH_TITLE}
        />
        <Input
          className="text-right font-mono text-[13px] leading-[20px]"
          inputMode="decimal"
          label={REAL_LENGTH_LABEL}
          hint={reference.realLengthHint ?? REAL_LENGTH_NO_HINT}
          onChange={(event) => {
            actions.onChangeRealLength(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              actions.onConfirmRealLength();
            }
          }}
          placeholder={reference.realLengthPlaceholder}
          suffix={REAL_LENGTH_UNIT}
          value={reference.realLengthText}
        />
        {reference.inlineWarning && (
          <InlineAlert
            level={toAlertLevel(reference.inlineWarning.statusCode)}
            message={reference.inlineWarning.message}
          />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <StepHeading index={3} isActive={isStepActive(reference.activeStep, 'result')} title={STEP_RESULT_TITLE} />
        <p className="font-mono text-[24px] font-semibold tabular-nums text-text-primary">
          {reference.resultLabel ?? MISSING_VALUE}
        </p>
      </div>
    </div>
  );
}
