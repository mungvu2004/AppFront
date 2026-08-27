/**
 * Khối 1 — Gói hiện tại. File anh em của `BillingScreen.tsx` (mục D, R-22):
 * view vượt trần 400 dòng nên phần này tách ra, kiểu mượn bằng `import type`
 * từ view chính — một nguồn duy nhất cho hợp đồng mục 2.
 */
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { motion } from '@/components/motion';
import { Button } from '@/components/ui/Button';
import { durationSeconds } from '@/lib/motion';
import { cn } from '@/lib/utils';

import type { BillingCurrentPlan } from './BillingScreen';

const CARD_SURFACE_CLASS = 'w-full max-w-[960px] rounded-xl bg-bg-surface p-6';

/** Rãnh thanh `--bg-sunken`, phần đầy `--accent`, chạy 0 → usedRatio trong `durationMs('slow')` (Q5). */
function QuotaBar({ plan }: { readonly plan: BillingCurrentPlan }) {
  const widthPercent = plan.usedRatio * 100;

  return (
    <div
      className="h-[6px] w-full overflow-hidden rounded-full bg-bg-sunken"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(widthPercent)}
      aria-label={plan.usageLabel}
    >
      <motion.div
        className="h-full rounded-full bg-accent"
        initial={{ width: 0 }}
        animate={{ width: `${widthPercent}%` }}
        transition={{ duration: durationSeconds('slow') }}
      />
    </div>
  );
}

export interface QuotaCardProps {
  readonly plan: BillingCurrentPlan;
  readonly alertMessage: string | null;
  readonly degradedMessage: string | null;
  readonly isReadOnly: boolean;
  readonly onChangePlanRequest: () => void;
}

export function QuotaCard({ plan, alertMessage, degradedMessage, isReadOnly, onChangePlanRequest }: QuotaCardProps) {
  const usageToneClass = plan.tone === 'attention' ? 'text-state-attention-text' : 'text-text-secondary';

  return (
    <section className={CARD_SURFACE_CLASS}>
      {degradedMessage !== null && <InlineAlert level="attention" message={degradedMessage} className="mb-4" />}
      <p className="text-[13px] font-medium text-text-secondary">Gói hiện tại</p>
      <div className="mt-1 flex items-center justify-between gap-4">
        <h2 className="text-[20px] font-semibold text-text-primary">{plan.name}</h2>
        <Button variant="ghost" onClick={onChangePlanRequest} disabled={isReadOnly || !plan.canChangePlan}>
          Đổi gói
        </Button>
      </div>
      <p className={cn('mt-2 text-[14px]', usageToneClass)}>{plan.usageLabel}</p>
      <div className="mt-3">
        <QuotaBar plan={plan} />
      </div>
      <p className="mt-2 text-[13px] text-text-muted">{plan.renewLabel}</p>
      {alertMessage !== null && <InlineAlert level="attention" message={alertMessage} className="mt-4" />}
    </section>
  );
}

/** Trạng thái Thu gọn (#7): tên gói + usageLabel + thanh hạn mức — không gì khác. */
export function CollapsedQuota({ plan }: { readonly plan: BillingCurrentPlan }) {
  return (
    <section className={CARD_SURFACE_CLASS}>
      <h2 className="text-[18px] font-semibold text-text-primary">{plan.name}</h2>
      <p className="mt-2 text-[14px] text-text-secondary">{plan.usageLabel}</p>
      <div className="mt-3">
        <QuotaBar plan={plan} />
      </div>
    </section>
  );
}
