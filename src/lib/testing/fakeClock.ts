/**
 * The one fake clock every timer test shares.
 *
 * A test that waits on the real clock is slow by construction and flaky under
 * load, so timed code is tested against Vitest's fake timers. But the raw API
 * is a dance — `useFakeTimers`, `advanceTimersByTimeAsync`, a hand-rolled
 * microtask flush, `useRealTimers` — and every file that performs it slightly
 * differently drifts: one flushes two microtask turns, another one, and a
 * promise chain that resolves in the first file times out in the second. So
 * the dance lives here, once.
 *
 * Three promises the wrapper keeps:
 *
 * - **Advancing waits for what it triggered.** {@link FakeClock.advance} is
 *   the async form: a timer callback that resolves promises has those
 *   promises settled before `advance` returns, so a test never asserts into
 *   a half-run callback.
 * - **The microtask queue can be drained without moving time.** Code that is
 *   `await`-deep but has no timer pending needs {@link FakeClock.flushMicrotasks},
 *   not a fake millisecond that would fire an unrelated timeout.
 * - **The start instant is fixed and shared.** Every clock starts at
 *   {@link FAKE_CLOCK_START} unless told otherwise — the 14:32 of the
 *   product's own autosave sample ("Đã lưu lúc 14:32") — so two test files
 *   formatting the same fake instant print the same string. Tests that format
 *   dates should still name a time zone, as `src/lib/format/datetime` asks.
 *
 * Restoring is the caller's job (`afterEach(() => clock.restore())`), or use
 * {@link withFakeClock}, which restores even when the body throws.
 */

import { vi } from 'vitest';

/** Where every fake clock starts: the product's own sample instant, 14:32 +07. */
export const FAKE_CLOCK_START = new Date('2026-08-17T14:32:00+07:00');

/**
 * Microtask turns one flush drains by default. Deep enough for the chained
 * `.then` ladders real code builds; a test with a deeper ladder passes more.
 */
const DEFAULT_FLUSH_TURNS = 8;

/** The clock a test steers. Every method is meaningful only until `restore`. */
export interface FakeClock {
  /** The current fake instant. */
  readonly now: () => Date;
  /** The current fake instant in epoch milliseconds. */
  readonly epochMs: () => number;
  /**
   * Move time forward, firing every timer that falls due — in order — and
   * settling the promises their callbacks created before returning.
   */
  readonly advance: (durationMs: number) => Promise<void>;
  /** Fire everything that is scheduled, however far ahead it sits. */
  readonly runAllTimers: () => Promise<void>;
  /** Drain the microtask queue without moving time at all. */
  readonly flushMicrotasks: (turns?: number) => Promise<void>;
  /** Hand the timers back to the runtime. Call it in `afterEach`. */
  readonly restore: () => void;
}

export interface FakeClockOptions {
  /** Start somewhere other than {@link FAKE_CLOCK_START}. */
  readonly startAt?: Date | number;
}

/**
 * Take over the timers and hand back the clock that steers them.
 *
 * @example
 * let clock: FakeClock;
 * beforeEach(() => { clock = installFakeClock(); });
 * afterEach(() => { clock.restore(); });
 *
 * it('saves after 800ms of silence', async () => {
 *   autosave.notifyChange();
 *   await clock.advance(799);
 *   expect(save).not.toHaveBeenCalled();
 *   await clock.advance(1);
 *   expect(save).toHaveBeenCalledTimes(1);
 * });
 */
export function installFakeClock(options: FakeClockOptions = {}): FakeClock {
  vi.useFakeTimers({ now: options.startAt ?? FAKE_CLOCK_START });

  return {
    now: (): Date => new Date(Date.now()),
    epochMs: (): number => Date.now(),
    advance: async (durationMs: number): Promise<void> => {
      await vi.advanceTimersByTimeAsync(durationMs);
    },
    runAllTimers: async (): Promise<void> => {
      await vi.runAllTimersAsync();
    },
    flushMicrotasks: async (turns: number = DEFAULT_FLUSH_TURNS): Promise<void> => {
      for (let turn = 0; turn < turns; turn += 1) {
        await Promise.resolve();
      }
    },
    restore: (): void => {
      vi.useRealTimers();
    },
  };
}

/**
 * Run one body against a fake clock and restore the real timers afterwards,
 * whatever happens inside — the fake-timer equivalent of a `finally`.
 *
 * @example
 * await withFakeClock(async (clock) => {
 *   startPolling();
 *   await clock.advance(5_000);
 *   expect(fetches).toBe(1);
 * });
 */
export async function withFakeClock<T>(
  body: (clock: FakeClock) => T | Promise<T>,
  options: FakeClockOptions = {},
): Promise<T> {
  const clock = installFakeClock(options);

  try {
    return await body(clock);
  } finally {
    clock.restore();
  }
}
