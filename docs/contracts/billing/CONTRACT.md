# HỢP ĐỒNG ĐÔNG CỨNG — màn `/billing` (BillingScreen)

> Bản này do điều phối viên chốt và **người dùng đã duyệt**. Worker **không được**
> sửa file này. Thấy hợp đồng sai → `orca orchestration ask`, dừng chờ trả lời.
> Thứ tự ưu tiên: `LUAT_MAN_HINH.md → RULE.md → CLAUDE.md → prompt màn → hợp đồng này`.

---

## 0. Tám phán quyết đã chốt (prompt nói khác repo — theo bảng này)

| # | Prompt nói | Chốt | Vì sao |
|---|---|---|---|
| Q1 | route `/thanh-toan` | **giữ `/billing`** | `ROUTE_PATTERNS.billing` + `ROUTES.billing` đã có sẵn ở `src/routes/paths.ts`. **KHÔNG sửa `paths.ts`.** |
| Q2 | "P-01 định dạng tiền" | **NOT FOUND trong repo.** Dùng `formatMoney` khai trong `useBillingScreen.ts` (mục 3.1). Nợ **P-01b** | không có hàm tiền tệ nào trong `src/lib`, `src/domain`; `src/lib/**` cấm sửa |
| Q3 | viền `--accent-border` | **NOT FOUND.** Dùng `--accent` 1px | không có trong `COLOR_TOKEN_NAMES` (`src/lib/coloring/scales.ts:62`) cũng như `globals.css` |
| Q4 | chạy số **240ms** | **260ms** (`COUNT_UP_DURATION = 'standard'`) | `src/lib/motion/useCountUp.ts:29-35` đã phán quyết đúng ca này |
| Q5 | thanh hạn mức **700ms** | **340ms** (`durationMs('slow')`) | `src/lib/motion/tokens.ts:76-86`: 700 là `AMBIENT_LOOP_MS` cho thứ **lặp**, "nothing travels from one state to another at it" |
| Q6 | "D-01/D-02 truy vấn hoá đơn và hạn mức" | **NOT FOUND.** Dùng `billingGateway.ts` trong thư mục màn. Nợ **T-09** | không endpoint, không `queryKeys.billing`, không kiểu domain. Tiền lệ đã ghi: `projectSettingsGateway.ts` → `accountSettingsGateway.ts:1-32` |
| Q7 | "6 file" | **7 file** (6 file R-59 + `billingGateway.ts`) | mục D cho phép file anh em trong thư mục màn |
| Q8 | "P-07 thang màu nhạt cho ngưỡng" | **T2 chốt bằng chứng.** Nghiêng về nhánh `attention` | prompt nói "thang **cần chú ý**" |

**Lệnh thêm của người duyệt:** dữ liệu là **mock có cấu trúc**, không hard-code. Nghĩa là:
mọi con số sống trong đúng một bảng dữ liệu có kiểu ở `billingGateway.ts`; **không** một số
nào, **không** một chuỗi tiền/diện tích nào viết thẳng trong hook, view, story hay JSX.

---

## 1. Bảng chủ sở hữu file — không ai sửa file của người khác

| File | Chủ | Lớp |
|---|---|---|
| `docs/contracts/billing/format-motion.md` | T1 | 1 |
| `docs/contracts/billing/data.md` | T2 | 1 |
| `docs/contracts/billing/ui.md` | T3 | 1 |
| `src/screens/billing/BillingScreen/billingGateway.ts` | **T4** | 1 |
| `docs/contracts/billing/i18n/*.fragment.json` | T4, T5, T6 (mỗi người MỘT file riêng) | 1–2 |
| `src/screens/billing/BillingScreen/useBillingScreen.ts` | **T5** | 2 |
| `src/screens/billing/BillingScreen/BillingScreen.tsx` | **T6** | 2 |
| `index.ts` · `BillingScreen.container.tsx` · `BillingScreen.stories.tsx` · `BillingScreen.test.tsx` · `src/routes/router.tsx` · `src/i18n/vi.json` | **T7** | 3 |

