/**
 * Đường nhập ổn định của màn Hiệu chỉnh tỷ lệ.
 *
 * Nơi gọi viết `@/screens/pipeline/ScaleCalibration` và không phải biết màn này
 * gồm mấy file — bốn phần con của view (canvas, panel, hai khối phương pháp) cố
 * ý **không** được tái xuất ở đây: chúng là mảnh của một view, không phải API
 * của màn. Cùng lý lẽ `ProcessingScreen/index.ts`.
 *
 * Cổng dữ liệu thì khác: `ScaleCalibrationGateway` là hình dạng test và story
 * phải cắm bản giả vào, nên nó đi ra qua đây (R-73). `appliedScale` mà hook trả
 * về là một `Scale` thật của `@/domain/units/scale`, có sẵn hai phép đổi, nên
 * màn sau nhận nó là dùng được ngay chứ không phải dựng lại từ một con số.
 *
 * `ScaleCalibrationRoute` là tên `src/routes/router.tsx` nạp qua `lazy(...)`;
 * đổi tên ở đây là làm route trắng lúc chạy chứ không hỏng lúc dựng.
 */

export { ScaleCalibration } from './ScaleCalibration';
export {
  ScaleCalibrationContainer,
  ScaleCalibrationRoute,
  type ScaleCalibrationContainerProps,
} from './ScaleCalibration.container';
export {
  useScaleCalibration,
  type UseScaleCalibrationHookOptions,
} from './useScaleCalibration';
export {
  clearPersistedScales,
  createAppScaleCalibrationGateway,
  createMockScaleCalibrationGateway,
  createScaleCalibrationGateway,
  readPersistedScale,
  withScaleCapabilities,
  type CreateScaleCalibrationGatewayOptions,
  type PersistScaleInput,
  type ReadFloorDrawingInput,
  type ReadFloorGeometryInput,
  type ScaleCalibrationGateway,
  type ScaleDrawingSnapshot,
  type ScaleRawDimensionString,
  type ScaleRawSnapTarget,
  type ScaleRoomBoxPx,
} from './scaleCalibrationGateway';
export type {
  DimensionStringRow,
  ImageRatioBox,
  ImageRatioPoint,
  ReferenceLineDraft,
  ReferenceLineEndpoint,
  ScaleApplyScope,
  ScaleCalibrationActions,
  ScaleCalibrationMethod,
  ScaleCalibrationProps,
  ScaleCalibrationState,
  ScaleCalibrationViewModel,
  ScaleCanvasViewModel,
  ScaleComputationViewModel,
  ScaleCrossCheckRow,
  ScaleDimensionMethodViewModel,
  ScalePanelViewModel,
  ScaleReferenceMethodViewModel,
  ScaleStatusBarViewModel,
  ScaleWarning,
  ScaleWarningNotice,
  UseScaleCalibrationOptions,
  UseScaleCalibrationResult,
} from './types';
