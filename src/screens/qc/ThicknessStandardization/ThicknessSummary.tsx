/**
 * Hàng tóm tắt bốn con số của màn "Chuẩn hoá độ dày tường" (2.1 của brief T7):
 * tổng số đoạn tường, đã chuẩn hoá, lệch quá dung sai, cột bê tông cốt thép.
 *
 * VIEW THUẦN — nhận đúng một prop (`ThicknessSummaryProps`, T4 khai), không
 * chạm store/hook/mạng. Bốn số chạy khi đổi bằng `useCountUp` (bản React ở
 * `src/hooks/`, KHÔNG phải bản thuần `src/lib/motion/useCountUp.ts`).
 *
 * ## Vì sao không con số nào mang xanh "đã xác minh"
 *
 * Bốn số là kết quả máy đếm, không phải việc người duyệt xác nhận: A5 dành xanh đó cho người
 * duyệt, nên cả bốn số dùng `text-text-primary` (BUG-611). Con số nằm CHÍNH TRONG câu trạng thái:
 * một con số duy nhất trong cây truy cập, không số lớn aria-hidden cộng số sr-only (BUG-340).
 */

import { useCountUp } from '@/hooks/useCountUp';

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
}

function SummaryStat({ value, label }: SummaryStatProps) {
  const { text } = useCountUp(value, { format: COUNT_FORMAT });

  return (
    <p className="flex flex-col gap-1 text-[13px] text-text-secondary" role="status">
      <span className="font-mono text-[24px] font-semibold leading-none tabular-nums text-text-primary">{text}</span>{' '}
      <span>{label}</span>
    </p>
  );
}

const STAT_KEYS: readonly (keyof ThicknessSummaryData)[] = [
  'segmentCount',
  'normalizedCount',
  'exceedingToleranceCount',
  'concreteColumnCount',
];

export function ThicknessSummary({ summary }: ThicknessSummaryProps) {
  return (
    // Một thẻ như các khối khác của màn, bốn ô (hai ô dưới 640 px) — hàng số trơ là BUG-611.
    <div
      aria-label={SUMMARY_GROUP_LABEL}
      className="grid grid-cols-2 gap-4 rounded-[12px] bg-bg-surface p-4 shadow-panel sm:grid-cols-4"
      role="group"
    >
      {STAT_KEYS.map((key) => (
        <SummaryStat key={key} label={THICKNESS_SUMMARY_LABELS[key]} value={summary[key]} />
      ))}
    </div>
  );
}
