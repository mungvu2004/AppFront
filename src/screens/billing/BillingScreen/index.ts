/**
 * Màn `ROUTES.billing` — hạn mức, so sánh gói, ước tính chi phí, hoá đơn.
 * Đường nhập duy nhất của thư mục này.
 *
 * - {@link BillingRoute} là thứ `src/routes/router.tsx` mount.
 * - {@link BillingScreenContainer} là màn đã nối, cho một chủ đã có provider.
 * - {@link BillingScreen} là markup thuần, cho story và test.
 *
 * ## Bảng chủ sở hữu — đọc trước khi sửa bất cứ file nào ở đây
 *
 * Bảy người dựng màn này song song từ một hợp đồng đông cứng. Ranh giới dưới đây
 * tồn tại để không ai phải chờ ai, và để không ai phải sửa file của người khác:
 *
 * | File | Chủ | Việc |
 * |---|---|---|
 * | `billingGateway.ts` | T4 | bảng dữ liệu có kiểu, sinh 24 hoá đơn, bốn hạt giống cảnh, `downloadInvoice` |
 * | `useBillingScreen.ts` | T5 | truy vấn, quyền, định dạng, chạy số, bảy trạng thái, `formatMoney` (nợ P-01b) |
 * | `BillingScreen.tsx` | T6 | view thuần, và **khai kiểu hợp đồng mục 2 đúng một lần** |
 * | `QuotaCard.tsx` · `PlanComparison.tsx` · `EstimateBlock.tsx` · `InvoiceTable.tsx` · `ConfirmUpgradeDialog.tsx` | T6 | bốn khối và hộp thoại — file anh em của view (mục D, R-22) |
 * | `index.ts` · `BillingScreen.container.tsx` · `BillingScreen.stories.tsx` · `BillingScreen.test.tsx` · `src/routes/router.tsx` · `src/i18n/vi.json` | T7 | gộp kiểu, ranh giới lỗi, bảy story, bộ kiểm, đăng ký route, từ điển |
 *
 * Nếu một khối tưởng như phải sửa file của người khác để làm được việc của nó
 * thì mối nối sai, không phải file sai — nói ra trước khi sửa.
 *
 * ## Một nguồn cho hình dạng view model
 *
 * `BillingScreenViewModel` (hook) và `BillingScreenProps` (view) là **một kiểu**:
 * T5 và T6 chép song song từ mục 2 của hợp đồng, và lượt tích hợp gộp lại ở đây
 * bằng `import type` — không bản chép thứ ba. Mười ba kiểu con của hợp đồng
 * (`BillingCurrentPlan`, `BillingPlanCard`, …) xuất ra khỏi thư mục đúng **một
 * lần**, từ hook; hai tên trên là hai cái tên của cùng một hình dạng, nên
 * {@link BillingContractIsOneType} ép biên dịch khẳng định điều đó thay cho một
 * chú thích. Thêm, bớt, hay đổi tên một trường ở T5 mà không đổi ở T6 là một lỗi
 * `tsc`, không phải một lỗi lúc chạy.
 *
 * Năm file anh em của view là chi tiết nội bộ và **không** xuất ra khỏi thư mục:
 * nơi gọi dựng `BillingScreen`, không dựng `QuotaCard`.
 *
 * Chuỗi tiếng Việt viết thẳng vào TS/TSX; `src/i18n/vi.json` là từ điển để
 * `lib/testing/expectVietnamese.ts` soát, không phải bảng dịch lúc chạy.
 */

import type { BillingScreenProps } from './BillingScreen';
import type { BillingScreenViewModel } from './useBillingScreen';

/**
 * Hai kiểu giống nhau tới từng `readonly`, không chỉ gán được cho nhau.
 *
 * Phép so sánh đi qua chữ ký hàm generic hoãn lại — cách duy nhất TypeScript cho
 * hỏi "đúng bằng nhau" thay vì "gán được": một trường thừa ở bên nào cũng làm
 * `A` và `B` khác nhau, còn phép gán hai chiều thông thường thì bỏ lọt.
 */
type IsExactly<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

/** Nhận đúng `true`. Bất cứ thứ gì khác là lỗi biên dịch, ngay tại dòng dưới. */
type AssertTrue<TChecked extends true> = TChecked;

/**
 * Bằng chứng biên dịch được rằng hợp đồng mục 2 chỉ có MỘT hình dạng.
 *
 * Xuất ra chứ không giấu đi: đây là mối nối giữa hai file của hai người, và một
 * mối nối không ai đọc được là một mối nối sẽ đứt lặng lẽ.
 */
export type BillingContractIsOneType = AssertTrue<
  IsExactly<BillingScreenProps, BillingScreenViewModel>
>;

export { BillingScreen } from './BillingScreen';
export type { BillingScreenProps } from './BillingScreen';

export { BillingRoute, BillingScreenContainer } from './BillingScreen.container';
export type { BillingScreenContainerProps } from './BillingScreen.container';

export {
  billingQueryKey,
  billingQuotaFillToken,
  formatMoney,
  INVOICE_PAGE_SIZE,
  QUOTA_ATTENTION_THRESHOLD,
  useBillingScreen,
} from './useBillingScreen';
export type {
  BillingBlock,
  BillingConfirmSummary,
  BillingCurrentPlan,
  BillingDegradedNotice,
  BillingErrorNotice,
  BillingEstimate,
  BillingInvoicePage,
  BillingInvoiceRow,
  BillingLabelledValue,
  BillingPeriod,
  BillingPlanCard,
  BillingScreenState,
  BillingScreenViewModel,
  InvoiceStatus,
  QuotaTone,
  UseBillingScreenOptions,
} from './useBillingScreen';

/**
 * Cổng dữ liệu: xuất `createBillingGateway` để một chủ khác tiêm nguồn của mình
 * vào container (R-73). `BILLING_SCENARIO_SEEDS` và `resetBillingStore` **không**
 * xuất ở đây — chúng là đồ nghề của bài kiểm, và mặt tiền sản phẩm của một màn
 * không phải chỗ để chúng, cũng không phải thứ nên giữ chúng sống trong gói.
 * Bộ kiểm nhập thẳng từ `./billingGateway`, đúng cách nó nhập view.
 */
export { createBillingGateway } from './billingGateway';
export type {
  BillingChangePlanQuote,
  BillingEstimateData,
  BillingGateway,
  BillingGatewaySeed,
  BillingInvoice,
  BillingPlanOffer,
  BillingQuota,
  BillingSnapshot,
} from './billingGateway';
