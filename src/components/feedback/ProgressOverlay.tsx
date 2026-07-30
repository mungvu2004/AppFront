import React from 'react';

export interface ProgressOverlayProps {
  className?: string;
}

export function ProgressOverlay({ className = '' }: ProgressOverlayProps) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      <div 
        className="absolute top-0 left-0 w-full h-[1px] bg-accent/40 animate-progress-overlay-scan"
      />
    </div>
  );
}
