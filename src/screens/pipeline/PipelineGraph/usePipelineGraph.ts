/**
 * Logic của màn Sơ đồ xử lý — nối lại thứ đã có, không tự chế (R-61).
 *
 * Hook đứng giữa cổng dữ liệu và view thuần: nó đọc, ghép, **định dạng xong mọi
 * con số** (A15) rồi trả ra đúng {@link PipelineGraphProps}. View không biết
 * `useQuery` tồn tại và không biết cổng tồn tại.
 *
 * ## Cái gì đến từ đâu
 *
 * | Việc | Nguồn |
 * |---|---|
 * | Trạng thái sáu bước, nhánh đang chạy | `PipelineGraphGateway.subscribeRun` → `toStageBreakdown` (T-08) |
 * | Nhánh mỗi tầng, dòng dẫn chứng, bảng so sánh | `PipelineGraphGateway` (chưa nối được ở bản thật, xem cổng) |
 * | Số mục QC đã duyệt | `src/store` `spatial` + `toViewModels` của P-03 — `statusCode === 'verified'` |
 * | Định dạng số và thời lượng | `@/lib/format` |
 * | So le 24 ms, thời lượng chuyển động | `@/lib/motion` |
 * | Quyền xem chế độ chi tiết | vai của phiên đăng nhập |
 *
 * ## Số mục đã duyệt đọc từ P-03, không đếm tay
 *
 * Cảnh báo của "Chạy lại từ bước này" phải nêu **đúng** số tường đã duyệt. Nguồn
 * duy nhất của "đã duyệt" là `ReviewMetadata.reviewed`, và bất biến A5 nói chỉ
 * người duyệt mới đặt được cờ đó. Hook không đọc cờ ấy trực tiếp: nó đưa tường
 * qua `toViewModels` rồi đếm `statusCode === 'verified'` — đúng chỗ A5 được cài
 * đặt, nên nếu luật A5 đổi thì màn này đổi theo mà không phải sửa gì.
 *
 * ## Quyền xem chế độ chi tiết
 *
 * Đặc tả nói "chỉ vai Quản trị và hỗ trợ". `AUTH_ROLES` của repo có ba vai —
 * `admin`, `engineer`, `viewer` — và **không có vai hỗ trợ riêng**, cũng không có
 * khoá quyền nào cho việc "xem bên trong pipeline" trong `permissionMatrix`
 * (`src/lib/auth/permissions.ts`). Cổng ở đây vì thế là danh sách vai viết rõ tại
 * {@link DETAIL_MODE_ROLES}, không mượn tạm một khoá quyền có nghĩa khác. Khoá
 * còn thiếu tên là `pipeline.inspect`; thêm nó là việc của một prompt logic, vì
 * `src/lib/**` nằm ngoài phạm vi màn (R-68).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { isEntityOfKind } from '@/domain/spatial/normalize';
import type { Wall } from '@/domain/spatial/types';
import { useCanvasViewport } from '@/hooks/useCanvasViewport';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { formatDuration } from '@/lib/format/datetime';
import { formatNumber, formatPercent, MISSING_VALUE } from '@/lib/format/number';
import { staggerDelayMs } from '@/lib/motion';
import type { PipelineStageId, PipelineStageState } from '@/lib/realtime/pipeline';
import { toViewModels } from '@/lib/viewmodel/toViewModel';
import { useStore } from '@/store';
import type { ProjectRole } from '@/types/project';

import {
  PIPELINE_GRAPH_TEXT,
  PIPELINE_NODE_TEXT,
  PIPELINE_OVERVIEW_BLOCKS,
} from './pipelineGraphText';
import type {
  PipelineGraphFailure,
  PipelineGraphGateway,
  PipelineRawBranchReport,
  PipelineRawNodeDetail,
} from './pipelineGraphGateway';
import {
  PIPELINE_NODES,
  type PipelineBranchId,
  type PipelineGraphActions,
  type PipelineGraphMode,
  type PipelineGraphState,
  type PipelineGraphViewModel,
  type PipelineNodeId,
  type PipelineNodeStatus,
  type PipelineNodeViewModel,
} from './types';

/* -------------------------------------------------------------------------- */
/* Hằng số của màn.                                                            */
/* -------------------------------------------------------------------------- */

/** Vai được mở chế độ chi tiết. Xem ghi chú đầu file về khoá `pipeline.inspect`. */
const DETAIL_MODE_ROLES: readonly ProjectRole[] = ['admin'];

