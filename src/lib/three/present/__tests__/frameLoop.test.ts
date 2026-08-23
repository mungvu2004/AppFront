import { describe, expect, it, vi } from 'vitest';

import { createFrameLoop, LOOP_GATES, MAX_SWAY_FPS, type FrameLoopOptions } from '../frameLoop';

/**
 * A scheduler the test drives by hand: `tick(ms)` advances the clock and runs
 * whatever was scheduled, the way a display would at its refresh rate.
 */
function fakeScheduler() {
  const queue = new Map<number, (nowMs: number) => void>();
  let next = 1;
  let now = 0;

  return {
    schedule: (callback: (nowMs: number) => void): number => {
      const handle = next;
      next += 1;
      queue.set(handle, callback);
      return handle;
    },
    cancel: (handle: number): void => {
      queue.delete(handle);
    },
    /** Advance by `ms` and run every callback that was waiting. */
    tick: (ms: number): void => {
      now += ms;
      const due = [...queue.entries()];
      queue.clear();
      for (const [, callback] of due) {
        callback(now);
      }
    },
    pending: () => queue.size,
    now: () => now,
  };
}

/** A sway that turns one radian a second, so thresholds read in seconds. */
const LINEAR: Pick<FrameLoopOptions, 'headingAt' | 'restingHeading'> = {
  headingAt: (elapsedMs) => elapsedMs / 1000,
  restingHeading: 0,
};

function setup(overrides: Partial<FrameLoopOptions> = {}) {
  const scheduler = fakeScheduler();
  const render = vi.fn();
  const loop = createFrameLoop({
    ...LINEAR,
    render,
    minStep: () => 0.01,
    schedule: scheduler.schedule,
    cancel: scheduler.cancel,
    ...overrides,
  });
  return { scheduler, render, loop };
}

