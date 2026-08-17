import { renderHook, act } from '@testing-library/react';
import { createElement, StrictMode, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import type { FrameScheduler } from '@/lib/motion';

import { useSceneTransition, type UseSceneTransitionOptions } from './useSceneTransition';

/** A clock and a frame queue a test drives by hand. Stable across renders. */
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

const strictWrapper = ({ children }: { children: ReactNode }) =>
  createElement(StrictMode, null, children);

const renderScene = (
  initialTo: string,
  options: UseSceneTransitionOptions,
  wrapper?: typeof strictWrapper,
) =>
  renderHook(({ to }: { to: string }) => useSceneTransition(to, options), {
    initialProps: { to: initialTo },
    ...(wrapper === undefined ? {} : { wrapper }),
  });

describe('useSceneTransition', () => {
  it('does not animate the first scene, because there is nothing to hand over from', () => {
    const clock = createManualScheduler();
    const { result } = renderScene('2d', { kind: 'view', scheduler: clock.scheduler });

    expect(result.current).toMatchObject({ from: null, to: '2d', done: true, isRunning: false });
    expect(clock.pendingCount()).toBe(0);
  });

  it('hands the screen over when the scene changes', () => {
    const clock = createManualScheduler();
    const { result, rerender } = renderScene('2d', { kind: 'view', scheduler: clock.scheduler });

    rerender({ to: '3d' });

    expect(result.current).toMatchObject({ from: '2d', to: '3d', phase: 'exit', done: false });
  });

  it('walks the phases and finishes after the whole duration', () => {
    const clock = createManualScheduler();
    const { result, rerender } = renderScene('2d', { kind: 'view', scheduler: clock.scheduler });

    rerender({ to: '3d' });

    act(() => clock.advance(120));
    expect(result.current.phase).toBe('overlap');

    act(() => clock.advance(140));
    expect(result.current.phase).toBe('enter');

    act(() => clock.advance(80));
    expect(result.current).toMatchObject({ done: true, isRunning: false, enter: 1 });
    expect(clock.pendingCount()).toBe(0);
  });

  it('has both layers part way through during the overlap', () => {
    const clock = createManualScheduler();
    const { result, rerender } = renderScene('2d', { kind: 'view', scheduler: clock.scheduler });

    rerender({ to: '3d' });
    act(() => clock.advance(120));

    expect(result.current.exit).toBeGreaterThan(0);
    expect(result.current.exit).toBeLessThan(1);
    expect(result.current.enter).toBeGreaterThan(0);
    expect(result.current.enter).toBeLessThan(1);
  });

  it('supersedes a handover already in flight rather than queueing behind it', () => {
    const clock = createManualScheduler();
    const { result, rerender } = renderScene('L1', { kind: 'floor', scheduler: clock.scheduler });

    rerender({ to: 'L2' });
    act(() => clock.advance(60));

    rerender({ to: 'L3' });

    // The new handover starts from the one that was interrupted, immediately.
    expect(result.current).toMatchObject({ from: 'L2', to: 'L3', phase: 'exit', done: false });
  });

  it('keeps up with a reader holding the floor key down', () => {
    const clock = createManualScheduler();
    const { result, rerender } = renderScene('L0', { kind: 'floor', scheduler: clock.scheduler });

    for (let floor = 1; floor <= 10; floor += 1) {
      rerender({ to: `L${floor}` });
      act(() => clock.advance(16));
    }

    expect(result.current.to).toBe('L10');
    expect(result.current.from).toBe('L9');
  });

  it('does not animate on mount even when StrictMode double-invokes the effect', () => {
    // StrictMode remounts on mount only, where there is nothing to hand over
    // from — so the guarantee being checked here is that the doubled effect does
    // not conjure a handover, not that a running one survives (see below).
    const clock = createManualScheduler();
    const { result } = renderScene(
      '2d',
      { kind: 'view', scheduler: clock.scheduler },
      strictWrapper,
    );

    expect(result.current).toMatchObject({ from: null, done: true });
    expect(clock.pendingCount()).toBe(0);
  });

  it('keeps driving a handover when the effect re-runs without the scene changing', () => {
    // The effect's cleanup cancels the frame loop whenever it re-runs — here
    // because `kind` changed mid-flight. Restarting would be wrong (the
    // destination is the same); doing nothing would freeze the handover where it
    // stood. It has to pick the running one back up.
    interface SceneProps {
      to: string;
      kind: 'view' | 'screen';
    }

    const clock = createManualScheduler();
    const { result, rerender } = renderHook(
      ({ to, kind }: SceneProps) => useSceneTransition(to, { kind, scheduler: clock.scheduler }),
      { initialProps: { to: '2d', kind: 'view' } as SceneProps },
    );

    rerender({ to: '3d', kind: 'view' });
    act(() => clock.advance(100));
    expect(result.current.done).toBe(false);

    rerender({ to: '3d', kind: 'screen' });

    // The frame loop must have been picked back up, not dropped.
    expect(clock.pendingCount()).toBeGreaterThan(0);

    act(() => clock.advance(240));

    expect(result.current).toMatchObject({ done: true, enter: 1 });
  });

  it('cuts straight to the new scene under reduced motion', () => {
    const clock = createManualScheduler();
    const { result, rerender } = renderScene('2d', {
      kind: 'view',
      conditions: { reducedMotion: true },
      scheduler: clock.scheduler,
    });

    rerender({ to: '3d' });

    expect(result.current).toMatchObject({ from: '2d', to: '3d', done: true, enter: 1 });
    expect(clock.pendingCount()).toBe(0);
  });

  it('shortens the handover to the instant slot when R-04 reports a low frame rate', () => {
    const clock = createManualScheduler();
    const { result, rerender } = renderScene('2d', {
      kind: 'view',
      performanceSignal: { frameRate: 14 },
      scheduler: clock.scheduler,
    });

    rerender({ to: '3d' });

    // 120ms rather than the usual 340ms — still a handover, just a quick one.
    act(() => clock.advance(119));
    expect(result.current.done).toBe(false);

    act(() => clock.advance(1));
    expect(result.current.done).toBe(true);
  });

  it('runs the full handover when R-04 reports a healthy frame rate', () => {
    const clock = createManualScheduler();
    const { result, rerender } = renderScene('2d', {
      kind: 'view',
      performanceSignal: { frameRate: 60 },
      scheduler: clock.scheduler,
    });

    rerender({ to: '3d' });
    act(() => clock.advance(120));

    expect(result.current.done).toBe(false);
  });

  it('times a floor change more quickly than a view change', () => {
    const clock = createManualScheduler();
    const { result, rerender } = renderScene('L1', { kind: 'floor', scheduler: clock.scheduler });

    rerender({ to: 'L2' });
    act(() => clock.advance(180));

    expect(result.current.done).toBe(true);
  });

  it('stops driving the handover once unmounted', () => {
    const clock = createManualScheduler();
    const { rerender, unmount } = renderScene('2d', { kind: 'view', scheduler: clock.scheduler });

    rerender({ to: '3d' });
    expect(clock.pendingCount()).toBeGreaterThan(0);

    unmount();

    expect(clock.pendingCount()).toBe(0);
  });
});
