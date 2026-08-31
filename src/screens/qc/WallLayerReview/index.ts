/**
 * Đường nhập ổn định của màn S-12 "Duyệt lớp tường" (`WallLayerReview`).
 *
 * Màn cha viết `@/screens/qc/WallLayerReview` và không phải biết màn này gồm
 * mấy file. Thư mục có nhiều hơn sáu tên chuẩn của R-59, và đó là điều mục D
 * cho phép: view vượt trần 400 dòng của R-22 thì phần con tách ra file anh em,
 * miễn `index.ts` giữ nguyên đường nhập. Tiền lệ: `PipelineFailure/` có 16 file.
 *
 * Năm nhóm đi ra khỏi đây, và không có nhóm thứ sáu:
 *
 * - `WallLayerReviewContainer` — màn đã nối dây, gắn được bằng một thẻ (R-73).
 * - `WallLayerReviewRoute` — vỏ route, thứ duy nhất biết tới `react-router-dom`.
 * - `WallLayerReview` — view thuần, thứ story và bài kiểm bảy trạng thái dựng thẳng.
 * - `useWallLayerReview` — nửa "suy nghĩ", cho màn cha muốn tự dựng view.
 * - Cổng dữ liệu và bộ mẫu: test và story phải cắm được bản giả vào (R-73), và
 *   cắm CÙNG một bộ mẫu thay vì bịa bảng dữ liệu thứ hai (R-70).
 *
 * KHÔNG tái xuất phần con nào của view (`WallLayerCanvas`, `WallLayerInspector`,
 * `WallLayerLeftPanel`, `WallLayerLegend`, `WallLayerList`, `WallLayerStatusBar`,
 * `WallLayerToolRail`): chúng là mảnh của một view, không phải API của màn —
 * cùng lý lẽ `PipelineFailure/index.ts`. Riêng hai hợp đồng props của ray công
 * cụ và thanh trạng thái thì ĐI RA, vì chúng là hình dạng mà nơi gọi phải biết
 * khi tự dựng view từ `useWallLayerReview`.
 */

export { WallLayerReview, type WallLayerReviewViewProps } from './WallLayerReview';
export {
  WallLayerReviewContainer,
  WallLayerReviewRoute,
  WALL_LAYER_REVIEW_SCREEN_ID,
  type WallLayerReviewContainerProps,
} from './WallLayerReview.container';
export {
  useWallLayerReview,
  deriveScreenState,
  WALL_LAYER_TEXT,
  type UseWallLayerReviewOptions,
  type UseWallLayerReviewResult,
} from './useWallLayerReview';
export { type WallLayerStatusBarProps } from './WallLayerStatusBar';
export { type WallLayerToolId, type WallLayerToolRailProps } from './WallLayerToolRail';
export { type WallLayerOtherKind } from './WallLayerLeftPanel';
export {
  backgroundImageAlt,
  createMockWallLayerReviewGateway,
  createWallLayerReviewGateway,
  CURSOR_IDLE_LABEL,
  wallDisplayCode,
  WALL_LAYER_CAPABILITIES,
  WALL_LAYER_MISSING_CAPABILITIES,
  WALL_LAYER_MISSING_ENDPOINTS,
  WALL_LAYER_SAMPLE_IMAGE,
  WALL_LAYER_SAMPLE_WALLS,
  WALL_LAYER_THICKNESS_CHOICES,
  type WallLayerCapability,
  type WallLayerGatewaySeed,
  type WallLayerReviewGateway,
} from './wallLayerReviewGateway';
export {
  WALL_LAYER_FIXTURE_LEVEL,
  WALL_LAYER_FIXTURE_NORMALIZED,
  WALL_LAYER_FIXTURE_REVIEWED,
  WALL_LAYER_FIXTURE_TOTAL,
  WALL_LAYER_FIXTURE_WALLS,
} from './wallLayerReviewFixture';
export {
  WALL_LAYER_REVIEW_SCENARIOS,
  type WallLayerReviewScenario,
} from './wallLayerReviewScenarios';

export type {
  WallLayerCanvasProps,
  WallLayerFilterKey,
  WallLayerFilters,
  WallLayerReviewProps,
  WallLayerScreenState,
  WallLayerViewProps,
  WallInspectorViewModel,
  WallReviewCounter,
  WallRowViewModel,
  WallThicknessChoice,
} from './types';