/** `< 1024px` — cùng mốc `ProcessingScreen`, `ScaleCalibration` và `InputQualityGate`. */
const NARROW_VIEWPORT_QUERY = '(max-width: 1023px)';

/** Nhánh mà nút "đổi nhánh" dẫn tới. Đặc tả chỉ nêu một chiều: sang nhánh AI. */
const SWITCH_TARGET_BRANCH: PipelineBranchId = 'ai';

/** Nút mở sẵn khi vào chế độ chi tiết: bước đầu tiên có dữ liệu để kể. */
const INITIAL_NODE_ID: PipelineNodeId = 'preprocess';

/** Khoá bộ đệm, dựng tại chỗ — `queryKeys` không có nhánh nào cho pipeline theo dự án. */
export const pipelineBranchQueryKey = (projectId: string): readonly string[] => [
  'pipeline',
  'branch',
  projectId,
];

export const pipelineComparisonQueryKey: readonly string[] = ['pipeline', 'comparison'];

export const pipelineNodeQueryKey = (
  projectId: string,
  nodeId: PipelineNodeId,
): readonly string[] => ['pipeline', 'node', projectId, nodeId];

/* -------------------------------------------------------------------------- */
/* Tham số vào và kết quả ra.                                                  */
/* -------------------------------------------------------------------------- */

/** Một lượt xử lý đang theo dõi được. Route chỉ mang `:id`, nên nơi gọi truyền vào. */
export interface PipelineGraphRun {
  readonly floorId: string;
  readonly uploadId: string;
}

export interface UsePipelineGraphOptions {
  readonly projectId: string;
  readonly gateway: PipelineGraphGateway;
  /** Lượt xử lý để theo dõi. Vắng mặt là câu trả lời hợp lệ — màn ở trạng thái rỗng. */
  readonly run?: PipelineGraphRun;
  readonly roles?: readonly ProjectRole[];
  /** Ép sơ đồ xếp dọc — cho story hoặc test muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
}

export interface UsePipelineGraphResult {
  readonly model: PipelineGraphViewModel;
  readonly actions: PipelineGraphActions;
}

/* -------------------------------------------------------------------------- */
/* Phép ghép.                                                                  */
/* -------------------------------------------------------------------------- */

const NO_ROLES: readonly ProjectRole[] = [];

/**
 * Dưới 1024 thì sơ đồ xếp dọc thành danh sách bước.
 *
 * Phải là JavaScript chứ không phải một lớp Tailwind: hai cách xếp là hai CÂY DOM
 * khác nhau (khối đặt tuyệt đối theo toạ độ ↔ một `<ol>`), mà CSS không đổi được
 * cây. Cùng khuôn `useProcessingScreen.ts:433` và `useScaleCalibration.ts:409`.
 */
function hasMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

function useNarrowViewport(): boolean {
  const [isNarrow, setIsNarrow] = useState(() =>
    hasMatchMedia() ? window.matchMedia(NARROW_VIEWPORT_QUERY).matches : false,
  );

  useEffect(() => {
    // Môi trường không có `matchMedia` (jsdom trần, một số webview) thì màn vẫn
    // vẽ ở cách xếp rộng — mất một tiện nghi, không mất cả màn hình (A11).
    if (!hasMatchMedia()) {
      return undefined;
    }

    const media = window.matchMedia(NARROW_VIEWPORT_QUERY);
    setIsNarrow(media.matches);
    const listener = (event: MediaQueryListEvent): void => {
      setIsNarrow(event.matches);
    };
    media.addEventListener('change', listener);
    return () => {
      media.removeEventListener('change', listener);
    };
  }, []);

  return isNarrow;
}

function statusOfStage(
  stages: readonly PipelineStageState[],
  stageId: PipelineStageId,
): PipelineNodeStatus {
  return stages.find((stage) => stage.id === stageId)?.status ?? 'queued';
}

/** Nút phía sau nút vừa xin chạy lại — mờ xuống rồi lần lượt sáng lại khi xong. */
function collectDownstream(from: PipelineNodeId): ReadonlySet<PipelineNodeId> {
  const reached = new Set<PipelineNodeId>();
  const queue: PipelineNodeId[] = [from];

  while (queue.length > 0) {
    const current = queue.shift();

    if (current === undefined) {
      break;
    }

    const definition = PIPELINE_NODES.find((node) => node.id === current);

    for (const target of definition?.edgeTargets ?? []) {
      if (!reached.has(target)) {
        reached.add(target);
        queue.push(target);
      }
    }
  }

  return reached;
}

/** Số tường người duyệt đã xác nhận — qua P-03, không đọc thẳng cờ `reviewed` (A5). */
function countApprovedWalls(walls: readonly Wall[]): number {
  return toViewModels(walls.map((wall) => ({ kind: 'wall' as const, wall }))).filter(
    (viewModel) => viewModel.statusCode === 'verified',
  ).length;
}

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

export function usePipelineGraph(options: UsePipelineGraphOptions): UsePipelineGraphResult {
  const { forceCollapsed, gateway, projectId, roles = NO_ROLES, run } = options;

  const prefersReducedMotion = useReducedMotion();
  const detectedNarrow = useNarrowViewport();
  const isCompact = forceCollapsed ?? detectedNarrow;
  const viewport = useCanvasViewport();

  const [mode, setMode] = useState<PipelineGraphMode>('overview');
  const [selectedNodeId, setSelectedNodeId] = useState<PipelineNodeId>(INITIAL_NODE_ID);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isRerunConfirming, setIsRerunConfirming] = useState(false);
  const [isKeepingApproved, setIsKeepingApproved] = useState(true);
  const [rerunFrom, setRerunFrom] = useState<PipelineNodeId | null>(null);
  const [isSwitchConfirming, setIsSwitchConfirming] = useState(false);
  const [stages, setStages] = useState<readonly PipelineStageState[]>([]);
  const [streamFailure, setStreamFailure] = useState<PipelineGraphFailure | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const canSeeDetail = roles.some((role) => DETAIL_MODE_ROLES.includes(role));

