/**
 * Đường nhập ổn định của màn S-18 "Chuẩn hoá độ dày tường"
 * (`ThicknessStandardization`).
 *
 * Màn cha viết `@/screens/qc/ThicknessStandardization` và không phải biết màn
 * này gồm mấy file. Thư mục có nhiều hơn sáu tên chuẩn của R-59, và đó là điều
 * mục D cho phép: view vượt trần 400 dòng của R-22 thì phần con tách ra file
 * anh em, miễn `index.ts` giữ nguyên đường nhập. Tiền lệ: `RoomLabelReview/`
 * (20 file), `WallLayerReview/` (20 file), `AxisGridManager/` (17 file).
 *
 * Năm nhóm đi ra khỏi đây, và không có nhóm thứ sáu:
 *
 * - `ThicknessStandardizationContainer` — màn đã nối dây, gắn được bằng một
 *   thẻ (R-73).
 * - `ThicknessStandardizationRoute` — vỏ route, thứ duy nhất biết tới
 *   `react-router-dom`.
 * - `ThicknessStandardization` — view thuần, thứ story và bài kiểm bảy trạng
 *   thái dựng thẳng.
 * - `useThicknessStandardization` — nửa "suy nghĩ", cho màn cha muốn tự dựng
 *   view.
 * - Cổng dữ liệu, bộ mẫu và bảy kịch bản: test và story phải cắm được bản giả
 *   vào (R-73), và cắm CÙNG một bộ mẫu thay vì bịa bảng dữ liệu thứ hai
 *   (R-70).
 *
 * KHÔNG tái xuất phần con nào của view (`ThicknessHistogram`,
 * `ThicknessPreviewCanvas`, `ThicknessSummary`, `ThicknessGroupTable`,
 * `ThicknessSegmentTable`, `ThicknessApplyBar`): chúng là mảnh của MỘT view,
 * không phải API của màn — cùng lý lẽ `RoomLabelReview/index.ts`. Riêng các
 * hợp đồng KIỂU thì ĐI RA, vì đó là hình dạng mà nơi gọi phải biết khi tự dựng
 * view từ `useThicknessStandardization`.
 */

export {
  ThicknessStandardization,
  type ThicknessStandardizationViewProps,
} from './ThicknessStandardization';
export {
  ThicknessStandardizationContainer,
  ThicknessStandardizationRoute,
  THICKNESS_STANDARDIZATION_SCREEN_ID,
  type ThicknessStandardizationContainerProps,
} from './ThicknessStandardization.container';
export {
  useThicknessStandardization,
  deriveThicknessScreenState,
  sortSegmentRows,
  THICKNESS_SCREEN_TEXT,
  type UseThicknessStandardizationOptions,
  type UseThicknessStandardizationResult,
} from './useThicknessStandardization';
export {
  buildApplyPreview,
  buildAssignGroupCommands,
  buildStandardizeThicknessCommands,
  createMockThicknessStandardizationGateway,
  createThicknessStandardizationGateway,
  createThicknessUndoTicket,
  deviationOf,
  groupOfMeasurement,
  isApplicable,
  isDefaultThresholds,
  sortThresholds,
  standardizeDescription,
  summaryOf,
  thicknessGraphOf,
  thicknessLegend,
  toGroupRows,
  toHistogramBins,
  toSegmentRows,
  toThicknessWallShapes,
  wallCodeLabel,
  withThresholdAt,
  THICKNESS_CAPABILITIES,
  THICKNESS_DEFAULT_ACTOR_ID,
  THICKNESS_FIXTURE_GRAPH,
  THICKNESS_MISSING_CAPABILITIES,
  THICKNESS_MISSING_ENDPOINTS,
  THICKNESS_NOTIFICATION_TYPE,
  type ThicknessCapability,
  type ThicknessGatewaySeed,
  type ThicknessMissingCapability,
  type ThicknessStandardizationGateway,
} from './thicknessStandardizationGateway';
export {
  FIXTURE_EXCEEDING_COUNT,
  FIXTURE_MEASURED_195_COUNT,
  FIXTURE_REVIEWED_COUNT,
  FIXTURE_SEGMENT_COUNT,
  THICKNESS_FIXTURE_BUILDING,
  THICKNESS_FIXTURE_LEVELS,
  THICKNESS_FIXTURE_WALLS,
} from './thicknessFixture';
export {
  THICKNESS_STANDARDIZATION_SCENARIOS,
  THICKNESS_SCENARIO_COLLAPSED,
  THICKNESS_SCENARIO_EMPTY,
  THICKNESS_SCENARIO_EMPTY_NO_MEASUREMENTS,
  THICKNESS_SCENARIO_ERROR,
  THICKNESS_SCENARIO_FORBIDDEN,
  THICKNESS_SCENARIO_LOADING,
  THICKNESS_SCENARIO_PARTIAL,
  THICKNESS_SCENARIO_PARTIAL_BY_FLOOR,
  THICKNESS_SCENARIO_SUCCESS,
  type ThicknessStandardizationScenario,
} from './thicknessStandardizationScenarios';

export {
  CONCRETE_COLUMN_GROUP,
  DEFAULT_THICKNESS_SORT_KEY,
  DEFAULT_THICKNESS_THRESHOLDS,
  DEFAULT_TOLERANCE_MM,
  HISTOGRAM_BIN_MM,
  HISTOGRAM_HEIGHT_PX,
  THICKNESS_GROUPS_MM,
  THICKNESS_GROUP_DISPLAY_ORDER,
  THICKNESS_GROUP_LABELS,
  THICKNESS_PREVIEW_CANVAS_WIDTH_PX,
  THICKNESS_SUMMARY_LABELS,
} from './thicknessTypes';

export type {
  ApplyPreview,
  HistogramBin,
  ReapplyFilterWarning,
  ThicknessApplyBarProps,
  ThicknessGroup,
  ThicknessGroupRow,
  ThicknessGroupTableProps,
  ThicknessHistogramProps,
  ThicknessLegendEntry,
  ThicknessPreviewCanvasProps,
  ThicknessScreenState,
  ThicknessSegmentRow,
  ThicknessSegmentTableProps,
  ThicknessSortKey,
  ThicknessStandardizationProps,
  ThicknessSummary as ThicknessSummaryViewModel,
  ThicknessSummaryProps,
  ThicknessThresholds,
  ThicknessWallShapeViewModel,
} from './thicknessTypes';
