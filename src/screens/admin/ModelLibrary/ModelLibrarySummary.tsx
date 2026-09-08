/**
 * Dải tóm tắt ba số trên đầu bảng: tổng số model, tổng dung lượng, số model nặng.
 *
 * Cả ba nhãn `…Label` trong `ModelLibrarySummaryModel` đã là chuỗi định dạng sẵn (A15) —
 * view chỉ đặt chúng vào ô, không tính lại, không `toLocaleString`. `isAllWithinBudget`
 * chỉ đổi giọng (màu chữ của số model nặng), dải vẫn hiện đủ ba số trong mọi trường hợp.
 */
import { cn } from '@/lib/utils';

import type { ModelLibrarySummaryModel } from './types';

const TOTAL_COUNT_CAPTION = 'tổng số model';
const TOTAL_SIZE_CAPTION = 'tổng dung lượng';
const HEAVY_COUNT_CAPTION = 'model nặng';

interface SummaryFigureProps {
  readonly caption: string;
  readonly value: string;
  readonly toneClassName?: string | undefined;
}

function SummaryFigure({ caption, value, toneClassName }: SummaryFigureProps) {
  return (
    <div className="flex flex-col-reverse gap-1">
      <dt className="text-[13px] text-text-secondary">{caption}</dt>
      <dd className={cn('font-mono text-3xl tabular-nums text-text-primary', toneClassName)}>{value}</dd>
    </div>
  );
}

export interface ModelLibrarySummaryProps {
  readonly summary: ModelLibrarySummaryModel;
}

export function ModelLibrarySummary({ summary }: ModelLibrarySummaryProps) {
  return (
    <dl className="grid grid-cols-3 gap-6">
      <SummaryFigure caption={TOTAL_COUNT_CAPTION} value={summary.totalCountLabel} />
      <SummaryFigure caption={TOTAL_SIZE_CAPTION} value={summary.totalSizeLabel} />
      <SummaryFigure
        caption={HEAVY_COUNT_CAPTION}
        toneClassName={summary.isAllWithinBudget ? undefined : 'text-state-attention-text'}
        value={summary.heavyCountLabel}
      />
    </dl>
  );
}
