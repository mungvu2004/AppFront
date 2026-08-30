/**
 * Đường nhập ổn định của màn Sơ đồ xử lý.
 *
 * Nơi gọi viết `@/screens/pipeline/PipelineGraph` và không phải biết màn này gồm
 * mấy file — ba phần con của view (chế độ Tổng quan, chế độ Chi tiết, panel
 * phải) cố ý **không** được tái xuất ở đây: chúng là mảnh của một view, không
 * phải API của màn. Cùng lý lẽ `ProcessingScreen/index.ts`.
 *
 * Cổng dữ liệu thì khác: `PipelineGraphGateway` là hình dạng test và story phải
 * cắm bản giả vào, nên nó đi ra qua đây cùng `createMockPipelineGraphGateway`
 * (R-73).
 *
 * `PipelineGraphRoute` là tên `src/routes/router.tsx` nạp qua `lazy(...)`; đổi
 * tên ở đây là làm route trắng lúc chạy chứ không hỏng lúc dựng.
 */

export { PipelineGraph } from './PipelineGraph';
export {
  PipelineGraphContainer,
  PipelineGraphRoute,
  type PipelineGraphContainerProps,
} from './PipelineGraph.container';
export {
  pipelineBranchQueryKey,
  pipelineComparisonQueryKey,
  pipelineNodeQueryKey,
  usePipelineGraph,
  type PipelineGraphRun,
  type UsePipelineGraphOptions,
  type UsePipelineGraphResult,
} from './usePipelineGraph';
export {
  createAppPipelineGraphGateway,
  createMockPipelineGraphGateway,
  createPipelineGraphGateway,
  unsupported,
  PIPELINE_GRAPH_CAPABILITIES,
  PIPELINE_GRAPH_MISSING_CAPABILITIES,
  PIPELINE_GRAPH_MISSING_ENDPOINTS,
  type CreateMockPipelineGraphGatewayOptions,
  type CreatePipelineGraphGatewayOptions,
  type PipelineGraphCapability,
  type PipelineGraphCapabilityResult,
  type PipelineGraphFailure,
  type PipelineGraphGateway,
  type PipelineRawBranchReport,
  type PipelineRawComparisonRow,
  type PipelineRawFloorBranch,
  type PipelineRawNodeDetail,
} from './pipelineGraphGateway';
export type {
  PipelineBranchId,
  PipelineBranchStateViewModel,
  PipelineComparisonRowViewModel,
  PipelineDetailViewModel,
  PipelineEvidenceRowViewModel,
  PipelineGraphActions,
  PipelineGraphAlertViewModel,
  PipelineGraphMode,
  PipelineGraphProps,
  PipelineGraphState,
  PipelineGraphViewModel,
  PipelineNodeId,
  PipelineNodePanelViewModel,
  PipelineNodeStatus,
  PipelineNodeViewModel,
  PipelineOverviewBlockViewModel,
  PipelineOverviewViewModel,
  PipelineRerunWarningViewModel,
  PipelineSwitchActionViewModel,
} from './types';
