import { useEffect, useRef, useState } from 'react';

import {
  createTransition,
  defaultFrameScheduler,
  type FrameScheduler,
  type MotionDurationName,
  type MotionEasingName,
  type TransitionSample,
} from '@/lib/motion';

import { useReducedMotion } from './useReducedMotion';

/**
 * How a transition is played. Every field has a default; the common call is
 * `useTransition('standard')`.
 */
export interface UseTransitionOptions {
  /** Play toward 1 while true, back toward 0 while false. Defaults to `true`. */
  readonly active?: boolean;
  /** Which of the three curves. Defaults to `inOut`. */
  readonly easing?: MotionEasingName;
  /**
   * Override the operating system preference. Leave unset in product code — the
   * hook reads the real setting. Useful for a story that must show the motion.
   */
  readonly reducedMotion?: boolean;
  /**
   * Test seam for the clock and the frame queue. Must be referentially stable
   * across renders: a fresh object each render restarts the animation each
   * frame. The default is a frozen module constant.
   */
  readonly scheduler?: FrameScheduler;
}

/**
 * A 0..1 value that moves at one of the four speeds, and a flag for arrival.
 *
 * This is the shared way to animate something React renders. A component names
 * the *slot* — `useTransition('fast')` — and gets back a number to interpolate
 * with; it never writes a duration, which is what keeps the whole product on one
 * rhythm. The returned `value` is already eased, so it maps straight onto an
 * opacity, a translation or a scale.
 *
 * ```ts
 * const { value, done } = useTransition('fast', { active: isOpen, easing: 'enter' });
 * ```
 *
 * **Reversal is continuous.** Flipping `active` retargets the transition from
 * wherever it currently is rather than restarting it, so a panel dismissed
 * halfway through opening closes from half-open. `done` reports arrival at the
 * end currently aimed at — it is true for a closed panel as well as an open one,
 * which is what makes it usable as the cue to unmount.
 *
 * **Reduced motion is honoured without a branch at the call site.** When the
 * reader has asked their system for less motion every duration is zero, so
 * `value` is at its destination on the first render and `done` is true
 * immediately — a cut rather than a fast animation.
 *
 * Not to be confused with React's own `useTransition`, which schedules
 * non-urgent state updates and has nothing to do with animation. Import this one
 * from `@/hooks/useTransition`.
 */
export function useTransition(
  duration: MotionDurationName,
  options: UseTransitionOptions = {},
): TransitionSample {
  const systemReducedMotion = useReducedMotion();

  const active = options.active ?? true;
  const easing = options.easing ?? 'inOut';
  const reducedMotion = options.reducedMotion ?? systemReducedMotion;

  // Read through a ref rather than depended upon: the scheduler is a seam, not
  // an input, and an inline object in the dependency list would restart the
  // animation on every frame it caused.
  const schedulerRef = useRef<FrameScheduler>(options.scheduler ?? defaultFrameScheduler);
  schedulerRef.current = options.scheduler ?? defaultFrameScheduler;

  // Linear position, kept outside React state so that it survives a change of
  // direction, of curve, or of speed without the element jumping.
  const progressRef = useRef(reducedMotion && active ? 1 : 0);

  const [sample, setSample] = useState<TransitionSample>(() => ({
    value: reducedMotion && active ? 1 : 0,
    done: reducedMotion || !active,
  }));

  useEffect(() => {
    const scheduler = schedulerRef.current;
    const transition = createTransition(
      { duration, easing, reducedMotion },
      { direction: active ? 'forward' : 'backward', progress: progressRef.current },
    );

    const publish = (next: TransitionSample): void => {
      progressRef.current = transition.progress;
      setSample(next);
    };

    publish(transition.sample());

    if (transition.done) {
      return undefined;
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

      const next = transition.advance(deltaMs);
      publish(next);

      if (!next.done) {
        handle = scheduler.request(step);
      }
    };

    handle = scheduler.request(step);

    return () => {
      cancelled = true;
      scheduler.cancel(handle);
    };
  }, [active, duration, easing, reducedMotion]);

  return sample;
}
