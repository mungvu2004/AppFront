import React from 'react';
import { useTransformGizmo, Axis } from './useTransformGizmo';

interface TransformGizmoProps {
  isVisible?: boolean;
}

export function TransformGizmo({ isVisible = true }: TransformGizmoProps) {
  const { activeAxis, offset, startDrag, endDrag } = useTransformGizmo();

  if (!isVisible) return null;

  const axes: { id: Axis; color: string; label: string; x2: number; y2: number }[] = [
    { id: 'x', color: 'var(--state-violation)', label: 'X', x2: 60, y2: 0 },
    { id: 'y', color: 'var(--state-verified)', label: 'Y', x2: 0, y2: -60 },
    { id: 'z', color: 'var(--accent)', label: 'Z', x2: -35, y2: 45 },
  ];

  return (
    <div className="absolute top-1/2 left-1/2 w-[160px] h-[160px] -ml-[80px] -mt-[80px] pointer-events-none z-10 flex items-center justify-center">
      <svg className="overflow-visible w-full h-full" viewBox="-80 -80 160 160">
        {axes.map((axis) => {
          const isActive = activeAxis === axis.id;
          const isOtherActive = activeAxis !== null && !isActive;
          
          return (
            <g
              key={axis.id}
              className="pointer-events-auto cursor-grab active:cursor-grabbing transition-opacity duration-180"
              style={{
                opacity: isOtherActive ? 0.3 : 1,
              }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                startDrag(axis.id);
              }}
              onPointerUp={(e) => {
                e.currentTarget.releasePointerCapture(e.pointerId);
                endDrag();
              }}
              onPointerCancel={endDrag}
            >
              {/* Invisible wider hit area for ease of clicking */}
              <line
                x1={0}
                y1={0}
                x2={axis.x2}
                y2={axis.y2}
                stroke="transparent"
                strokeWidth={16}
              />
              <line
                x1={0}
                y1={0}
                x2={axis.x2}
                y2={axis.y2}
                stroke={axis.color}
                strokeWidth={isActive ? 3 : 1}
                strokeLinecap="round"
                className="transition-[stroke-width] duration-120"
              />
              <text
                x={axis.x2 + (axis.x2 > 0 ? 8 : axis.x2 < 0 ? -16 : -4)}
                y={axis.y2 + (axis.y2 > 0 ? 16 : axis.y2 < 0 ? -8 : 4)}
                fill={axis.color}
                className="font-mono text-[11px] select-none pointer-events-none"
              >
                {axis.label}
              </text>
            </g>
          );
        })}
      </svg>
      
      {/* Mono readout that follows pointer */}
      {activeAxis && (
        <div
          className="absolute bg-bg-surface px-2 py-1 rounded shadow-float pointer-events-none whitespace-nowrap"
          style={{
            transform: `translate(${offset.x}px, ${offset.y - 40}px)`,
            transition: activeAxis ? 'none' : 'transform 0.4s cubic-bezier(0.34,1.3,0.64,1)',
          }}
        >
          <span className="font-mono text-xs text-text-primary">
            {activeAxis.toUpperCase()}: {offset[activeAxis]}mm
          </span>
        </div>
      )}
    </div>
  );
}
