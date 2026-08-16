/**
 * The shape `framer-motion` wants, kept alive so existing views need no edit.
 *
 * Before this folder existed, `src/lib/motion.ts` held a table of durations in
 * *seconds* and a set of easings as raw arrays, because that is what a
 * `<motion.div transition={…}>` takes. Five components in `src/components`
 * import it. That file is now this one, and `@/lib/motion` resolves here through
 * the barrel, so none of those imports changed.
 *
 * **{@link DURATION} is derived, not restated.** Every figure comes from
 * {@link MOTION_DURATIONS_MS} divided by a thousand, which is the whole point:
 * there is one table of durations in the product and this is a unit conversion
 * of it, not a second opinion that can drift.
 *
 * **{@link EASE} and {@link SPRING} are preserved verbatim**, deliberately. They
 * are not the same curves as {@link MOTION_EASINGS} — `EASE.default` is a much
 * harder ease-out than `enter` — and quietly re-pointing them at the new curves
 * would change how five shipped overlays move, which is a visual change nobody
 * asked for and one the 1440px snapshots would be right to fail on. Migrating
 * them is a separate, reviewable piece of work.
 *
 * @deprecated for new code. Reach for {@link MOTION_DURATIONS_MS},
 * {@link MOTION_EASINGS} and `useTransition` instead; this exists for the views
 * that already drive framer-motion directly.
 */

import { AMBIENT_LOOP_MS, MILLISECONDS_PER_SECOND, MOTION_DURATIONS_MS } from './tokens';

/**
 * The four speeds plus the ambient loop, in seconds, under their historical
 * names.
 *
 * The names predate the `instant`/`fast`/`standard`/`slow` ladder and do not
 * line up with it — this `fast` is the ladder's `instant`, and this `quick` is
 * the ladder's `fast`. The mapping is spelled out per line so the mismatch is
 * visible rather than surprising. Prefer {@link MOTION_DURATIONS_MS}.
 *
 * @deprecated Use {@link MOTION_DURATIONS_MS} with `useTransition`.
 */
export const DURATION = Object.freeze({
  /** 120 ms — micro-interaction. The ladder's `instant`. */
  fast: MOTION_DURATIONS_MS.instant / MILLISECONDS_PER_SECOND,
  /** 180 ms — closing an overlay. The ladder's `fast`. */
  quick: MOTION_DURATIONS_MS.fast / MILLISECONDS_PER_SECOND,
  /** 260 ms — opening an overlay, toggling a panel. The ladder's `standard`. */
  default: MOTION_DURATIONS_MS.standard / MILLISECONDS_PER_SECOND,
  /** 340 ms — a drawer sliding. The ladder's `slow`. */
  slow: MOTION_DURATIONS_MS.slow / MILLISECONDS_PER_SECOND,
  /** 700 ms — progress and skeleton loops. Not one of the four speeds. */
  expand: AMBIENT_LOOP_MS / MILLISECONDS_PER_SECOND,
});

/**
 * The curves the shipped overlays already move on.
 *
 * Left exactly as they were found. See the module note for why they are not
 * pointed at {@link MOTION_EASINGS}.
 *
 * @deprecated Use `MOTION_EASINGS[name].css` or `.points` for new work.
 */
export const EASE = {
  /** Panel open and close. */
  default: [0.32, 0.72, 0, 1] as [number, number, number, number],
  /** Ease out. */
  out: [0, 0, 0.58, 1] as [number, number, number, number],
  /** Ease in and out. */
  inOut: [0.42, 0, 0.58, 1] as [number, number, number, number],
  /**
   * The Material standard curve, as already used by the combobox, the select
   * and the tab indicator.
   *
   * Named here because those three views each had it written out as a literal.
   * It is *not* {@link MOTION_EASINGS}.`inOut`, which is symmetric where this is
   * not — pointing them at the new curve would change how three shipped controls
   * move, so the old value keeps its own name until someone decides to migrate
   * it deliberately.
   */
  standard: [0.4, 0, 0.2, 1] as [number, number, number, number],
} as const;

/**
 * The one spring in the product: the bottom sheet's snap.
 *
 * A spring earns its place here. A sheet is dragged, and a gesture that is
 * released mid-flight wants to be caught by something with momentum — a fixed
 * tween would have to restart from wherever the finger let go, which reads as a
 * stutter. What a spring must not do is *bounce*.
 *
 * **It used to, very slightly.** At `damping: 28` against `stiffness: 220` the
 * damping ratio was 0.944 — underdamped, so the sheet overshot its snap point
 * and came back. The overshoot worked out around a hundredth of a per cent, far
 * too small to see, but "too small to see" is not the same as "not there", and
 * the number that produced it was not chosen against any criterion.
 *
 * It is now damped at or past critical: with mass 1 and stiffness 220 the
 * critical value is `2·√220 ≈ 29.67`, and 30 clears it. The sheet arrives and
 * stops. `motion.test.ts` checks the inequality rather than the literal, so
 * changing the stiffness cannot quietly reintroduce the bounce.
 *
 * `mass` is stated rather than left to framer-motion's default of 1, because
 * the critical-damping test needs all three numbers to mean anything.
 *
 * @deprecated Do not add to this. New motion uses the curves in `tokens.ts`.
 */
export const SPRING = {
  /** Bottom-sheet snap. Critically damped: it settles, it does not bounce. */
  sheet: { type: 'spring' as const, mass: 1, damping: 30, stiffness: 220 },
} as const;
