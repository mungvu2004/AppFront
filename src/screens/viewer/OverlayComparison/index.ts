/**
 * Đường nhập ổn định của màn Đối chiếu bản vẽ.
 *
 * Nơi gọi viết `@/screens/viewer/OverlayComparison` và không phải biết màn này
 * gồm mấy file — ba mảnh của view (canvas, thanh công cụ, panel) cố ý KHÔNG
 * được tái xuất ở đây: chúng là mảnh của một view, không phải API của màn. Cùng
 * lý lẽ `ScaleCalibration/index.ts`.
 *
 * `OverlayComparisonRoute` là tên `src/routes/router.tsx` nạp qua `lazy(...)`:
 * route trỏ vào container, không vào view gốc.
 *
 * `useOverlayComparison` và `createAppOverlayComparisonGateway` cũng ra từ đây —
 * chúng là hai nửa còn lại của API màn, cho một màn cha muốn tự dựng vỏ.
 */

export { OverlayComparison } from './OverlayComparison';
export {
  OVERLAY_COMPARISON_SCREEN_ID,
  OverlayComparisonContainer,
  OverlayComparisonRoute,
  type OverlayComparisonContainerProps,
} from './OverlayComparison.container';
export {
  createAppOverlayComparisonGateway,
  type OverlayComparisonGateway,
} from './overlayComparisonGateway';
export {
  useOverlayComparison,
  type UseOverlayComparisonOptions,
  type UseOverlayComparisonResult,
} from './useOverlayComparison';
export type {
  CompareModeId,
  ConfirmationViewModel,
  DeviationMarkViewModel,
  DeviationMeasurementViewModel,
  DeviationRowViewModel,
  FloorOptionViewModel,
  GeometryPolyline,
  MatchMetricsViewModel,
  OverlayComparisonActions,
  OverlayComparisonCanvasProps,
  OverlayComparisonPanelProps,
  OverlayComparisonProps,
  OverlayComparisonState,
  OverlayComparisonToolbarProps,
  OverlayComparisonViewModel,
  OverlayLayerId,
  OverlayLayerViewModel,
  OverlayMissingCapability,
  OverlayUnsupported,
  RatioBox,
  RatioPoint,
} from './types';