  /* ---- Dòng sự kiện của T-08 -------------------------------------------- */

  useEffect(() => {
    if (run === undefined) {
      return undefined;
    }

    setStreamFailure(null);

    return gateway.subscribeRun(
      { floorId: run.floorId, projectId, uploadId: run.uploadId },
      {
        onStages: (next) => {
          setStages(next);
        },
        onFailure: (failure) => {
          setStreamFailure(failure);
        },
      },
    );
  }, [gateway, projectId, retryToken, run]);

  /* ---- Ba lượt đọc, tất cả qua react-query (R-64) ------------------------ */

  const branchQuery = useQuery({
    queryKey: [...pipelineBranchQueryKey(projectId), retryToken],
    queryFn: () => gateway.readBranchReport({ projectId }),
  });

  const comparisonQuery = useQuery({
    queryKey: pipelineComparisonQueryKey,
    queryFn: () => gateway.readBranchComparison(),
  });

  const nodeDetailQuery = useQuery({
    queryKey: pipelineNodeQueryKey(projectId, selectedNodeId),
    queryFn: () => gateway.readNodeDetail({ projectId, nodeId: selectedNodeId }),
    enabled: canSeeDetail,
  });

  const switchMutation = useMutation({
    mutationFn: (targetBranch: PipelineBranchId) =>
      gateway.switchBranch({ projectId, targetBranch }),
  });

  const rerunMutation = useMutation({
    mutationFn: (input: { readonly nodeId: PipelineNodeId; readonly keepApproved: boolean }) =>
      gateway.rerunFromNode({ projectId, ...input }),
  });

  /* ---- Số mục QC đã duyệt, qua P-03 ------------------------------------- */

  const spatial = useStore((state) => state.spatial);

  const approvedWallCount = useMemo(() => {
    if (spatial === null) {
      return 0;
    }

    const walls = (spatial.byKind.wall ?? [])
      .map((wallId) => spatial.byId[wallId])
      .filter((entity): entity is Wall => entity !== undefined && isEntityOfKind('wall', entity));

    return countApprovedWalls(walls);
  }, [spatial]);

  /* ---- Nhánh và dẫn chứng ----------------------------------------------- */

  const branchReport: PipelineRawBranchReport | null =
    branchQuery.data?.supported === true ? branchQuery.data.value : null;

  const comparisonRows = useMemo(() => {
    if (comparisonQuery.data?.supported !== true) {
      return [];
    }

    return comparisonQuery.data.value.map((row) => ({
      id: row.id,
      label: row.label,
      cadText: row.cadText,
      aiText: row.aiText,
    }));
  }, [comparisonQuery.data]);

  const evidenceRows = useMemo(
    () =>
      (branchReport?.floors ?? []).map((floor) => ({
        id: floor.floorId,
        floorLabel: floor.floorName,
        sentence: floor.reason,
        branch: floor.branch,
      })),
    [branchReport],
  );

