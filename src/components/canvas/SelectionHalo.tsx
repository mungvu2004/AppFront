import React from 'react';


interface SelectionHaloProps {
  isSelected: boolean;
  isPulsing: boolean;
  width: number;
  height: number;
  x: number;
  y: number;
  isViolation?: boolean;
}

export function SelectionHalo({
  isSelected,
  isPulsing,
  width,
  height,
  x,
  y,
  isViolation = false,
}: SelectionHaloProps) {
  if (!isSelected) return null;

  const outlineColor = isViolation ? 'var(--state-violation)' : 'var(--accent)';
  const fillColor = isViolation ? 'var(--state-violation)' : 'var(--accent)';

  return (
    <div
      className="absolute pointer-events-none z-10"
      style={{
        left: x,
        top: y,
        width,
        height,
      }}
    >
      <style>
        {`
          @keyframes violationPulse {
            0% { opacity: 1; }
            50% { opacity: 0.45; }
            100% { opacity: 1; }
          }
          .halo-pulse {
            animation: violationPulse 1.8s ease-in-out;
            animation-iteration-count: 3;
          }
        `}
      </style>
      <div
        className={`w-full h-full border-2 ${isPulsing ? 'halo-pulse' : ''}`}
        style={{
          borderColor: outlineColor,
          backgroundColor: `color-mix(in srgb, ${fillColor} 6%, transparent)`,
        }}
      />
    </div>
  );
}
