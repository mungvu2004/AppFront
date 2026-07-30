import { useState, useCallback, useRef } from 'react';

export function useMiniMap() {
  // Viewport rectangle coordinates (normalized 0-1 or percentage)
  const [viewport, setViewport] = useState({ x: 20, y: 20, width: 40, height: 30 });
  const [isDragging, setIsDragging] = useState(false);
  
  const mapRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !mapRef.current) return;
    
    const rect = mapRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left - (viewport.width / 2 * rect.width / 100), rect.width - (viewport.width * rect.width / 100)));
    const y = Math.max(0, Math.min(e.clientY - rect.top - (viewport.height / 2 * rect.height / 100), rect.height - (viewport.height * rect.height / 100)));
    
    setViewport((prev) => ({
      ...prev,
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
    }));
  }, [isDragging, viewport.width, viewport.height]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  return {
    viewport,
    mapRef,
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