`src/routes/paths.ts` — **không ai sửa** (Q1).
`docs/contracts/billing/**` là vật tư điều phối tạm: **T7 xoá sạch** trước commit cuối, để
`git diff --name-only` khi merge chỉ còn `src/screens/billing/**`, `src/routes/router.tsx`,
`src/i18n/vi.json`.

---

## 2. Kiểu đông cứng

`BillingScreenViewModel` (T5 khai trong hook) và `BillingScreenProps` (T6 khai trong view) là
**MỘT kiểu**, chép song song từ mục này; T7 gộp bằng `import type`. Khuôn đã chạy được ở
`src/screens/onboarding/WelcomeScreen/index.ts`. **Thêm/bớt/đổi tên một trường = escalate cho
điều phối viên**, không tự quyết.

```ts
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
   * Chia năm mảnh để view đặt chữ đều lên mảnh 1 và 3 mà KHÔNG nối chuỗi (A15).
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
```

### 2.1 Kiểu của gateway (T4 khai, T5 tiêu thụ)

```ts
export interface BillingQuota {
  readonly digitisedAreaM2: number;
  readonly limitAreaM2: number;
  /** Gateway tính sẵn. Màn KHÔNG chia. */
  readonly usedRatio: number;
  readonly renewsAt: number;          // epoch ms — P-02 định dạng
  readonly isRecalculating: boolean;  // trạng thái 3
}
export interface BillingPlanOffer {
  readonly id: string;
  readonly name: string;
  readonly priceVnd: Readonly<Record<BillingPeriod, number>>;
  readonly features: readonly string[];   // đúng 6
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
  readonly marketUnitPriceMinVnd: number;   // 200_000
  readonly marketUnitPriceMaxVnd: number;   // 500_000
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
  readonly invoicesUnavailable: boolean;   // trạng thái 3
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
```

Mọi hàm trả `Promise` — `useQuery` phải có một lượt "đang tải" thật, nếu không trạng thái 2
của A11 chỉ tồn tại trong story (`accountSettingsGateway.ts:47-52`).

---

## 3. Định dạng — nguồn duy nhất

| Việc | Hàm | Đường dẫn |
|---|---|---|
| Diện tích hoá đơn | `formatArea(m2)` → `"2.480,00 m²"` | `@/lib/format/measure` |
| Diện tích hạn mức | `formatArea(m2, { fractionDigits: 0 })` → `"1.842 m²"` | nt |
| Số | `formatNumber(v, { fractionDigits: 0 })` | `@/lib/format/number` |
| Kỳ, ngày | `formatCalendarDate` / `formatTimestamp` | `@/lib/format/datetime` |
| Thiếu giá trị | `MISSING_VALUE` (`"—"`) | `@/lib/format/number` |
| Chạy số | `useCountUp` | `@/hooks/useCountUp` (260ms, `standard`) |
| Thời lượng | `durationMs('instant'\|'fast'\|'standard'\|'slow')` | `@/lib/motion` |

### 3.1 `formatMoney` — nợ P-01b, khai trong `useBillingScreen.ts`, T5 xuất

```ts
/**
 * Tiền Việt. Nợ P-01b: `src/lib/format` chưa có hàm tiền tệ và `src/lib/**` là
 * thư mục màn này không được sửa (R-68). Đúng khuôn `formatArea` đang dùng —
 * `formatNumber` lo chữ số, hậu tố ghép ở đây — và ghép ở tầng viewmodel là chỗ
 * A15 chỉ định. Mở dây thật là một lượt riêng ở tầng logic, mã đề xuất P-01b:
 * thêm `formatMoney` vào `src/lib/format/number.ts` rồi xoá hàm này.
 */