  const activeBranch = branchReport?.activeBranch;
  const hasBranchFailure = (branchReport?.floors ?? []).some((floor) => floor.hasFailed);
  const isMixedBranch = branchReport !== null && activeBranch === undefined;

  const branches = useMemo(
    () =>
      PIPELINE_GRAPH_TEXT.branchOrder.map((branchId) => ({
        id: branchId,
        label: PIPELINE_GRAPH_TEXT.branchLabels[branchId],
        isActive: activeBranch === branchId,
        hasFailed: (branchReport?.floors ?? []).some(
          (floor) => floor.branch === branchId && floor.hasFailed,
        ),
        ...(activeBranch === branchId
          ? { activeBadgeLabel: PIPELINE_GRAPH_TEXT.activeBadge }
          : {}),
      })),
    [activeBranch, branchReport],
  );

  /* ---- Bảy nút của sơ đồ kỹ thuật --------------------------------------- */

  const downstream = useMemo(
    () => (rerunFrom === null ? new Set<PipelineNodeId>() : collectDownstream(rerunFrom)),
    [rerunFrom],
  );

  const statusByNode = useMemo(() => {
    const byNode = new Map<PipelineNodeId, PipelineNodeStatus>();
    const hasRun = stages.length > 0;

    for (const node of PIPELINE_NODES) {
      if (node.stageId !== undefined) {
        byNode.set(node.id, statusOfStage(stages, node.stageId));
      }
    }

    for (const node of PIPELINE_NODES) {
      if (node.stageId !== undefined) {
        continue;
      }

      byNode.set(
        node.id,
        node.inheritsFrom === undefined
          ? hasRun
            ? 'done'
            : 'queued'
          : (byNode.get(node.inheritsFrom) ?? 'queued'),
      );
    }

    return byNode;
  }, [stages]);

  const nodeDetail: PipelineRawNodeDetail | null =
    nodeDetailQuery.data?.supported === true ? nodeDetailQuery.data.value : null;

  const nodes: readonly PipelineNodeViewModel[] = useMemo(
    () =>
      PIPELINE_NODES.map((node, index) => {
        const text = PIPELINE_NODE_TEXT[node.id];
        const status = statusByNode.get(node.id) ?? 'queued';

        return {
          id: node.id,
          name: text.name,
          ...(text.technicalLabel !== undefined
            ? { technicalLabel: text.technicalLabel }
            : {}),
          ...(text.formula !== undefined ? { formula: text.formula } : {}),
          status,
          statusLabel: PIPELINE_GRAPH_TEXT.statusLabels[status],
          subRows: text.subRows.map((label, subIndex) => ({
            id: `${node.id}-${String(subIndex)}`,
            label,
          })),
          column: node.column,
          row: node.row,
          edgeTargets: node.edgeTargets,
          enterDelayMs: staggerDelayMs(index, { reducedMotion: prefersReducedMotion }),
          isSelected: node.id === selectedNodeId,
          // Mờ xuống cho tới khi CHÍNH nút đó báo xong, nên các nút phía sau
          // sáng lại lần lượt theo đúng thứ tự T-08 báo về, chứ không cùng lúc.
          isDownstreamOfRerun: downstream.has(node.id) && status !== 'done',
        };
      }),
    [downstream, prefersReducedMotion, selectedNodeId, statusByNode],
  );

  /**
   * Thời lượng và số đầu ra chỉ gắn vào ĐÚNG nút đang chọn: cổng trả chi tiết
   * theo từng nút, và bịa cho tám nút còn lại là đúng thứ R-69 cấm.
   */
  const decoratedNodes = useMemo(
    () =>
      nodes.map((node) => {
        if (nodeDetail === null || nodeDetail.nodeId !== node.id) {
          return node;
        }

        return {
          ...node,
          ...(nodeDetail.durationMs !== undefined
            ? { durationLabel: formatDuration(nodeDetail.durationMs) }
            : {}),
          ...(nodeDetail.outputCount !== undefined
            ? {
                outputCountLabel: `${formatNumber(nodeDetail.outputCount)} ${
                  nodeDetail.outputUnit ?? PIPELINE_GRAPH_TEXT.defaultOutputUnit
                }`,
              }
            : {}),
        };
      }),
    [nodeDetail, nodes],
  );

  /* ---- Panel phải -------------------------------------------------------- */

  const selectedText = PIPELINE_NODE_TEXT[selectedNodeId];
  const isRerunSupported = gateway.supports.rerunFromNode;

