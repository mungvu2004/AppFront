/**
 * A number that runs up to its value instead of appearing.
 *
 * An area of 248,60 m², a violation count, a health score — landing the final
 * figure over a quarter of a second gives its arrival a little weight without
 * costing the reader anything: the true value is on screen before their eye has
 * finished saccading to it.
 *
 * ## Every intermediate frame is a real, formatted number
 *
 * The one hard rule: no frame may show a malformed value. So the engine never
 * hands the caller a raw float to render — every sample carries `text`,
 * produced by the same `formatNumber` (P-01) that formats the resting value,
 * with the same options. Counting to `248,60` shows `117,23`, never `117.23`
 * or `117,2299999`. And because the curve's control points live inside the
 * unit square, the value cannot overshoot the target and count back down —
 * `248,60` is never glimpsed as `251,88` first.
 *
 * ## The file is named for the capability; the hook lives elsewhere
 *
 * `src/lib` may not import React (mục 0.4), so what this file exports is the
 * pure engine — the exact split `transition.ts` has with
 * `src/hooks/useTransition.ts`. A screen that wants the hook form wraps
 * {@link createCountUp} in `src/hooks` with the scheduler pattern already
 * proven there; the engine is the part with rules in it, and the part a test
 * can drive with a hand-stepped clock.
 *
 * ## Duration
 *
 * One slot: `standard` (260 ms). The brief asked for 240 ms, but rule B allows
 * five durations and 240 is not among them — and a sixth duration is exactly
 * the drift the ladder exists to prevent. `standard` is the nearest slot.
 * Under reduced motion the number simply *is* its value; on a struggling
 * machine it runs at `instant`.
 */

import { formatNumber, isFormattable, type NumberFormatOptions } from '../format/number';
import { conditionedDurationMs, type MotionConditions } from './orchestrate';
import { clampProgress, easingOf, type MotionDurationName, type MotionEasingName } from './tokens';

/** The one speed a number runs at. See the module note for why not 240 ms. */
export const COUNT_UP_DURATION: MotionDurationName = 'standard';

/** Decelerating: the digits move fastest while they are wrong and settle as they become right. */
export const COUNT_UP_EASING: MotionEasingName = 'enter';

/** What to count to, and how to write it. */
export interface CountUpSpec extends MotionConditions {
  /** The resting value. A missing value (`NaN`, `±Infinity`) renders as `—` at once. */
  readonly to: number;
  /** Where the run starts. Defaults to `0`. */
  readonly from?: number;
  /**
   * Passed to `formatNumber` for every frame *and* the resting frame, so the
   * shape of the text never changes mid-run. An area uses
   * `{ fractionDigits: 2 }`; a count uses `{ fractionDigits: 0 }`.
   */
  readonly format?: NumberFormatOptions;
}

/** One frame of the run: the number, the string to render, and whether it is over. */
export interface CountUpSample {
  readonly value: number;
  /** Always correctly formatted — render this, never `value`. */
  readonly text: string;
  readonly done: boolean;
}

/** The start of the run, with anything unusable folded to zero. */
function startValueOf(spec: CountUpSpec): number {
  return isFormattable(spec.from) ? spec.from : 0;
}

/**
 * Where the run stands after `elapsedMs`. Pure and stateless.
 *
 * An unformattable target makes the run already over, showing the same `—`
 * placeholder every formatter shows — a count-up must never invent a number
 * where the product would show none.
 */
export function sampleCountUp(spec: CountUpSpec, elapsedMs: number): CountUpSample {
  if (!isFormattable(spec.to)) {
    return { value: spec.to, text: formatNumber(spec.to, spec.format), done: true };
  }

  // No distance to run is a run that is already over — a caller mounting at
  // rest (`from === to`) must not be handed a quarter second of no-op frames.
  if (startValueOf(spec) === spec.to) {
    return { value: spec.to, text: formatNumber(spec.to, spec.format), done: true };
  }

  const totalMs = conditionedDurationMs(COUNT_UP_DURATION, spec);
  const progress = totalMs <= 0 ? 1 : clampProgress(elapsedMs / totalMs);

  // The last frame is the target itself, not `from + span` — those can differ
  // by a floating-point crumb, and the resting frame must equal what a plain
  // `formatNumber(to)` elsewhere on the screen shows.
  if (progress >= 1) {
    return { value: spec.to, text: formatNumber(spec.to, spec.format), done: true };
  }

  const from = startValueOf(spec);
  const value = from + (spec.to - from) * easingOf(COUNT_UP_EASING).at(progress);

  return { value, text: formatNumber(value, spec.format), done: false };
}

/** A run that remembers where it is. Advanced by whatever clock the caller has. */
export interface CountUp {
  /** Full length in ms; zero under reduced motion, `instant` on a struggling machine. */
  readonly durationMs: number;
  readonly value: number;
  /** The string to render right now. Always correctly formatted. */
  readonly text: string;
  readonly done: boolean;
  /** Move time on and report the new frame. */
  advance(deltaMs: number): CountUpSample;
  /** Read the current frame without moving time on. */
  sample(): CountUpSample;
  /** Jump to the resting value — for an unmount, or a target that changed mid-run. */
  finish(): CountUpSample;
}

/** A run at its start, waiting for its first `advance`. */
export function createCountUp(spec: CountUpSpec): CountUp {
  const totalMs = isFormattable(spec.to) ? conditionedDurationMs(COUNT_UP_DURATION, spec) : 0;
  let elapsedMs = 0;

  const current = (): CountUpSample => sampleCountUp(spec, elapsedMs);

  return {
    get durationMs() {
      return totalMs;
    },
    get value() {
      return current().value;
    },
    get text() {
      return current().text;
    },
    get done() {
      return current().done;
    },
    advance: (deltaMs) => {
      if (Number.isFinite(deltaMs) && deltaMs > 0) {
        elapsedMs = Math.min(totalMs, elapsedMs + deltaMs);
      }

      return current();
    },
    sample: current,
    finish: () => {
      elapsedMs = totalMs;

      return current();
    },
  };
}
