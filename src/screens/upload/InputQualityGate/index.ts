/**
 * Đường nhập ổn định của màn Cổng chất lượng đầu vào.
 *
 * Nơi gọi viết `@/screens/upload/InputQualityGate` và không phải biết màn này
 * gồm mấy file — ba phần con của view (panel ảnh, panel báo cáo, chân trang)
 * cố ý **không** được tái xuất ở đây: chúng là mảnh của một view, không phải
 * API của màn. Cùng lý lẽ với `FloorUploadScreen/index.ts`.
 *
 * Cổng dữ liệu thì ngược lại: `createInputQualityGateway` là thứ test và story
 * phải cắm bản giả vào, và `InputQualityToast` là hình dạng nơi gọi phải biết
 * để nối `Toast.Provider` của mình — cả hai là API của màn, không phải mảnh
 * của view, nên chúng đi ra qua đây (R-73).
 */

export { InputQualityGateView } from './InputQualityGate';
export {
  InputQualityGateContainer,
  InputQualityGateRoute,
  type InputQualityGateContainerProps,
} from './InputQualityGate.container';
export {
  useInputQualityGate,
  type InputQualityToast,
  type UseInputQualityGateOptions,
} from './useInputQualityGate';
export {
  createAppInputQualityGateway,
  createInputQualityGateway,
  UNDO_WINDOW_MS,
  type InputQualityFailure,
  type InputQualityGateway,
} from './inputQualityGateway';
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