  const panel = useMemo(
    () => ({
      title: selectedText.name,
      inputLines: nodeDetail?.inputLines ?? [],
      parameterRows: (nodeDetail?.parameters ?? []).map((parameter) => ({
        id: parameter.id,
        label: parameter.label,
        value: parameter.value,
      })),
      ...(nodeDetail?.outputCount !== undefined
        ? {
            outputCountLabel: `${formatNumber(nodeDetail.outputCount)} ${
              nodeDetail.outputUnit ?? PIPELINE_GRAPH_TEXT.defaultOutputUnit
            }`,
          }
        : {}),
      ...(nodeDetail?.thumbnailUrl !== undefined
        ? {
            thumbnail: {
              url: nodeDetail.thumbnailUrl,
              alt: `${PIPELINE_GRAPH_TEXT.thumbnailAltPrefix}${selectedText.name}`,
            },
          }
        : {}),
      logLines: nodeDetail?.logLines ?? [],
      isLogOpen,
      rerunLabel: PIPELINE_GRAPH_TEXT.rerunLabel,
      ...(isRerunConfirming
        ? {
            rerunWarning: {
              title: PIPELINE_GRAPH_TEXT.rerunWarningTitle,
              message: PIPELINE_GRAPH_TEXT.rerunWarningMessage(
                formatNumber(approvedWallCount),
                selectedText.name,
              ),
              keepApprovedLabel: PIPELINE_GRAPH_TEXT.keepApprovedLabel,
              isKeepingApproved,
              confirmLabel: PIPELINE_GRAPH_TEXT.rerunConfirmLabel,
              dismissLabel: PIPELINE_GRAPH_TEXT.dismissLabel,
            },
          }
        : {}),
      ...(isRerunSupported
        ? {}
        : { rerunUnavailableLine: PIPELINE_GRAPH_TEXT.rerunUnavailableLine }),
    }),
    [
      approvedWallCount,
      isKeepingApproved,
      isLogOpen,
      isRerunConfirming,
      isRerunSupported,
      nodeDetail,
      selectedText,
    ],
  );

  /* ---- Bảy trạng thái (A11) --------------------------------------------- */

  const failure = streamFailure;
  const isPending = branchQuery.isPending || comparisonQuery.isPending;
  const isRunning = stages.some((stage) => stage.status === 'running');
  const isEverythingDone =
    stages.length > 0 && stages.every((stage) => stage.status === 'done');

  /**
   * Thứ tự xét, cùng khuôn `useProcessingScreen.ts:685`: đang tải → lỗi → không
   * có quyền → rỗng → thu gọn → một phần → xong.
   *
   * Một chỗ lệch có chủ ý: `empty` xét TRƯỚC `collapsed`. Màn không có gì để kể
   * thì phải nói ra điều đó ở mọi bề rộng, chứ không im lặng đưa ra một sơ đồ
   * xếp dọc rỗng (A11). Cách xếp thu gọn vẫn đúng ở mọi trạng thái vì view đọc
   * thẳng `isCompact`, không đọc `state`.
   */
  const state: PipelineGraphState = isPending
    ? 'loading'
    : failure !== null
      ? 'error'
      : !canSeeDetail
        ? 'forbidden'
        : run === undefined && branchReport === null
          ? 'empty'
          : isCompact
            ? 'collapsed'
            : isMixedBranch || hasBranchFailure || !isEverythingDone
              ? 'partial'
              : 'success';

  /* ---- Hành động --------------------------------------------------------- */

  const onModeChange = useCallback((next: PipelineGraphMode) => {
    setMode(next);
  }, []);

  const onSelectNode = useCallback((nodeId: PipelineNodeId) => {
    setSelectedNodeId(nodeId);
    setIsRerunConfirming(false);
  }, []);

  const onToggleLog = useCallback(() => {
    setIsLogOpen((previous) => !previous);
  }, []);

  const onRequestRerun = useCallback(() => {
    setIsRerunConfirming(true);
  }, []);

  const onToggleKeepApproved = useCallback(() => {
    setIsKeepingApproved((previous) => !previous);
  }, []);

  const onConfirmRerun = useCallback(() => {
    setIsRerunConfirming(false);
    setRerunFrom(selectedNodeId);
    rerunMutation.mutate({ nodeId: selectedNodeId, keepApproved: isKeepingApproved });
  }, [isKeepingApproved, rerunMutation, selectedNodeId]);

  const onDismissRerun = useCallback(() => {
    setIsRerunConfirming(false);
  }, []);

  const onRequestSwitchBranch = useCallback(() => {
    setIsSwitchConfirming(true);
  }, []);

