/**
 * Đường nhập ổn định của màn Đối chiếu bản vẽ.
 *
 * Nơi gọi viết `@/screens/viewer/OverlayComparison` và không phải biết màn này
 * gồm mấy file — ba mảnh của view (canvas, thanh công cụ, panel) cố ý KHÔNG
 * được tái xuất ở đây: chúng là mảnh của một view, không phải API của màn. Cùng
 * lý lẽ `ScaleCalibration/index.ts`.
 *
 * `useOverlayComparison` và `overlayComparisonGateway` không tái xuất ở đây vì
 * hai file đó chưa tồn tại trong worktree này (nhánh `overlay-hook`, viết song
 * song — xem chú thích đầu `OverlayComparison.tsx`); Lớp 3 thêm chúng vào khi gộp.
 */

export { OverlayComparison } from './OverlayComparison';
export {
  OVERLAY_COMPARISON_SCREEN_ID,
  OverlayComparisonContainer,
  type OverlayComparisonContainerProps,
} from './OverlayComparison.container';
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
