import React, { useCallback, useRef } from 'react';
import { cn } from '../../lib/utils';
import { axisStrokeToken } from './materialMap';
import { formatMm } from '../../lib/format';
import { useTransformGizmo, type Axis } from '../../hooks/useTransformGizmo';

interface TransformGizmoProps {
  isVisible?: boolean;
  /** Vị trí tâm gizmo (px) */
  cx?: number;
  cy?: number;
  className?: string;
}

/** Cấu hình trục: hướng mũi tên trong không gian SVG */
const AXIS_CONFIG: {
  id: Axis;
  x2: number;
  y2: number;
  labelOffsetX: number;
  labelOffsetY: number;
}[] = [
  { id: 'x', x2: 56,  y2: 0,   labelOffsetX: 10, labelOffsetY: 4  },
  { id: 'y', x2: 0,   y2: -56, labelOffsetX: -4, labelOffsetY: -10 },
  { id: 'z', x2: -36, y2: 42,  labelOffsetX: -16, labelOffsetY: 10 },
];

const HANDLE_SIZE = 8;

/**
 * TransformGizmo — tay kéo 3 trục.
 * - Handle: 8×8, bo 6, nền bg-surface, viền accent
 * - Trục X/Y/Z: thang xám ấm từ materialMap (không đỏ/xanh bão hòa)
 * - Nhãn trục font-mono
 * - Số delta mm khi kéo dùng formatMm()
 */
export function TransformGizmo({
  isVisible = true,
  cx = 80,
  cy = 80,
  className,
}: TransformGizmoProps) {
  const { activeAxis, delta, startDrag, updateDrag, endDrag } = useTransformGizmo();

  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGGElement>, axis: Axis) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      startDrag(axis);
    },
    [startDrag]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGGElement>) => {
      if (!lastPosRef.current) return;
      const dx = e.clientX - lastPosRef.current.x;
      const dy = e.clientY - lastPosRef.current.y;
      updateDrag(dx, dy);
      lastPosRef.current = { x: e.clientX, y: e.clientY };
    },
    [updateDrag]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGGElement>) => {
      e.currentTarget.releasePointerCapture(e.pointerId);
      lastPosRef.current = null;
      endDrag();
    },
    [endDrag]
  );

  if (!isVisible) return null;

  return (
    <div
      className={cn('absolute pointer-events-none', className)}
      style={{ left: cx - 80, top: cy - 80, width: 160, height: 160 }}
      role="group"
      aria-label="Transform gizmo"
    >
      <svg
        className="overflow-visible w-full h-full"
        viewBox="-80 -80 160 160"
        aria-hidden="true"
      >
        {AXIS_CONFIG.map((axis) => {
          const isActive = activeAxis === axis.id;
          const isOtherActive = activeAxis !== null && !isActive;
          const strokeColor = axisStrokeToken(axis.id);

          return (
            <g
              key={axis.id}
              className="pointer-events-auto cursor-grab active:cursor-grabbing"
              style={{
                opacity: isOtherActive ? 0.25 : 1,
                transition: 'opacity 180ms ease',
              }}
              onPointerDown={(e) => handlePointerDown(e, axis.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              aria-label={`Trục ${axis.id.toUpperCase()}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Escape') endDrag();
              }}
            >
              {/* Hit area vô hình rộng hơn */}
              <line
                x1={0} y1={0} x2={axis.x2} y2={axis.y2}
                stroke="transparent"
                strokeWidth={20}
              />

              {/* Đường trục */}
              <line
                x1={0} y1={0} x2={axis.x2} y2={axis.y2}
                stroke={strokeColor}
                strokeWidth={isActive ? 2 : 1}
                strokeLinecap="round"
                style={{ transition: 'stroke-width 120ms ease' }}
              />

              {/* Handle: 8×8 bo 6 */}
              <rect
                x={axis.x2 - HANDLE_SIZE / 2}
                y={axis.y2 - HANDLE_SIZE / 2}
                width={HANDLE_SIZE}
                height={HANDLE_SIZE}
                rx={3}
                fill="var(--bg-surface)"
                stroke={isActive ? 'var(--accent)' : strokeColor}
                strokeWidth={isActive ? 1.5 : 1}
                style={{ transition: 'stroke 120ms ease, stroke-width 120ms ease' }}
              />

              {/* Nhãn trục */}
              <text
                x={axis.x2 + axis.labelOffsetX}
                y={axis.y2 + axis.labelOffsetY}
                fill={strokeColor}
                fontSize={10}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {axis.id.toUpperCase()}
              </text>
            </g>
          );
        })}

        {/* Điểm trung tâm */}
        <circle
          cx={0} cy={0} r={3}
          fill="var(--bg-surface)"
          stroke="var(--wall-220)"
          strokeWidth={1}
        />
      </svg>

      {/* Readout delta mm — hiện khi đang kéo */}
      {activeAxis && (
        <div
          className={cn(
            'absolute pointer-events-none',
            'bg-bg-surface border border-border-default rounded-[6px]',
            'px-2 py-1 shadow-panel',
            'whitespace-nowrap'
          )}
          style={{
            left: '50%',
            top: -36,
            transform: 'translateX(-50%)',
          }}
          role="status"
          aria-live="polite"
          aria-label={`Delta trục ${activeAxis.toUpperCase()}`}
        >
          <span className="font-mono text-xs text-text-primary">
            {activeAxis.toUpperCase()}: {formatMm(delta[activeAxis])}
          </span>
        </div>
      )}
    </div>
  );
}
