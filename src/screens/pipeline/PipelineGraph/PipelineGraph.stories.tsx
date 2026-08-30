/**
 * Bảy story, một cho mỗi trạng thái của A11 (R-63), cộng bốn cảnh chụp mà phần
 * nghiệm thu yêu cầu.
 *
 * Story dựng thẳng {@link PipelineGraph} — không container, không provider,
 * không cổng dữ liệu, không một lời gọi mạng nào. Đó là thứ mục D mua được: xem
 * được cả bảy trạng thái mà không phải dựng nổi một máy chủ. Cùng khuôn
 * `ScaleCalibration.stories.tsx`.
 *
 * ## Dữ liệu đến từ bộ mẫu của cổng, không bịa tại chỗ (R-70)
 *
 * Ba bộ hằng `PIPELINE_GRAPH_SAMPLE_*` sống trong `pipelineGraphGateway.ts` và
 * là thứ `createMockPipelineGraphGateway()` trả về. Story đọc chính chúng, nên
 * cái người ta nhìn trong Storybook là đúng cái test nhìn qua cổng giả — không
 * có bảng dữ liệu thứ hai ở đây.
 *
 * ## Story đứng vào chỗ của hook, nên nó được phép định dạng
 *
 * `formatDuration` và `formatNumber` xuất hiện ở đây vì story thay hook làm việc
 * ghép view model. Đây không phải view: view nhận chuỗi đã xong và không được
 * biết tới `@/lib/format` (A15).
 */

import type { Meta, StoryObj } from '@storybook/react';

import { formatDuration } from '@/lib/format/datetime';
import { formatNumber } from '@/lib/format/number';
import { staggerDelayMs } from '@/lib/motion';
import { SEVEN_STATES, type SevenState } from '@/lib/testing/sevenStateScenarios';

import { PipelineGraph } from './PipelineGraph';
import {
  PIPELINE_GRAPH_SAMPLE_BRANCH_REPORT,
  PIPELINE_GRAPH_SAMPLE_COMPARISON,
  PIPELINE_GRAPH_SAMPLE_NODE_DETAILS,
} from './pipelineGraphGateway';
import {
  PIPELINE_GRAPH_TEXT,
  PIPELINE_NODE_TEXT,
  PIPELINE_OVERVIEW_BLOCKS,
} from './pipelineGraphText';
import {
  PIPELINE_NODES,
  type PipelineBranchId,
  type PipelineGraphActions,
  type PipelineGraphProps,
  type PipelineNodeId,
  type PipelineNodePanelViewModel,
  type PipelineNodeStatus,
  type PipelineNodeViewModel,
  type PipelineOverviewViewModel,
} from './types';

/** Story không nối dây; mọi hành động là một hàm không làm gì. */
const NO_OP = (): void => undefined;

const ACTIONS: PipelineGraphActions = {
  onModeChange: NO_OP,
  onSelectNode: NO_OP,
  onToggleLog: NO_OP,
  onRequestRerun: NO_OP,
  onToggleKeepApproved: NO_OP,
  onConfirmRerun: NO_OP,
  onDismissRerun: NO_OP,
  onRequestSwitchBranch: NO_OP,
  onConfirmSwitchBranch: NO_OP,
  onDismissSwitchBranch: NO_OP,
  onRetry: NO_OP,
  onPanGraph: NO_OP,
  onZoomGraph: NO_OP,
  onResetViewport: NO_OP,
};

/** Nút đang chọn trong mọi cảnh chi tiết: bước có đủ tham số, ảnh và nhật ký. */
const SELECTED_NODE_ID: PipelineNodeId = 'preprocess';

/** 12 tường đã duyệt — đúng con số phần nghiệm thu bắt cảnh báo phải nêu. */
export const APPROVED_WALL_COUNT = 12;

/* -------------------------------------------------------------------------- */
/* Trạng thái từng nút theo trạng thái màn.                                    */
/* -------------------------------------------------------------------------- */

