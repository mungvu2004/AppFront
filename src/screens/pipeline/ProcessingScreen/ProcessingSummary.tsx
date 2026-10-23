/**
 * Khối tổng kết cuối màn Xử lý — năm con số đã đọc được, một câu về mức tin cậy
 * thấp, và hai lối đi tiếp.
 *
 * MỌI CHUỖI SỐ ĐẾN ĐÂY ĐÃ ĐỊNH DẠNG XONG (A15): `metricLabels` là `"48 tường"`,
 * `areaLabel` là `"248,60 m²"` với dấu phẩy thập phân. File này không gọi
 * `toFixed`, không gọi `toLocaleString`, không nhân chia đơn vị, không ghép câu
 * từ số — nó in ra đúng cái nhận được (`local/no-raw-number`).
 *
 * Hai nút là hành động điều hướng, không phải hành động phá huỷ, nên chúng
 * không cần hộp thoại xác nhận của A9 — và màn này không có hộp thoại nào.
 */

import { clsx } from 'clsx';

import { Button } from '@/components/ui/Button';

import { splitMetricLabel } from './splitMetricLabel';
import type { ProcessingSummaryProps } from './types';

const SUMMARY_ARIA_LABEL = 'Báo cáo tổng kết';
const REVIEW_WALLS_LABEL = 'Duyệt lớp tường';
const CALIBRATE_SCALE_LABEL = 'Hiệu chỉnh tỷ lệ';

export function ProcessingSummary({ summary }: ProcessingSummaryProps) {
  const metrics = summary.metricLabels;

  return (
    <section
      aria-label={SUMMARY_ARIA_LABEL}
      className="flex flex-col gap-4 rounded-lg border border-border-default bg-bg-surface p-4"
    >
      {metrics.length > 0 ? (
        // Plain figures, no chip frame, so they no longer look like the buttons below; a zero count
        // (e.g. "0 chuỗi kích thước" — likely a miss) is marked for attention (aesthetic 2.5 #3).
        <ul className="flex flex-wrap gap-x-8 gap-y-3">
          {metrics.map((metric) => {
            const { value, unit } = splitMetricLabel(metric);
            const isZero = value === '0';
            return (
              <li aria-label={metric} className="flex flex-col" key={metric}>
                <span
                  className={clsx(
                    'text-heading tabular-nums',
                    isZero ? 'text-state-attention-text' : 'text-text-primary',
                  )}
                >
                  {value}
                </span>
                <span className={clsx('text-[12px]', isZero ? 'text-state-attention-text' : 'text-text-secondary')}>
                  {unit}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {summary.lowConfidenceSentence !== undefined ? (
        <p className="text-[14px] leading-relaxed text-text-secondary">{summary.lowConfidenceSentence}</p>
      ) : null}

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
