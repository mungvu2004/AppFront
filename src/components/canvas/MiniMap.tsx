import React from 'react';
import { useMiniMap } from './useMiniMap';

interface MiniMapProps {
  isVisible?: boolean;
}

export function MiniMap({ isVisible = true }: MiniMapProps) {
  const {
    viewport,
    mapRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useMiniMap();

  if (!isVisible) return null;

  return (
    <div
      className="absolute top-4 right-4 bg-bg-surface rounded-[12px] shadow-overlay p-3 z-10 w-[184px] h-[144px]"
      style={{ boxSizing: 'border-box' }}
    >
      <div 
        className="relative w-[160px] h-[120px] bg-bg-sunken rounded-md overflow-hidden"
        ref={mapRef}
      >
        {/* Placeholder for actual mini-map content (e.g. low-res canvas or SVG) */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(to right, var(--border-default) 1px, transparent 1px), linear-gradient(to bottom, var(--border-default) 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }} />

        {/* Viewport Indicator */}
        <div
          className="absolute border border-accent bg-accent/10 cursor-grab active:cursor-grabbing touch-none"
          style={{
            left: `${viewport.x}%`,
            top: `${viewport.y}%`,
            width: `${viewport.width}%`,
            height: `${viewport.height}%`,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
    </div>
  );
}
