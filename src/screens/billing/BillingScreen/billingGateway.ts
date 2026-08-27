/**
 * Nguồn dữ liệu của màn thanh toán.
 *
 * ## Vì sao đây là bộ nhớ trong chứ không phải một lời gọi mạng
 *
 * `src/api/endpoints.ts` hiện có đúng sáu nhóm — `auth.{login,register}`,
 * `drawings`, `featureFlags.read`, `floors`, `projects`, `spatial`. **Không có**
 * điểm cuối nào cho gói, hạn mức hay hoá đơn, và `src/api/**` là thư mục màn
 * này không được sửa. Bịa một đường dẫn ra rồi gọi vào đó cho "trông như thật"
 * là cách chắc chắn nhất để màn hình xanh trên máy người viết và đỏ ở mọi nơi
 * khác.
 *
 * Nên toàn bộ dữ liệu — hạn mức, ba gói, ước tính, lịch sử hoá đơn — sống
 * trong bộ nhớ của chính module này, đúng khuôn mà
 * `screens/account/AccountSettings/accountSettingsGateway.ts` và
 * `screens/project/ProjectSettings/projectSettingsGateway.ts` đã đi trước.
 * Danh sách hoá đơn không phải hai mươi bốn object chép tay: nó SINH ra từ
 * {@link BILLING_MOCK_DATA} bằng {@link generateInvoices}, một hàm thuần — cùng
 * cấu hình đưa vào, cùng danh sách trả ra, không `Math.random`, không
 * `Date.now()` — nên bài kiểm tất định được ngày qua ngày.
 *
 * Mở dây thật là một lượt riêng ở tầng dữ liệu, mã đề xuất **T-09**: thêm
 * nhóm `billing` vào `ENDPOINTS`, cho `createBillingGateway` gọi
 * `src/api/client.ts` (mọi truy cập mạng đi qua `src/lib/http` —
 * `local/no-fetch-outside-http` không cho đường nào khác), rồi xoá bộ nhớ
 * dưới đây. Khi ấy đây là file duy nhất phải sửa: `useBillingScreen` và
 * `BillingScreen.tsx` không đổi một dòng nào.
 *
 * ## Ép cảnh cho bài kiểm
 *
 * `createBillingGateway` nhận một `seed` tường minh — không sửa mã, không
 * biến toàn cục ẩn — để bài kiểm dựng đủ bảy trạng thái của A11:
 * {@link BILLING_SCENARIO_SEEDS} gói sẵn bốn cảnh hay dùng nhất (hạn mức gần
 * đầy, không có hoá đơn, hạn mức đang tính lại cộng mất lịch sử hoá đơn, và
 * một lượt đọc ném lỗi).
 */

/* -------------------------------------------------------------------------- */
/* Kiểu — mục 2.1 của CONTRACT.md, T4 khai, T5 tiêu thụ.                      */
/* -------------------------------------------------------------------------- */

export type BillingPeriod = 'monthly' | 'yearly';

/** Sắc thái cảnh báo hạn mức. T5/T6 tiêu thụ khi dựng `BillingCurrentPlan.tone`. */
export type QuotaTone = 'normal' | 'attention';

export type InvoiceStatus = 'paid' | 'pending' | 'overdue';

export interface BillingQuota {
  readonly digitisedAreaM2: number;
  readonly limitAreaM2: number;
  /** Gateway tính sẵn. Màn KHÔNG chia. */
  readonly usedRatio: number;
  readonly renewsAt: number;
  readonly isRecalculating: boolean;
}

export interface BillingPlanOffer {
  readonly id: string;
  readonly name: string;
  readonly priceVnd: Readonly<Record<BillingPeriod, number>>;
  readonly features: readonly string[];
  readonly isRecommended: boolean;
}

export interface BillingInvoice {
  readonly id: string;
  readonly code: string;
  readonly periodStart: number;
  readonly periodEnd: number;
  readonly areaM2: number;
  readonly amountVnd: number;
  readonly status: InvoiceStatus;
}

export interface BillingEstimateData {
  readonly areaM2: number;
  readonly marketUnitPriceMinVnd: number;
  readonly marketUnitPriceMaxVnd: number;
  readonly ourUnitPriceVnd: number;
  /** Tạm tính ĐÃ tính sẵn ở nguồn. Màn tuyệt đối không nhân chia. */
  readonly subtotalVnd: number;
}

export interface BillingSnapshot {
  readonly currentPlanId: string;
  readonly quota: BillingQuota;
  readonly plans: readonly BillingPlanOffer[];
  readonly estimate: BillingEstimateData;
  readonly invoices: readonly BillingInvoice[];
  readonly invoicesUnavailable: boolean;
}

