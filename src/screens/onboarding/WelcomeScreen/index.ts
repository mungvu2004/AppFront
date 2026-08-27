/**
 * Màn `ROUTES.onboarding` — lời chào và ba bước đầu tiên. Đường nhập duy nhất của thư mục này.
 *
 * - {@link WelcomeRoute} là thứ `src/routes/router.tsx` mount.
 * - {@link WelcomeScreenContainer} là màn đã nối, cho một chủ đã có provider.
 * - {@link WelcomeScreen} là markup thuần, cho story và test.
 *
 * ## Bảng chủ sở hữu — đọc trước khi sửa bất cứ file nào ở đây
 *
 * Bốn người dựng màn này song song từ một hợp đồng đông cứng. Ranh giới dưới đây
 * tồn tại để không ai phải chờ ai, và để không ai phải sửa file của người khác:
 *
 * | File | Chủ | Việc |
 * |---|---|---|
 * | `useWelcomeScreen.ts` | L2-E | truy vấn danh sách dự án, suy ra ba bước, cờ "đã xem", bảy trạng thái |
 * | `WelcomeScreen.tsx` | L2-F | view thuần: ba thẻ, ba liên kết chìm, khung xương, trạng thái lỗi |
 * | `src/routes/paths.ts` · `src/i18n/vi.json` | L2-G | `ROUTES.onboarding`, và 24 khoá từ điển để soát |
 * | `index.ts` · `WelcomeScreen.container.tsx` · `WelcomeScreen.stories.tsx` · `WelcomeScreen.test.tsx` · `src/routes/router.tsx` | L3-H | gộp kiểu, nối hộp thoại tạo dự án, bảy story, bộ kiểm, đăng ký route |
 *
 * Nếu một khối tưởng như phải sửa file của người khác để làm được việc của nó
 * thì mối nối sai, không phải file sai — nói ra trước khi sửa.
 *
 * ## Một nguồn cho hình dạng view model
 *
 * `WelcomeScreenViewModel` (hook) và `WelcomeScreenProps` (view) là **một kiểu**:
 * L2-E và L2-F chép song song từ mục 2 của hợp đồng, lượt tích hợp gộp lại bằng
 * `import type`. Thêm một trường thì sửa `useWelcomeScreen.ts` và không chỗ nào khác.
 *
 * Chuỗi tiếng Việt viết thẳng vào TS/TSX; `src/i18n/vi.json` là từ điển để
 * `lib/testing/expectVietnamese.ts` soát, không phải bảng dịch lúc chạy.
 */

export { WelcomeScreen } from './WelcomeScreen';
export type {
  OnboardingLink,
  OnboardingStepCard,
  OnboardingStepId,
  OnboardingStepState,
  WelcomeScreenProps,
} from './WelcomeScreen';
export { WelcomeRoute, WelcomeScreenContainer } from './WelcomeScreen.container';
export type { WelcomeScreenContainerProps } from './WelcomeScreen.container';
export { readWelcomeSeen, useWelcomeScreen } from './useWelcomeScreen';
export type { UseWelcomeScreenOptions, WelcomeScreenViewModel } from './useWelcomeScreen';
