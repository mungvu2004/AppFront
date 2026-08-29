/**
 * Khối tổng kết cuối màn Xử lý — năm con số đã đọc được, một câu về mức tin cậy
 * thấp, và hai lối đi tiếp.
 *
 * MỌI CHUỖI SỐ ĐẾN ĐÂY ĐÃ ĐỊNH DẠNG XONG (A15): `wallCountLabel` là `"48 tường"`,
 * `areaLabel` là `"248,60 m²"` với dấu phẩy thập phân. File này không gọi
 * `toFixed`, không gọi `toLocaleString`, không nhân chia đơn vị, không ghép câu
 * từ số — nó in ra đúng cái nhận được (`local/no-raw-number`).
 *
 * Hai nút là hành động điều hướng, không phải hành động phá huỷ, nên chúng
 * không cần hộp thoại xác nhận của A9 — và màn này không có hộp thoại nào.
 */

import { Button } from '@/components/ui/Button';

import type { ProcessingSummaryProps } from './types';

const SUMMARY_ARIA_LABEL = 'Báo cáo tổng kết';
const REVIEW_WALLS_LABEL = 'Duyệt lớp tường';
const CALIBRATE_SCALE_LABEL = 'Hiệu chỉnh tỷ lệ';

export function ProcessingSummary({ summary }: ProcessingSummaryProps) {
  const metrics = [
    summary.wallCountLabel,
    summary.objectCountLabel,
    summary.dimensionCountLabel,
    summary.roomCountLabel,
    summary.areaLabel,
  ];

  return (
    <section
      aria-label={SUMMARY_ARIA_LABEL}
      className="flex flex-col gap-4 rounded-[12px] border border-border-default bg-bg-surface p-4"
    >
      <ul className="flex flex-wrap gap-2">
        {metrics.map((metric) => (
          <li
            className="rounded-[8px] bg-bg-sunken px-3 py-1.5 text-[14px] font-medium text-text-primary"
            key={metric}
          >
            {metric}
          </li>
        ))}
      </ul>

      <p className="text-[14px] leading-relaxed text-text-secondary">{summary.lowConfidenceSentence}</p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={summary.onReviewWalls} size="sm" variant="secondary">
          {REVIEW_WALLS_LABEL}
        </Button>
        <Button onClick={summary.onCalibrateScale} size="sm" variant="secondary">
          {CALIBRATE_SCALE_LABEL}
        </Button>
      </div>
    </section>
  );
}
