import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { FrameScheduler, MediaMatcher } from '@/lib/motion';

import { useReducedMotion } from './useReducedMotion';
import { useTransition } from './useTransition';

/**
 * A clock and a frame queue a test drives by hand.
 *
 * Created once per test and passed unchanged on every render, which is the
 * contract {@link useTransition} documents for the seam.
 */
interface ManualScheduler {
  readonly scheduler: FrameScheduler;
  /** Move time on and run the frames that fall due. */
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

/** A media query list a test can toggle, standing in for the OS setting. */
const createFakeMatcher = (initial: boolean) => {
  const listeners = new Set<() => void>();
  let matches = initial;

  const query = {
    get matches() {
      return matches;
    },
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
  };

  const matcher: MediaMatcher = {
    matchMedia: () => query as unknown as MediaQueryList,
  };

  return {
    matcher,
    set: (reduced: boolean) => {
      matches = reduced;
      [...listeners].forEach((listener) => listener());
    },
  };
};

describe('useTransition', () => {
  it('starts at rest and has not finished', () => {
    const clock = createManualScheduler();
    const { result } = renderHook(() =>
      useTransition('standard', { scheduler: clock.scheduler }),
    );

    expect(result.current.value).toBe(0);
    expect(result.current.done).toBe(false);
  });

  it('runs to 1 over the duration of the slot it names', () => {
    const clock = createManualScheduler();
    const { result } = renderHook(() =>
      useTransition('standard', { scheduler: clock.scheduler }),
    );

    act(() => clock.advance(130));

    expect(result.current.value).toBeCloseTo(0.5, 6);
    expect(result.current.done).toBe(false);

    act(() => clock.advance(130));

    expect(result.current.value).toBe(1);
    expect(result.current.done).toBe(true);
  });

  it('stops asking for frames once it has arrived', () => {
    const clock = createManualScheduler();
    renderHook(() => useTransition('instant', { scheduler: clock.scheduler }));

    act(() => clock.advance(120));

    expect(clock.pendingCount()).toBe(0);
  });

  it('takes longer at a slower slot', () => {
    const clock = createManualScheduler();
    const { result } = renderHook(() => useTransition('slow', { scheduler: clock.scheduler }));

    act(() => clock.advance(260));

    expect(result.current.done).toBe(false);

    act(() => clock.advance(80));

    expect(result.current.done).toBe(true);
  });

  it('sits at 0 and counts as done while inactive', () => {
    const clock = createManualScheduler();
    const { result } = renderHook(() =>
      useTransition('standard', { active: false, scheduler: clock.scheduler }),
    );

    expect(result.current).toEqual({ value: 0, done: true });
    expect(clock.pendingCount()).toBe(0);
  });

  it('reverses from where it is rather than restarting', () => {
    const clock = createManualScheduler();
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) =>
        useTransition('standard', { active, scheduler: clock.scheduler }),
      { initialProps: { active: true } },
    );

    act(() => clock.advance(130));
    const midpoint = result.current.value;
    expect(midpoint).toBeCloseTo(0.5, 6);

    rerender({ active: false });

    expect(result.current.value).toBeCloseTo(midpoint, 6);
    expect(result.current.done).toBe(false);

    act(() => clock.advance(130));

    expect(result.current.value).toBe(0);
    expect(result.current.done).toBe(true);
  });

  it('applies the curve it is given', () => {
    const clock = createManualScheduler();
    const { result } = renderHook(() =>
      useTransition('standard', { easing: 'enter', scheduler: clock.scheduler }),
    );

    act(() => clock.advance(130));

    // A decelerating curve is past halfway at half the time.
    expect(result.current.value).toBeGreaterThan(0.5);
  });

  it('is already finished under reduced motion, with no frame requested', () => {
    const clock = createManualScheduler();
    const { result } = renderHook(() =>
      useTransition('slow', { reducedMotion: true, scheduler: clock.scheduler }),
    );

    expect(result.current).toEqual({ value: 1, done: true });
    expect(clock.pendingCount()).toBe(0);
  });

  it('cuts straight to 0 when deactivated under reduced motion', () => {
    const clock = createManualScheduler();
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) =>
        useTransition('slow', { active, reducedMotion: true, scheduler: clock.scheduler }),
      { initialProps: { active: true } },
    );

    expect(result.current).toEqual({ value: 1, done: true });

    rerender({ active: false });

    expect(result.current).toEqual({ value: 0, done: true });
    expect(clock.pendingCount()).toBe(0);
  });

  it('stops driving the animation once unmounted', () => {
    const clock = createManualScheduler();
    const { unmount } = renderHook(() =>
      useTransition('standard', { scheduler: clock.scheduler }),
    );

    expect(clock.pendingCount()).toBe(1);

    unmount();

    expect(clock.pendingCount()).toBe(0);
  });
});

describe('useReducedMotion', () => {
  it('reports the setting on the first render, before any effect runs', () => {
    const fake = createFakeMatcher(true);
    const { result } = renderHook(() => useReducedMotion(fake.matcher));

    expect(result.current).toBe(true);
  });

  it('reports motion allowed when the setting is off', () => {
    const fake = createFakeMatcher(false);
    const { result } = renderHook(() => useReducedMotion(fake.matcher));

    expect(result.current).toBe(false);
  });

  it('follows the setting when it is changed mid-session', () => {
    const fake = createFakeMatcher(false);
    const { result } = renderHook(() => useReducedMotion(fake.matcher));

    act(() => fake.set(true));

    expect(result.current).toBe(true);
  });
});
