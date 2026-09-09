/**
 * Màn "không tìm thấy trang" — route `*`: nói ngắn gọn chuyện gì đã xảy ra, và
 * đưa người dùng về một chỗ có thật. Đường nhập duy nhất của thư mục này.
 *
 * - {@link NotFoundRoute} là bản toàn màn của route `*`.
 *   `src/routes/router.tsx` nhập ĐÚNG tên này — đổi tên là hỏng route.
 * - {@link NotFoundContainer} là lớp đã nối (ranh giới lỗi + đo bề ngang +
 *   hook), cho một màn chủ muốn tự dựng màn này (R-73).
 * - {@link NotFound} là markup thuần, cho story và bài kiểm.
 * - {@link useNotFound} là tầng logic, cho ai cần tự nối theo cách khác.
 * - {@link createNotFoundGateway} là cổng dữ liệu, cắm vào `queryKeys.project.list()`.
 *
 * ## Bảng chủ sở hữu — đọc trước khi sửa bất cứ file nào ở đây
 *
 * Bốn người dựng màn này song song từ một hợp đồng đông cứng
 * (`notFoundModel.ts`). Ranh giới dưới đây tồn tại để không ai phải chờ ai:
 *
 * | File | Chủ | Việc |
 * |---|---|---|
 * | `notFoundModel.ts` | hợp đồng | hình dạng dữ liệu, hằng ngưỡng, chữ ký cổng |
 * | `notFoundGateway.ts` · `useNotFound.ts` | T5 | cổng đọc dự án gần đây + ba nguyên nhân + bảy trạng thái |
 * | `NotFound.tsx` · `PlanFragment.tsx` | T6 | view thuần: một cột 560, hình mảnh mặt bằng, hàng gợi ý |
 * | `NotFound.test.tsx` · `.stories.tsx` · `notFoundScenarios.ts` | T7 | bảy trạng thái + tiếp cận + tiếng Việt + bốn bài nghiệm thu |
 * | `NotFound.container.tsx` · `index.ts` | T9 | ranh giới lỗi + nối đủ props (R-62, R-73) + đường nhập ổn định |
 * | `src/routes/router.tsx` · `src/i18n/vi.json` | T8 | route `*` và từ điển soát tiếng Việt |
 *
 * `NotFoundVm` là **một nguồn duy nhất**: khai trong `notFoundModel.ts` (hợp
 * đồng đông lạnh), mọi file khác nhập bằng `import type`, không khai lại.
 *
 * Chuỗi tiếng Việt viết thẳng vào TS/TSX; `src/i18n/vi.json` là từ điển để
 * `lib/testing/expectVietnamese.ts` soát, không phải bảng dịch lúc chạy.
 */

export { NotFoundContainer, NotFoundRoute } from './NotFound.container';
export type { NotFoundContainerProps } from './NotFound.container';
export { NotFound } from './NotFound';
export { PlanFragment } from './PlanFragment';
export type { PlanFragmentProps } from './PlanFragment';
export { NOT_FOUND_TEXT, useNotFound } from './useNotFound';
export type { UseNotFoundOptions } from './useNotFound';
export {
  createNotFoundGateway,
  NOT_FOUND_RECENT_CACHE_POLICY,
  NOT_FOUND_RECENT_QUERY_KEY,
  RECENCY_LABEL_PREFIX,
  toRecentProjectVm,
} from './notFoundGateway';
export {
  CONTENT_COLUMN_PX,
  CONTENT_LIFT_PX,
  ILLUSTRATION_SIZE_PX,
  ILLUSTRATION_STROKE_WIDTH,
  NOT_FOUND_ERROR_CODE,
  NOT_FOUND_REASONS,
  NOT_FOUND_SCREEN_CODE,
  RECENT_PROJECT_LIMIT,
  ROW_HOVER_LIFT_PX,
} from './notFoundModel';
export type {
  NotFoundAction,
  NotFoundGateway,
  NotFoundReason,
  NotFoundScreenState,
  NotFoundVm,
  RecentProjectVm,
} from './notFoundModel';
