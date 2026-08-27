/**
 * Màn `ROUTES.billing` — hạn mức, so sánh gói, ước tính chi phí, hoá đơn.
 *
 * View thuần (R-60): mọi thứ vẽ ra đến từ `BillingScreenProps`, không store,
 * không mạng, không `Date`, không định dạng số. Kiểu dưới đây là bản chép song
 * song của CONTRACT.md mục 2 — `useBillingScreen.ts` (T5) chép bản còn lại; T7
 * gộp hai bản bằng `import type` ở lượt tích hợp.
 *
 * Bốn khối (quota/plans/estimate/invoices) và hộp thoại xác nhận tách thành
 * file anh em trong CHÍNH thư mục này (mục D, R-22: view vượt trần 400 dòng),
 * mỗi file mượn lại kiểu ở đây bằng `import type` — một nguồn duy nhất, không
 * chép kiểu lần thứ hai.
 */

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { cn } from '@/lib/utils';

import { CollapsedQuota, QuotaCard } from './QuotaCard';
import { PlanComparison } from './PlanComparison';
import { EstimateBlock } from './EstimateBlock';
import { InvoiceTableSection } from './InvoiceTable';
import { ConfirmUpgradeDialog } from './ConfirmUpgradeDialog';

export type BillingPeriod = 'monthly' | 'yearly';
export type QuotaTone = 'normal' | 'attention';
export type InvoiceStatus = 'paid' | 'pending' | 'overdue';
export type BillingBlock = 'quota' | 'plans' | 'estimate' | 'invoices';
export type BillingScreenState =
  | 'empty' | 'loading' | 'partial' | 'error' | 'ready' | 'forbidden' | 'collapsed';

export interface BillingLabelledValue {
  readonly label: string;
  readonly value: string;
}

export interface BillingCurrentPlan {
  readonly name: string;
  /** ĐÃ định dạng: "1.842 / 5.000 m² đã số hoá trong chu kỳ này" */
  readonly usageLabel: string;
  /** 0..1, gateway trả sẵn. View chỉ nhân với 100 để ra bề rộng. Không phép chia nào trong màn. */
  readonly usedRatio: number;
  readonly tone: QuotaTone;
  /** ĐÃ định dạng qua P-02: "Gia hạn ngày 27/09/2026" */
  readonly renewLabel: string;
  readonly canChangePlan: boolean;
}

export interface BillingPlanCard {
  readonly id: string;
  readonly name: string;
  /** ĐÃ định dạng qua formatMoney: "1.240.000 ₫". Đây là chuỗi chạy số. */
  readonly priceLabel: string;
  readonly unitLabel: string;
  /** ĐÚNG sáu dòng. */
  readonly features: readonly string[];
  readonly isRecommended: boolean;
  readonly isCurrent: boolean;
  readonly actionLabel: string;
  readonly isActionDisabled: boolean;
  readonly onSelect: () => void;
}

export interface BillingEstimate {
  /**
   * ĐÚNG năm mảnh: [văn xuôi, đơn giá thị trường, văn xuôi, chi phí sản phẩm, văn xuôi].
   * Chia năm mảnh để view đặt chữ đều lên mảnh 1 và 3 (0-based: sentence[1], sentence[3])
   * mà KHÔNG nối chuỗi (A15).
   */
  readonly sentence: readonly [string, string, string, string, string];
  /** ĐÚNG ba dòng: diện tích tháng này · đơn giá · tạm tính. */
  readonly rows: readonly [BillingLabelledValue, BillingLabelledValue, BillingLabelledValue];
}

export interface BillingInvoiceRow {
  readonly id: string;
  readonly codeLabel: string;
  readonly periodLabel: string;
  readonly areaLabel: string;
  readonly amountLabel: string;
  readonly status: InvoiceStatus;
  readonly statusLabel: string;
  readonly downloadLabel: string;
  readonly onDownload: () => void;
}

export interface BillingInvoicePage {
  readonly index: number;
  readonly count: number;
  readonly label: string;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}

export interface BillingConfirmSummary {
  readonly title: string;
  readonly rows: readonly BillingLabelledValue[];
  readonly confirmLabel: string;
  readonly cancelLabel: string;
}

export interface BillingDegradedNotice {
  readonly block: BillingBlock;
  readonly message: string;
}

