import React from 'react';
import { Minus, Plus, Maximize, RotateCcw } from 'lucide-react';
import { useZoomCluster } from './useZoomCluster';

interface ZoomClusterProps {
  isVisible?: boolean;
}

export function ZoomCluster({ isVisible = true }: ZoomClusterProps) {
  const { zoomLevel, zoomIn, zoomOut, resetZoom, fitToScreen } = useZoomCluster();

  if (!isVisible) return null;

  return (
    <div className="absolute bottom-4 right-4 z-10 flex items-center justify-center p-[120px] -m-[120px] group pointer-events-none">
      <div className="flex items-center bg-bg-surface rounded-full shadow-overlay p-2 gap-1 opacity-40 group-hover:opacity-100 transition-opacity duration-180 pointer-events-auto">
        <button
          onClick={zoomOut}
          className="p-1.5 rounded-full hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label="Zoom out"
        >
          <Minus size={16} />
        </button>
        
        <div className="w-12 text-center">
          <span className="font-mono text-sm text-text-primary">
            {zoomLevel}%
          </span>
        </div>

        <button
          onClick={zoomIn}
          className="p-1.5 rounded-full hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label="Zoom in"
        >
          <Plus size={16} />
        </button>

        <div className="w-[1px] h-4 bg-border-default mx-1" />

        <button
          onClick={fitToScreen}
          className="p-1.5 rounded-full hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label="Fit to screen"
        >
          <Maximize size={16} />
        </button>

        <button
          onClick={resetZoom}
          className="p-1.5 rounded-full hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label="Reset zoom to 1:1"
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
}
