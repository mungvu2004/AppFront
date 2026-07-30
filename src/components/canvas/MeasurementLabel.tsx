import React from 'react';
import { MeasurementState } from './useMeasurementLabel';

interface MeasurementLabelProps {
  state: MeasurementState;
  startPoint: { x: number; y: number } | null;
  currentPoint: { x: number; y: number } | null;
  distance: number;
}

export function MeasurementLabel({ state, startPoint, currentPoint, distance }: MeasurementLabelProps) {
  if (state === 'idle' || !startPoint || !currentPoint) return null;

  const midX = (startPoint.x + currentPoint.x) / 2;
  const midY = (startPoint.y + currentPoint.y) / 2;

  // The label is positioned near the cursor while measuring, or anchored with a leader when committed.
  const isCommitted = state === 'committed';
  const labelX = isCommitted ? midX + 40 : currentPoint.x + 16;
  const labelY = isCommitted ? midY - 40 : currentPoint.y + 16;

  return (
    <>
      {/* Measurement Line */}
      <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
        <line
          x1={startPoint.x}
          y1={startPoint.y}
          x2={currentPoint.x}
          y2={currentPoint.y}
          stroke="var(--accent)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        {isCommitted && (
          <line
            x1={midX}
            y1={midY}
            x2={labelX}
            y2={labelY}
            stroke="var(--accent)"
            strokeWidth="1"
          />
        )}
        <circle cx={startPoint.x} cy={startPoint.y} r="3" fill="var(--accent)" />
        <circle cx={currentPoint.x} cy={currentPoint.y} r="3" fill="var(--accent)" />
        {isCommitted && <circle cx={midX} cy={midY} r="3" fill="var(--accent)" />}
      </svg>

      {/* Pill Label */}
      <div
        className="absolute bg-bg-surface rounded-full shadow-overlay px-3 py-1 pointer-events-none transition-all duration-120"
        style={{
          left: labelX,
          top: labelY,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <span className="font-mono text-[13px] text-text-primary leading-none">
          {distance} mm
        </span>
      </div>
    </>
  );
}