export function formatMoney(amountVnd: MaybeNumber): string {
  return isFormattable(amountVnd) ? `${formatNumber(amountVnd, { fractionDigits: 0 })} ₫` : MISSING_VALUE;
}
```

**Năm chuỗi nghiệm thu bắt buộc in ra** (T7):

| Gọi | Kỳ vọng |
|---|---|
| `formatArea(2480)` | `2.480,00 m²` |
| `formatMoney(1240000)` | `1.240.000 ₫` |
| `formatArea(620, { fractionDigits: 0 })` | `620 m²` |
| `formatArea(1842, { fractionDigits: 0 })` | `1.842 m²` |
| `formatMoney(200000)` | `200.000 ₫` |

---

## 4. Bảy trạng thái → phần tử giao diện

| # | Trạng thái | `state` | Hiện gì |
|---|---|---|---|
| 1 | Rỗng | `empty` | `EmptyState` trong khối 4: chưa có hoá đơn, khung trống dạy nghề. Ba khối trên vẫn hiện |
| 2 | Đang tải | `loading` | 8 dòng `Skeleton` bảng + ba thẻ gói khung xương |
| 3 | Một phần | `partial` | `degraded[]` — dải cảnh báo **chỉ nằm trong khối của nó** (`quota` hoặc `invoices`), khối khác vẫn đầy đủ |
| 4 | Lỗi | `error` | `InlineAlert` nêu lý do (L-03) + mã chữ đều nhỏ + nút thử lại |
| 5 | Xong | `ready` | đủ bốn khối |
| 6 | Không có quyền | `forbidden` | **toàn bộ ở chế độ đọc** + câu "Chỉ quản trị viên có thể thay đổi gói." Không ẩn khối nào |
| 7 | Thu gọn | `collapsed` | tóm tắt gọn: tên gói + `usageLabel` + thanh hạn mức |

Bộ kiểm đi qua `expectSevenStates` (`src/lib/testing/expectSevenStates.ts`), phải in **7/7**.

---

## 5. Chuỗi tiếng Việt — nguồn duy nhất

Viết thẳng tiếng Việt có dấu vào TS/TSX. `src/i18n/vi.json` là **từ điển để soát**
(`expectVietnamese`), không phải bảng dịch lúc chạy. Chữ **thường, kiểu câu** (A6);
ngoại lệ chữ hoa: mã hoá đơn, mã lỗi, tên phím.

| Chỗ | Chuỗi |
|---|---|
| Tiêu đề màn | `Thanh toán` |
| Khối 1 | `Gói hiện tại` · `Đổi gói` · `{đã dùng} / {hạn mức} đã số hoá trong chu kỳ này` · `Gia hạn ngày {ngày}` |
| Cảnh báo hạn mức | `Sắp hết hạn mức. Còn {còn lại}.` |
| Khối 2 | `So sánh gói` · badge đề xuất: `Đề xuất` · `mỗi tháng` / `mỗi năm` · `Gói hiện tại` / `Nâng gói` |
| Kỳ thanh toán | `Theo tháng` · `Theo năm` |
| Khối 3 | `Ước tính` · ba dòng: `Diện tích tháng này` · `Đơn giá` · `Tạm tính` |
| Khối 4 | `Hoá đơn` · cột: `Mã` · `Kỳ` · `Diện tích` · `Số tiền` · `Trạng thái` |
| Trạng thái hoá đơn | `Đã thanh toán` · `Chờ thanh toán` · `Quá hạn` |
| Nút tải | aria-label `Tải hoá đơn {mã} dạng PDF` |
| Phân trang | `Trang {n} / {m}` · `Trang trước` · `Trang sau` |
| Rỗng | `Chưa có hoá đơn nào` + mô tả dạy nghề |
| Một phần | `Đang tính lại hạn mức.` · `Không lấy được lịch sử hoá đơn.` |
| Không có quyền | `Chỉ quản trị viên có thể thay đổi gói.` |
| Xác nhận nâng gói | `Xác nhận nâng gói` · `Gói mới` · `Phần còn lại của chu kỳ` · `Thanh toán ngay` · `Huỷ` |
| Thử lại | `Thử lại` |

Mỗi worker cần khoá mới → ghi vào **fragment riêng của mình**
`docs/contracts/billing/i18n/<task>.fragment.json`, dạng `{"billing":{"<khoá>":"<chuỗi>"}}`.
T7 gộp tất cả vào `src/i18n/vi.json` dưới đúng một nhánh `"billing"`.

---

## 6. Màu và badge

- Nền màn `--bg-app`; thẻ trắng `--bg-surface`; rãnh thanh `--bg-sunken`; phần đầy `--accent`.
- Thẻ khuyến nghị: **chỉ** viền 1px `--accent` + badge nền `--accent-wash`. **Không** nền màu,
  **không** băng, **không** "phổ biến nhất".
- Sáu dấu tích tính năng: 18px, `--text-secondary`. **Không xanh lá.**
- Badge trạng thái hoá đơn — nền nhạt, không tô đặc:

| Trạng thái | `variant` của `Badge` |
|---|---|
| `paid` | `neutral` |
| `pending` | `attention` |
| `overdue` | `violation` (đã là `bg-state-violation-tint`, **không** đỏ đặc) |

`paid` **không** dùng `verified`: A5 nói xanh "đã xác minh" chỉ đánh dấu việc người duyệt.

---

## 7. Chuyển động

| Chỗ | Thời lượng | Nguồn |
|---|---|---|
| Thanh hạn mức 0 → giá trị thật khi vào màn | `durationMs('slow')` = 340ms | Q5 |
| Đổi kỳ → giá **chạy số** sang giá mới | `useCountUp` = 260ms | Q4 |
| Thẻ gói nâng −1px khi trỏ chuột | `durationMs('instant')` = 120ms | mục B |

Thẻ khuyến nghị **không** được động khác ba thẻ kia. Không con số thời lượng nào viết tay (R-71).

---

## 8. Cấm tuyệt đối — nguyên văn từ prompt gốc

```
[CẤM TUYỆT ĐỐI]
- Không thẻ gói nào có nền màu, không băng nhiều màu, không "phổ biến nhất" nổi bật.
- Dấu tích tính năng màu trung tính, không xanh lá.
- Không đỏ đặc cho hoá đơn quá hạn; dùng badge nền nhạt.
- Không tự định dạng số, không tự tính tạm tính.
- Không tạo component mới.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

