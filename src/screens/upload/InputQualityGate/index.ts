/**
 * Đường nhập ổn định của màn Cổng chất lượng đầu vào.
 *
 * Nơi gọi viết `@/screens/upload/InputQualityGate` và không phải biết màn này
 * gồm mấy file — ba phần con của view (panel ảnh, panel báo cáo, chân trang)
 * cố ý **không** được tái xuất ở đây: chúng là mảnh của một view, không phải
 * API của màn. Cùng lý lẽ với `FloorUploadScreen/index.ts`.
 */

export { InputQualityGateView } from './InputQualityGate';
export {
  InputQualityGateContainer,
  InputQualityGateRoute,
  type InputQualityGateContainerProps,
} from './InputQualityGate.container';
export { useInputQualityGate, type UseInputQualityGateOptions } from './useInputQualityGate';
export type {
  InputQualityComparisonModel,
  InputQualityCorner,
  InputQualityFindingAction,
  InputQualityFindingModel,
  InputQualityFloorRow,
  InputQualityFooterModel,
  InputQualityFooterProps,
  InputQualityForecast,
  InputQualityGateActions,
  InputQualityGateModel,
  InputQualityGateStatus,
  InputQualityGateViewProps,
  InputQualityImageModel,
  InputQualityImagePanelProps,
  InputQualityRegion,
  InputQualityReportPanelProps,
  InputQualitySkewLine,
  QualityLevel,
  QualityMetricId,
} from './types';
