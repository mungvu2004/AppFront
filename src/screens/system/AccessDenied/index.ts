/**
 * Màn "bạn chưa có quyền truy cập" — route `/khong-co-quyen`: nếu một yêu cầu
 * trả về 403, điều phối viên chuyển người dùng tới đây, và màn giải thích tại sao
 * cùng những cách có thể để lấy quyền.
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
export { AccessDenied } from './AccessDenied';
export type { AccessDeniedProps } from './AccessDenied';
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