Thêm, từ LUAT_MAN_HINH R-68/R-69/R-70/R-71:
- Không `TODO`, không `FIXME`, không stub, không `any`. Thiếu logic → **DỪNG và `ask`**.
- Không sửa, nới, tắt, `.skip`, `.only` bài kiểm có sẵn.
- Không chuỗi bắt đầu bằng `/` hay `http` trong `src/screens/**` (R-65).
- Không `useState` tự chế cho `loading`/`error` (R-64) — đi qua `@tanstack/react-query`.
- Không hằng số viết tay: mã lỗi, thời gian chờ, ngưỡng, thời lượng (R-71).

---

## 9. Nghiệm thu — mọi worker phải in SỐ, không in tính từ

Thiếu số = **chưa xong**, điều phối viên bắt retry (E.10 / R-58).

```bash
pnpm typecheck     # in "0 errors" hoặc danh sách lỗi
pnpm lint          # --max-warnings 0
pnpm test          # in "N passed | M failed"
pnpm length        # file của bạn bao nhiêu dòng
```

**Cổng kích thước gói là cổng DELTA** (người duyệt đã chốt): `pnpm verify` **đỏ từ trước**
trên `master` sạch ở bước 6 — tổng JS 419,8 KiB / ngân sách 175 KiB, chunk lớn nhất
132,9 KiB. Đây là nợ toàn repo (three.js), không màn nào tạo ra. Chỉ T7 đo:
**đạt khi tổng JS ≤ 431,8 KiB và chunk lớn nhất vẫn 132,9 KiB.** Báo cáo ghi
`kích thước gói: ĐỎ TỪ TRƯỚC (419,8/175)` — **tuyệt đối không ghi "đạt"**.

Khối lệnh R-59→R-73 của `LUAT_MAN_HINH.md` Phần 4 chạy ở T7.
