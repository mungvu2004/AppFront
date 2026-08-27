/**
 * Khối 2 — So sánh gói. File anh em của `BillingScreen.tsx` (mục D, R-22).
 */
import { Check } from 'lucide-react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { cn } from '@/lib/utils';

import type { BillingPeriod, BillingPlanCard } from './BillingScreen';

/** Q3: `--accent-border` không tồn tại. Viền gói khuyến nghị dùng `--accent` 1px. */
const RECOMMENDED_CARD_CLASS = 'border-accent';
const DEFAULT_CARD_CLASS = 'border-border-default';

/** Chung cho cả ba thẻ — thẻ khuyến nghị KHÔNG được động khác hai thẻ kia (mục 7). */
const CARD_HOVER_CLASS = cn(
  'transition-transform duration-instant hover:-translate-y-px',
  'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
);

/** Đề xuất: CHỈ viền 1px + badge nền `--accent-wash` (mục 6) — không nền màu, không băng. */
function PlanCard({ plan }: { readonly plan: BillingPlanCard }) {
  return (
    <div
      className={cn(
        'flex h-full flex-col justify-between rounded-2xl border bg-bg-surface p-7',
        plan.isRecommended ? RECOMMENDED_CARD_CLASS : DEFAULT_CARD_CLASS,
        CARD_HOVER_CLASS,
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[17px] font-semibold text-text-primary">{plan.name}</h3>
          {plan.isRecommended && (
            <span className="inline-flex h-[22px] items-center rounded-[6px] bg-accent-wash px-2 text-[13px] font-medium text-accent">
              Đề xuất
            </span>
          )}
        </div>
        <div>
          <p className="font-mono text-[20px] font-semibold tabular-nums text-text-primary">{plan.priceLabel}</p>
          <p className="text-[13px] text-text-secondary">{plan.unitLabel}</p>
        </div>
        <div className="h-px bg-border-default" />
        <ul className="flex flex-col gap-2.5">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-[14px] text-text-primary">
              <Check size={18} className="shrink-0 text-text-secondary" aria-hidden="true" />
              {feature}
            </li>
          ))}
        </ul>
      </div>
      <Button variant="secondary" onClick={plan.onSelect} disabled={plan.isActionDisabled} fullWidth className="mt-6">
        {plan.actionLabel}
      </Button>
    </div>
  );
}

function PlanCardsSkeleton() {
  return (
    <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-3">
      {['one', 'two', 'three'].map((slot) => (
        <div key={slot} className="h-[360px] rounded-2xl border border-border-default bg-bg-surface p-7">
          <Skeleton preset="project-card" />
        </div>
      ))}
    </div>
  );
}

export interface PlanComparisonProps {
  readonly period: BillingPeriod;
  readonly periodOptions: readonly { readonly label: string; readonly value: BillingPeriod }[];
  readonly onPeriodChange: (period: BillingPeriod) => void;
  readonly plans: readonly BillingPlanCard[];
  readonly degradedMessage: string | null;
  readonly isLoading: boolean;
}

/** Dải rộng tối đa 1120 — các khối khác 960 (bố cục). SegmentedControl kỳ thanh toán đặt trên. */
export function PlanComparison({
  period,
  periodOptions,
  onPeriodChange,
  plans,
  degradedMessage,
  isLoading,
}: PlanComparisonProps) {
  return (
    <section className="flex w-full max-w-[1120px] flex-col items-center gap-4">
      {degradedMessage !== null && <InlineAlert level="attention" message={degradedMessage} className="w-full" />}
      <h2 className="w-full text-[20px] font-semibold text-text-primary">So sánh gói</h2>
      <SegmentedControl
        options={[...periodOptions]}
        value={period}
        onChange={onPeriodChange}
        aria-label="Kỳ thanh toán"
      />
      {isLoading ? (
        <PlanCardsSkeleton />
      ) : (
        <div className="grid w-full grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </section>
  );
}
