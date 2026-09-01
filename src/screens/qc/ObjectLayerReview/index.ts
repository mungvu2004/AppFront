/**
 * Đường nhập ổn định của màn S-13 "Lớp đối tượng" (`ObjectLayerReview`).
 *
 * Màn cha viết `@/screens/qc/ObjectLayerReview` và không phải biết màn này gồm
 * mấy file. Thư mục có nhiều hơn sáu tên chuẩn của R-59, và đó là điều mục D
 * cho phép: view vượt trần 400 dòng của R-22 thì phần con tách ra file anh em,
 * miễn `index.ts` giữ nguyên đường nhập. Tiền lệ: `WallLayerReview/` (20 file),
 * `PipelineFailure/` (16 file).
 *
 * Năm nhóm đi ra khỏi đây, và không có nhóm thứ sáu:
 *
 * - `ObjectLayerReviewContainer` — màn đã nối dây, gắn được bằng một thẻ (R-73).
 * - `ObjectLayerReviewRoute` — vỏ route, thứ duy nhất biết tới `react-router-dom`.
 * - `ObjectLayerReview` — view thuần, thứ story và bài kiểm bảy trạng thái dựng thẳng.
 * - `useObjectLayerReview` — nửa "suy nghĩ", cho màn cha muốn tự dựng view.
 * - Cổng dữ liệu, bộ mẫu và bảy kịch bản: test và story phải cắm được bản giả
 *   vào (R-73), và cắm CÙNG một bộ mẫu thay vì bịa bảng dữ liệu thứ hai (R-70).
 *
 * KHÔNG tái xuất phần con nào của view (`ObjectLayerCanvas`,
 * `ObjectLayerInspector`, `ObjectLayerLeftPanel`, `ObjectLayerList`,
 * `ObjectLayerStatusBar`, `ObjectLayerToolRail`): chúng là mảnh của MỘT view,
 * không phải API của màn — cùng lý lẽ `WallLayerReview/index.ts`. Riêng các hợp
 * đồng props thì ĐI RA, vì đó là hình dạng mà nơi gọi phải biết khi tự dựng
 * view từ `useObjectLayerReview`.
 */

export { ObjectLayerReview, type ObjectLayerReviewViewProps } from './ObjectLayerReview';
export {
  ObjectLayerReviewContainer,
  ObjectLayerReviewRoute,
  OBJECT_LAYER_REVIEW_SCREEN_ID,
  type ObjectLayerReviewContainerProps,
} from './ObjectLayerReview.container';
export {
  useObjectLayerReview,
  applyObjectFilters,
  deriveScreenState,
  subtypeSlotsOf,
  type UseObjectLayerReviewOptions,
} from './useObjectLayerReview';
export {
  createMockObjectLayerReviewGateway,
  createObjectLayerReviewGateway,
  manualDoorProposalOf,
  objectsOf,
  reviewProgressLabel,
  OBJECT_APPROVE_COMMAND_TYPE,
  OBJECT_CHANGE_KIND_COMMAND_TYPE,
  OBJECT_CHANGE_SWING_COMMAND_TYPE,
  OBJECT_LAYER_CAPABILITIES,
  OBJECT_LAYER_MISSING_ENDPOINTS,
  OBJECT_LAYER_SAMPLE_GRAPH,
  OBJECT_LAYER_SAMPLE_IMAGE,
  OBJECT_LAYER_SAMPLE_LEVEL,
  OBJECT_LAYER_SEED,
  OBJECT_LAYER_TEXT,
  type ManualObjectProposal,
  type ObjectLayerGatewaySeed,
  type ObjectLayerReviewGateway,
  type ObjectSeedEntry,
} from './objectLayerReviewGateway';
export {
  OBJECT_LAYER_FIXTURE_COUNTS,
  OBJECT_LAYER_FIXTURE_OBJECTS,
  OBJECT_LAYER_FIXTURE_REVIEWED,
} from './objectLayerFixture';
export {
  objectLayerScenarioFor,
  OBJECT_LAYER_REVIEW_SCENARIOS,
  type ObjectLayerReviewScenario,
} from './objectLayerReviewScenarios';

export type {
  HostWallOutlineViewModel,
  ObjectDragMeasurement,
  ObjectInspectorViewModel,
  ObjectLayerCanvasProps,
  ObjectLayerCounts,
  ObjectLayerId,
  ObjectLayerInspectorProps,
  ObjectLayerLeftPanelProps,
  ObjectLayerListProps,
  ObjectLayerReviewModel,
  ObjectLayerScreenState,
  ObjectLayerStatusBarProps,
  ObjectLayerToolRailProps,
  ObjectLayerViewport,
  ObjectListRowViewModel,
  ObjectPlacementViewModel,
  ObjectReviewCounter,
  ObjectSubtype,
  ReviewObject,
} from './objectLayerTypes';
export type {
  ObjectLayerCanvasViewProps,
  ObjectLayerLeftPanelViewProps,
  ObjectLayerListViewProps,
} from './objectLayerSymbols';
