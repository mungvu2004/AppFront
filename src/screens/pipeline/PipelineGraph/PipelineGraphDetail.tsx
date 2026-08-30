/**
 * Chế độ Chi tiết kỹ thuật — nơi gỡ lỗi khi bước tách tường ra 12 tường thay vì 48.
 *
 * View THUẦN (mục D, R-60). Đây là file DUY NHẤT của màn được viết tên thư viện
 * kỹ thuật, và mọi tên đó đi qua `<code>`: vừa đúng "chữ đều" của đặc tả, vừa là
 * thẻ `expectVietnamese` bỏ qua.
 *
 * ## Sơ đồ kéo và thu phóng, vẫn đi được bằng bàn phím
 *
 * Nút là `button` thật, nằm trong luồng Tab bình thường — không dùng roving
 * `tabindex`, vì thứ đó đổi một nút thành "không tới được" dưới con mắt của
 * `expectAccessible`. Phím mũi tên **thêm** một lối đi thứ hai: chúng đổi nút
 * đang chọn theo thứ tự sơ đồ và mang tiêu điểm theo (A12).
 *
 * Kéo bằng chuột đi qua `onPanGraph`, thu phóng đi qua `onZoomGraph` — cả hai là
 * hành động của hook, nên khung nhìn là một giá trị có thể dựng thẳng trong story.
 *
 * ## Sơ đồ vào so le 24 ms
 *
 * `enterDelayMs` do hook tính bằng `staggerDelayMs` của `@/lib/motion` (24 ms một
 * nút, trần 200 ms). Nó chỉ có nghĩa khi có một chuyển động để trễ, nên nút
 * thường mang `animate-panel-rise` — keyframe đã có sẵn trong `tailwind.config.ts`,
 * không phải một keyframe viết mới ở tầng màn.
 *
 * ## Chấm trạng thái, và vì sao "xong" KHÔNG xanh
 *
 * Bất biến A5: màu xanh "đã xác minh" chỉ đánh dấu việc người duyệt, và đầu ra
 * của máy không bao giờ được đặt nó. Một bước pipeline chạy xong là đầu ra của
 * máy, nên nó nhận màu chữ trung tính. Vàng dành cho bước đang chạy, đỏ cho bước
 * hỏng — đúng ba màu trạng thái của A4, không có màu thứ tư.
 */

import { useRef } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { clsx } from 'clsx';

import { IconButton } from '@/components/ui/IconButton';
import { AMBIENT_LOOP_MS } from '@/lib/motion';

import { PipelineGraphPanel } from './PipelineGraphPanel';
import { PIPELINE_GRAPH_TEXT } from './pipelineGraphText';
import type {
  PipelineDetailViewModel,
  PipelineNodeId,
  PipelineNodeStatus,
  PipelineNodeViewModel,
} from './types';

/* -------------------------------------------------------------------------- */
/* Kích thước sơ đồ.                                                           */
/* -------------------------------------------------------------------------- */

const NODE_WIDTH = 200;
const NODE_MIN_HEIGHT = 92;
const COLUMN_STEP = 248;
const ROW_STEP = 200;
const GRAPH_WIDTH = COLUMN_STEP * 6 + NODE_WIDTH;
const GRAPH_HEIGHT = ROW_STEP * 2 + NODE_MIN_HEIGHT;
/**
 * Khung nhìn phải chứa hết hàng cuối cùng: hàng 2 bắt đầu ở `ROW_STEP * 2` và
 * nút ở đó cao ít nhất `NODE_MIN_HEIGHT`, nên thấp hơn tổng ấy là cắt mất chân.
 */
const CANVAS_HEIGHT = ROW_STEP * 2 + NODE_MIN_HEIGHT + 28;

/** Nút phía sau nút vừa xin chạy lại mờ xuống trong lúc chờ. */
const DOWNSTREAM_OPACITY = 0.4;