const DONE_UNTIL: Readonly<Record<SevenState, number>> = {
  empty: 0,
  loading: 1,
  partial: 4,
  error: 2,
  success: PIPELINE_NODES.length,
  forbidden: PIPELINE_NODES.length,
  collapsed: 4,
};

function statusFor(state: SevenState, index: number): PipelineNodeStatus {
  if (state === 'error' && index === DONE_UNTIL.error) {
    return 'failed';
  }

  if (index < DONE_UNTIL[state]) {
    return 'done';
  }

  return index === DONE_UNTIL[state] && (state === 'loading' || state === 'partial')
    ? 'running'
    : 'queued';
}

function nodesFor(state: SevenState): readonly PipelineNodeViewModel[] {
  return PIPELINE_NODES.map((node, index) => {
    const text = PIPELINE_NODE_TEXT[node.id];
    const detail = PIPELINE_GRAPH_SAMPLE_NODE_DETAILS[node.id];
    const status = statusFor(state, index);
    const isDone = status === 'done';

    return {
      id: node.id,
      name: text.name,
      ...(text.technicalLabel !== undefined ? { technicalLabel: text.technicalLabel } : {}),
      ...(text.formula !== undefined ? { formula: text.formula } : {}),
      status,
      statusLabel: PIPELINE_GRAPH_TEXT.statusLabels[status],
      ...(isDone && detail?.durationMs !== undefined
        ? { durationLabel: formatDuration(detail.durationMs) }
        : {}),
      ...(isDone && detail?.outputCount !== undefined
        ? {
            outputCountLabel: `${formatNumber(detail.outputCount)} ${
              detail.outputUnit ?? PIPELINE_GRAPH_TEXT.defaultOutputUnit
            }`,
          }
        : {}),
      subRows: text.subRows.map((label, subIndex) => ({
        id: `${node.id}-${String(subIndex)}`,
        label,
      })),
      column: node.column,
      row: node.row,
      edgeTargets: node.edgeTargets,
      enterDelayMs: staggerDelayMs(index),
      isSelected: node.id === SELECTED_NODE_ID,
      isDownstreamOfRerun: false,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Panel phải.                                                                 */
/* -------------------------------------------------------------------------- */

function panelFor(isRerunConfirming: boolean): PipelineNodePanelViewModel {
  const detail = PIPELINE_GRAPH_SAMPLE_NODE_DETAILS[SELECTED_NODE_ID];
  const text = PIPELINE_NODE_TEXT[SELECTED_NODE_ID];

  return {
    title: text.name,
    inputLines: detail?.inputLines ?? [],
    parameterRows: (detail?.parameters ?? []).map((parameter) => ({
      id: parameter.id,
      label: parameter.label,
      value: parameter.value,
    })),
    ...(detail?.outputCount !== undefined
      ? {
          outputCountLabel: `${formatNumber(detail.outputCount)} ${
            detail.outputUnit ?? PIPELINE_GRAPH_TEXT.defaultOutputUnit
          }`,
        }
      : {}),
    ...(detail?.thumbnailUrl !== undefined
      ? {
          thumbnail: {
            url: detail.thumbnailUrl,
            alt: `${PIPELINE_GRAPH_TEXT.thumbnailAltPrefix}${text.name}`,
          },
        }
      : {}),
    logLines: detail?.logLines ?? [],
    isLogOpen: true,
    rerunLabel: PIPELINE_GRAPH_TEXT.rerunLabel,
    ...(isRerunConfirming
      ? {
          rerunWarning: {
            title: PIPELINE_GRAPH_TEXT.rerunWarningTitle,
            message: PIPELINE_GRAPH_TEXT.rerunWarningMessage(
              formatNumber(APPROVED_WALL_COUNT),
              text.name,
            ),
            keepApprovedLabel: PIPELINE_GRAPH_TEXT.keepApprovedLabel,
            isKeepingApproved: true,
            confirmLabel: PIPELINE_GRAPH_TEXT.rerunConfirmLabel,
            dismissLabel: PIPELINE_GRAPH_TEXT.dismissLabel,
          },
        }
      : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* Chế độ Tổng quan.                                                           */
/* -------------------------------------------------------------------------- */

function overviewFor(
  state: SevenState,
  activeBranch: PipelineBranchId | undefined,
  failedBranch?: PipelineBranchId,
): PipelineOverviewViewModel {
  const isEmpty = state === 'empty';

  return {
    blocks: PIPELINE_OVERVIEW_BLOCKS,
    branches: PIPELINE_GRAPH_TEXT.branchOrder.map((branchId) => ({
      id: branchId,
      label: PIPELINE_GRAPH_TEXT.branchLabels[branchId],
      isActive: activeBranch === branchId,
      hasFailed: failedBranch === branchId,
      ...(activeBranch === branchId ? { activeBadgeLabel: PIPELINE_GRAPH_TEXT.activeBadge } : {}),
    })),
    comparisonRows: isEmpty ? [] : PIPELINE_GRAPH_SAMPLE_COMPARISON,
    evidenceRows: isEmpty
      ? []
      : PIPELINE_GRAPH_SAMPLE_BRANCH_REPORT.floors.map((floor) => ({
          id: floor.floorId,
          floorLabel: floor.floorName,
          sentence: floor.reason,
          branch: floor.branch,
        })),
    reasonLine:
      activeBranch === undefined
        ? PIPELINE_GRAPH_TEXT.reasonUnknown
        : PIPELINE_GRAPH_TEXT.reasonByBranch[activeBranch],
    // Cùng luật với hook: không mời đổi sang nhánh đang chạy sẵn.
    ...(state === 'forbidden' || activeBranch === 'ai'
      ? {}
      : {
          switchAction: {
            label: PIPELINE_GRAPH_TEXT.switchLabel,
            targetBranch: 'ai' as const,
            isConfirming: false,
            warningTitle: PIPELINE_GRAPH_TEXT.switchWarningTitle,
            warningMessage: PIPELINE_GRAPH_TEXT.switchWarningMessage,
            confirmLabel: PIPELINE_GRAPH_TEXT.switchConfirmLabel,
            dismissLabel: PIPELINE_GRAPH_TEXT.dismissLabel,
          },
        }),
  };
}

/* -------------------------------------------------------------------------- */
/* Bảy kịch bản.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Props đầy đủ của một trạng thái.
 *
 * Bảy nhánh, và `SevenState` là một union đóng — nên bỏ sót một trạng thái là
 * lỗi biên dịch ở đây, và `expectSevenStates` bắt lại lần nữa lúc chạy.
 */
export function scenarioFor(state: SevenState): PipelineGraphProps {
  const activeBranch: PipelineBranchId | undefined = state === 'empty' ? undefined : 'cad';

  return {
    actions: ACTIONS,
    model: {
      state,
      mode: 'overview',
      title: PIPELINE_GRAPH_TEXT.title,
      leadLine: PIPELINE_GRAPH_TEXT.leadLine,
      overview: overviewFor(state, activeBranch),
      ...(state === 'forbidden'
        ? { forbiddenLine: PIPELINE_GRAPH_TEXT.forbiddenLine }
        : {
            detail: {
              nodes: nodesFor(state),
              selectedNodeId: SELECTED_NODE_ID,
              panel: panelFor(false),
              isRunning: state === 'loading' || state === 'partial',
              viewport: { x: 0, y: 0, zoom: 1, zoomLabel: '100%' },
            },
            detailDisclosureLabel: PIPELINE_GRAPH_TEXT.detailDisclosureLabel,
          }),
      ...(state === 'partial' ? { partialNoticeLine: PIPELINE_GRAPH_TEXT.partialNotice } : {}),
      ...(state === 'error'
        ? {
            alert: {
              title: 'Không đọc được tiến độ xử lý',
              message:
                'Mất kết nối tới máy chủ xử lý, nên sơ đồ đang dừng ở lần cập nhật gần nhất.',
              technicalCode: 'NETWORK',
              retryLabel: PIPELINE_GRAPH_TEXT.retryLabel,
            },
          }
        : {}),
      isCompact: state === 'collapsed',
      prefersReducedMotion: false,
    },
  };
}

/** Bảy kịch bản, dựng sẵn — test dùng chính bộ này, không dựng bộ thứ hai (R-70). */
export const SEVEN_SCENARIOS: readonly PipelineGraphProps[] = SEVEN_STATES.map(scenarioFor);

/** Tổng quan khi hồ sơ đi nhánh ảnh quét. */
export function aiBranchScenario(): PipelineGraphProps {
  const base = scenarioFor('success');

  return {
    ...base,
    model: { ...base.model, overview: overviewFor('success', 'ai') },
  };
}

/** Chế độ Chi tiết kỹ thuật đã mở. */
export function detailScenario(): PipelineGraphProps {
  const base = scenarioFor('success');

  return { ...base, model: { ...base.model, mode: 'detail' } };
}

/** Chi tiết khi một nhánh lỗi: nút hỏng có viền vi phạm, nhánh kia vẽ nét thường. */
export function failedBranchScenario(): PipelineGraphProps {
  const base = scenarioFor('error');

  return {
    ...base,
    model: {
      ...base.model,
      mode: 'detail',
      overview: overviewFor('error', 'cad', 'ai'),
    },
  };
}

/** Lớp cảnh báo của "Chạy lại từ bước này", đang mở. */
export function rerunWarningScenario(): PipelineGraphProps {
  const base = detailScenario();
  const { detail } = base.model;

  if (detail === undefined) {
    return base;
  }

  return {
    ...base,
    model: { ...base.model, detail: { ...detail, panel: panelFor(true) } },
  };
}

/** Giảm chuyển động: cạnh không chạy nét đứt, nút không so le khi vào (mục B). */
export function reducedMotionScenario(): PipelineGraphProps {
  const base = detailScenario();

  return { ...base, model: { ...base.model, prefersReducedMotion: true } };
}

/* -------------------------------------------------------------------------- */
/* Storybook.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * `excludeStories` KHÔNG phải chuyện gọn gàng, nó là sửa lỗi.
 *
 * CSF coi **mọi** export có tên là một story và gắn `.parameters` lên nó. Gặp
 * một export là số — {@link APPROVED_WALL_COUNT} — Storybook ném
 * `Cannot create property 'parameters' on number '12'` và CẢ file story hỏng
 * trắng. Đã dựng thật và nhìn thấy đúng lỗi đó trước khi thêm dòng này.
 *
 * Những cái tên dưới đây là bộ dựng kịch bản mà `PipelineGraph.test.tsx` nhập
 * lại (R-70: một bộ dữ liệu, không phải hai), nên chúng phải ở lại dạng export —
 * chỉ cần Storybook đừng tưởng chúng là story.
 */
const meta = {
  title: 'Màn hình/Sơ đồ xử lý',
  component: PipelineGraph,
  parameters: { layout: 'fullscreen' },
  excludeStories: [
    'APPROVED_WALL_COUNT',
    'SEVEN_SCENARIOS',
    'scenarioFor',
    'aiBranchScenario',
    'detailScenario',
    'failedBranchScenario',
    'rerunWarningScenario',
    'reducedMotionScenario',
  ],
} satisfies Meta<typeof PipelineGraph>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Rong: Story = { args: scenarioFor('empty') };

export const DangTai: Story = { args: scenarioFor('loading') };

export const MotPhan: Story = { args: scenarioFor('partial') };

export const Loi: Story = { args: scenarioFor('error') };

export const Xong: Story = { args: scenarioFor('success') };

export const KhongCoQuyen: Story = { args: scenarioFor('forbidden') };

export const ThuGon: Story = { args: scenarioFor('collapsed') };

export const TongQuanNhanhAi: Story = { args: aiBranchScenario() };

export const ChiTietKyThuat: Story = { args: detailScenario() };

export const ChiTietNhanhLoi: Story = { args: failedBranchScenario() };

export const CanhBaoChayLai: Story = { args: rerunWarningScenario() };

export const GiamChuyenDong: Story = { args: reducedMotionScenario() };
