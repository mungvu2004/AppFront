/**
 * Trung tâm thông báo — tấm trượt kể những việc vừa xảy ra trong dự án, và
 * cái chuông mở nó. Đường nhập duy nhất của thư mục này.
 *
 * - {@link NotificationCenterRoute} là bản toàn màn của `/thong-bao`.
 *   `src/routes/router.tsx:36` nhập ĐÚNG tên này — đổi tên là hỏng route.
 * - {@link NotificationCenterContainer} là lớp đã nối (ranh giới lỗi + router +
 *   hook), cho một màn chủ muốn tự giữ trạng thái mở (R-73).
 * - {@link NotificationBellContainer} là chuông + tấm trượt trong một khối, cho
 *   một vỏ ứng dụng muốn gắn bằng một dòng.
 * - {@link NotificationCenter} và {@link NotificationBell} là markup thuần, cho
 *   story và test.
 * - {@link useNotificationCenter} là tầng logic, cho ai cần tự nối theo cách khác.
 *
 * ## Bảng chủ sở hữu — đọc trước khi sửa bất cứ file nào ở đây
 *
 * Bốn người dựng màn này song song từ một hợp đồng đông cứng
 * (`notificationModel.ts`). Ranh giới dưới đây tồn tại để không ai phải chờ ai:
 *
 * | File | Chủ | Việc |
 * |---|---|---|
 * | `notificationModel.ts` | hợp đồng | hình dạng dữ liệu, hằng ngưỡng, chữ ký cổng |
 * | `notificationCenterGateway.ts` · `useNotificationCenter.ts` | W1 | cổng nhớ trong + máy trạng thái + bảy trạng thái |
 * | `NotificationCenter.tsx` | W2 | view thuần: tấm trượt, dòng, chấm chưa đọc, chuông |
 * | `NotificationCenter.test.tsx` · `.stories.tsx` | W3 | bảy trạng thái + tiếp cận + tiếng Việt + bốn bài nghiệm thu |
 * | `NotificationCenter.container.tsx` · `index.ts` | W5 | ranh giới lỗi + nối đủ props (R-62, R-73) + đường nhập ổn định |
 * | `src/routes/paths.ts` · `router.tsx` · `src/i18n/vi.json` | W4 | route `/thong-bao` và từ điển soát tiếng Việt |
 *
 * `NotificationCenterProps` là **một nguồn duy nhất**: khai trong
 * `useNotificationCenter.ts` (đúng khuôn `EditorTourProps` ở `useEditorTour.ts`),
 * mọi file khác nhập bằng `import type`, không khai lại.
 *
 * Chuỗi tiếng Việt viết thẳng vào TS/TSX; `src/i18n/vi.json` là từ điển để
 * `lib/testing/expectVietnamese.ts` soát, không phải bảng dịch lúc chạy.
 */

export {
  NotificationBellContainer,
  NotificationCenterContainer,
  NotificationCenterRoute,
} from './NotificationCenter.container';
export type { NotificationCenterContainerProps } from './NotificationCenter.container';
export { NotificationBell, NotificationCenter } from './NotificationCenter';
export type { NotificationBellProps } from './NotificationCenter';
export {
  NOTIFICATION_CENTER_TEXT,
  notificationListQueryKey,
  useNotificationCenter,
} from './useNotificationCenter';
export type {
  NotificationCenterProps,
  NotificationFilterOption,
  NotificationScrollSurface,
  UseNotificationCenterOptions,
  UseNotificationCenterResult,
} from './useNotificationCenter';
export {
  createNotificationCenterGateway,
  createNotificationTarget,
  resolveNotificationTo,
} from './notificationCenterGateway';
export {
  NOTIFICATION_FILTER_LABELS,
  NOTIFICATION_FILTERS,
  NOTIFICATION_KINDS,
  UNREAD_BADGE_CAP,
  UNREAD_DOT_SIZE_PX,
  UNREAD_DOT_STAGGER_MS,
} from './notificationModel';
export type {
  NotificationCenterGateway,
  NotificationDayGroup,
  NotificationFilter,
  NotificationInlineAction,
  NotificationItemVm,
  NotificationKind,
  NotificationScreenState,
  NotificationTarget,
} from './notificationModel';