export interface BillingErrorNotice {
  readonly message: string;
  readonly code: string;
  readonly retryLabel: string;
  readonly onRetry: () => void;
}

export interface BillingScreenProps {
  readonly state: BillingScreenState;
  readonly isReadOnly: boolean;
  readonly readOnlyNotice: string | null;
  readonly plan: BillingCurrentPlan | null;
  readonly quotaAlert: { readonly message: string } | null;
  readonly period: BillingPeriod;
  readonly periodOptions: readonly { readonly label: string; readonly value: BillingPeriod }[];
  readonly onPeriodChange: (period: BillingPeriod) => void;
  readonly plans: readonly BillingPlanCard[];
  readonly estimate: BillingEstimate | null;
  readonly invoices: readonly BillingInvoiceRow[];
  readonly invoicePage: BillingInvoicePage;
  readonly degraded: readonly BillingDegradedNotice[];
  readonly error: BillingErrorNotice | null;
  readonly confirm: BillingConfirmSummary | null;
  readonly onChangePlanRequest: () => void;
  readonly onConfirmDismiss: () => void;
  readonly onConfirmAccept: () => void;
}

const BLOCK_WIDTH_CLASS = 'w-full max-w-[960px]';
const CARD_SURFACE_CLASS = cn(BLOCK_WIDTH_CLASS, 'rounded-xl bg-bg-surface p-6');

function degradedMessageFor(degraded: readonly BillingDegradedNotice[], block: BillingBlock): string | null {
  return degraded.find((notice) => notice.block === block)?.message ?? null;
}

export function BillingScreen({
  state,
  isReadOnly,
  readOnlyNotice,
  plan,
  quotaAlert,
  period,
  periodOptions,
  onPeriodChange,
  plans,
  estimate,
  invoices,
  invoicePage,
  degraded,
  error,
  confirm,
  onChangePlanRequest,
  onConfirmDismiss,
  onConfirmAccept,
}: BillingScreenProps) {
  const isCollapsed = state === 'collapsed';
  const isLoading = state === 'loading';
  const isEmptyInvoices = state === 'empty';
  const isError = state === 'error';

  return (
    <div className="min-h-full w-full bg-bg-app py-10">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center gap-6 px-6">
        <h1 className={cn(BLOCK_WIDTH_CLASS, 'text-[24px] font-semibold text-text-primary')}>Thanh toán</h1>

        {isReadOnly && readOnlyNotice !== null && (
          <p className={cn(BLOCK_WIDTH_CLASS, 'text-[13px] text-text-secondary')}>{readOnlyNotice}</p>
        )}

        {isError && error !== null ? (
          <section className={CARD_SURFACE_CLASS}>
            <InlineAlert
              level="violation"
              message={error.message}
              action={{ label: error.retryLabel, onClick: error.onRetry }}
            />
            <p className="mt-2 font-mono text-[12px] text-text-muted">{error.code}</p>
          </section>
        ) : isCollapsed ? (
          plan !== null && <CollapsedQuota plan={plan} />
        ) : (
          <>
            {plan !== null && (
              <QuotaCard
                plan={plan}
                alertMessage={quotaAlert?.message ?? null}
                degradedMessage={degradedMessageFor(degraded, 'quota')}
                isReadOnly={isReadOnly}
                onChangePlanRequest={onChangePlanRequest}
              />
            )}
            <PlanComparison
              period={period}
              periodOptions={periodOptions}
              onPeriodChange={onPeriodChange}
              plans={plans}
              degradedMessage={degradedMessageFor(degraded, 'plans')}
              isLoading={isLoading}
            />
            {estimate !== null && (
              <EstimateBlock estimate={estimate} degradedMessage={degradedMessageFor(degraded, 'estimate')} />
            )}
            <InvoiceTableSection
              invoices={invoices}
              invoicePage={invoicePage}
              degradedMessage={degradedMessageFor(degraded, 'invoices')}
              isLoading={isLoading}
              isEmpty={isEmptyInvoices}
            />
          </>
        )}
      </div>

      <ConfirmUpgradeDialog confirm={confirm} onConfirmDismiss={onConfirmDismiss} onConfirmAccept={onConfirmAccept} />
    </div>
  );
}
