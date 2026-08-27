/**
 * Màn thanh toán (`billing`): nó đọc gì, nó nói gì, bấm vào thì chuyện gì xảy ra.
 *
 * Mục D chia đôi: file này giữ trạng thái và mọi phép suy luận, `BillingScreen.tsx`
 * chỉ vẽ. Mọi trường `*Label` ra khỏi đây đã là chuỗi tiếng Việt hoàn chỉnh, nên view
 * không còn một con số nào để làm tròn, đổi đơn vị hay ghép sai (A15). Không thứ nào
 * dưới đây được dựng lại: trạng thái máy chủ đi qua `@tanstack/react-query` (R-64),
 * định dạng qua `src/lib/format`, chạy số qua `useCountUp` (260 ms, hợp đồng Q4), màu
 * ngưỡng qua {@link billingQuotaFillToken} (P-07/Q8), lỗi qua `toAppError` +
 * `describeError` (L-03) với `code` lấy thẳng từ `AppError.code`.
 *
 * **Nợ T-10 — quyền.** `permissionMatrix` không có `PermissionKey` nào cho billing và
 * `src/lib/auth/permissions.ts` là file cấm sửa (R-68), nên `can()` không tra được gì
 * và vai quản trị đọc thẳng từ `useSession().roles`. Lượt logic riêng T-10 thêm khoá
 * `billing.manage` vào ma trận rồi đổi đúng một biểu thức dưới đây.
 */

import { useCallback, useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCountUp, type UseCountUpOptions } from '@/hooks/useCountUp';
import { useSession } from '@/hooks/useSession';
import { createLookupScale } from '@/lib/coloring/scales';
import { describeError, toAppError } from '@/lib/errors';
import { formatCalendarDate } from '@/lib/format/datetime';
import { formatArea } from '@/lib/format/measure';
import {
  formatNumber, isFormattable, MISSING_VALUE, type MaybeNumber, type NumberFormatOptions,
} from '@/lib/format/number';
import { getAppAnnouncer, type Announcer } from '@/lib/input/announcer';

import {
  createBillingGateway, type BillingGateway, type BillingInvoice, type BillingPeriod,
  type BillingPlanOffer, type InvoiceStatus, type QuotaTone,
} from './billingGateway';

/** Ba union của hợp đồng mục 2 khai ở tầng dữ liệu; xuất lại để cả bộ kiểu ở một chỗ
 *  mà repo vẫn chỉ có MỘT định nghĩa cho mỗi cái. */
export type { BillingPeriod, InvoiceStatus, QuotaTone } from './billingGateway';

/* -- View model: chép song song từ hợp đồng mục 2. `BillingScreen.tsx` khai LẠI đúng
      khối này dưới tên `BillingScreenProps`; T7 gộp hai bản làm một `import type`. -- */

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
  /** ĐÚNG năm mảnh: [văn xuôi, đơn giá thị trường, văn xuôi, chi phí sản phẩm, văn xuôi].
   *  Chia năm mảnh để view đặt chữ đều lên mảnh 1 và 3 mà KHÔNG nối chuỗi (A15). */
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

