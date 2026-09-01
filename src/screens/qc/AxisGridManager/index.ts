/**
 * Đường nhập ổn định của màn S-15 "Trục và gốc toạ độ" (`AxisGridManager`).
 *
 * Màn cha viết `@/screens/qc/AxisGridManager` và không phải biết màn này gồm
 * mấy file. Thư mục có nhiều hơn sáu tên chuẩn của R-59, và đó là điều mục D
 * cho phép: view vượt trần 400 dòng của R-22 thì phần con tách ra file anh em,
 * miễn `index.ts` giữ nguyên đường nhập. Tiền lệ: `WallLayerReview/` (20 file),
 * `ObjectLayerReview/` (14 file), `PipelineFailure/` (16 file).
 *
 * Năm nhóm đi ra khỏi đây, và không có nhóm thứ sáu:
 *
 * - `AxisGridManagerContainer` — màn đã nối dây, gắn được bằng một thẻ (R-73).
 * - `AxisGridManagerRoute` — vỏ route, thứ duy nhất biết tới `react-router-dom`.
 * - `AxisGridManager` — view thuần, thứ story và bài kiểm bảy trạng thái dựng thẳng.
 * - `useAxisGridManager` — nửa "suy nghĩ", cho màn cha muốn tự dựng view.
 * - Cổng dữ liệu, bộ mẫu và bảy kịch bản: test và story phải cắm được bản giả
 *   vào (R-73), và cắm CÙNG một bộ mẫu thay vì bịa bảng dữ liệu thứ hai (R-70).
 *
 * KHÔNG tái xuất phần con nào của view (`AxisGridCanvas`, `AxisGridGhostFloor`,
 * `AxisGridOriginMarker`, `AxisGridLeftPanel`, `AxisGridOriginPanel`,
 * `AxisGridFloorAlignList`): chúng là mảnh của MỘT view, không phải API của màn
 * — cùng lý lẽ `WallLayerReview/index.ts`. Riêng các hợp đồng KIỂU thì ĐI RA,
 * vì đó là hình dạng mà nơi gọi phải biết khi tự dựng view từ
 * `useAxisGridManager`.
 */

export { AxisGridManager, type AxisGridManagerViewProps } from './AxisGridManager';
export {
  AxisGridManagerContainer,
  AxisGridManagerRoute,
  AXIS_GRID_MANAGER_SCREEN_ID,
  type AxisGridManagerContainerProps,
} from './AxisGridManager.container';
export {
  useAxisGridManager,
  anchorPointOf,
  anchorValueOf,
  axisRowId,
  deriveAxisGridScreenState,
  floorStatusOf,
  millimetreText,
  pixelText,
  worstAlignmentIssue,
  AXIS_GRID_TEXT,
  type AxisGridStateInput,
  type UseAxisGridManagerOptions,
  type UseAxisGridManagerResult,
} from './useAxisGridManager';
export {
  announceSpacingViolation,
  createAxisGridManagerGateway,
  createAxisGridSampleGraph,
  createMockAxisGridManagerGateway,
  describeSpacingViolation,
  findSpacingViolation,
  AXIS_COMMAND_TYPES,
  AXIS_GRID_CAPABILITIES,
  AXIS_GRID_MISSING_CAPABILITIES,
  AXIS_GRID_MISSING_ENDPOINTS,
  AXIS_GRID_SAMPLE_LEVEL_ID,
  MIN_AXIS_SPACING_MM,
  type AxisGridCapability,
  type AxisGridGatewaySeed,
  type AxisGridManagerGateway,
} from './axisGridManagerGateway';
export {
  AXIS_GRID_FIXTURE_FLOOR1,
  AXIS_GRID_FIXTURE_FLOOR2,
  AXIS_GRID_FIXTURE_FLOOR3,
  AXIS_GRID_FIXTURE_SCALE,
  AXIS_GRID_FIXTURE_SPACING_VIOLATION_EXAMPLE,
} from './axisGridFixture';
export {
  axisGridScenarioFor,
  AXIS_GRID_MANAGER_SCENARIOS,
  AXIS_GRID_SCENARIO_PARTIAL_BY_FLOOR,
} from './axisGridManagerScenarios';

export type {
  AxisCanvasAxisViewModel,
  AxisCanvasGhostFloorViewModel,
  AxisCanvasOriginViewModel,
  AxisCanvasViewModel,
  AxisGridDirection,
  AxisGridManagerProps,
  AxisGridPixelPoint,
  AxisGridPixelRect,
  AxisGridScreenState,
  AxisGridViewModel,
  AxisGridWarningBanner,
  AxisGroupViewModel,
  AxisOriginAnchorOption,
  AxisRowViewModel,
  AxisSpacingViolation,
  FloorAlignRowViewModel,
  FloorAlignStatus,
  OriginPanelViewModel,
} from './axisGridTypes';
