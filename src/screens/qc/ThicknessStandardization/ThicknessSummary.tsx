/**
 * Hàng tóm tắt bốn con số của màn "Chuẩn hoá độ dày tường" (2.1 của brief T7):
 * tổng số đoạn tường, đã chuẩn hoá, lệch quá dung sai, cột bê tông cốt thép.
 *
 * VIEW THUẦN — nhận đúng một prop (`ThicknessSummaryProps`, T4 khai), không
 * chạm store/hook/mạng. Bốn số chạy khi đổi bằng `useCountUp` (bản React ở
 * `src/hooks/`, KHÔNG phải bản thuần `src/lib/motion/useCountUp.ts`).
 *
 * ## Vì sao "lệch quá dung sai" đổi màu khi về 0
 *
 * `summary.exceedingToleranceCount === 0` là SỰ THẬT có thể đọc thẳng từ prop
 * duy nhất của component này — không cần biết `ThicknessScreenState` (kiểu đó
 * không có trong `ThicknessSummaryProps`). Ô này chuyển sang tông
 * `state-verified-text` khi về 0 VÀ còn đoạn để đếm (`segmentCount > 0`), để
 * tránh trường hợp rỗng (0/0) trông giống một cột mốc đã đạt. Đây KHÔNG phải
 * `Badge variant="verified"` hay bất kỳ tuyên bố "đã được người duyệt xác
 * nhận" nào cho một bức tường cụ thể (A5 chỉ cấm đúng việc đó) — chỉ là một
 * tông màu tích cực cho MỘT con số tổng hợp đã về 0, giống cách một bảng điều
 * khiển tô xanh dòng "còn 0 lỗi".
 */

import { useCountUp } from '@/hooks/useCountUp';
import { cn } from '@/lib/utils';

import {
  THICKNESS_SUMMARY_LABELS,
  type ThicknessSummary as ThicknessSummaryData,
  type ThicknessSummaryProps,
} from './thicknessTypes';

const SUMMARY_GROUP_LABEL = 'Tóm tắt chuẩn hoá độ dày tường';
const COUNT_FORMAT = { fractionDigits: 0 };

interface SummaryStatProps {
  readonly value: number;
  readonly label: string;
  readonly isPositive: boolean;
}

function SummaryStat({ value, label, isPositive }: SummaryStatProps) {
  const { text } = useCountUp(value, { format: COUNT_FORMAT });

  return (
    <div className="flex flex-col gap-1">
      <span
        aria-hidden="true"
        className={cn(
          'font-mono text-[24px] font-semibold leading-none tabular-nums',
          isPositive ? 'text-state-verified-text' : 'text-text-primary',
        )}
      >
        {text}
      </span>
      <p className="text-[13px] text-text-secondary" role="status">
        {value} {label}
      </p>
    </div>
  );
}

export function ThicknessSummary({ summary }: ThicknessSummaryProps) {
  const isFullyStandardized = summary.segmentCount > 0 && summary.exceedingToleranceCount === 0;

  const stats: readonly { key: keyof ThicknessSummaryData; isPositive: boolean }[] = [
    { key: 'segmentCount', isPositive: false },
    { key: 'normalizedCount', isPositive: false },
    { key: 'exceedingToleranceCount', isPositive: isFullyStandardized },
    { key: 'concreteColumnCount', isPositive: false },
  ];

  return (
    <div aria-label={SUMMARY_GROUP_LABEL} className="flex flex-wrap items-start gap-6" role="group">
      {stats.map((stat) => (
        <SummaryStat
          isPositive={stat.isPositive}
          key={stat.key}
          label={THICKNESS_SUMMARY_LABELS[stat.key]}
          value={summary[stat.key]}
        />
      ))}
    </div>
  );
}
