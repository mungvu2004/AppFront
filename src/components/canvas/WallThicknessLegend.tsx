import React from 'react';
import { useWallThicknessLegend, WallThickness } from './useWallThicknessLegend';

interface WallThicknessLegendProps {
  isVisible?: boolean;
}

export function WallThicknessLegend({ isVisible = true }: WallThicknessLegendProps) {
  const { activeThickness, toggleThickness } = useWallThicknessLegend();

  if (!isVisible) return null;

  const thicknesses: { value: WallThickness; colorClass: string; label: string }[] = [
    { value: 110, colorClass: 'bg-[var(--wall-110)]', label: '110 mm' },
    { value: 220, colorClass: 'bg-[var(--wall-220)]', label: '220 mm' },
    { value: 330, colorClass: 'bg-[var(--wall-330)]', label: '330 mm' },
  ];

  return (
    <div className="absolute bottom-4 left-4 bg-bg-surface rounded-[12px] shadow-overlay p-3 flex flex-col gap-2 z-10">
      {thicknesses.map((item) => {
        const isDimmed = activeThickness !== null && activeThickness !== item.value;
        return (
          <button
            key={item.value}
            onClick={() => toggleThickness(item.value)}
            className={`flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-bg-hover transition-colors duration-180 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              isDimmed ? 'opacity-50' : 'opacity-100'
            }`}
            aria-pressed={activeThickness === item.value}
          >
            <div className={`w-3 h-3 rounded-[4px] ${item.colorClass}`} />
            <span className="font-mono text-sm text-text-primary leading-none">
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
