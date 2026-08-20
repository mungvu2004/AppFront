import React from 'react';
import { cn } from '../../lib/utils';
import { dimensionStrokeToken } from './materialMap';
import type { useMeasurementLabel, Point } from '../../hooks/useMeasurementLabel';

/** Tick mark length (px) tại đầu/cuối đường đo */
const TICK_LENGTH = 8;

interface MeasurementLabelProps {
  state: ReturnType<typeof useMeasurementLabel>['state'];
  startPoint: Point | null;
  currentPoint: Point | null;
  midPoint: Point | null;
  distanceFormatted: string;
  /** Khi true, component ẩn (bị chồng) */
  isHidden?: boolean;
  className?: string;
}

/**
 * MeasurementLabel — nhãn kích thước mono 13px.
 * Nền bg-surface 92% opacity, bo 6, có đường dấu hai đầu (tick marks).
 * Màu đường từ materialMap (dimensionStrokeToken).
 */
export function MeasurementLabel({
  state,
  startPoint,
  currentPoint,
  midPoint,
  distanceFormatted,
  isHidden = false,
  className,
}: MeasurementLabelProps) {
  if (state === 'idle' || !startPoint || !currentPoint || isHidden) return null;

  const strokeColor = dimensionStrokeToken();
  const isCommitted = state === 'committed';

  // Vị trí label
  const labelX = isCommitted
    ? (midPoint?.x ?? 0) + 40
    : currentPoint.x + 16;
  const labelY = isCommitted
    ? (midPoint?.y ?? 0) - 40
    : currentPoint.y + 16;

  // Tính góc của đường đo để vẽ tick vuông góc
  const dx = currentPoint.x - startPoint.x;
  const dy = currentPoint.y - startPoint.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = len > 0 ? dx / len : 1;
  const uy = len > 0 ? dy / len : 0;
  // Normal vector (vuông góc với đường đo)
  const nx = -uy;
  const ny = ux;

  return (
    <>
      {/* SVG: đường đo + tick marks */}
      <svg
        className={cn('absolute inset-0 pointer-events-none', className)}
        style={{ width: '100%', height: '100%', overflow: 'visible' }}
        aria-hidden="true"
      >
        {/* Đường đo chính (dashed) */}
        <line
          x1={startPoint.x}
          y1={startPoint.y}
          x2={currentPoint.x}
          y2={currentPoint.y}
          stroke={strokeColor}
          strokeWidth="1"
          strokeDasharray="5 3"
          strokeLinecap="round"
        />

        {/* Tick mark tại startPoint (vuông góc) */}
        <line
          x1={startPoint.x + nx * TICK_LENGTH / 2}
          y1={startPoint.y + ny * TICK_LENGTH / 2}
          x2={startPoint.x - nx * TICK_LENGTH / 2}
          y2={startPoint.y - ny * TICK_LENGTH / 2}
          stroke={strokeColor}
          strokeWidth="1"
          strokeLinecap="round"
        />

        {/* Tick mark tại currentPoint */}
        <line
          x1={currentPoint.x + nx * TICK_LENGTH / 2}
          y1={currentPoint.y + ny * TICK_LENGTH / 2}
          x2={currentPoint.x - nx * TICK_LENGTH / 2}
          y2={currentPoint.y - ny * TICK_LENGTH / 2}
          stroke={strokeColor}
          strokeWidth="1"
          strokeLinecap="round"
        />

        {/* Đường dẫn từ midpoint tới label (khi committed) */}
        {isCommitted && midPoint && (
          <line
            x1={midPoint.x}
            y1={midPoint.y}
            x2={labelX}
            y2={labelY}
            stroke={strokeColor}
            strokeWidth="0.75"
            strokeLinecap="round"
          />
        )}
      </svg>

      {/* Nhãn pill */}
      <div
        className="absolute pointer-events-none transition-all duration-120"
        style={{
          left: labelX,
          top: labelY,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <span
          className={cn(
            'block font-mono text-[13px] text-text-primary leading-none',
            'px-2 py-1 rounded-[6px]',
            // Nền bg-surface 92% opacity
            'bg-bg-surface/[0.92]',
            // Viền hairline nhẹ
            'border border-border-default/50',
            'shadow-panel'
          )}
        >
          {distanceFormatted}
        </span>
      </div>
    </>
  );
}
