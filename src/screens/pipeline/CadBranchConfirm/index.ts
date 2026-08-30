/**
 * Đường nhập ổn định của màn Phát hiện tệp CAD.
 *
 * Nơi gọi viết `@/screens/pipeline/CadBranchConfirm` và không phải biết màn này
 * gồm mấy file — sáu mảnh view của hai giai đoạn (hộp thoại, bảng so sánh, bảng
 * tầng, panel ánh xạ, canvas xem trước, khối tuỳ chọn nhập) cố ý **không** được
 * tái xuất ở đây: chúng là mảnh của một view, không phải API của màn. Cùng lý lẽ
 * `ScaleCalibration/index.ts`.
 *
 * Cổng dữ liệu thì khác: `CadBranchConfirmGateway` là hình dạng test và story
 * phải cắm bản giả vào, nên nó đi ra qua đây (R-73), cùng bộ mẫu chín lớp mà cả
 * hai dùng chung để không ai phải bịa bảng dữ liệu thứ hai (R-70).
 *
 * `CadBranchConfirmRoute` là tên `src/routes/router.tsx` nạp qua `lazy(...)`;
 * đổi tên ở đây là làm route trắng lúc chạy chứ không hỏng lúc dựng.
 */

export { CadBranchConfirm } from './CadBranchConfirm';
export {
  CadBranchConfirmContainer,
  CadBranchConfirmRoute,
  type CadBranchConfirmContainerProps,
} from './CadBranchConfirm.container';
export {
  CAD_ALLOWED_WORDS,
  CAD_INSPECTION_QUERY_SCOPE,
  CAD_REMEMBER_NOTICE,
  useCadBranchConfirm,
  type UseCadBranchConfirmHookOptions,
} from './useCadBranchConfirm';
export {
  CAD_FILE_EXTENSION,
  CAD_MISSING_ENDPOINTS,
  CAD_REMEMBER_SESSION_NOTICE,
  CAD_SAMPLE_ENTITIES,
  CAD_SAMPLE_FILE_FORMAT_VERSION,
  CAD_SAMPLE_FLOOR_AVAILABILITY,
  CAD_SAMPLE_INSPECTION,
  CAD_SAMPLE_LAYERS,
  CAD_SAMPLE_LAYERS_MAPPED,
  CAD_SAMPLE_UNSUPPORTED_ENTITIES,
  CAD_SAMPLE_UNSUPPORTED_FILE_FORMAT_VERSION,
  CAD_SAMPLE_WALL_THICKNESSES_MM,
  clearPersistedBranchChoices,
  createAppCadBranchConfirmGateway,
  createCadBranchConfirmGateway,
  createMockCadBranchConfirmGateway,
  readPersistedBranchChoice,
  withCadCapabilities,
  type CadBranchConfirmGateway,
  type CadCapability,
  type CadFailure,
  type CadInspectionSnapshot,
  type CadLayerAssignment,
  type CadRawLayer,
  type CreateCadBranchConfirmGatewayOptions,
  type CreateMockCadBranchConfirmGatewayOptions,
} from './cadBranchConfirmGateway';
export type {
  CadBranchChoice,
  CadBranchComparisonCell,
  CadBranchConfirmActions,
  CadBranchConfirmDialogViewModel,
  CadBranchConfirmProps,
  CadBranchConfirmStage,
  CadBranchConfirmState,
  CadBranchConfirmViewModel,
  CadDrawingUnit,
  CadFileDiagnostics,
  CadFloorAvailability,
  CadImportOptionsViewModel,
  CadLayer,
  CadLayerMappingPanelViewModel,
  CadLayerPreviewCanvasViewModel,
  CadLayerRole,
  CadMappingSummary,
  CadOriginMode,
  CadPreviewEntity,
  CadPreviewExtent,
  CadPreviewPoint,
  CadSelectOption,
  CadWallThicknessLegendEntry,
  UnsupportedEntityKind,
  UseCadBranchConfirmOptions,
  UseCadBranchConfirmResult,
} from './types';
