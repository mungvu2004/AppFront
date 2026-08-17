import { useEffect, useRef, useState } from 'react';

import {
  createCountUp,
  defaultFrameScheduler,
  sampleCountUp,
  type CountUpSample,
  type CountUpSpec,
  type FrameScheduler,
} from '@/lib/motion';
import { type NumberFormatOptions } from '@/lib/format/number';

import { useReducedMotion } from './useReducedMotion';

/** How a number is run up. Every field has a default; the common call is `useCountUp(area)`. */
export interface UseCountUpOptions {
  /** Where the first run starts. Defaults to `0`. Retargets start from the shown value instead. */
  readonly from?: number;
  /**
   * Passed to `formatNumber` for every frame, so the text never changes shape
   * mid-run. An area wants `{ fractionDigits: 2 }`; a count `{ fractionDigits: 0 }`.
   */
  readonly format?: NumberFormatOptions;
  /**
   * Override the operating system preference. Leave unset in product code — the
   * hook reads the real setting. Useful for a story that must show the motion.
   */
  readonly reducedMotion?: boolean;
  /** R-04's verdict, from `useMotionConditions`. Drops the run to the instant slot. */
  readonly lowPerformance?: boolean;
  /**
   * Test seam for the clock and the frame queue. Must be referentially stable
   * across renders. The default is a frozen module constant.
   */
  readonly scheduler?: FrameScheduler;
}

/**
 * A number that runs up to its value — the React face of
 * `src/lib/motion/useCountUp.ts`, which holds all the rules.
 *
 * Render `text`, never `value`: `text` is produced by the shared `formatNumber`
 * with the caller's own options on every frame, which is what guarantees no
 * frame ever shows a malformed number.
 *
 * ```ts
 * const { text } = useCountUp(area, { format: { fractionDigits: 2 } });
 * ```
 *
 * **A change of target counts on from the shown value.** When `to` moves from
 * 248,60 to 251,20 mid-run or at rest, the digits run the short distance from
 * wherever they stand — never back through 0, which would read as the
 * measurement being retaken.
 *
 * **Reduced motion is a cut.** The number simply is its value on the first
 * frame, with no run at all; a struggling machine (R-04) shortens the run to
 * the instant slot instead. Both arrive through the same options the rest of
 * the motion system uses.
 */
/**
 * Assemble a spec without writing `undefined` into optional fields, which
 * `exactOptionalPropertyTypes` rightly refuses.
 */
function specOf(
  to: number,
  from: number | undefined,
  fractionDigits: number | undefined,
  maxFractionDigits: number | undefined,
  grouping: boolean | undefined,
  reducedMotion: boolean,
  lowPerformance: boolean,
): CountUpSpec {
  const format: NumberFormatOptions = {
    ...(fractionDigits !== undefined ? { fractionDigits } : {}),
    ...(maxFractionDigits !== undefined ? { maxFractionDigits } : {}),
    ...(grouping !== undefined ? { grouping } : {}),
  };

  return {
    to,
    format,
    reducedMotion,
    lowPerformance,
    ...(from !== undefined ? { from } : {}),
  };
}

export function useCountUp(to: number, options: UseCountUpOptions = {}): CountUpSample {
  const systemReducedMotion = useReducedMotion();

  const reducedMotion = options.reducedMotion ?? systemReducedMotion;
  const lowPerformance = options.lowPerformance === true;
  const explicitFrom = options.from;

  // The format is depended upon field by field: an inline options object is the
  // normal call shape, and its identity changes every render.
  const fractionDigits = options.format?.fractionDigits;
  const maxFractionDigits = options.format?.maxFractionDigits;
  const grouping = options.format?.grouping;

  // Read through a ref rather than depended upon: the scheduler is a seam, not
  // an input, and an inline object in the dependency list would restart the
  // run on every frame it caused.
  const schedulerRef = useRef<FrameScheduler>(options.scheduler ?? defaultFrameScheduler);
  schedulerRef.current = options.scheduler ?? defaultFrameScheduler;

  // The value currently on screen, kept outside React state so a retarget can
  // start from it even when the effect re-runs for another reason.
  const shownRef = useRef<number | null>(null);

  const [sample, setSample] = useState<CountUpSample>(() =>
    sampleCountUp(
      specOf(to, explicitFrom, fractionDigits, maxFractionDigits, grouping, reducedMotion, lowPerformance),
      0,
    ),
  );

  useEffect(() => {
    const scheduler = schedulerRef.current;
    const countUp = createCountUp(
      specOf(
        to,
        shownRef.current ?? explicitFrom,
        fractionDigits,
        maxFractionDigits,
        grouping,
        reducedMotion,
        lowPerformance,
      ),
    );

    const publish = (next: CountUpSample): void => {
      // Only a readable value can be counted on from. After a missing value
      // (`—`), the next target is simply shown — running up from 0 would
      // animate a distance the reader never saw.
      shownRef.current = Number.isFinite(next.value) ? next.value : null;
      setSample(next);
    };

    publish(countUp.sample());

    if (countUp.done) {
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

      const next = countUp.advance(deltaMs);
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
  }, [to, explicitFrom, fractionDigits, maxFractionDigits, grouping, reducedMotion, lowPerformance]);

  return sample;
}
