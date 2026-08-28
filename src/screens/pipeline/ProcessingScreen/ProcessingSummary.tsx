/**
 * STUB — báo cáo tổng kết cuối màn Xử lý. Nhiệm vụ V5 thay ruột file này; chữ
 * ký giữ nguyên từ `ProcessingSummaryProps` (`types.ts`).
 */

import { Button } from '@/components/ui/Button';

import type { ProcessingSummaryProps } from './types';

export function ProcessingSummary({ summary }: ProcessingSummaryProps) {
  return (
    <div aria-label="Báo cáo tổng kết" role="region">
      <ul className="flex flex-wrap gap-4">
        <li>{summary.wallCountLabel}</li>
        <li>{summary.objectCountLabel}</li>
        <li>{summary.dimensionCountLabel}</li>
        <li>{summary.roomCountLabel}</li>
        <li>{summary.areaLabel}</li>
      </ul>
      <p>{summary.lowConfidenceSentence}</p>
      <div className="flex gap-2">
        <Button onClick={summary.onReviewWalls} variant="secondary">
          Xem lại tường
        </Button>
        <Button onClick={summary.onCalibrateScale} variant="secondary">
          Hiệu chỉnh tỉ lệ
        </Button>
      </div>
    </div>
  );
}
