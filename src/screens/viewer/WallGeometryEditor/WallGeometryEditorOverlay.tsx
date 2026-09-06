/**
 * Lớp phủ tay nắm + bắt điểm + tô sáng cạnh + chuỗi kích thước sống.
 *
 * Toạ độ của mọi thứ ở đây đã là PIXEL KHUNG NHÌN do hook chiếu sẵn
 * (`WallGeometryPointPx`) — file này không chiếu, không tính giao điểm, chỉ
 * đặt hình vào đúng chỗ được bảo (Cấm tuyệt đối #1).
 *
 * Đường bắt điểm và cạnh tô sáng vẽ bằng SVG, không bắt con trỏ
 * (`pointer-events-none`); tay nắm là các `<button>` HTML thật nằm trên lớp đó
 * để Tab tới được và Enter/phím mũi tên dùng được (A12). Màu lấy từ biến CSS
 * token qua `style`, đúng cách `ViewerOverlays.tsx` đã làm với `colorToken` —
 * không phải mã màu thô (A1).
 */
import type { KeyboardEvent, ReactNode } from 'react';

import { cssDurationMs } from '@/lib/motion';
import { cn } from '@/lib/utils';

import {
  WALL_GEOMETRY_EDITOR_LAYOUT,
  WALL_GEOMETRY_MOTION,
  type WallGeometryDimensionChain,
  type WallGeometryEdgeHighlight,
  type WallGeometryHandle,
  type WallGeometryNudgeDirection,
  type WallGeometrySnapModel,
  type WallGeometryTone,
} from './wallGeometryEditorTypes';

const NUDGE_KEYS: Readonly<Record<string, WallGeometryNudgeDirection>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

/** Ba màu trạng thái của A4 (`verified` không xuất hiện trên màn này — A5). */
function toneVar(tone: WallGeometryTone): string {
  return tone === 'neutral' ? 'var(--border-default)' : `var(--state-${tone})`;
}

function HandleButton({
  handle,
  isReturning,
}: {
  handle: WallGeometryHandle;
  isReturning: boolean;
}): ReactNode {
  const layout = WALL_GEOMETRY_EDITOR_LAYOUT;
  const sizePx = handle.kind === 'edge' ? layout.edgeHandlePx : handle.isHovered ? layout.vertexHandleHoverPx : layout.vertexHandlePx;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const direction = NUDGE_KEYS[event.key];

    if (direction === undefined) {
      return;
    }

    event.preventDefault();
    handle.onNudge(direction, event.shiftKey);
  };

  return (
    <button
      aria-disabled={!handle.isEnabled}
      aria-label={handle.ariaLabel}
      className={cn(
        'pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 border-solid bg-white outline-none',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface',
        handle.kind === 'vertex' ? 'rounded-full' : 'rounded-[1px]',
        !handle.isEnabled && 'opacity-40',
      )}
      disabled={!handle.isEnabled}
      onKeyDown={handleKeyDown}
      onPointerDown={(): void => {
        handle.onPointerDown(handle.atPx);
      }}
      onPointerEnter={handle.onPointerEnter}
      onPointerLeave={handle.onPointerLeave}
      style={{
        left: handle.atPx.xPx,
        top: handle.atPx.yPx,
        width: sizePx,
        height: sizePx,
        borderWidth: layout.vertexHandleStrokePx,
        borderColor: 'var(--accent)',
        transition: handle.isDragging
          ? 'none'
          : `left ${cssDurationMs(isReturning ? WALL_GEOMETRY_MOTION.cancelDrag : WALL_GEOMETRY_MOTION.snapSettle)}, ` +
            `top ${cssDurationMs(isReturning ? WALL_GEOMETRY_MOTION.cancelDrag : WALL_GEOMETRY_MOTION.snapSettle)}, ` +
            `width ${cssDurationMs(WALL_GEOMETRY_MOTION.snapSettle)}`,
      }}
      type="button"
    />
  );
}

export interface WallGeometryEditorOverlayProps {
  readonly dimensionChain: WallGeometryDimensionChain;
  readonly handles: readonly WallGeometryHandle[];
  readonly snap: WallGeometrySnapModel;
  readonly edgeHighlights: readonly WallGeometryEdgeHighlight[];
  readonly returningHandleId: string | null;
}

export function WallGeometryEditorOverlay({
  dimensionChain,
  handles,
  snap,
  edgeHighlights,
  returningHandleId,
}: WallGeometryEditorOverlayProps): ReactNode {
  return (
    <>
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        {edgeHighlights.map((highlight) => (
          <line
            key={highlight.edgeId}
            stroke={toneVar(highlight.tone)}
            strokeWidth={3}
            x1={highlight.fromPx.xPx}
            x2={highlight.toPx.xPx}
            y1={highlight.fromPx.yPx}
            y2={highlight.toPx.yPx}
          />
        ))}
        {snap.activeGuides.map((guide) => (
          <line
            key={guide.id}
            stroke="var(--accent)"
            strokeDasharray="4 3"
            strokeWidth={WALL_GEOMETRY_EDITOR_LAYOUT.snapGuideStrokePx}
            x1={guide.fromPx.xPx}
            x2={guide.toPx.xPx}
            y1={guide.fromPx.yPx}
            y2={guide.toPx.yPx}
          />
        ))}
      </svg>

      {edgeHighlights.map((highlight) => (
        <span className="sr-only" key={`${highlight.edgeId}-sr`}>
          {highlight.ariaLabel}
        </span>
      ))}

      {dimensionChain.segments.map((segment) => (
        <span
          className={cn(
            'pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-[4px] bg-bg-surface px-1 font-mono text-[11px] text-text-primary shadow-panel',
            segment.isLive && 'text-accent',
          )}
          key={segment.id}
          style={{ left: segment.midpointPx.xPx, top: segment.midpointPx.yPx }}
        >
          {segment.lengthLabel}
        </span>
      ))}

      {snap.activeGuides.map((guide) => (
        <span
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[11px] text-accent"
          key={`${guide.id}-label`}
          style={{ left: guide.labelAtPx.xPx, top: guide.labelAtPx.yPx }}
        >
          {guide.label}
        </span>
      ))}

      {handles.map((handle) => (
        <HandleButton handle={handle} isReturning={handle.id === returningHandleId} key={handle.id} />
      ))}

      {snap.modifierNotice !== null && (
        <span aria-live="polite" className="sr-only" role="status">
          {snap.modifierNotice}
        </span>
      )}
    </>
  );
}
