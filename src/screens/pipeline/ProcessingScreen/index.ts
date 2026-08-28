/**
 * Đường nhập ổn định của màn Xử lý.
 *
 * Nơi gọi viết `@/screens/pipeline/ProcessingScreen` và không phải biết màn này
 * gồm mấy file — năm phần con của view (dãy chip tầng, danh sách bước, panel xem
 * trước, panel nhật ký, báo cáo tổng kết) cố ý **không** được tái xuất ở đây:
 * chúng là mảnh của một view, không phải API của màn. Cùng lý lẽ với
 * `InputQualityGate/index.ts`.
 *
 * Cổng dữ liệu thì khác: `ProcessingGateway` là hình dạng test và story sau này
 * phải cắm bản giả vào, nên nó đi ra qua đây (R-73).
 */

export { ProcessingScreen } from './ProcessingScreen';
export {
  ProcessingScreenContainer,
  ProcessingScreenRoute,
  type ProcessingScreenContainerProps,
} from './ProcessingScreen.container';
export { useProcessingScreen, type UseProcessingScreenOptions } from './useProcessingScreen';
export type {
  ProcessingGateway,
  ProcessingProgressSnapshot,
  ProcessingRawFloorProgress,
  ProcessingRawLogLine,
  ProcessingRawStageStatus,
  ProcessingRawStepProgress,
  ReadQueuePositionInput,
  RequestCancelInput,
  RunInBackgroundInput,
  SubscribeProgressInput,
} from './processingGateway';
export type {
  ProcessingErrorAlertViewModel,
  ProcessingFloorChipViewModel,
  ProcessingLogLineViewModel,
  ProcessingPanelTab,
  ProcessingPreviewViewModel,
  ProcessingScreenProps,
  ProcessingScreenState,
  ProcessingStageStatus,
  ProcessingStepViewModel,
  ProcessingSummaryViewModel,
} from './types';