export interface BillingScreenViewModel {
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

/* -- Chuỗi tiếng Việt: nguồn duy nhất, hợp đồng mục 5. Chữ thường, kiểu câu (A6);
      ngoại lệ chữ hoa là mã hoá đơn, thứ do dữ liệu mang tới. -------------------- */

const STRINGS = Object.freeze({
  usage: (used: string, limit: string) => `${used} / ${limit} đã số hoá trong chu kỳ này`,
  renew: (date: string) => `Gia hạn ngày ${date}`,
  quotaAlert: (remaining: string) => `Sắp hết hạn mức. Còn ${remaining}.`,
  quotaRecalculating: 'Đang tính lại hạn mức.',
  invoicesUnavailable: 'Không lấy được lịch sử hoá đơn.',
  readOnlyNotice: 'Chỉ quản trị viên có thể thay đổi gói.',
  currentPlanAction: 'Gói hiện tại',
  upgradeAction: 'Nâng gói',
  changePlanHint: 'Bảng so sánh gói ở ngay bên dưới, chọn một gói để nâng.',
  estimateLead: 'Số hoá thủ công ngoài thị trường tốn khoảng ',
  estimateMiddle: ' mỗi m². AppFront tính ',
  estimateTail: ' mỗi m² cho phần diện tích đã số hoá.',
  estimateAreaRow: 'Diện tích tháng này',
  estimateUnitRow: 'Đơn giá',
  estimateSubtotalRow: 'Tạm tính',
  invoicePeriod: (from: string, to: string) => `${from} – ${to}`,
  invoiceDownload: (code: string) => `Tải hoá đơn ${code} dạng PDF`,
  pageLabel: (index: string, count: string) => `Trang ${index} / ${count}`,
  confirmTitle: 'Xác nhận nâng gói',
  confirmPlanRow: 'Gói mới',
  confirmRemainingRow: 'Phần còn lại của chu kỳ',
  confirmDueRow: 'Thanh toán ngay',
  confirmCancel: 'Huỷ',
  dayUnit: (days: string) => `${days} ngày`,
  retry: 'Thử lại',
});

const INVOICE_STATUS_LABELS: Readonly<Record<InvoiceStatus, string>> = Object.freeze({
  paid: 'Đã thanh toán', pending: 'Chờ thanh toán', overdue: 'Quá hạn',
});

const PERIOD_UNIT_LABELS: Readonly<Record<BillingPeriod, string>> = Object.freeze({
  monthly: 'mỗi tháng', yearly: 'mỗi năm',
});

const PERIOD_OPTIONS: readonly { readonly label: string; readonly value: BillingPeriod }[] =
  Object.freeze([{ label: 'Theo tháng', value: 'monthly' }, { label: 'Theo năm', value: 'yearly' }]);

/* -- Hằng số có tên — R-71: không con số trần nào nằm rải trong thân hàm. ------ */

/**
 * Khoá bộ đệm, dựng tại chỗ chứ không lấy từ `queryKeys`: bảng đó có 10 nhánh và không
 * nhánh nào là `billing`, mà `src/lib` là thư mục cấm sửa (`data.md` mục 1.1 và 1.5).
 * Thời gian sống để mặc định của `createQueryClient` — R-71 cấm màn tự đặt số mới.
 */
export const billingQueryKey = (period: BillingPeriod) => ['billing', period] as const;

/** Ngưỡng sang sắc thái "cần chú ý". Đọc `usedRatio` gateway tính sẵn: một phép SO
 *  SÁNH, không phải một phép chia trong màn. */
export const QUOTA_ATTENTION_THRESHOLD = 0.8;

/** Số dòng mỗi trang của bảng hoá đơn. 24 hoá đơn mock ⇒ ba trang. */
export const INVOICE_PAGE_SIZE = 10;

/**
 * Màu phần đầy của thanh hạn mức — P-07/Q8, `data.md` mục 5. `createLookupScale` chứ
 * không `createQuantileScale`: `QuotaTone` là tập hợp cố định hai trường hợp, không
 * phải một dải số cần cắt phân vị. Xuất ra để view gọi với `plan.tone` — hook lẫn view
 * đều không được chọn màu bằng tay, và hợp đồng mục 2 không có trường mang token đi.
 */
export const billingQuotaFillToken = createLookupScale<QuotaTone>({
  normal: '--accent',
  attention: '--state-attention-tint',
});

/**
 * `DEFAULT_PERIOD` — hợp đồng mục 5 đặt `Theo tháng` trước. `WHOLE` — tiền Việt không có
 * phần lẻ, cùng tuỳ chọn cho chuỗi tĩnh lẫn từng khung chạy số. `MONEY_SUFFIX` — hậu tố
 * viết một lần, `formatMoney` và nhãn giá đang chạy dùng chung. `RANGE_SEPARATOR` —
 * gạch ngang en, không phải dấu trừ. `PLAN_COUNT_UP_SLOTS` — ba ô chạy số dựng sẵn cho
 * ĐÚNG ba thẻ gói của hợp đồng mục 4. Hai mảng rỗng đóng băng giữ tham chiếu ổn định
 * cho memo trong lúc truy vấn chưa về.
 */
const DEFAULT_PERIOD: BillingPeriod = 'monthly';
const WHOLE: NumberFormatOptions = Object.freeze({ fractionDigits: 0 });
const MONEY_SUFFIX = ' ₫';
const RANGE_SEPARATOR = ' – ';
const PLAN_COUNT_UP_SLOTS = 3;
const COUNT_UP_MONEY: UseCountUpOptions = Object.freeze({ format: WHOLE });
const EMPTY_OFFERS: readonly BillingPlanOffer[] = Object.freeze([]);
const EMPTY_INVOICES: readonly BillingInvoice[] = Object.freeze([]);

/**
 * Tiền Việt. Nợ P-01b: `src/lib/format` chưa có hàm tiền tệ và `src/lib` là thư mục cấm
 * sửa (R-68). Đúng khuôn `formatArea`: `formatNumber` lo chữ số, hậu tố ghép ở đây —
 * tầng viewmodel là chỗ A15 chỉ định. Lượt riêng P-01b đưa hàm này vào
 * `src/lib/format/number.ts` rồi xoá bản ở đây.
 */
export function formatMoney(amountVnd: MaybeNumber): string {
  return isFormattable(amountVnd) ? `${formatNumber(amountVnd, WHOLE)}${MONEY_SUFFIX}` : MISSING_VALUE;
}

export interface UseBillingScreenOptions {
  /** Nguồn dữ liệu. Mặc định là cổng thật; test tiêm hạt giống để dựng bảy trạng thái. */
  readonly gateway?: BillingGateway;
  /** Bộ đọc màn hình, tiêm vào để soát rằng nút "Đổi gói" nói ra được điều nó làm. */
  readonly announcer?: Announcer;
  /** Story/test bật tay trạng thái thu gọn; lúc chạy thật CSS lo phần dưới 1024. */
  readonly forceCollapsed?: boolean;
}

export function useBillingScreen(options: UseBillingScreenOptions = {}): BillingScreenViewModel {
  const session = useSession();
  const queryClient = useQueryClient();

  const [gateway] = useState(() => options.gateway ?? createBillingGateway());
  const [period, setPeriod] = useState<BillingPeriod>(DEFAULT_PERIOD);
  const [pageIndex, setPageIndex] = useState(0);

  // `keepPreviousData` là điều kiện để hợp đồng mục 7 chạy được: đổi kỳ là đổi khoá, và
  // không có nó thì màn về khung xương, thẻ gói dựng lại, giá NHẢY thay vì chạy tới.
  const snapshotQuery = useQuery({
    queryKey: billingQueryKey(period),
    queryFn: () => gateway.read(period),
    placeholderData: keepPreviousData,
  });

  const snapshot = snapshotQuery.data;
  const quota = snapshot?.quota ?? null;
  const offers = snapshot?.plans ?? EMPTY_OFFERS;
  const invoices = snapshot?.invoices ?? EMPTY_INVOICES;

  // Quyền: nợ T-10, xem đầu file.
  const canChangePlan = session.roles.includes('admin');
  const isReadOnly = !canChangePlan;

  // Ba lượt gọi máy chủ. `confirmChangePlan` chỉ chạy sau hộp thoại xác nhận (A9).
  const quoteMutation = useMutation({
    mutationFn: (planId: string) => gateway.quoteChangePlan(planId, period),
  });

  const confirmMutation = useMutation({
    mutationFn: (planId: string) => gateway.confirmChangePlan(planId, period),
    onSuccess: async () => {
      quoteMutation.reset();
      // `invalidationMap` là bảng đóng, không có `changePlan` (`data.md` mục 1.3).
      await queryClient.invalidateQueries({ queryKey: billingQueryKey(period) });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: (invoiceId: string) => gateway.downloadInvoice(invoiceId),
  });

  const quote = quoteMutation.data;
  const isChanging = quoteMutation.isPending || confirmMutation.isPending;

  // Giá chạy số sang giá của kỳ mới, 260 ms (hợp đồng Q4 và mục 7).
  // `useCountUp` là một hook: số lời gọi phải cố định giữa các lượt vẽ, nên ba ô dựng sẵn
  // theo đúng ba thẻ của hợp đồng. Gói thứ tư trở đi vẫn hiện đúng giá, chỉ không chạy.
  const firstPrice = useCountUp(offers[0]?.priceVnd[period] ?? 0, COUNT_UP_MONEY);
  const secondPrice = useCountUp(offers[1]?.priceVnd[period] ?? 0, COUNT_UP_MONEY);
  const thirdPrice = useCountUp(offers[2]?.priceVnd[period] ?? 0, COUNT_UP_MONEY);

  const selectPlan = useCallback((planId: string): void => {
    // Vai không đổi được gói thì cú bấm không thành lượt gọi máy chủ, kể cả khi view quên.
    if (!canChangePlan) return;
    quoteMutation.mutate(planId);
  }, [canChangePlan, quoteMutation]);

  // Nút "Đổi gói" của khối 1 KHÔNG chọn gói thay người dùng: bước chọn là lý do khối 2
  // tồn tại. Ở tầng logic nó nói ra bước tiếp theo cho trình đọc màn hình; cuộn và
  // chuyển tiêu điểm thuộc về view, nơi giữ DOM.
  const announcer = options.announcer;

  const onChangePlanRequest = useCallback((): void => {
    (announcer ?? getAppAnnouncer()).announce(STRINGS.changePlanHint);
  }, [announcer]);

  const onConfirmDismiss = useCallback((): void => {
    quoteMutation.reset();
  }, [quoteMutation]);

  const onConfirmAccept = useCallback((): void => {
    if (quote === undefined) return;
    confirmMutation.mutate(quote.planId);
  }, [quote, confirmMutation]);

  // Thử lại đúng thứ vừa hỏng, không phải luôn luôn tải lại cả màn.
  const onRetry = useCallback((): void => {
    const { variables: confirmed } = confirmMutation;
    const { variables: quoted } = quoteMutation;
    const { variables: downloaded } = downloadMutation;
    if (confirmMutation.isError && confirmed !== undefined) confirmMutation.mutate(confirmed);
    else if (quoteMutation.isError && quoted !== undefined) quoteMutation.mutate(quoted);
    else if (downloadMutation.isError && downloaded !== undefined) downloadMutation.mutate(downloaded);
    else void snapshotQuery.refetch();
  }, [confirmMutation, quoteMutation, downloadMutation, snapshotQuery]);

  /* -- Khối 1: gói hiện tại. -- */
  const tone: QuotaTone =
    quota !== null && quota.usedRatio >= QUOTA_ATTENTION_THRESHOLD ? 'attention' : 'normal';

  const plan = useMemo<BillingCurrentPlan | null>(() => {
    if (quota === null) return null;
    return {
      name: offers.find((offer) => offer.id === snapshot?.currentPlanId)?.name ?? MISSING_VALUE,
      usageLabel: STRINGS.usage(formatNumber(quota.digitisedAreaM2, WHOLE), formatArea(quota.limitAreaM2, WHOLE)),
      usedRatio: quota.usedRatio,
      tone,
      renewLabel: STRINGS.renew(formatCalendarDate(quota.renewsAt)),
      canChangePlan,
    };
  }, [quota, offers, snapshot?.currentPlanId, tone, canChangePlan]);

  const quotaAlert = useMemo<{ readonly message: string } | null>(() => {
    if (quota === null || tone !== 'attention') return null;
    // Phép TRỪ hai số cùng đơn vị m², không phải quy đổi: gateway không có trường này.
    return { message: STRINGS.quotaAlert(formatArea(quota.limitAreaM2 - quota.digitisedAreaM2, WHOLE)) };
  }, [quota, tone]);

  /* -- Khối 2: ba thẻ gói. -- */
  const plans = useMemo<readonly BillingPlanCard[]>(() => {
    const runningTexts = [firstPrice.text, secondPrice.text, thirdPrice.text];
    return offers.map((offer, index) => {
      const isCurrent = offer.id === snapshot?.currentPlanId;
      const runningText = index < PLAN_COUNT_UP_SLOTS ? runningTexts[index] : undefined;

      return {
        id: offer.id,
        name: offer.name,
        priceLabel:
          runningText === undefined
            ? formatMoney(offer.priceVnd[period])
            : `${runningText}${MONEY_SUFFIX}`,
        unitLabel: PERIOD_UNIT_LABELS[period],
        features: offer.features,
        isRecommended: offer.isRecommended,
        isCurrent,
        actionLabel: isCurrent ? STRINGS.currentPlanAction : STRINGS.upgradeAction,
        isActionDisabled: isCurrent || !canChangePlan || isChanging,
        onSelect: () => { selectPlan(offer.id); },
      };
    });
  }, [offers, period, snapshot?.currentPlanId, canChangePlan, isChanging, selectPlan,
    firstPrice.text, secondPrice.text, thirdPrice.text]);

  /* -- Khối 3: ước tính. Mọi con số đã tính sẵn ở nguồn, màn không nhân chia. -- */
  const estimate = useMemo<BillingEstimate | null>(() => {
    const data = snapshot?.estimate;
    if (data === undefined) return null;
    const market = `${formatNumber(data.marketUnitPriceMinVnd, WHOLE)}${RANGE_SEPARATOR}${formatMoney(data.marketUnitPriceMaxVnd)}`;

    return {
      sentence: [
        STRINGS.estimateLead, market, STRINGS.estimateMiddle,
        formatMoney(data.ourUnitPriceVnd), STRINGS.estimateTail,
      ],
      rows: [
        // Cùng con số với hạn mức khối 1 nên cùng độ chính xác: hai chữ số thập phân là
        // của diện tích HOÁ ĐƠN (hợp đồng mục 3), không của diện tích kỳ này.
        { label: STRINGS.estimateAreaRow, value: formatArea(data.areaM2, WHOLE) },
        { label: STRINGS.estimateUnitRow, value: formatMoney(data.ourUnitPriceVnd) },
        { label: STRINGS.estimateSubtotalRow, value: formatMoney(data.subtotalVnd) },
      ],
    };
  }, [snapshot?.estimate]);

  /* -- Khối 4: hoá đơn, 10 dòng một trang. -- */
  const pageCount = Math.max(1, Math.ceil(invoices.length / INVOICE_PAGE_SIZE));
  // Danh sách ngắn đi (đổi hạt giống, tải lại) không được để lại một trang trống.
  const safePageIndex = Math.min(pageIndex, pageCount - 1);

  const invoiceRows = useMemo<readonly BillingInvoiceRow[]>(() => {
    const start = safePageIndex * INVOICE_PAGE_SIZE;
    return invoices.slice(start, start + INVOICE_PAGE_SIZE).map((invoice) => ({
      id: invoice.id,
      codeLabel: invoice.code,
      periodLabel: STRINGS.invoicePeriod(formatCalendarDate(invoice.periodStart), formatCalendarDate(invoice.periodEnd)),
      areaLabel: formatArea(invoice.areaM2),
      amountLabel: formatMoney(invoice.amountVnd),
      status: invoice.status,
      statusLabel: INVOICE_STATUS_LABELS[invoice.status],
      downloadLabel: STRINGS.invoiceDownload(invoice.code),
      onDownload: () => { downloadMutation.mutate(invoice.id); },
    }));
  }, [invoices, safePageIndex, downloadMutation]);

  const invoicePage = useMemo<BillingInvoicePage>(() => ({
    index: safePageIndex + 1,
    count: pageCount,
    label: STRINGS.pageLabel(formatNumber(safePageIndex + 1, WHOLE), formatNumber(pageCount, WHOLE)),
    onPrevious: () => { setPageIndex(Math.max(0, safePageIndex - 1)); },
    onNext: () => { setPageIndex(Math.min(pageCount - 1, safePageIndex + 1)); },
  }), [safePageIndex, pageCount]);

  // Một phần: chỉ khối bị ảnh hưởng, phần còn lại vẫn đủ dữ liệu.
  const invoicesUnavailable = snapshot?.invoicesUnavailable === true;
  const isRecalculating = quota?.isRecalculating === true;

  const degraded = useMemo<readonly BillingDegradedNotice[]>(() => {
    const notices: BillingDegradedNotice[] = [];
    if (isRecalculating) notices.push({ block: 'quota', message: STRINGS.quotaRecalculating });
    if (invoicesUnavailable) notices.push({ block: 'invoices', message: STRINGS.invoicesUnavailable });
    return notices;
  }, [isRecalculating, invoicesUnavailable]);

  // L-03. `code` KHÔNG đi qua `describeError` (`data.md` mục 3).
  const failure =
    snapshotQuery.error ?? confirmMutation.error ?? quoteMutation.error ?? downloadMutation.error;

  const error = useMemo<BillingErrorNotice | null>(() => {
    if (failure === null) return null;
    const appError = toAppError(failure);
    return {
      message: describeError(appError).description,
      code: appError.code,
      retryLabel: STRINGS.retry,
      onRetry,
    };
  }, [failure, onRetry]);

  // Hộp thoại xác nhận (A9): có số tiền chia theo tỷ lệ trước khi gửi lệnh đi.
  const confirm = useMemo<BillingConfirmSummary | null>(() => {
    if (quote === undefined) return null;
    return {
      title: STRINGS.confirmTitle,
      rows: [
        { label: STRINGS.confirmPlanRow, value: quote.planName },
        { label: STRINGS.confirmRemainingRow, value: STRINGS.dayUnit(formatNumber(quote.remainingDays, WHOLE)) },
        { label: STRINGS.confirmDueRow, value: formatMoney(quote.dueNowVnd) },
      ],
      confirmLabel: STRINGS.upgradeAction,
      cancelLabel: STRINGS.confirmCancel,
    };
  }, [quote]);

  /**
   * Bảy trạng thái suy ra ở ĐÚNG một chỗ, một chuỗi `if` theo thứ tự ưu tiên cố định —
   * khuôn `useWelcomeScreen.ts:268-281` và `data.md` mục 7.
   *
   * Khác màn chào đúng một điểm: hai trạng thái vòng đời mạng đứng TRƯỚC `forbidden`.
   * Ở màn chào `forbidden` là một bộ thẻ khác, dựng được mà không cần dữ liệu; ở đây
   * hợp đồng mục 4 nói trạng thái 6 là "toàn bộ ở chế độ đọc, KHÔNG ẩn khối nào" — nó
   * vẫn phải có bốn khối đầy dữ liệu để hiện, nên cho nó thắng lúc chưa có dữ liệu là
   * vẽ một màn trắng cho vai Kỹ sư và Người xem, đúng thứ A11 tồn tại để chặn. Quyền
   * không mất đi: `isReadOnly` và `readOnlyNotice` không phụ thuộc trường này.
   *
   * `partial` trước `empty` vì "không lấy được lịch sử hoá đơn" cũng cho ra danh sách
   * rỗng: đọc `empty` trước sẽ nói "chưa có hoá đơn nào" trong khi sự thật là chưa hỏi
   * được — một câu sai, không phải một câu thiếu.
   */
  const state = useMemo<BillingScreenState>(() => {
    if (snapshotQuery.isPending) return 'loading';
    if (snapshotQuery.isError) return 'error';
    if (isReadOnly) return 'forbidden';
    if (options.forceCollapsed === true) return 'collapsed';
    if (degraded.length > 0) return 'partial';
    if (invoices.length === 0) return 'empty';
    return 'ready';
  }, [snapshotQuery.isPending, snapshotQuery.isError, isReadOnly, options.forceCollapsed,
    degraded.length, invoices.length]);

  return {
    state, isReadOnly, readOnlyNotice: isReadOnly ? STRINGS.readOnlyNotice : null,
    plan, quotaAlert, period, periodOptions: PERIOD_OPTIONS, onPeriodChange: setPeriod,
    plans, estimate, invoices: invoiceRows, invoicePage, degraded, error, confirm,
    onChangePlanRequest, onConfirmDismiss, onConfirmAccept,
  };
}
