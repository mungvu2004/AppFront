/**
 * Khối 3 — Ước tính. File anh em của `BillingScreen.tsx` (mục D, R-22).
 */
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { FieldRow } from '@/components/ui/FieldRow';
import { cn } from '@/lib/utils';

import type { BillingEstimate } from './BillingScreen';

export interface EstimateBlockProps {
  readonly estimate: BillingEstimate;
  readonly degradedMessage: string | null;
}

/** Mảnh 1 và 3 (0-based: sentence[1], sentence[3]) là số — đặt chữ đều, không nối chuỗi (A15). */
export function EstimateBlock({ estimate, degradedMessage }: EstimateBlockProps) {
  const [lead, marketPrice, middle, productCost, tail] = estimate.sentence;

  return (
    <section className={cn('w-full max-w-[960px]', 'rounded-xl bg-bg-sunken p-6')}>
      {degradedMessage !== null && <InlineAlert level="attention" message={degradedMessage} className="mb-4" />}
      <h2 className="text-[20px] font-semibold text-text-primary">Ước tính</h2>
      <p className="mt-3 text-[14px] leading-relaxed text-text-primary">
        {lead}
        <span className="font-mono tabular-nums">{marketPrice}</span>
        {middle}
        <span className="font-mono tabular-nums">{productCost}</span>
        {tail}
      </p>
      <div className="mt-4">
        {estimate.rows.map((row, index) => (
          <FieldRow key={row.label} label={row.label} isLast={index === estimate.rows.length - 1}>
            {row.value}
          </FieldRow>
        ))}
      </div>
    </section>
  );
}