export interface BillingChangePlanQuote {
  readonly planId: string;
  readonly planName: string;
  readonly proratedVnd: number;
  readonly remainingDays: number;
  readonly dueNowVnd: number;
}

export interface BillingGateway {
  readonly read: (period: BillingPeriod) => Promise<BillingSnapshot>;
  readonly quoteChangePlan: (planId: string, period: BillingPeriod) => Promise<BillingChangePlanQuote>;
  readonly confirmChangePlan: (planId: string, period: BillingPeriod) => Promise<void>;
}

/**
 * Cách bài kiểm ép một cảnh cụ thể, không sửa mã.
 *
 * `quotaOverride` chỉ nhận ba trường có thể đổi mà không phá tính tất định —
 * `renewsAt` luôn tới từ {@link BILLING_MOCK_DATA} vì cả `read` lẫn
 * `quoteChangePlan` cùng neo vào đúng một mốc gia hạn.
 */
export interface BillingGatewaySeed {
  readonly quotaOverride?: Partial<Pick<BillingQuota, 'digitisedAreaM2' | 'limitAreaM2' | 'isRecalculating'>>;
  readonly invoicesOverride?: 'empty';
  readonly invoicesUnavailable?: boolean;
  readonly failRead?: boolean;
  readonly failQuoteChangePlan?: boolean;
  readonly failConfirmChangePlan?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Bảng dữ liệu — MỘT bảng có kiểu, mọi con số sống ở đây, không rải trong    */
/* thân hàm.                                                                  */
/* -------------------------------------------------------------------------- */

interface BillingMockPlanSeed {
  readonly id: string;
  readonly name: string;
  readonly priceVnd: Readonly<Record<BillingPeriod, number>>;
  readonly features: readonly [string, string, string, string, string, string];
  readonly isRecommended: boolean;
}

interface BillingMockInvoiceGeneration {
  /** Bao nhiêu hoá đơn sinh ra — tối thiểu 24 để phân trang 10 dòng/trang chứng minh được ba trang. */
  readonly count: number;
  /** Năm của kỳ gần nhất (chỉ số 0 trong danh sách sinh ra). */
  readonly anchorYear: number;
  /** Tháng của kỳ gần nhất, 0 = tháng Một, theo đúng quy ước `Date.UTC`. */
  readonly anchorMonthIndex: number;
  /** Ngày chốt kỳ mỗi tháng. */
  readonly billingDay: number;
  /** Diện tích của hoá đơn gần nhất (chỉ số 0); các kỳ trước giảm dần theo `areaStepM2`. */
  readonly baseAreaM2: number;
  readonly areaStepM2: number;
  /** Cứ mỗi bấy nhiêu vị trí (tính từ 1) thì hoá đơn quá hạn. */
  readonly overdueEveryNth: number;
  /** Cứ mỗi bấy nhiêu vị trí (tính từ 1) thì hoá đơn chờ thanh toán. */
  readonly pendingEveryNth: number;
  readonly codePrefix: string;
}

interface BillingMockData {
  readonly currentPlanId: string;
  readonly quota: {
    readonly digitisedAreaM2: number;
    readonly limitAreaM2: number;
    readonly renewsAtEpochMs: number;
    readonly isRecalculating: boolean;
  };
  readonly plans: readonly [BillingMockPlanSeed, BillingMockPlanSeed, BillingMockPlanSeed];
  readonly estimate: {
    readonly marketUnitPriceMinVnd: number;
    readonly marketUnitPriceMaxVnd: number;
    readonly ourUnitPriceVnd: number;
  };
  readonly invoiceGeneration: BillingMockInvoiceGeneration;
  readonly changePlan: {
    /** Mốc "hiện tại" của toàn bộ mock — một hằng số, không phải `Date.now()`. */
    readonly mockNowEpochMs: number;
    readonly periodDaysByPeriod: Readonly<Record<BillingPeriod, number>>;
  };
}

const BILLING_MOCK_DATA: BillingMockData = {
  currentPlanId: 'starter',
  quota: {
    digitisedAreaM2: 1842,
    limitAreaM2: 5000,
    // 27/09/2026 — cùng mốc gia hạn dùng làm ví dụ P-02 ở CONTRACT.md mục 2.1.
    renewsAtEpochMs: Date.UTC(2026, 8, 27),
    isRecalculating: false,
  },
  plans: [
    {
      id: 'starter',
      name: 'Cơ bản',
      priceVnd: { monthly: 490_000, yearly: 4_900_000 },
      features: [
        '500 m² số hoá mỗi tháng',
        '3 dự án đang hoạt động',
        'Xuất mô hình 3D độ phân giải chuẩn',
        'Lưu bản vẽ 30 ngày',
        'Hỗ trợ qua email trong giờ hành chính',
        '1 thành viên chỉnh sửa',
      ],
      isRecommended: false,
    },
    {
      id: 'growth',
      name: 'Chuyên nghiệp',
      priceVnd: { monthly: 1_240_000, yearly: 12_400_000 },
      features: [
        '5.000 m² số hoá mỗi tháng',
        'Không giới hạn dự án đang hoạt động',
        'Xuất mô hình 3D độ phân giải cao',
        'Lưu bản vẽ không giới hạn',
        'Hỗ trợ ưu tiên 24/7',
        '5 thành viên chỉnh sửa',
      ],
      isRecommended: true,
    },
    {
      id: 'enterprise',
      name: 'Doanh nghiệp',
      priceVnd: { monthly: 2_980_000, yearly: 29_800_000 },
      features: [
        '20.000 m² số hoá mỗi tháng',
        'Không giới hạn dự án và thành viên',
        'Xuất mô hình 3D kèm decal vật liệu',
        'Sao lưu bản vẽ riêng theo yêu cầu',
        'Quản lý tài khoản chuyên trách',
        'Tích hợp API riêng theo yêu cầu',
      ],
      isRecommended: false,
    },
  ],
  estimate: {
    marketUnitPriceMinVnd: 200_000,
    marketUnitPriceMaxVnd: 500_000,
    ourUnitPriceVnd: 195_000,
  },
  invoiceGeneration: {
    count: 24,
    anchorYear: 2026,
    anchorMonthIndex: 7,
    billingDay: 27,
    baseAreaM2: 2016,
    areaStepM2: 18,
    overdueEveryNth: 7,
    pendingEveryNth: 5,
    codePrefix: 'HD',
  },
  changePlan: {
    mockNowEpochMs: Date.UTC(2026, 7, 27),
    periodDaysByPeriod: { monthly: 30, yearly: 365 },
  },
};

/** Bốn cảnh mà bài kiểm cần ép, gói sẵn tên gọi — xem JSDoc đầu file. */
export const BILLING_SCENARIO_SEEDS: Readonly<Record<string, BillingGatewaySeed>> = {
  quotaNearLimit: { quotaOverride: { digitisedAreaM2: 4380, limitAreaM2: 5000 } },
  emptyInvoices: { invoicesOverride: 'empty' },
  partialDegraded: { invoicesUnavailable: true, quotaOverride: { isRecalculating: true } },
  readFails: { failRead: true },
};

const DAY_MS = 24 * 60 * 60 * 1000;

const BILLING_PERIODS: readonly BillingPeriod[] = ['monthly', 'yearly'];

/* -------------------------------------------------------------------------- */
/* Hàm thuần — không đọc/ghi trạng thái module, chỉ biến đầu vào thành ra.    */
/* -------------------------------------------------------------------------- */

function assertBillingPeriod(period: BillingPeriod): void {
  if (!BILLING_PERIODS.includes(period)) {
    throw new Error(`Kỳ thanh toán không hợp lệ: "${String(period)}".`);
  }
}

function resolveInvoiceStatus(position: number, config: BillingMockInvoiceGeneration): InvoiceStatus {
  if (position % config.overdueEveryNth === 0) {
    return 'overdue';
  }
  if (position % config.pendingEveryNth === 0) {
    return 'pending';
  }
  return 'paid';
}

/**
 * Sinh danh sách hoá đơn từ {@link BILLING_MOCK_DATA.invoiceGeneration}.
 *
 * Thuần và tất định: cùng cấu hình đưa vào luôn cho ra cùng mảng, vì mỗi
 * trường của mỗi hoá đơn chỉ phụ thuộc chỉ số `i` và bản thân cấu hình —
 * không `Math.random`, không đọc đồng hồ hệ thống.
 */
function generateInvoices(config: BillingMockInvoiceGeneration): readonly BillingInvoice[] {
  return Array.from({ length: config.count }, (_unused, i) => {
    const position = i + 1;
    const periodEnd = Date.UTC(config.anchorYear, config.anchorMonthIndex - i, config.billingDay);
    const periodStart = Date.UTC(config.anchorYear, config.anchorMonthIndex - i - 1, config.billingDay);
    const areaM2 = config.baseAreaM2 - i * config.areaStepM2;
    const amountVnd = Math.round(areaM2 * BILLING_MOCK_DATA.estimate.ourUnitPriceVnd);
    const periodEndDate = new Date(periodEnd);
    const year = periodEndDate.getUTCFullYear();
    const monthLabel = String(periodEndDate.getUTCMonth() + 1).padStart(2, '0');

    return {
      id: `billing-invoice-${String(year)}${monthLabel}`,
      code: `${config.codePrefix}-${String(year)}-${monthLabel}`,
      periodStart,
      periodEnd,
      areaM2,
      amountVnd,
      status: resolveInvoiceStatus(position, config),
    };
  });
}

/** Sinh một lần lúc nạp module — {@link generateInvoices} vẫn thuần, chỉ gọi lại cho tốn công. */
const BILLING_GENERATED_INVOICES = generateInvoices(BILLING_MOCK_DATA.invoiceGeneration);

function buildEstimate(areaM2: number): BillingEstimateData {
  const { marketUnitPriceMinVnd, marketUnitPriceMaxVnd, ourUnitPriceVnd } = BILLING_MOCK_DATA.estimate;

  return {
    areaM2,
    marketUnitPriceMinVnd,
    marketUnitPriceMaxVnd,
    ourUnitPriceVnd,
    subtotalVnd: Math.round(areaM2 * ourUnitPriceVnd),
  };
}

function resolvePlan(planId: string): BillingPlanOffer {
  const plan = BILLING_MOCK_DATA.plans.find((candidate) => candidate.id === planId);

  if (plan === undefined) {
    throw new Error(`Không tìm thấy gói với mã "${planId}".`);
  }

  return plan;
}

/* -------------------------------------------------------------------------- */
/* Bộ nhớ trong cho gói đang dùng — xem đầu file, mã T-09.                    */
/* -------------------------------------------------------------------------- */

let currentPlanId: string = BILLING_MOCK_DATA.currentPlanId;

/**
 * Cổng thật của ứng dụng.
 *
 * Trả về `Promise` chứ không phải giá trị đồng bộ, và đó là chủ ý: `useQuery`
 * phải có một lượt "đang tải" thật để trạng thái 2 của A11 không phải là thứ
 * chỉ tồn tại trong story. Khi T-09 nối dây thật, chữ ký này không đổi.
 */
export function createBillingGateway(seed: BillingGatewaySeed = {}): BillingGateway {
  return {
    read: async (period) => {
      assertBillingPeriod(period);

      if (seed.failRead === true) {
        throw new Error('Không tải được dữ liệu thanh toán.');
      }

      const digitisedAreaM2 = seed.quotaOverride?.digitisedAreaM2 ?? BILLING_MOCK_DATA.quota.digitisedAreaM2;
      const limitAreaM2 = seed.quotaOverride?.limitAreaM2 ?? BILLING_MOCK_DATA.quota.limitAreaM2;
      const quota: BillingQuota = {
        digitisedAreaM2,
        limitAreaM2,
        usedRatio: digitisedAreaM2 / limitAreaM2,
        renewsAt: BILLING_MOCK_DATA.quota.renewsAtEpochMs,
        isRecalculating: seed.quotaOverride?.isRecalculating ?? BILLING_MOCK_DATA.quota.isRecalculating,
      };

      return {
        currentPlanId,
        quota,
        plans: BILLING_MOCK_DATA.plans,
        estimate: buildEstimate(digitisedAreaM2),
        invoices: seed.invoicesOverride === 'empty' ? [] : BILLING_GENERATED_INVOICES,
        invoicesUnavailable: seed.invoicesUnavailable ?? false,
      };
    },

    quoteChangePlan: async (planId, period) => {
      if (seed.failQuoteChangePlan === true) {
        throw new Error('Không tính được báo giá đổi gói.');
      }

      const plan = resolvePlan(planId);
      const periodDays = BILLING_MOCK_DATA.changePlan.periodDaysByPeriod[period];
      const remainingMs = Math.max(
        0,
        BILLING_MOCK_DATA.quota.renewsAtEpochMs - BILLING_MOCK_DATA.changePlan.mockNowEpochMs,
      );
      const remainingDays = Math.round(remainingMs / DAY_MS);
      // Đổi gói ngay sau khi kỳ hiện tại vừa mở có thể cho remainingDays > periodDays
      // của kỳ tháng (30) — kẹp lại để phần trả trước không bao giờ vượt giá trọn kỳ.
      const cappedRemainingDays = Math.min(remainingDays, periodDays);
      const proratedVnd = Math.round((plan.priceVnd[period] * cappedRemainingDays) / periodDays);

      return {
        planId: plan.id,
        planName: plan.name,
        proratedVnd,
        remainingDays,
        // Không phụ phí nào khác trong mock: khoản phải trả ngay bằng đúng phần trả trước.
        dueNowVnd: proratedVnd,
      };
    },

    confirmChangePlan: async (planId, period) => {
      assertBillingPeriod(period);

      if (seed.failConfirmChangePlan === true) {
        throw new Error('Không xác nhận được lượt đổi gói.');
      }

      currentPlanId = resolvePlan(planId).id;
    },
  };
}

/** Đưa bộ nhớ tạm (gói đang dùng) về mặc định. Dành cho test; sản phẩm không gọi. */
export function resetBillingStore(): void {
  currentPlanId = BILLING_MOCK_DATA.currentPlanId;
}
