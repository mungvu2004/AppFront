import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { FrameScheduler } from '@/lib/motion';

import { useCanvasViewport, type ContentBounds } from './useCanvasViewport';

/** A clock and a frame queue a test drives by hand — same seam as `useCountUp`. */
interface ManualScheduler {
  readonly scheduler: FrameScheduler;
  readonly advance: (deltaMs: number) => void;
  readonly pendingCount: () => number;
}

const createManualScheduler = (): ManualScheduler => {
  const pending = new Map<number, (timeMs: number) => void>();
  let timeMs = 0;
  let nextHandle = 1;

  return {
    scheduler: {
      now: () => timeMs,
      request: (callback) => {
        const handle = nextHandle;
        nextHandle += 1;
        pending.set(handle, callback);

        return handle;
      },
      cancel: (handle) => {
        pending.delete(handle);
      },
    },
    advance: (deltaMs) => {
      timeMs += deltaMs;
      const due = [...pending.values()];
      pending.clear();
      due.forEach((callback) => callback(timeMs));
    },
    pendingCount: () => pending.size,
  };
};

const SQUARE_BOUNDS: ContentBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
const DEGENERATE_BOUNDS: ContentBounds = { minX: 0, minY: 0, maxX: 0, maxY: 100 };

/** 500×500 canvas, default 40px padding: zoom 4.2, centred at (40, 40). */
const CANVAS = 500;
const EXPECTED_TARGET = { x: 40, y: 40, zoom: 4.2 };

describe('useCanvasViewport', () => {
  it('starts at the given initial state, defaulting to origin and zoom 1', () => {
    const { result } = renderHook(() => useCanvasViewport());
    expect(result.current.viewport).toEqual({ x: 0, y: 0, zoom: 1 });

    const withInitial = renderHook(() => useCanvasViewport({ x: 10, zoom: 2 }));
    expect(withInitial.result.current.viewport).toEqual({ x: 10, y: 0, zoom: 2 });
  });

  it('pans by the given delta', () => {
    const { result } = renderHook(() => useCanvasViewport());
    act(() => result.current.pan(5, -3));
    expect(result.current.viewport).toEqual({ x: 5, y: -3, zoom: 1 });
  });

  it('zooms and clamps to the [0.1, 10] range', () => {
    const { result } = renderHook(() => useCanvasViewport());
    act(() => result.current.zoomTo(50));
    expect(result.current.viewport.zoom).toBe(10);
    act(() => result.current.zoomTo(-5));
    expect(result.current.viewport.zoom).toBe(0.1);
  });

  it('jumps to a bounding box instantly with fitToContent — unchanged existing behaviour', () => {
    const { result } = renderHook(() => useCanvasViewport());
    act(() => result.current.fitToContent(SQUARE_BOUNDS, CANVAS, CANVAS));
    expect(result.current.viewport).toEqual(EXPECTED_TARGET);
  });

  describe('flyToBounds', () => {
    it('flies to the same target fitToContent would jump to, over the slow slot (340ms)', () => {
      const clock = createManualScheduler();
      const { result } = renderHook(() => useCanvasViewport());

      act(() => {
        result.current.flyToBounds(SQUARE_BOUNDS, CANVAS, CANVAS, { scheduler: clock.scheduler });
      });

      expect(result.current.viewport).toEqual({ x: 0, y: 0, zoom: 1 });

      act(() => clock.advance(340));

      expect(result.current.viewport).toEqual(EXPECTED_TARGET);
      expect(clock.pendingCount()).toBe(0);
    });

    it('decelerates: covers more than half the distance in the first half of the run', () => {
      const clock = createManualScheduler();
      const { result } = renderHook(() => useCanvasViewport());

      act(() => {
        result.current.flyToBounds(SQUARE_BOUNDS, CANVAS, CANVAS, { scheduler: clock.scheduler });
      });

      act(() => clock.advance(170));

      expect(result.current.viewport.zoom).toBeLessThan(EXPECTED_TARGET.zoom);
      const covered = (result.current.viewport.zoom - 1) / (EXPECTED_TARGET.zoom - 1);
      expect(covered).toBeGreaterThan(0.5);

      act(() => clock.advance(170));
      expect(result.current.viewport).toEqual(EXPECTED_TARGET);
    });

    it('is at the target immediately under reduced motion, with no frame requested', () => {
      const clock = createManualScheduler();
      const { result } = renderHook(() => useCanvasViewport());

      act(() => {
        result.current.flyToBounds(SQUARE_BOUNDS, CANVAS, CANVAS, {
          reducedMotion: true,
          scheduler: clock.scheduler,
        });
      });

      expect(result.current.viewport).toEqual(EXPECTED_TARGET);
      expect(clock.pendingCount()).toBe(0);
    });

    it('does nothing for a degenerate box, and does not crash', () => {
      const clock = createManualScheduler();
      const { result } = renderHook(() => useCanvasViewport());

      act(() => {
        result.current.flyToBounds(DEGENERATE_BOUNDS, CANVAS, CANVAS, {
          scheduler: clock.scheduler,
        });
      });

      expect(result.current.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
      expect(clock.pendingCount()).toBe(0);
    });

    it('supersedes a flight in progress, continuing from where the viewport actually is', () => {
      const clock = createManualScheduler();
      const { result } = renderHook(() => useCanvasViewport());

      act(() => {
        result.current.flyToBounds(SQUARE_BOUNDS, CANVAS, CANVAS, { scheduler: clock.scheduler });
      });
      act(() => clock.advance(170));

      const midFlightViewport = result.current.viewport;
      expect(midFlightViewport.zoom).toBeGreaterThan(1);
      expect(midFlightViewport.zoom).toBeLessThan(EXPECTED_TARGET.zoom);

      const otherBounds: ContentBounds = { minX: 0, minY: 0, maxX: 200, maxY: 200 };
      act(() => {
        result.current.flyToBounds(otherBounds, CANVAS, CANVAS, { scheduler: clock.scheduler });
      });

      // Retargeting is a cut only at rest; here it restarts a new run from the
      // exact frame the interrupted one had reached — not from the original
      // (0, 0, 1) start, and not a snap to the new destination either.
      expect(result.current.viewport).toEqual(midFlightViewport);
      expect(clock.pendingCount()).toBe(1);

      act(() => clock.advance(340));
      // 200×200 content on a 500×500 canvas at 40px padding: zoom (500-80)/200 = 2.1.
      expect(result.current.viewport).toEqual({ x: 40, y: 40, zoom: 2.1 });
      expect(clock.pendingCount()).toBe(0);
    });

    it('cancels the run in flight on unmount, leaking no frame request', () => {
      const clock = createManualScheduler();
      const { result, unmount } = renderHook(() => useCanvasViewport());

      act(() => {
        result.current.flyToBounds(SQUARE_BOUNDS, CANVAS, CANVAS, { scheduler: clock.scheduler });
      });
      expect(clock.pendingCount()).toBe(1);

      unmount();

      expect(clock.pendingCount()).toBe(0);
    });

    it('respects a custom padding', () => {
      const clock = createManualScheduler();
      const { result } = renderHook(() => useCanvasViewport());

      act(() => {
        result.current.flyToBounds(SQUARE_BOUNDS, CANVAS, CANVAS, {
          padding: 0,
          reducedMotion: true,
          scheduler: clock.scheduler,
        });
      });

      // No padding: zoom is canvas / content = 5, centred at (250, 250).
      expect(result.current.viewport).toEqual({ x: 0, y: 0, zoom: 5 });
    });
  });
});
