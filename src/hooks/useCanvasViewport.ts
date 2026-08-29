import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createTransition,
  defaultFrameScheduler,
  type FrameScheduler,
} from '@/lib/motion';

import { useReducedMotion } from './useReducedMotion';

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface ContentBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface FlyToBoundsOptions {
  /** Empty space kept around the content, in canvas pixels. Defaults to 40. */
  readonly padding?: number;
  /**
   * Override the operating system preference. Leave unset in product code —
   * the hook reads the real setting. Useful for a story that must show the
   * motion, or a test that must not wait for it.
   */
  readonly reducedMotion?: boolean;
  /**
   * Test seam for the clock and the frame queue. Must be referentially stable
   * across renders. The default is a frozen module constant.
   */
  readonly scheduler?: FrameScheduler;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;

/** Empty space kept around the content when no padding is given, in canvas pixels. */
const DEFAULT_FIT_PADDING = 40;

/**
 * Where `contentBounds` puts the viewport — the same maths `fitToContent`
 * jumps to instantly, factored out so {@link useCanvasViewport.flyToBounds}
 * can animate towards it instead.
 */
function targetViewportFor(
  contentBounds: ContentBounds,
  canvasWidth: number,
  canvasHeight: number,
  padding: number,
): ViewportState | null {
  const contentWidth = contentBounds.maxX - contentBounds.minX;
  const contentHeight = contentBounds.maxY - contentBounds.minY;

  if (contentWidth <= 0 || contentHeight <= 0) {
    return null;
  }

  const scaleX = (canvasWidth - padding * 2) / contentWidth;
  const scaleY = (canvasHeight - padding * 2) / contentHeight;
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(scaleX, scaleY)));

  const contentCenterX = (contentBounds.minX + contentBounds.maxX) / 2;
  const contentCenterY = (contentBounds.minY + contentBounds.maxY) / 2;

  return {
    x: canvasWidth / 2 - contentCenterX * zoom,
    y: canvasHeight / 2 - contentCenterY * zoom,
    zoom,
  };
}

/**
 * Manages 2D canvas pan and zoom state.
 */
export function useCanvasViewport(initialState?: Partial<ViewportState>) {
  const [viewport, setViewport] = useState<ViewportState>({
    x: initialState?.x ?? 0,
    y: initialState?.y ?? 0,
    zoom: initialState?.zoom ?? 1,
  });

  // Mirrors `viewport` synchronously on every render so `flyToBounds` — called
  // imperatively from an event handler, not from an effect reacting to a prop
  // — always animates from the position actually on screen, never a stale
  // closure over the viewport at the time it was defined.
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const systemReducedMotion = useReducedMotion();

  // Cancels whatever fly-to run is in flight, or is a no-op once none is.
  const cancelFlightRef = useRef<() => void>(() => {});

  useEffect(() => () => cancelFlightRef.current(), []);

  const pan = useCallback((dx: number, dy: number) => {
    setViewport((prev) => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy,
    }));
  }, []);

  const zoomTo = useCallback((zoomLevel: number, centerX?: number, centerY?: number) => {
    setViewport((prev) => {
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel));
      if (newZoom === prev.zoom) return prev;
      
      // If center is provided, adjust x/y to zoom into that point
      if (centerX !== undefined && centerY !== undefined) {
        const scaleChange = newZoom / prev.zoom;
        return {
          zoom: newZoom,
          x: centerX - (centerX - prev.x) * scaleChange,
          y: centerY - (centerY - prev.y) * scaleChange,
        };
      }

      return { ...prev, zoom: newZoom };
    });
  }, []);

  const fitToContent = useCallback((contentBounds: { minX: number, minY: number, maxX: number, maxY: number }, canvasWidth: number, canvasHeight: number, padding = 40) => {
    const contentWidth = contentBounds.maxX - contentBounds.minX;
    const contentHeight = contentBounds.maxY - contentBounds.minY;
    
    if (contentWidth <= 0 || contentHeight <= 0) return;

    const scaleX = (canvasWidth - padding * 2) / contentWidth;
    const scaleY = (canvasHeight - padding * 2) / contentHeight;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(scaleX, scaleY)));

    const contentCenterX = (contentBounds.minX + contentBounds.maxX) / 2;
    const contentCenterY = (contentBounds.minY + contentBounds.maxY) / 2;

    const newX = canvasWidth / 2 - contentCenterX * newZoom;
    const newY = canvasHeight / 2 - contentCenterY * newZoom;

    setViewport({ x: newX, y: newY, zoom: newZoom });
  }, []);

  /**
   * Fly to a bounding box over the `slow` slot (340 ms), decelerating into
   * place — the animated sibling of {@link fitToContent}, which jumps.
   *
   * A call in flight is superseded, never queued: retargeting mid-flight
   * restarts the animation from wherever the viewport actually is right now
   * (`viewportRef`), the same "counts on from the shown value" rule
   * `useCountUp` and `useSceneTransition` follow. Under reduced motion the
   * viewport lands on the target on the very first frame, with no run
   * requested at all.
   */
  const flyToBounds = useCallback(
    (
      contentBounds: ContentBounds,
      canvasWidth: number,
      canvasHeight: number,
      options: FlyToBoundsOptions = {},
    ) => {
      cancelFlightRef.current();
      cancelFlightRef.current = () => {};

      const padding = options.padding ?? DEFAULT_FIT_PADDING;
      const target = targetViewportFor(contentBounds, canvasWidth, canvasHeight, padding);

      if (target === null) {
        return;
      }

      const start = viewportRef.current;
      const reducedMotion = options.reducedMotion ?? systemReducedMotion;
      const scheduler = options.scheduler ?? defaultFrameScheduler;

      const applyAt = (eased: number): void => {
        const next: ViewportState = {
          x: start.x + (target.x - start.x) * eased,
          y: start.y + (target.y - start.y) * eased,
          zoom: start.zoom + (target.zoom - start.zoom) * eased,
        };
        viewportRef.current = next;
        setViewport(next);
      };

      const transition = createTransition({ duration: 'slow', easing: 'enter', reducedMotion });

      applyAt(transition.value);

      if (transition.done) {
        return;
      }

      let lastTimeMs = scheduler.now();
      let handle = 0;
      let cancelled = false;

      const step = (timeMs: number): void => {
        if (cancelled) {
          return;
        }

        const deltaMs = Math.max(0, timeMs - lastTimeMs);
        lastTimeMs = timeMs;

        const sample = transition.advance(deltaMs);
        applyAt(sample.value);

        if (!sample.done) {
          handle = scheduler.request(step);
        }
      };

      handle = scheduler.request(step);

      cancelFlightRef.current = () => {
        cancelled = true;
        scheduler.cancel(handle);
      };
    },
    [systemReducedMotion],
  );

  return {
    viewport,
    pan,
    zoomTo,
    fitToContent,
    flyToBounds,
  };
}
