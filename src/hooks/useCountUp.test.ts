import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { FrameScheduler } from '@/lib/motion';

import { useCountUp } from './useCountUp';

/** A clock and a frame queue a test drives by hand — the seam the hook documents. */
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

/** Vietnamese notation with exactly two decimals: `0,00`, `117,23`, `1.234,56`. */
const TWO_DECIMALS = /^\d{1,3}(?:\.\d{3})*,\d{2}$/u;

describe('useCountUp', () => {
  it('starts at the start value, already formatted', () => {
    const clock = createManualScheduler();
    const { result } = renderHook(() =>
      useCountUp(248.6, { format: { fractionDigits: 2 }, scheduler: clock.scheduler }),
    );

    expect(result.current.text).toBe('0,00');
    expect(result.current.done).toBe(false);
  });

  it('arrives at the exact figure over the standard slot', () => {
    const clock = createManualScheduler();
    const { result } = renderHook(() =>
      useCountUp(248.6, { format: { fractionDigits: 2 }, scheduler: clock.scheduler }),
    );

    act(() => clock.advance(130));

    expect(result.current.done).toBe(false);

    act(() => clock.advance(130));

    expect(result.current).toEqual({ value: 248.6, text: '248,60', done: true });
  });

  it('shows a correctly formatted number on every frame it renders', () => {
    const clock = createManualScheduler();
    const { result } = renderHook(() =>
      useCountUp(248.6, { format: { fractionDigits: 2 }, scheduler: clock.scheduler }),
    );

    for (let frame = 0; frame < 26; frame += 1) {
      act(() => clock.advance(10));
      expect(result.current.text).toMatch(TWO_DECIMALS);
    }
  });

  it('mounts at rest with no frame requested when told to start from its target', () => {
    const clock = createManualScheduler();
    const { result } = renderHook(() =>
      useCountUp(100, { from: 100, scheduler: clock.scheduler }),
    );

    expect(result.current.done).toBe(true);
    expect(result.current.value).toBe(100);
    expect(clock.pendingCount()).toBe(0);
  });

  it('stops asking for frames once it has arrived', () => {
    const clock = createManualScheduler();
    renderHook(() => useCountUp(14, { scheduler: clock.scheduler }));

    act(() => clock.advance(260));

    expect(clock.pendingCount()).toBe(0);
  });

  it('counts on from the shown value when the target changes, never back through 0', () => {
    const clock = createManualScheduler();
    const { result, rerender } = renderHook(
      ({ to }: { to: number }) =>
        useCountUp(to, { format: { fractionDigits: 2 }, scheduler: clock.scheduler }),
      { initialProps: { to: 100 } },
    );

    act(() => clock.advance(260));
    expect(result.current.value).toBe(100);

    rerender({ to: 200 });

    expect(result.current.value).toBe(100);

    act(() => clock.advance(130));

    expect(result.current.value).toBeGreaterThan(100);
    expect(result.current.value).toBeLessThanOrEqual(200);

    act(() => clock.advance(130));

    expect(result.current).toEqual({ value: 200, text: '200,00', done: true });
  });

  it('is its value immediately under reduced motion, with no frame requested', () => {
    const clock = createManualScheduler();
    const { result } = renderHook(() =>
      useCountUp(248.6, {
        format: { fractionDigits: 2 },
        reducedMotion: true,
        scheduler: clock.scheduler,
      }),
    );

    expect(result.current).toEqual({ value: 248.6, text: '248,60', done: true });
    expect(clock.pendingCount()).toBe(0);
  });

  it('runs at the instant slot on a struggling machine', () => {
    const clock = createManualScheduler();
    const { result } = renderHook(() =>
      useCountUp(100, { lowPerformance: true, scheduler: clock.scheduler }),
    );

    act(() => clock.advance(120));

    expect(result.current.done).toBe(true);
  });

  it('shows the missing-value dash for a target that is not a number', () => {
    const clock = createManualScheduler();
    const { result } = renderHook(() => useCountUp(Number.NaN, { scheduler: clock.scheduler }));

    expect(result.current.text).toBe('—');
    expect(result.current.done).toBe(true);
    expect(clock.pendingCount()).toBe(0);
  });

  it('stops driving the run once unmounted', () => {
    const clock = createManualScheduler();
    const { unmount } = renderHook(() => useCountUp(100, { scheduler: clock.scheduler }));

    expect(clock.pendingCount()).toBe(1);

    unmount();

    expect(clock.pendingCount()).toBe(0);
  });
});