/** Nút hỏng đập viền ba nhịp rồi giữ tĩnh. */
const FAILURE_PULSE_BEATS = 3;

/** Mỗi lần bấm phóng to hoặc thu nhỏ đổi tỷ lệ bấy nhiêu lần. */
const ZOOM_STEP_RATIO = 1.2;

const NODE_STATUS_DOT: Readonly<Record<PipelineNodeStatus, string>> = {
  queued: 'bg-border-default',
  running: 'bg-state-attention',
  done: 'bg-text-secondary',
  failed: 'bg-state-violation',
};

const nodeX = (node: PipelineNodeViewModel): number => node.column * COLUMN_STEP;
const nodeY = (node: PipelineNodeViewModel): number => node.row * ROW_STEP;

export interface PipelineGraphDetailProps {
  readonly detail: PipelineDetailViewModel;
  readonly isCompact: boolean;
  readonly prefersReducedMotion: boolean;
  readonly onSelectNode: (nodeId: PipelineNodeId) => void;
  readonly onToggleLog: () => void;
  readonly onRequestRerun: () => void;
  readonly onToggleKeepApproved: () => void;
  readonly onConfirmRerun: () => void;
  readonly onDismissRerun: () => void;
  readonly onPanGraph: (deltaX: number, deltaY: number) => void;
  readonly onZoomGraph: (zoom: number) => void;
  readonly onResetViewport: () => void;
}

/** Cạnh 1px một màu; chạy nét đứt khi lượt xử lý đang chạy thật. */
function GraphEdges({
  isRunning,
  nodes,
  prefersReducedMotion,
}: {
  isRunning: boolean;
  nodes: readonly PipelineNodeViewModel[];
  prefersReducedMotion: boolean;
}) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const isMarching = isRunning && !prefersReducedMotion;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 text-border-default"
      height={GRAPH_HEIGHT}
      viewBox={`0 0 ${String(GRAPH_WIDTH)} ${String(GRAPH_HEIGHT)}`}
      width={GRAPH_WIDTH}
    >
      {nodes.flatMap((node) =>
        node.edgeTargets.map((targetId) => {
          const target = byId.get(targetId);

          if (target === undefined) {
            return null;
          }

          const x1 = nodeX(node) + NODE_WIDTH;
          const y1 = nodeY(node) + NODE_MIN_HEIGHT / 2;
          const x2 = nodeX(target);
          const y2 = nodeY(target) + NODE_MIN_HEIGHT / 2;
          const midX = (x1 + x2) / 2;

          return (
            <polyline
              fill="none"
              key={`${node.id}-${targetId}`}
              points={`${String(x1)},${String(y1)} ${String(midX)},${String(y1)} ${String(midX)},${String(y2)} ${String(x2)},${String(y2)}`}
              stroke="currentColor"
              strokeDasharray={isRunning ? '4 4' : undefined}
              strokeWidth={1}
            >
              {isMarching ? (
                <animate
                  attributeName="stroke-dashoffset"
                  dur={`${String(AMBIENT_LOOP_MS)}ms`}
                  from="8"
                  repeatCount="indefinite"
                  to="0"
                />
              ) : null}
            </polyline>
          );
        }),
      )}
    </svg>
  );
}

