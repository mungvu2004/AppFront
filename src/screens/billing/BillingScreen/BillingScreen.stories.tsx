/**
 * Màn `ROUTES.billing` trong bảy trạng thái của bất biến A11 — R-63.
 *
 * Mọi story dựng {@link BillingScreen} — view thuần — chứ không dựng
 * `BillingScreenContainer`: không truy vấn, không phiên đăng nhập, không router.
 * Đó là toàn bộ lý do mục D chia màn làm hai.
 *
 * **Không một con số nào viết tay ở đây.** Lệnh của người duyệt (hợp đồng mục 0)
 * nói mọi con số sống trong đúng một bảng dữ liệu có kiểu ở `billingGateway.ts`,
 * và cấm chuỗi tiền hay diện tích viết thẳng vào hook, view **hay story**. Nên
 * file này đọc một ảnh chụp thật của cổng ở cấp module rồi định dạng bằng đúng
 * những hàm hook dùng — `formatMoney`, `formatArea`, `formatNumber`,
 * `formatCalendarDate`. Đổi giá gói trong bảng dữ liệu là bảy story đổi theo,
 * không ai phải sửa file này.
 *
 * Phần văn xuôi thì chép tay từ bảng chuỗi của hợp đồng mục 5: story là minh
 * hoạ, và minh hoạ được phép nói lại câu của mình. Con số thì không.
 *
 * `BillingScreen.test.tsx` cố ý KHÔNG nhập lại file này: bộ kiểm dẫn bảy `props`
 * của nó ra từ `createSevenStateScenarios()`, nên bộ kịch bản chung đổi hình thì
 * bộ kiểm đỏ — còn story thì minh hoạ.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { describeError, toAppError } from '@/lib/errors';
import { formatCalendarDate } from '@/lib/format/datetime';
import { formatArea } from '@/lib/format/measure';
import { formatNumber, type NumberFormatOptions } from '@/lib/format/number';

import { BillingScreen } from './BillingScreen';
import type {
  BillingCurrentPlan,
  BillingEstimate,
  BillingInvoicePage,
  BillingInvoiceRow,
  BillingPlanCard,
  BillingScreenProps,
} from './BillingScreen';
import { createBillingGateway, type BillingPeriod, type BillingSnapshot } from './billingGateway';
import { formatMoney, INVOICE_PAGE_SIZE, QUOTA_ATTENTION_THRESHOLD } from './useBillingScreen';

const meta = {
  title: 'Screens/Billing/BillingScreen',
  component: BillingScreen,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof BillingScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = (): void => undefined;

/* -------------------------------------------------------------------------- */
/* Nguồn số: một ảnh chụp thật của cổng, đọc một lần lúc nạp module.           */
/* -------------------------------------------------------------------------- */

const PERIOD: BillingPeriod = 'monthly';

const snapshot: BillingSnapshot = await createBillingGateway().read(PERIOD);

/** Nửa đường từ ngưỡng "cần chú ý" tới đầy — một cảnh dẫn ra, không một con số chọn tay. */
const ATTENTION_MIDPOINT = QUOTA_ATTENTION_THRESHOLD + (1 - QUOTA_ATTENTION_THRESHOLD) / 2;

const nearLimitSnapshot: BillingSnapshot = await createBillingGateway({
  quotaOverride: { digitisedAreaM2: Math.round(snapshot.quota.limitAreaM2 * ATTENTION_MIDPOINT) },
}).read(PERIOD);

/** Tiền Việt không có phần lẻ — cùng tuỳ chọn hook dùng cho mọi chuỗi số nguyên. */
const WHOLE: NumberFormatOptions = { fractionDigits: 0 };

/* -------------------------------------------------------------------------- */
/* Văn xuôi — bảng chuỗi của hợp đồng mục 5.                                   */
/* -------------------------------------------------------------------------- */

