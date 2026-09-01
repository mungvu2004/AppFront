/**
 * Đường nhập ổn định của màn S-16 "Quản lý tầng" (`FloorManager`).
 *
 * Màn cha viết `@/screens/qc/FloorManager` và không phải biết màn này gồm mấy
 * file. Thư mục có nhiều hơn sáu tên chuẩn của R-59, và đó là điều mục D cho
 * phép: view vượt trần 400 dòng của R-22 thì phần con tách ra file anh em,
 * miễn `index.ts` giữ nguyên đường nhập. Tiền lệ: `AxisGridManager/` (17 file),
 * `WallLayerReview/` (20 file), `ObjectLayerReview/` (14 file).
 *
 * Năm nhóm đi ra khỏi đây, và không có nhóm thứ sáu:
 *
 * - `FloorManagerContainer` — màn đã nối dây, gắn được bằng một thẻ (R-73).
 * - `FloorManagerRoute` — vỏ route, thứ duy nhất biết tới `react-router-dom`;
 *   đây là tên mà `src/routes/router.tsx` lazy-import.
 * - `FloorManager` — view thuần, thứ story và bài kiểm bảy trạng thái dựng thẳng.
 * - `useFloorManager` — nửa "suy nghĩ", cho màn cha muốn tự dựng view.
 * - Cổng dữ liệu, bộ mẫu và bảy kịch bản: test và story phải cắm được bản giả
 *   vào (R-73), và cắm CÙNG một bộ mẫu thay vì bịa bảng dữ liệu thứ hai (R-70).
 *
 * KHÔNG tái xuất phần con nào của view (`FloorSectionCut`, `FloorTable`,
 * `FloorTableRow`): chúng là mảnh của MỘT view, không phải API của màn — cùng
 * lý lẽ `AxisGridManager/index.ts`. Riêng các hợp đồng KIỂU thì ĐI RA, vì đó là
 * hình dạng mà nơi gọi phải biết khi tự dựng view từ `useFloorManager`.
 */

export { FloorManager } from './FloorManager';
export {
  FloorManagerContainer,
  FloorManagerRoute,
  FLOOR_MANAGER_SCREEN_ID,
  type FloorManagerContainerProps,
} from './FloorManager.container';
export {
  useFloorManager,
  bandLabel,
  countText,
  cssPercentOf,
  deriveFloorManagerScreenState,
  draftToMillimetres,
  drawingCountText,
  duplicateFloorName,
  floorCountText,
  metreDraftText,
  metreText,
  newFloorName,
  worstStackIssue,
  FLOOR_MANAGER_TEXT,
  type FloorManagerStateInput,
  type UseFloorManagerOptions,
} from './useFloorManager';
export {
  areaOfLevel,
  createFloorManagerGateway,
  createFloorManagerSampleFloors,
  createFloorManagerSampleGraph,
  createMockFloorManagerGateway,
  findElevationConflict,
  levelsOf,
  roomsOfLevel,
  stackBottomMm,
  stackTopMm,
  wallCountOfLevel,
  FLOOR_MANAGER_CAPABILITIES,
  FLOOR_MANAGER_MISSING_CAPABILITIES,
  FLOOR_MANAGER_MISSING_ENDPOINTS,
  FLOOR_MANAGER_SAMPLE_BUILDING,
  FLOOR_MANAGER_SAMPLE_GROUND_ID,
  FLOOR_MANAGER_SAMPLE_LEVELS,
  FLOOR_MANAGER_SAMPLE_ROOF_ID,
  FLOOR_MANAGER_SAMPLE_ROOM_COUNT,
  FLOOR_MANAGER_SAMPLE_SECOND_ID,
  FLOOR_MANAGER_UNSUPPORTED_NOTICES,
  type FloorManagerCapability,
  type FloorManagerGateway,
  type FloorManagerGatewaySeed,
  type FloorManagerMissingCapability,
  type FloorManagerSampleLevel,
} from './floorManagerGateway';
export {
  floorManagerScenarioFor,
  FLOOR_MANAGER_FIXTURE_BANDS,
  FLOOR_MANAGER_FIXTURE_ELEVATION_TICKS,
  FLOOR_MANAGER_FIXTURE_FOOTER,
  FLOOR_MANAGER_FIXTURE_ROWS,
  FLOOR_MANAGER_FIXTURE_TOTAL_HEIGHT_TEXT,
  FLOOR_MANAGER_SCENARIOS,
  type FloorManagerScenarioVm,
} from './floorManagerFixture';

export type {
  DuplicateElevationViolation,
  ElevationTickVm,
  FloorEditableField,
  FloorManagerScreenState,
  FloorManagerViewProps,
  FloorRowDraft,
  FloorRowVm,
  FloorTableFooterVm,
  SectionBandVm,
  UseFloorManagerResult,
} from './floorManagerTypes';