/** Một nút: tên · tên thư viện · thời lượng · số đầu ra · một chấm trạng thái. */
function GraphNode({
  isAbsolute,
  node,
  onKeyDown,
  onSelectNode,
  prefersReducedMotion,
  registerRef,
}: {
  isAbsolute: boolean;
  node: PipelineNodeViewModel;
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>, node: PipelineNodeViewModel) => void;
  onSelectNode: (nodeId: PipelineNodeId) => void;
  prefersReducedMotion: boolean;
  registerRef: (nodeId: PipelineNodeId, element: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      aria-pressed={node.isSelected}
      className={clsx(
        'flex flex-col gap-1.5 rounded-[12px] bg-bg-surface p-4 text-left',
        'transition-opacity duration-180 ease-enter',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        isAbsolute ? 'absolute' : 'relative w-full',
        node.isSelected
          ? 'border-2 border-accent'
          : node.status === 'failed'
            ? 'border-2 border-state-violation'
            : 'border border-border-default',
        // Hai chuyển động loại trừ nhau, không chồng lên nhau: nút hỏng đập viền,
        // nút thường trôi lên khi sơ đồ vào. Gắn cả hai class thì thứ tự sinh
        // CSS của Tailwind quyết định cái nào thắng — không đoán được.
        prefersReducedMotion
          ? undefined
          : node.status === 'failed'
            ? 'animate-pulse'
            : 'animate-panel-rise',
      )}
      onClick={() => {
        onSelectNode(node.id);
      }}
      onKeyDown={(event) => {
        onKeyDown(event, node);
      }}
      ref={(element) => {
        registerRef(node.id, element);
      }}
      style={{
        ...(isAbsolute
          ? { left: nodeX(node), top: nodeY(node), width: NODE_WIDTH, minHeight: NODE_MIN_HEIGHT }
          : {}),
        ...(node.status === 'failed' ? { animationIterationCount: FAILURE_PULSE_BEATS } : {}),
        // `opacity` nội tuyến thắng `animate-panel-rise`, nên nút đang chờ chạy
        // lại giữ nguyên mức mờ 0,4 thay vì trôi lên rồi sáng hẳn.
        ...(node.isDownstreamOfRerun ? { opacity: DOWNSTREAM_OPACITY } : {}),
        ...(prefersReducedMotion ? {} : { animationDelay: `${String(node.enterDelayMs)}ms` }),
      }}
      type="button"
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={clsx('h-2 w-2 shrink-0 rounded-full', NODE_STATUS_DOT[node.status])}
        />
        <span className="text-[14px] text-text-primary">{node.name}</span>
      </span>

      {node.technicalLabel !== undefined ? (
        <code className="font-mono text-[12px] text-text-secondary">{node.technicalLabel}</code>
      ) : null}

      {node.formula !== undefined ? (
        <code className="font-mono text-[12px] text-text-secondary">{node.formula}</code>
      ) : null}

      {node.subRows.length === 0 ? null : (
        <span className="flex flex-col gap-0.5">
          {node.subRows.map((subRow) => (
            <span className="text-[12px] text-text-secondary" key={subRow.id}>
              {subRow.label}
            </span>
          ))}
        </span>
      )}

      <span className="flex flex-wrap items-baseline gap-2 text-[12px] text-text-muted">
        <span>{node.statusLabel}</span>
        {node.durationLabel !== undefined ? (
          <code className="font-mono">{node.durationLabel}</code>
        ) : null}
        {node.outputCountLabel !== undefined ? <span>{node.outputCountLabel}</span> : null}
      </span>
    </button>
  );
}

/** Ba nút thu phóng của riêng sơ đồ này. */
function GraphZoomControls({
  detail,
  onResetViewport,
  onZoomGraph,
}: Pick<PipelineGraphDetailProps, 'detail' | 'onResetViewport' | 'onZoomGraph'>) {
  return (
    <div
      aria-label={PIPELINE_GRAPH_TEXT.zoomResetLabel}
      className="absolute bottom-3 right-3 flex items-center gap-1 rounded-[12px] border border-border-default bg-bg-surface px-2 py-1.5 shadow-float"
      role="group"
    >
      <IconButton
        aria-label={PIPELINE_GRAPH_TEXT.zoomOutLabel}
        icon={<Minus size={14} strokeWidth={2} />}
        onClick={() => {
          onZoomGraph(detail.viewport.zoom / ZOOM_STEP_RATIO);
        }}
        size="sm"
      />
      <span className="min-w-[52px] text-center font-mono text-[13px] text-text-primary">
        {detail.viewport.zoomLabel}
      </span>
      <IconButton
        aria-label={PIPELINE_GRAPH_TEXT.zoomInLabel}
        icon={<Plus size={14} strokeWidth={2} />}
        onClick={() => {
          onZoomGraph(detail.viewport.zoom * ZOOM_STEP_RATIO);
        }}
        size="sm"
      />
      <IconButton
        aria-label={PIPELINE_GRAPH_TEXT.zoomResetLabel}
        icon={<Maximize2 size={14} strokeWidth={2} />}
        onClick={onResetViewport}
        size="sm"
      />
    </div>
  );
}

