// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  canSleep,
  canSwitchTier,
  createShadowThrottle,
  progressAt,
  radiusPx,
  scrollFor,
  SLEEP_AFTER_INPUT_MS,
  type LoopState,
} from '../loop';

describe('progressAt / scrollFor', () => {
  const span = { top: 200, range: 1000 };

  it('maps the track like ScrollTrigger top top → bottom bottom, clamped', () => {
    expect(progressAt(0, span)).toBe(0);
    expect(progressAt(200, span)).toBe(0);
    expect(progressAt(700, span)).toBe(0.5);
    expect(progressAt(1200, span)).toBe(1);
    expect(progressAt(5000, span)).toBe(1);
  });

  it('round-trips through scrollFor', () => {
    for (const p of [0, 0.25, 0.618, 1]) expect(progressAt(scrollFor(p, span), span)).toBeCloseTo(p, 12);
  });

  it('a track no taller than the viewport is all-or-nothing', () => {
    expect(progressAt(199, { top: 200, range: 0 })).toBe(0);
    expect(progressAt(200, { top: 200, range: -50 })).toBe(1);
    expect(scrollFor(1, { top: 200, range: -50 })).toBe(200);
  });
});

describe('canSleep', () => {
  const still: LoopState = { sinceInputMs: SLEEP_AFTER_INPUT_MS, scrolling: false, settled: true, owed: false, busy: false, ambient: false };

  it('sleeps only when nothing can change the next frame', () => {
    expect(canSleep(still)).toBe(true);
    expect(canSleep({ ...still, sinceInputMs: SLEEP_AFTER_INPUT_MS - 1 })).toBe(false);
    expect(canSleep({ ...still, scrolling: true })).toBe(false);
    expect(canSleep({ ...still, settled: false })).toBe(false);
    expect(canSleep({ ...still, owed: true })).toBe(false);
    expect(canSleep({ ...still, busy: true })).toBe(false);
    expect(canSleep({ ...still, ambient: true })).toBe(false);
  });

  it('switches tier only on a still page', () => {
    expect(canSwitchTier(true, false, true)).toBe(true);
    expect(canSwitchTier(false, false, true)).toBe(false);
    expect(canSwitchTier(true, true, true)).toBe(false);
    expect(canSwitchTier(true, false, false)).toBe(false);
  });
});

describe('radiusPx', () => {
  it('a unit sphere at distance 1 under a 90° fov spans half the viewport height', () => {
    expect(radiusPx(1, 1, 90, 800)).toBeCloseTo(400, 6);
    expect(radiusPx(1, 2, 90, 800)).toBeCloseTo(200, 6);
  });
});

describe('createShadowThrottle', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('redraws at most once per gap and wakes once for the final redraw', () => {
    vi.useFakeTimers();
    const wake = vi.fn();
    const t = createShadowThrottle(100, wake);
    expect(t.take(false, 0)).toBe(false);
    expect(t.take(true, 0)).toBe(true);
    expect(t.take(true, 16)).toBe(false);
    expect(t.take(true, 32)).toBe(false);
    vi.advanceTimersByTime(83);
    expect(wake).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(wake).toHaveBeenCalledTimes(1);
    expect(t.take(true, 100)).toBe(true);
    t.reset();
    expect(t.take(true, 101)).toBe(true);
    expect(t.take(true, 110)).toBe(false);
    t.dispose();
    vi.advanceTimersByTime(1000);
    expect(wake).toHaveBeenCalledTimes(1);
  });
});
