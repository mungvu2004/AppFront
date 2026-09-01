/**
 * Dải đối chiếu DÍNH ĐÁY: chuỗi OCR đọc được, số đo từ hình học của bản vẽ, và
 * độ lệch giữa hai bên.
 *
 * View THUẦN của mục D (R-60): mọi thứ vào bằng props, không `@/api`, không
 * `@/store`, không `@/domain`, không `@/lib/http`.
 *
 * ## [CẤM TUYỆT ĐỐI] view không tự tính lệch và không tự so ngưỡng
 *
 * `isSignificant` là một CỜ do hook T5 điền. File này đọc cờ rồi tô hay không
 * tô — nó không biết ngưỡng 2% là bao nhiêu, không trừ hai số, không chia, và
 * không quy đổi đơn vị. Ba chuỗi `ocrValueLabel`, `measuredValueLabel`,
 * `deviationLabel` tới nơi đã định dạng xong (A15).
 *
 * ## Vì sao tô CẢ DẢI chứ không tô một khúc giữa câu
 *
 * `comparisonLine()` của T4 trả về MỘT câu tiếng Việt liền mạch. Tô màu riêng
 * phần "lệch 0,25%" nghĩa là cắt câu đó ra bằng chỉ số hay bằng dấu chấm giữa —
 * đúng thứ `expectVietnamese` sinh ra để bắt, và sẽ vỡ ngay lần đầu ai đó sửa
 * câu. Điều phối viên chốt ở QĐ-7: giữ nguyên câu, đổi nền và màu chữ của cả
 * dải khi độ lệch đáng kể.
 *
 * ## Chạy số 260 ms
 *
 * Phần trăm lệch chạy bằng `useCountUp` của `src/hooks` — lớp bọc React của
 * engine thuần `src/lib/motion/useCountUp.ts`. Engine đó khai
 * `COUNT_UP_DURATION = 'standard'`, và `'standard'` là `MOTION_DURATIONS_MS.standard`
 * = 260 ms. Đặc tả gốc ghi 240 ms; thang chuyển động không có 240 (QĐ-2), nên
 * con số đúng là 260 và nó KHÔNG được viết ra ở đây — file này không chứa một
 * con số thời lượng nào (R-71).
 *
 * Chữ hiện ra do `formatDeviation` của hook dựng, không do view: view đưa
 * `sample.value` của khung hiện tại vào rồi vẽ chuỗi nhận về (A15).
 */

import { useCountUp } from '@/hooks/useCountUp';
import { cn } from '@/lib/utils';

import { comparisonLine, DIMENSION_OCR_TEXT } from './dimensionOcrText';
import type { DimensionOcrCompareBarProps } from './dimensionOcrTypes';

/**
 * Props của dải đối chiếu — mở rộng THUẦN CỘNG hợp đồng đóng băng của T3 (QĐ-7).
 *
 * `deviationLabel` là chuỗi nghỉ; hai trường dưới đây là thứ cần để nó CHẠY tới
 * chuỗi đó. `dimensionOcrTypes.ts` không bị chạm tới.
 */
export interface DimensionOcrCompareBarViewProps extends DimensionOcrCompareBarProps {
  /** Phần trăm lệch dạng SỐ thô, để `useCountUp` có đích mà chạy tới. */
  readonly deviationPercentValue: number;
  /**
   * Hàm định dạng do hook cấp (`formatPercent` của `@/lib/format/number`). View
   * gọi nó cho từng khung hình và KHÔNG tự định dạng — A15 đặt việc ấy ở
   * viewmodel, không ở view.
   */
  readonly formatDeviation: (value: number) => string;
}

export function DimensionOcrCompareBar({
  compare,
  deviationPercentValue,
  formatDeviation,
}: DimensionOcrCompareBarViewProps) {
  /*
    Hook gọi vô điều kiện: `compare === null` là chuyện thường (chưa chọn chuỗi
    nào), và một `return` sớm đặt trước lời gọi này sẽ đổi số hook giữa hai lượt
    render.
  */
  const running = useCountUp(deviationPercentValue);

  if (compare === null) {
    return null;
  }

  const isSignificant = compare.isSignificant;

  return (
    <div
      aria-label={DIMENSION_OCR_TEXT.comparisonBar.ariaLabel}
      className={cn(
        'sticky bottom-0 z-10 flex items-center px-4 py-2',
        'border-t border-border-default text-[13px]',
        /* Độ lệch chỉ tô màu khi thật sự đáng kể — cờ của hook, không phải phép so ở đây. */
        isSignificant
          ? 'bg-state-attention-tint text-state-attention-text'
          : 'bg-bg-surface text-text-secondary',
      )}
      role="group"
    >
      {/* Số bằng chữ đều: không `font-mono` ở dải này, đúng đặc tả. */}
      <p>
        {comparisonLine(
          compare.ocrValueLabel,
          compare.measuredValueLabel,
          running.done ? compare.deviationLabel : formatDeviation(running.value),
        )}
      </p>
    </div>
  );
}