export function PipelineGraphDetail(props: PipelineGraphDetailProps) {
  const { detail, isCompact, onPanGraph, onSelectNode, prefersReducedMotion } = props;

  const nodeRefs = useRef(new Map<PipelineNodeId, HTMLButtonElement>());
  const dragOrigin = useRef<{ x: number; y: number } | null>(null);

  const registerRef = (nodeId: PipelineNodeId, element: HTMLButtonElement | null): void => {
    if (element === null) {
      nodeRefs.current.delete(nodeId);
      return;
    }

    nodeRefs.current.set(nodeId, element);
  };

  /** Phím mũi tên đổi nút đang chọn theo thứ tự sơ đồ và mang tiêu điểm theo. */
  const handleNodeKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    node: PipelineNodeViewModel,
  ): void => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;

    if (step === 0) {
      return;
    }

    const index = detail.nodes.findIndex((candidate) => candidate.id === node.id);
    const next = detail.nodes[index + step];

    if (next === undefined) {
      return;
    }

    event.preventDefault();
    onSelectNode(next.id);
    nodeRefs.current.get(next.id)?.focus();
  };

  const graphNodes = detail.nodes.map((node) => (
    <GraphNode
      isAbsolute={!isCompact}
      key={node.id}
      node={node}
      onKeyDown={handleNodeKeyDown}
      onSelectNode={onSelectNode}
      prefersReducedMotion={prefersReducedMotion}
      registerRef={registerRef}
    />
  ));

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {isCompact ? (
        <ol
          aria-label={PIPELINE_GRAPH_TEXT.detailStepListAriaLabel}
          className="flex flex-1 flex-col gap-3"
        >
          {detail.nodes.map((node, index) => (
            <li key={node.id}>{graphNodes[index]}</li>
          ))}
        </ol>
      ) : (
        <div
          aria-label={PIPELINE_GRAPH_TEXT.detailGraphAriaLabel}
          className="relative flex-1 overflow-hidden rounded-[12px] border border-border-default bg-bg-sunken"
          onPointerDown={(event) => {
            dragOrigin.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerMove={(event) => {
            const origin = dragOrigin.current;

            if (origin === null) {
              return;
            }

            onPanGraph(event.clientX - origin.x, event.clientY - origin.y);
            dragOrigin.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerUp={() => {
            dragOrigin.current = null;
          }}
          role="group"
          style={{ height: CANVAS_HEIGHT }}
        >
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              height: GRAPH_HEIGHT,
              width: GRAPH_WIDTH,
              transform: `translate(${String(detail.viewport.x)}px, ${String(detail.viewport.y)}px) scale(${String(detail.viewport.zoom)})`,
            }}
          >
            <GraphEdges
              isRunning={detail.isRunning}
              nodes={detail.nodes}
              prefersReducedMotion={prefersReducedMotion}
            />
            {graphNodes}
          </div>

          <GraphZoomControls
            detail={detail}
            onResetViewport={props.onResetViewport}
            onZoomGraph={props.onZoomGraph}
          />
        </div>
      )}

      <PipelineGraphPanel
        onConfirmRerun={props.onConfirmRerun}
        onDismissRerun={props.onDismissRerun}
        onRequestRerun={props.onRequestRerun}
        onToggleKeepApproved={props.onToggleKeepApproved}
        onToggleLog={props.onToggleLog}
        panel={detail.panel}
      />
    </div>
  );
}
