/**
 * A transition that keeps its own time and owns nothing else.
 *
 * It has no element, no camera and no clock: it is told how much time has
 * passed and it says where that leaves it. That is what lets the same object
 * drive a `requestAnimationFrame` loop in the browser and a test that steps it
 * 60 ms at a time with no DOM in sight — and it is why this file is pure enough
 * to live in `src/lib`, with the React wrapper in `src/hooks/useTransition.ts`
 * doing nothing but hold it and pump it.
 *
 * ## Forward and backward
 *
 * A transition has a direction rather than a fresh instance per play, because
 * the interesting case is the one that changes its mind: a dropdown closed
 * halfway through opening should close *from where it is*, not jump to fully
 * open and then leave. {@link Transition.aimAt} retargets in place, so the
 * position on screen is continuous across the reversal.
 *
 * ## Reduced motion
 *
 * A transition whose duration is zero is finished at construction and stays
 * finished: `advance` cannot move it and `aimAt` snaps it to the new end
 * immediately. Callers therefore need no branch of their own — they build the
 * transition with the preference and read the same two fields either way.
 */

import {
  clampProgress,
  durationMs,
  easingOf,
  type MotionDurationName,
  type MotionEasingName,
} from './tokens';

/** Where a transition has got to: a 0..1 position, and whether it has arrived. */
export interface TransitionSample {
  /** Eased position, 0 at the start and 1 at the end. */
  readonly value: number;
  /** Has it reached the end it is aimed at? */
  readonly done: boolean;
}

/** Which end a transition is heading for. */
export type TransitionDirection = 'forward' | 'backward';

/** What to animate and how. */
export interface TransitionSpec {
  /** Which of the four speeds. */
  readonly duration: MotionDurationName;
  /** Which of the three curves. Defaults to {@link DEFAULT_MOTION_EASING}. */
  readonly easing?: MotionEasingName;
  /** When true the transition takes no time at all. */
  readonly reducedMotion?: boolean;
}

/**
 * The curve used when a caller does not name one.
 *
 * `inOut` rather than `enter`, because a shared default is asked to cover moves
 * as often as arrivals, and a decelerating curve applied to a move makes it look
 * like it was already underway before it started.
 */
export const DEFAULT_MOTION_EASING: MotionEasingName = 'inOut';

/** The end a direction points at. */
function targetOf(direction: TransitionDirection): number {
  return direction === 'forward' ? 1 : 0;
}

/**
 * Where a transition of this shape stands after `elapsedMs`. Pure and stateless.
 *
 * For callers that already know how long something has been running — a
 * progress bar, a server-driven step — and do not need an object to keep time
 * for them.
 */
export function sampleTransition(spec: TransitionSpec, elapsedMs: number): TransitionSample {
  const total = durationMs(spec.duration, { reducedMotion: spec.reducedMotion === true });
  const progress = total <= 0 ? 1 : clampProgress(elapsedMs / total);

  return {
    value: easingOf(spec.easing ?? DEFAULT_MOTION_EASING).at(progress),
    done: progress >= 1,
  };
}

/** A transition that remembers where it is. */
export interface Transition {
  /** Its full length in milliseconds; zero under reduced motion. */
  readonly durationMs: number;
  /** The end it is currently heading for. */
  readonly direction: TransitionDirection;
  /** Linear time through the move, 0..1, before the curve is applied. */
  readonly progress: number;
  /** Eased position, 0..1 — the number a caller animates with. */
  readonly value: number;
  /** Has it arrived at the end it is aimed at? */
  readonly done: boolean;
  /** Move time on and report where that leaves it. */
  advance(deltaMs: number): TransitionSample;
  /** Head for the other end, continuing from the position on screen. */
  aimAt(direction: TransitionDirection): void;
  /** Jump to an end without animating. */
  settleAt(direction: TransitionDirection): void;
  /** Read the position without moving time on. */
  sample(): TransitionSample;
}

/** Where a transition starts. */
export interface CreateTransitionOptions {
  /** Which end it heads for. Defaults to `forward`. */
  readonly direction?: TransitionDirection;
  /** Linear position it starts from, 0..1. Defaults to the far end from its target. */
  readonly progress?: number;
}

/**
 * A transition, at rest until something advances it.
 *
 * Note the default start: a forward transition begins at 0 and a backward one
 * at 1, so `createTransition({ duration: 'standard' })` is an entrance with no
 * further arguments, which is the common case.
 */
export function createTransition(
  spec: TransitionSpec,
  options: CreateTransitionOptions = {},
): Transition {
  const total = durationMs(spec.duration, { reducedMotion: spec.reducedMotion === true });
  const curve = easingOf(spec.easing ?? DEFAULT_MOTION_EASING);

  let direction: TransitionDirection = options.direction ?? 'forward';
  let progress = clampProgress(options.progress ?? 1 - targetOf(direction));

  // A zero-length transition is over before it is returned.
  if (total <= 0) {
    progress = targetOf(direction);
  }

  const sample = (): TransitionSample => ({
    value: curve.at(progress),
    done: progress === targetOf(direction),
  });

  return {
    get durationMs() {
      return total;
    },
    get direction() {
      return direction;
    },
    get progress() {
      return progress;
    },
    get value() {
      return curve.at(progress);
    },
    get done() {
      return progress === targetOf(direction);
    },
    sample,
    advance: (deltaMs) => {
      if (total <= 0) {
        progress = targetOf(direction);
        return sample();
      }
      if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
        return sample();
      }

      const step = deltaMs / total;
      progress =
        direction === 'forward' ? Math.min(1, progress + step) : Math.max(0, progress - step);

      return sample();
    },
    aimAt: (next) => {
      direction = next;
      if (total <= 0) {
        progress = targetOf(direction);
      }
    },
    settleAt: (next) => {
      direction = next;
      progress = targetOf(direction);
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Driving a transition in real time.                                          */
/* -------------------------------------------------------------------------- */

/**
 * The clock and the frame queue, as a seam.
 *
 * Injected rather than reached for so that a test can step time exactly and a
 * headless render can drop frames on the floor. The default reads the real
 * globals lazily, which keeps this module importable where there is no `window`.
 */
export interface FrameScheduler {
  /** Current time in milliseconds, on the same scale frame callbacks receive. */
  now(): number;
  /** Ask for a frame; returns a handle for {@link FrameScheduler.cancel}. */
  request(callback: (timeMs: number) => void): number;
  cancel(handle: number): void;
}

/**
 * Roughly one frame at 60 Hz, used only where `requestAnimationFrame` is absent
 * — a worker, a server render, an old test environment. Not a motion duration
 * and not subject to the four-slot rule: it is a polling interval, and nothing
 * is timed against it.
 */
const FALLBACK_FRAME_MS = 16;

function hasAnimationFrame(): boolean {
  return (
    typeof requestAnimationFrame === 'function' && typeof cancelAnimationFrame === 'function'
  );
}

/** The real clock and the real frame queue. Stable, so it is safe as a hook dependency. */
export const defaultFrameScheduler: FrameScheduler = Object.freeze({
  now: (): number =>
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now(),
  request: (callback: (timeMs: number) => void): number => {
    if (hasAnimationFrame()) {
      return requestAnimationFrame(callback);
    }

    return setTimeout(() => callback(Date.now()), FALLBACK_FRAME_MS) as unknown as number;
  },
  cancel: (handle: number): void => {
    if (hasAnimationFrame()) {
      cancelAnimationFrame(handle);
      return;
    }

    clearTimeout(handle);
  },
});