  const onConfirmSwitchBranch = useCallback(() => {
    setIsSwitchConfirming(false);
    switchMutation.mutate(SWITCH_TARGET_BRANCH);
  }, [switchMutation]);

  const onDismissSwitchBranch = useCallback(() => {
    setIsSwitchConfirming(false);
  }, []);

  const onRetry = useCallback(() => {
    setStreamFailure(null);
    setRetryToken((previous) => previous + 1);
  }, []);

  const onPanGraph = viewport.pan;

  const onZoomGraph = useCallback(
    (zoom: number) => {
      viewport.zoomTo(zoom);
    },
    [viewport],
  );

  const onResetViewport = useCallback(() => {
    viewport.zoomTo(1);
  }, [viewport]);

  const actions: PipelineGraphActions = useMemo(
    () => ({
      onModeChange,
      onSelectNode,
      onToggleLog,
      onRequestRerun,
      onToggleKeepApproved,
      onConfirmRerun,
      onDismissRerun,
      onRequestSwitchBranch,
      onConfirmSwitchBranch,
      onDismissSwitchBranch,
      onRetry,
      onPanGraph,
      onZoomGraph,
      onResetViewport,
    }),
    [
      onConfirmRerun,
      onConfirmSwitchBranch,
      onDismissRerun,
      onDismissSwitchBranch,
      onModeChange,
      onPanGraph,
      onRequestRerun,
      onRequestSwitchBranch,
      onResetViewport,
      onRetry,
      onSelectNode,
      onToggleKeepApproved,
      onToggleLog,
      onZoomGraph,
    ],
  );

  /* ---- Mô hình của view -------------------------------------------------- */

  const model: PipelineGraphViewModel = {
    state,
    mode: canSeeDetail ? mode : 'overview',
    title: PIPELINE_GRAPH_TEXT.title,
    leadLine: PIPELINE_GRAPH_TEXT.leadLine,
    overview: {
      blocks: PIPELINE_OVERVIEW_BLOCKS,
      branches,
      comparisonRows,
      evidenceRows,
      reasonLine:
        activeBranch === undefined
          ? PIPELINE_GRAPH_TEXT.reasonUnknown
          : PIPELINE_GRAPH_TEXT.reasonByBranch[activeBranch],
      // Nút đổi nhánh chỉ có nghĩa khi còn nhánh khác để đổi sang: hồ sơ đã chạy
      // nhánh ảnh quét rồi thì "đổi sang nhánh ảnh quét" là một nút không làm gì.
      ...(canSeeDetail && gateway.supports.switchBranch && activeBranch !== SWITCH_TARGET_BRANCH
        ? {
            switchAction: {
              label: PIPELINE_GRAPH_TEXT.switchLabel,
              targetBranch: SWITCH_TARGET_BRANCH,
              isConfirming: isSwitchConfirming,
              warningTitle: PIPELINE_GRAPH_TEXT.switchWarningTitle,
              warningMessage: PIPELINE_GRAPH_TEXT.switchWarningMessage,
              confirmLabel: PIPELINE_GRAPH_TEXT.switchConfirmLabel,
              dismissLabel: PIPELINE_GRAPH_TEXT.dismissLabel,
            },
          }
        : {}),
    },
    ...(canSeeDetail
      ? {
          detail: {
            nodes: decoratedNodes,
            selectedNodeId,
            panel,
            isRunning,
            viewport: {
              x: viewport.viewport.x,
              y: viewport.viewport.y,
              zoom: viewport.viewport.zoom,
              zoomLabel: formatPercent(viewport.viewport.zoom, { source: 'ratio' }),
            },
          },
          detailDisclosureLabel: PIPELINE_GRAPH_TEXT.detailDisclosureLabel,
        }
      : { forbiddenLine: PIPELINE_GRAPH_TEXT.forbiddenLine }),
    ...(state === 'partial' ? { partialNoticeLine: PIPELINE_GRAPH_TEXT.partialNotice } : {}),
    ...(failure !== null
      ? {
          alert: {
            title: failure.title,
            message: failure.sentence,
            technicalCode: failure.technicalCode,
            retryLabel: PIPELINE_GRAPH_TEXT.retryLabel,
          },
        }
      : {}),
    isCompact,
    prefersReducedMotion,
  };

  return { model, actions };
}

/** Dấu gạch của `@/lib/format` khi một số chưa có — dùng chung cho cả màn. */
export const PIPELINE_MISSING_VALUE = MISSING_VALUE;
