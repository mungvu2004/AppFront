import React from 'react';

interface StatusBarProps {
  x: number;
  y: number;
  scaleLabel: string;
  onScaleClick: () => void;
  saveStateText: string;
}

export function StatusBar({ x, y, scaleLabel, onScaleClick, saveStateText }: StatusBarProps) {
  return (
    <div className="h-8 bg-bg-app flex items-center justify-between px-3 text-[12px] text-text-secondary w-full select-none">
      <div className="flex items-center space-x-4">
        {/* Cursor Coordinates in mono */}
        <div className="font-mono tabular-nums tracking-tight opacity-70">
          {x.toFixed(1)}, {y.toFixed(1)}
        </div>
        
        {/* Scale Ratio Pill */}
        <button 
          onClick={onScaleClick}
          className="px-2 py-0.5 rounded-[4px] bg-bg-surface border border-border-default hover:bg-bg-hover active:scale-98 transition-all duration-120"
        >
          {scaleLabel}
        </button>
      </div>

      {/* Save State Indicator */}
      <div className="opacity-80">
        {saveStateText}
      </div>
    </div>
  );
}
