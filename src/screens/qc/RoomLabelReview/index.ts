/**
 * Đường nhập ổn định của màn S-17 "Duyệt tên phòng" (`RoomLabelReview`).
 *
 * Màn cha viết `@/screens/qc/RoomLabelReview` và không phải biết màn này gồm
 * mấy file. Thư mục có nhiều hơn sáu tên chuẩn của R-59, và đó là điều mục D
 * cho phép: view vượt trần 400 dòng của R-22 thì phần con tách ra file anh em,
 * miễn `index.ts` giữ nguyên đường nhập. Tiền lệ: `WallLayerReview/` (20 file),
 * `AxisGridManager/` (17 file), `ObjectLayerReview/` (14 file).
 *
 * Năm nhóm đi ra khỏi đây, và không có nhóm thứ sáu:
 *
 * - `RoomLabelReviewContainer` — màn đã nối dây, gắn được bằng một thẻ (R-73).
 * - `RoomLabelReviewRoute` — vỏ route, thứ duy nhất biết tới `react-router-dom`.
 * - `RoomLabelReview` — view thuần, thứ story và bài kiểm bảy trạng thái dựng thẳng.
 * - `useRoomLabelReview` — nửa "suy nghĩ", cho màn cha muốn tự dựng view.
 * - Cổng dữ liệu, bộ mẫu và bảy kịch bản: test và story phải cắm được bản giả
 *   vào (R-73), và cắm CÙNG một bộ mẫu thay vì bịa bảng dữ liệu thứ hai (R-70).
 *
 * KHÔNG tái xuất phần con nào của view (`RoomLabelCanvas`, `RoomLabelLeftPanel`,
 * `RoomLabelList`, `RoomLabelInspector`, `RoomLabelNameField`,
 * `RoomLabelNormalizePreview`, hai hộp thoại): chúng là mảnh của MỘT view,
 * không phải API của màn — cùng lý lẽ `AxisGridManager/index.ts`. Riêng các hợp
 * đồng KIỂU thì ĐI RA, vì đó là hình dạng mà nơi gọi phải biết khi tự dựng view
 * từ `useRoomLabelReview`.
 */

export { RoomLabelReview, type RoomLabelReviewViewProps } from './RoomLabelReview';
export {
  RoomLabelReviewContainer,
  RoomLabelReviewRoute,
  ROOM_LABEL_REVIEW_SCREEN_ID,
  type RoomLabelReviewContainerProps,
} from './RoomLabelReview.container';
export {
  useRoomLabelReview,
  applyUnnamedFilter,
  areaCaptionOf,
  deriveRoomLabelScreenState,
  mergeCandidatesOf,
  outlineKeyOf,
  splitPointOf,
  ROOM_LABEL_NAME_SUGGESTIONS,
  ROOM_LABEL_SCREEN_TEXT,
  ROOM_LABEL_USAGE_OPTIONS,
  type UseRoomLabelReviewOptions,
  type UseRoomLabelReviewResult,
} from './useRoomLabelReview';
export {
  backgroundImageAlt,
  createMockRoomLabelReviewGateway,
  createRoomLabelReviewGateway,
  roomCodeLabel,
  roomImageAlt,
  ROOM_APPROVE_COMMAND_TYPE,
  ROOM_LABEL_CAPABILITIES,
  ROOM_LABEL_MISSING_CAPABILITIES,
  ROOM_LABEL_MISSING_ENDPOINTS,
  ROOM_LABEL_SAMPLE_IMAGE,
  ROOM_LABEL_TEXT,
  ROOM_NAME_TARGETS,
  ROOM_NORMALIZE_COMMAND_TYPE,
  type RoomLabelCapability,
  type RoomLabelGatewaySeed,
  type RoomLabelMissingCapability,
  type RoomLabelReviewGateway,
} from './roomLabelReviewGateway';
export {
  ROOM_LABEL_FIXTURE_BUILDING,
  ROOM_LABEL_FIXTURE_EMPTY,
  ROOM_LABEL_FIXTURE_LEVEL,
  ROOM_LABEL_FIXTURE_ROOMS,
  ROOM_LABEL_FIXTURE_ROOM_R005,
  ROOM_LABEL_FIXTURE_TOTAL,
  ROOM_LABEL_FIXTURE_TOTAL_AREA_M2,
  ROOM_LABEL_FIXTURE_UNNAMED_COUNT,
} from './roomLabelFixture';
export {
  ROOM_LABEL_REVIEW_SCENARIOS,
  ROOM_LABEL_SCENARIO_COLLAPSED,
  ROOM_LABEL_SCENARIO_EMPTY,
  ROOM_LABEL_SCENARIO_ERROR,
  ROOM_LABEL_SCENARIO_FORBIDDEN,
  ROOM_LABEL_SCENARIO_GAP_MM,
  ROOM_LABEL_SCENARIO_GAP_WALLS,
  ROOM_LABEL_SCENARIO_LOADING,
  ROOM_LABEL_SCENARIO_PARTIAL,
  ROOM_LABEL_SCENARIO_SUCCESS,
  type RoomLabelReviewScenario,
} from './roomLabelReviewScenarios';

export type {
  RoomLabelCanvasProps,
  RoomLabelCropViewModel,
  RoomLabelGapViewModel,
  RoomLabelInspectorProps,
  RoomLabelLeftPanelProps,
  RoomLabelListProps,
  RoomLabelMergeCandidate,
  RoomLabelNormalizePreview as RoomLabelNormalizePreviewViewModel,
  RoomLabelNormalizePreviewProps,
  RoomLabelNormalizeRow,
  RoomLabelNoticeViewModel,
  RoomLabelPixelPoint,
  RoomLabelPixelRect,
  RoomLabelReviewProps,
  RoomLabelScreenState,
  RoomLabelStatus,
  RoomLabelSummaryViewModel,
  RoomLabelUsageOption,
  RoomLabelViewModel,
} from './roomLabelTypes';
