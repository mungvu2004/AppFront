/**
 * Đường nhập ổn định của màn S-11 "Một bước AI hỏng" (`PipelineFailure`).
 *
 * Màn cha viết `@/screens/pipeline/PipelineFailure` và không phải biết màn này gồm
 * mấy file.
 *
 * Ở lượt này (lớp L1) mới chỉ có hợp đồng props, nên đây CHỈ tái xuất kiểu. View,
 * hook, container và cổng dữ liệu chưa tồn tại; nhập một file chưa có sẽ làm hỏng
 * `pnpm typecheck`, nên worker lớp sau bổ sung các export còn lại vào chính file
 * này khi file của họ đã có — `PipelineFailure`, `PipelineFailureContainer`,
 * `usePipelineFailure`, và kiểu cổng dữ liệu (thứ test và story phải cắm bản giả
 * vào, R-73).
 *
 * Không tái xuất phần con nào của view: chúng là mảnh của một view, không phải API
 * của màn — cùng lý lẽ `ProcessingScreen/index.ts`.
 */

export type {
  PipelineFailureAlertBand,
  PipelineFailureBand,
  PipelineFailureContainerProps,
  PipelineFailureCopyAction,
  PipelineFailureFloorStatus,
  PipelineFailureFloorViewModel,
  PipelineFailureIdentity,
  PipelineFailureIdleBand,
  PipelineFailureKeptItem,
  PipelineFailureKeptWork,
  PipelineFailureKeptWorkLine,
  PipelineFailureKeptWorkList,
  PipelineFailureLogLine,
  PipelineFailureNextStep,
  PipelineFailureNextStepId,
  PipelineFailureNextSteps,
  PipelineFailureProps,
  PipelineFailureReasonViewModel,
  PipelineFailureResolvedBand,
  PipelineFailureRetryAction,
  PipelineFailureRetryAttemptNotice,
  PipelineFailureRetryingBand,
  PipelineFailureRetryNotice,
  PipelineFailureRetrySupportNotice,
  PipelineFailureState,
  PipelineFailureSupportLink,
  PipelineFailureTechnicalDetails,
} from './types';