const USAGE_TAIL = ' đã số hoá trong chu kỳ này';
const RENEW_LEAD = 'Gia hạn ngày ';
const ALERT_LEAD = 'Sắp hết hạn mức. Còn ';
const RECALCULATING = 'Đang tính lại hạn mức.';
const INVOICES_UNAVAILABLE = 'Không lấy được lịch sử hoá đơn.';
const READ_ONLY_NOTICE = 'Chỉ quản trị viên có thể thay đổi gói.';
const CURRENT_ACTION = 'Gói hiện tại';
const UPGRADE_ACTION = 'Nâng gói';
const RANGE_SEPARATOR = ' – ';

const INVOICE_STATUS_LABELS = {
  paid: 'Đã thanh toán',
  pending: 'Chờ thanh toán',
  overdue: 'Quá hạn',
} as const;

/* -------------------------------------------------------------------------- */
/* Ảnh chụp → props. Cùng phép ghép hook làm, chỉ khác là ở đây nó tĩnh.       */
/* -------------------------------------------------------------------------- */

function currentPlanOf(source: BillingSnapshot, canChangePlan: boolean): BillingCurrentPlan {
  const { quota } = source;
  const isAttention = quota.usedRatio >= QUOTA_ATTENTION_THRESHOLD;

  return {
    name: source.plans.find((offer) => offer.id === source.currentPlanId)?.name ?? '',
    usageLabel: `${formatNumber(quota.digitisedAreaM2, WHOLE)} / ${formatArea(quota.limitAreaM2, WHOLE)}${USAGE_TAIL}`,
    usedRatio: quota.usedRatio,
    tone: isAttention ? 'attention' : 'normal',
    renewLabel: `${RENEW_LEAD}${formatCalendarDate(quota.renewsAt)}`,
    canChangePlan,
  };
}

function quotaAlertOf(source: BillingSnapshot): { readonly message: string } {
  const remaining = source.quota.limitAreaM2 - source.quota.digitisedAreaM2;

  return { message: `${ALERT_LEAD}${formatArea(remaining, WHOLE)}.` };
}

function planCardsOf(source: BillingSnapshot, isReadOnly: boolean): readonly BillingPlanCard[] {
  return source.plans.map((offer) => {
    const isCurrent = offer.id === source.currentPlanId;

    return {
      id: offer.id,
      name: offer.name,
      priceLabel: formatMoney(offer.priceVnd[PERIOD]),
      unitLabel: 'mỗi tháng',
      features: offer.features,
      isRecommended: offer.isRecommended,
      isCurrent,
      actionLabel: isCurrent ? CURRENT_ACTION : UPGRADE_ACTION,
      isActionDisabled: isCurrent || isReadOnly,
      onSelect: noop,
    };
  });
}

function estimateOf(source: BillingSnapshot): BillingEstimate {
  const { estimate } = source;

  return {
    sentence: [
      'Số hoá thủ công ngoài thị trường tốn khoảng ',
      `${formatNumber(estimate.marketUnitPriceMinVnd, WHOLE)}${RANGE_SEPARATOR}${formatMoney(estimate.marketUnitPriceMaxVnd)}`,
      ' mỗi m². AppFront tính ',
      formatMoney(estimate.ourUnitPriceVnd),
      ' mỗi m² cho phần diện tích đã số hoá.',
    ],
    rows: [
      { label: 'Diện tích tháng này', value: formatArea(estimate.areaM2, WHOLE) },
      { label: 'Đơn giá', value: formatMoney(estimate.ourUnitPriceVnd) },
      { label: 'Tạm tính', value: formatMoney(estimate.subtotalVnd) },
    ],
  };
}

function invoiceRowsOf(source: BillingSnapshot): readonly BillingInvoiceRow[] {
  return source.invoices.slice(0, INVOICE_PAGE_SIZE).map((invoice) => ({
    id: invoice.id,
    codeLabel: invoice.code,
    periodLabel: `${formatCalendarDate(invoice.periodStart)}${RANGE_SEPARATOR}${formatCalendarDate(invoice.periodEnd)}`,
    areaLabel: formatArea(invoice.areaM2),
    amountLabel: formatMoney(invoice.amountVnd),
    status: invoice.status,
    statusLabel: INVOICE_STATUS_LABELS[invoice.status],
    downloadLabel: `Tải hoá đơn ${invoice.code} dạng PDF`,
    onDownload: noop,
  }));
}