describe('createFrameLoop', () => {
  it('starts with every gate open and ticks only once invalidated', () => {
    const { scheduler, render, loop } = setup();

    for (const gate of LOOP_GATES) {
      expect(loop.isOpen(gate)).toBe(true);
    }
    expect(scheduler.pending()).toBe(0);
    expect(render).not.toHaveBeenCalled();

    loop.invalidate();
    expect(loop.isRunning()).toBe(true);
    scheduler.tick(16);
    expect(render).toHaveBeenCalledTimes(1);
    expect(loop.framesDrawn()).toBe(1);
  });

  it('draws at most thirty frames a second while the heading keeps moving', () => {
    const { scheduler, render, loop } = setup();
    loop.invalidate();

    // Sixty ticks a second for one second; the heading moves a radian, far past any step.
    for (let tick = 0; tick < 60; tick += 1) {
      scheduler.tick(1000 / 60);
    }

    expect(render.mock.calls.length).toBeLessThanOrEqual(MAX_SWAY_FPS + 1);
    expect(render.mock.calls.length).toBeGreaterThanOrEqual(MAX_SWAY_FPS - 1);
  });

  it('skips a tick that would move the rim by less than a pixel', () => {
    // Ten pixels' worth a second; at sixty ticks a second only every sixth tick moves a pixel.
    const { scheduler, render, loop } = setup({ minStep: () => 0.1 });
    loop.invalidate();

    for (let tick = 0; tick < 60; tick += 1) {
      scheduler.tick(1000 / 60);
    }

    // The first frame, then one per tenth of a radian: about ten.
    expect(render.mock.calls.length).toBeGreaterThanOrEqual(9);
    expect(render.mock.calls.length).toBeLessThanOrEqual(11);
  });

  it('reads the threshold on every tick, so a resized viewport changes the cadence at once', () => {
    const minStep = vi.fn(() => 0.01);
    const { scheduler, loop } = setup({ minStep });
    loop.invalidate();
    scheduler.tick(16);
    scheduler.tick(16);

    expect(minStep).toHaveBeenCalledTimes(2);
  });

  it.each(['visible', 'onScreen', 'focused'] as const)('stops ticking while the %s gate is closed, and resumes', (gate) => {
    const { scheduler, render, loop } = setup();
    loop.invalidate();
    scheduler.tick(50);
    expect(render).toHaveBeenCalledTimes(1);

    loop.setGate(gate, false);
    expect(loop.isRunning()).toBe(false);
    expect(scheduler.pending()).toBe(0);
    scheduler.tick(50);
    scheduler.tick(50);
    expect(render).toHaveBeenCalledTimes(1);

    loop.setGate(gate, true);
    expect(loop.isRunning()).toBe(true);
    scheduler.tick(50);
    scheduler.tick(50);
    expect(render.mock.calls.length).toBeGreaterThan(1);
  });

  it('keeps the phase of the sway across a pause rather than jumping ahead', () => {
    const { scheduler, render, loop } = setup();
    loop.invalidate();
    // The sway's clock starts on the first tick.
    scheduler.tick(0);
    scheduler.tick(100);
    scheduler.tick(100);
    expect(render).toHaveBeenLastCalledWith(0.2);

    loop.setGate('focused', false);
    scheduler.tick(5000);
    loop.setGate('focused', true);
    // The first tick back resumes at the banked phase — nothing has moved yet.
    scheduler.tick(50);
    expect(render).toHaveBeenLastCalledWith(0.2);
    scheduler.tick(50);

    // Five seconds passed on the clock; the heading moved by one fifty-millisecond tick.
    expect(render).toHaveBeenLastCalledWith(0.25);
  });

  it('parks at the resting heading, drawn once, when motion is switched off', () => {
    const { scheduler, render, loop } = setup();
    loop.invalidate();
    scheduler.tick(0);
    scheduler.tick(500);
    expect(render).toHaveBeenLastCalledWith(0.5);

    loop.setGate('motion', false);
    expect(loop.isRunning()).toBe(false);
    scheduler.tick(16);
    expect(render).toHaveBeenLastCalledWith(0);
    expect(loop.lastHeading()).toBe(0);

    // Parked is parked: no further frames without a reason.
    const drawn = render.mock.calls.length;
    scheduler.tick(16);
    scheduler.tick(16);
    expect(render).toHaveBeenCalledTimes(drawn);
  });

  it('draws the parked model once more when invalidated, coalescing several requests', () => {
    const { scheduler, render, loop } = setup();
    loop.setGate('motion', false);
    scheduler.tick(16);
    const drawn = render.mock.calls.length;

    loop.invalidate();
    loop.invalidate();
    loop.invalidate();
    expect(scheduler.pending()).toBe(1);
    scheduler.tick(16);

    expect(render).toHaveBeenCalledTimes(drawn + 1);
  });

  it('holds a parked redraw until the canvas can be seen again', () => {
    const { scheduler, render, loop } = setup();
    loop.setGate('motion', false);
    loop.setGate('visible', false);
    scheduler.tick(16);
    expect(render).not.toHaveBeenCalled();

    loop.invalidate();
    scheduler.tick(16);
    expect(render).not.toHaveBeenCalled();

    loop.setGate('visible', true);
    scheduler.tick(16);
    expect(render).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenLastCalledWith(0);
  });

  it('draws the paused sway at its last heading, not at rest, when invalidated while blurred', () => {
    const { scheduler, render, loop } = setup();
    loop.invalidate();
    scheduler.tick(0);
    scheduler.tick(500);
    loop.setGate('focused', false);

    loop.invalidate();
    scheduler.tick(16);

    expect(render).toHaveBeenLastCalledWith(0.5);
  });

  it('ignores a gate set to the state it is already in', () => {
    const { scheduler, loop } = setup();
    loop.invalidate();
    scheduler.tick(16);
    const handleBefore = scheduler.pending();

    loop.setGate('visible', true);
    expect(scheduler.pending()).toBe(handleBefore);
  });

  it('draws nothing after dispose, whatever happens next', () => {
    const { scheduler, render, loop } = setup();
    loop.invalidate();
    scheduler.tick(16);
    expect(render).toHaveBeenCalledTimes(1);

    loop.dispose();
    expect(scheduler.pending()).toBe(0);
    loop.invalidate();
    loop.setGate('motion', false);
    loop.setGate('motion', true);
    scheduler.tick(100);

    expect(render).toHaveBeenCalledTimes(1);
    expect(loop.isRunning()).toBe(false);
  });

  it('cancels a pending parked frame on dispose', () => {
    const { scheduler, render, loop } = setup();
    loop.setGate('motion', false);
    expect(scheduler.pending()).toBe(1);

    loop.dispose();
    expect(scheduler.pending()).toBe(0);
    scheduler.tick(16);
    expect(render).not.toHaveBeenCalled();
  });

  it('falls back to the browser scheduler when none is given', () => {
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 7);
    const caf = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => undefined);

    const loop = createFrameLoop({ ...LINEAR, render: vi.fn(), minStep: () => 0 });
    loop.invalidate();
    expect(raf).toHaveBeenCalledTimes(1);
    loop.dispose();
    expect(caf).toHaveBeenCalledWith(7);

    raf.mockRestore();
    caf.mockRestore();
  });
});
