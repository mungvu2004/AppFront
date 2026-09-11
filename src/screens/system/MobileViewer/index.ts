/**
 * Màn `/m/du-an/:projectId` — xem mô hình 3D **chỉ đọc** trên điện thoại.
 *
 * Chủ đầu tư và kỹ sư mở nó ở công trường, một tay cầm máy. Không cho sửa dữ
 * liệu là **hạn chế có ý thức**, không phải phần còn thiếu.
 *
 * - {@link MobileViewerRoute} là bản toàn màn của route. `src/routes/router.tsx`
 *   nhập ĐÚNG tên này — đổi tên là hỏng route.
 * - {@link MobileViewerContainer} là lớp đã nối (ranh giới lỗi + ranh giới
 *   chunk), cho một màn chủ muốn tự dựng màn này.
 * - {@link MobileViewer} là markup thuần, cho story và bài kiểm (mục D).
 * - {@link useMobileViewer} là tầng logic, cho ai cần tự nối theo cách khác.
 * - {@link createMobileViewerGateway} là cổng dữ liệu.
 *
 * Mọi kiểu và hằng số chung sống ở `mobileViewerTypes.ts` — nguồn duy nhất, khai
 * đúng một lần ở đó và nhập bằng `import type` ở khắp nơi.
 *
 * ## Ba thứ CỐ Ý không xuất ở đây, và lý do là một con số
 *
 * `mountMobileViewerScene`, `attachMobileViewerGestures` và
 * `ConnectedMobileViewer` đều kéo theo `three` (bộ nhận cử chỉ qua
 * `CLICK_SLOP_PX` của `lib/three/interaction/raycast`). File này là thứ
 * `router.tsx` nhập, nên một lời xuất GIÁ TRỊ nào trong ba cái đó sẽ lôi ~137
 * KiB gzip vào **bao đóng nhập tĩnh** của chunk màn và làm vỡ ngân sách
 * `routeChunk` 280 KiB — đúng thứ `MobileViewer.connected.tsx` được tách ra để
 * tránh. Ai cần chúng thì nhập thẳng module, và đọc docblock ở đó trước.
 *
 * Xuất KIỂU thì không sao: `import type` bị xoá lúc biên dịch, không để lại một
 * byte nào trong gói.
 */

export {
  MobileViewerContainer,
  MobileViewerRoute,
  MOBILE_VIEWER_SCREEN_ID,
} from './MobileViewer.container';
export type { MobileViewerContainerProps } from './MobileViewer.container';
export type { ConnectedMobileViewerProps } from './MobileViewer.connected';
export { MobileViewer } from './MobileViewer';
export { useMobileViewer } from './useMobileViewer';
export type { MountMobileViewerScene, UseMobileViewerOptions } from './useMobileViewer';
export type { MobileViewerSceneMountOptions } from './mobileViewerScene';
export {
  createMobileViewerGateway,
  floorsOf,
  selectionOf,
  toMobileMeasurement,
  MOBILE_KIND_LABELS,
} from './mobileViewerGateway';
export type { MobileViewerGateway } from './mobileViewerGateway';
export {
  MOBILE_VIEWER_BOTTOM_BAR_PX,
  MOBILE_VIEWER_COMPACT_WIDTH_PX,
  MOBILE_VIEWER_MIN_HIT_TARGET_PX,
  MOBILE_VIEWER_MODEL_TOKEN,
  MOBILE_VIEWER_SHEET_FULL_RATIO,
  MOBILE_VIEWER_SHEET_MID_RATIO,
  MOBILE_VIEWER_SHEET_PEEK_PX,
  MOBILE_VIEWER_TOOLS,
  MOBILE_VIEWER_TOOLS_COMPACT,
  MOBILE_VIEWER_TOP_BAR_PX,
} from './mobileViewerTypes';
export type {
  MobileViewerFloor,
  MobileViewerGesture,
  MobileViewerInfoRow,
  MobileViewerMeasurement,
  MobileViewerModel,
  MobileViewerProps,
  MobileViewerSceneHandle,
  MobileViewerSceneMount,
  MobileViewerSceneOptions,
  MobileViewerSelection,
  MobileViewerState,
  MobileViewerToolId,
} from './mobileViewerTypes';
