/**
 * Màn "bạn chưa có quyền truy cập" — route `/khong-co-quyen`, giải thích tại sao
 * bị chặn cùng những cách có thể để lấy quyền.
 *
 * Đây là đích DÀNH SẴN: hôm nay chưa nơi nào dẫn tới route này (B-V1-05, ngoài
 * FE). Khi có lối 403 thật (mở liên kết chia sẻ v2), màn chủ dựng
 * `AccessDeniedContainer` TẠI CHỖ với prop `error` — không `navigate`, không đổi URL.
 *
 * - {@link AccessDeniedRoute} là bản toàn màn của route `/khong-co-quyen`.
 *   `src/routes/router.tsx` nhập ĐÚNG tên này — đổi tên là hỏng route.
 * - {@link AccessDeniedContainer} là lớp đã nối (ranh giới lỗi + đo bề ngang +
 *   hook), cho một màn chủ muốn tự dựng màn này.
 * - {@link AccessDenied} là markup thuần, cho story và bài kiểm.
 * - {@link useAccessDenied} là tầng logic, cho ai cần tự nối theo cách khác.
 * - {@link createAccessDeniedGateway} là cổng dữ liệu.
 *
 * Mọi kiểu và hằng số sống ở `accessDeniedModel.ts` — nguồn duy nhất, khai đúng
 * một lần ở đó và nhập bằng `import type` ở khắp nơi.
 */

export { AccessDeniedContainer, AccessDeniedRoute } from './AccessDenied.container';
export type { AccessDeniedContainerProps } from './AccessDenied.container';
// `AccessDenied` nhận thẳng `AccessDeniedVm` làm props — hợp đồng nói VM là
// toàn bộ những gì view cần, nên không có kiểu `AccessDeniedProps` thứ hai để
// xuất. Người gọi nhập `AccessDeniedVm` ở khối kiểu bên dưới.
export { AccessDenied } from './AccessDenied';
export { useAccessDenied } from './useAccessDenied';
export type { UseAccessDeniedOptions } from './useAccessDenied';
export { createAccessDeniedGateway } from './accessDeniedGateway';
export {
  ACCESS_DENIED_CAPABILITIES_TODAY,
  ACCESS_DENIED_REASONS,
  DEFAULT_SCREEN_STATE,
  ILLUSTRATION_SIZE_PX,
  ILLUSTRATION_STROKE_WIDTH,
  NARROW_QUERY,
  REQUEST_COOLDOWN_MS,
  SCREEN_ID,
  resolveAccessDeniedReason,
} from './accessDeniedModel';
export type {
  AccessDeniedAction,
  AccessDeniedCapabilities,
  AccessDeniedGateway,
  AccessDeniedReason,
  AccessDeniedScreenState,
  AccessDeniedVm,
  AccessRequestVm,
  ProjectOwnerVm,
} from './accessDeniedModel';