function invoicePageOf(source: BillingSnapshot): BillingInvoicePage {
  const count = Math.max(1, Math.ceil(source.invoices.length / INVOICE_PAGE_SIZE));
  const firstPage = 1;

  return {
    index: firstPage,
    count,
    label: `Trang ${formatNumber(firstPage, WHOLE)} / ${formatNumber(count, WHOLE)}`,
    onPrevious: noop,
    onNext: noop,
  };
}

/** Mọi trường không đổi giữa bảy trạng thái, một chỗ. */
const BASE: BillingScreenProps = {
  state: 'ready',
  isReadOnly: false,
  readOnlyNotice: null,
  plan: currentPlanOf(snapshot, true),
  quotaAlert: null,
  period: PERIOD,
  periodOptions: [
    { label: 'Theo tháng', value: 'monthly' },
    { label: 'Theo năm', value: 'yearly' },
  ],
  onPeriodChange: noop,
  plans: planCardsOf(snapshot, false),
  estimate: estimateOf(snapshot),
  invoices: invoiceRowsOf(snapshot),
  invoicePage: invoicePageOf(snapshot),
  degraded: [],
  error: null,
  confirm: null,
  onChangePlanRequest: noop,
  onConfirmDismiss: noop,
  onConfirmAccept: noop,
};

/** Lỗi của trạng thái 4 phân loại qua đúng đường hook đi — L-03, không bịa mã. */
const SAMPLE_FAILURE = toAppError(new Error('network: fetch failed'));

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái.                                                             */
/* -------------------------------------------------------------------------- */

/** 1 — rỗng: chưa có hoá đơn nào. Ba khối trên vẫn đầy đủ (hợp đồng mục 4). */
export const Empty: Story = {
  args: {
    ...BASE,
    state: 'empty',
    invoices: [],
    invoicePage: { ...BASE.invoicePage, count: 1 },
  },
};

/** 2 — đang tải: tám dòng khung xương bảng, cộng ba thẻ gói khung xương. */
export const Loading: Story = {
  args: { ...BASE, state: 'loading' },
};

/** 3 — một phần: hạn mức đang tính lại và mất lịch sử hoá đơn; khối 2, 3 vẫn đủ. */
export const Partial: Story = {
  args: {
    ...BASE,
    state: 'partial',
    degraded: [
      { block: 'quota', message: RECALCULATING },
      { block: 'invoices', message: INVOICES_UNAVAILABLE },
    ],
    invoices: [],
  },
};

/** 4 — lỗi: câu nêu lý do, mã chữ đều nhỏ, và một nút thử lại. */
export const ErrorState: Story = {
  args: {
    ...BASE,
    state: 'error',
    error: {
      message: describeError(SAMPLE_FAILURE).description,
      code: SAMPLE_FAILURE.code,
      retryLabel: 'Thử lại',
      onRetry: noop,
    },
  },
};

/** 5 — xong: đủ bốn khối, hạn mức đã qua ngưỡng nên khối 1 kèm dải cảnh báo. */
export const Ready: Story = {
  args: {
    ...BASE,
    plan: currentPlanOf(nearLimitSnapshot, true),
    quotaAlert: quotaAlertOf(nearLimitSnapshot),
  },
};

/** 6 — không có quyền: toàn bộ ở chế độ đọc, không khối nào bị ẩn. */
export const Forbidden: Story = {
  args: {
    ...BASE,
    state: 'forbidden',
    isReadOnly: true,
    readOnlyNotice: READ_ONLY_NOTICE,
    plan: currentPlanOf(snapshot, false),
    plans: planCardsOf(snapshot, true),
  },
};

/** 7 — thu gọn: tên gói, `usageLabel`, thanh hạn mức — không gì khác. */
export const Collapsed: Story = {
  args: { ...BASE, state: 'collapsed' },
};
