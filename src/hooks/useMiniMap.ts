import { useState, useCallback, useRef } from 'react';

export interface ViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MiniMapState {
  viewport: ViewportRect;
  isDragging: boolean;
  isHovered: boolean;
  mapRef: React.RefObject<HTMLDivElement>;
  handlePointerDown: (e: React.PointerEvent) => void;
  handlePointerMove: (e: React.PointerEvent) => void;
  handlePointerUp: (e: React.PointerEvent) => void;
  handleClick: (e: React.MouseEvent) => void;
  handleMouseEnter: () => void;
  handleMouseLeave: () => void;
  /** Nhảy khung nhìn về trung tâm bản đồ — đường bàn phím cho Enter/Space (A12). */
  jumpToCentre: () => void;
  onViewportChange: ((rect: ViewportRect) => void) | undefined;
}

interface UseMiniMapOptions {
  initialViewport?: Partial<ViewportRect>;
  onViewportChange?: (rect: ViewportRect) => void;
}

/**
 * Hook thuần — quản lý minimap drag, click-to-jump, hover state.
 */
export function useMiniMap(options: UseMiniMapOptions = {}): MiniMapState {
  const { onViewportChange } = options;

  const [viewport, setViewport] = useState<ViewportRect>({
    x: 20,
    y: 20,
    width: 40,
    height: 30,
    ...options.initialViewport,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);

  const clampViewport = useCallback(
    (x: number, y: number, w: number, h: number): ViewportRect => ({
      x: Math.max(0, Math.min(x, 100 - w)),
      y: Math.max(0, Math.min(y, 100 - h)),
      width: w,
      height: h,
    }),
    []
  );

  const jumpTo = useCallback(
    (clientX: number, clientY: number) => {
      if (!mapRef.current) return;
      const rect = mapRef.current.getBoundingClientRect();
      const relX = ((clientX - rect.left) / rect.width) * 100;
      const relY = ((clientY - rect.top) / rect.height) * 100;
      const newVp = clampViewport(
        relX - viewport.width / 2,
        relY - viewport.height / 2,
        viewport.width,
        viewport.height
      );
      setViewport(newVp);
      onViewportChange?.(newVp);
    },
    [clampViewport, viewport.width, viewport.height, onViewportChange]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      setIsDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      jumpTo(e.clientX, e.clientY);
    },
    [jumpTo]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      jumpTo(e.clientX, e.clientY);
    },
    [isDragging, jumpTo]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => { jumpTo(e.clientX, e.clientY); },
    [jumpTo]
  );

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  const jumpToCentre = useCallback(() => {
    const newVp = clampViewport(
      50 - viewport.width / 2,
      50 - viewport.height / 2,
      viewport.width,
      viewport.height
    );
    setViewport(newVp);
    onViewportChange?.(newVp);
  }, [clampViewport, viewport.width, viewport.height, onViewportChange]);

  return {
    viewport,
    isDragging,
    isHovered,
    mapRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleClick,
    handleMouseEnter,
    handleMouseLeave,
    jumpToCentre,
    onViewportChange,
  };
}
