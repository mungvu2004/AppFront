/**
 * Every duration and every curve the product is allowed to move at.
 *
 * Motion that is scattered — 200 ms here because it felt right, 450 ms there
 * because the panel is bigger — reads as an interface assembled by several people
 * who never spoke. A reviewer notices it as stiffness without being able to say
 * why. So there are four speeds, three curves, and no fifth of either: a
 * component picks the *slot* that matches what it is doing, not a number that
 * matches how it feels today.
 *
 * ## The four speeds
 *
 * | Slot       |    ms | What moves at it |
 * |------------|-------|------------------|
 * | `instant`  |   120 | State a pointer is already on: hover, focus ring, press |
 * | `fast`     |   180 | Something small appearing where you are looking: dropdown, tooltip |
 * | `standard` |   260 | The default. Panels, toasts, anything with its own area |
 * | `slow`     |   340 | Something that changes what the screen is: view change, camera move |
 *
 * These are the repository's allowed durations (rule B), the same ladder
 * `tailwind.config.ts` declares under `transitionDuration`, so a value picked
 * here and a Tailwind class picked in a view cannot disagree.
 *
 * ## The three curves
 *
 * Gentle only — no overshoot, no bounce, no spring. Each is a cubic Bézier whose
 * control points all lie inside the unit square, which is what guarantees the
 * output never leaves 0..1 and never turns back on itself. `motion.test.ts`
 * asserts both properties for every curve rather than trusting the numbers.
 *
 * - `enter` decelerates. Fast off the mark, settling at the end — an element
 *   arriving has already made its point by the time it stops.
 * - `exit` accelerates. Slow to leave, quick to go — the reverse shape, so a
 *   thing that leaves does not look like a thing that arrived played backwards.
 * - `inOut` eases both ends, and is *symmetric about its midpoint* — its second
 *   control point is the reflection of its first. For something that is neither
 *   arriving nor leaving but moving from one place on screen to another, where
 *   the way back should look like the way out played in reverse rather than
 *   like a different gesture. `useTransition` reverses in place, so this is a
 *   property that shows.
 *
 * Each curve carries both its CSS text and a sampling function over the *same*
 * control points, so a rAF loop in JavaScript and a CSS transition describe one
 * curve and not two that drift.
 *
 * ## Reduced motion
 *
 * {@link durationMs} takes the preference and returns `0` for every slot when it
 * is set. Zero is not "very fast": callers treat a zero duration as *already
 * finished*, so the element is at its destination on the first frame with no
 * animation at all. See `transition.ts`.
 */

/* -------------------------------------------------------------------------- */
/* Durations.                                                                  */
/* -------------------------------------------------------------------------- */

/** The four speeds. Nothing in the product moves at a duration outside this set. */
export type MotionDurationName = 'instant' | 'fast' | 'standard' | 'slow';

/** The table. The single place any of these four numbers is written. */
export const MOTION_DURATIONS_MS: Readonly<Record<MotionDurationName, number>> = Object.freeze({
  instant: 120,
  fast: 180,
  standard: 260,
  slow: 340,
});

/** The slots from quickest to slowest, for iteration and for tests. */
export const MOTION_DURATION_NAMES: readonly MotionDurationName[] = Object.freeze([
  'instant',
  'fast',
  'standard',
  'slow',
]);

/**
 * The fifth duration rule B allows, and the one that is not a speed.
 *
 * 700 ms paces the things that repeat rather than transition — the skeleton
 * sweep, the progress sheen. Nothing travels from one state to another at it,
 * which is why it is kept out of {@link MotionDurationName}: offering it as a
 * fifth slot would invite someone to open a panel over three quarters of a
 * second. It is here so that the loops have a named constant too, rather than
 * a literal somewhere.
 */
export const AMBIENT_LOOP_MS = 700;

/** Whether the caller — or the operating system — has asked for less movement. */
export interface ReducedMotionOption {
  readonly reducedMotion?: boolean;
}

/**
 * How long a slot lasts, in milliseconds. Zero under reduced motion.
 *
 * Zero is deliberate rather than merely small: every caller in this module
 * treats a zero-length transition as finished before it starts, which turns a
 * move into a cut. A very short duration would still animate, and a person who
 * asked their system for less motion would still get some.
 */
export function durationMs(name: MotionDurationName, options: ReducedMotionOption = {}): number {
  return options.reducedMotion === true ? 0 : MOTION_DURATIONS_MS[name];
}

/** The same figure as a CSS time, for an inline style or a custom property. */
export function cssDurationMs(name: MotionDurationName, options: ReducedMotionOption = {}): string {
  return `${durationMs(name, options)}ms`;
}

/** Milliseconds to seconds. The animation libraries count in seconds; this table does not. */
export const MILLISECONDS_PER_SECOND = 1000;

/**
 * The same figure in seconds, which is what `framer-motion` counts in.
 *
 * `transition={{ duration: durationSeconds('fast') }}` rather than
 * `duration: 0.18` — the point of the exercise. A view names the slot; the
 * conversion happens here, once.
 */
export function durationSeconds(
  name: MotionDurationName,
  options: ReducedMotionOption = {},
): number {
  return durationMs(name, options) / MILLISECONDS_PER_SECOND;
}

/* -------------------------------------------------------------------------- */
/* Curves.                                                                     */
/* -------------------------------------------------------------------------- */

/** Which of the three curves. */
export type MotionEasingName = 'enter' | 'exit' | 'inOut';

/** The two free control points of a cubic Bézier, as CSS orders them. */
export type CubicBezierPoints = readonly [number, number, number, number];

/** One curve, described once and usable from both CSS and JavaScript. */
export interface MotionEasing {
  readonly name: MotionEasingName;
  readonly points: CubicBezierPoints;
  /** The CSS form, e.g. `cubic-bezier(0, 0, 0.2, 1)`. */
  readonly css: string;
  /** Sample it: linear progress 0..1 in, eased position 0..1 out. */
  readonly at: (progress: number) => number;
}

/**
 * Clamp to the unit interval, treating anything non-finite as the start.
 *
 * Shared rather than rewritten per call site because a `NaN` that leaks into a
 * transform is invisible until the element vanishes.
 */
export function clampProgress(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/**
 * One coordinate of a cubic Bézier whose ends are pinned at 0 and 1.
 *
 * Written in polynomial form — `((a·t + b)·t + c)·t` — rather than as the
 * textbook sum of Bernstein terms, because it is evaluated a few times per
 * frame per animated element.
 */
function bezierAt(t: number, p1: number, p2: number): number {
  const a = 1 - 3 * p2 + 3 * p1;
  const b = 3 * p2 - 6 * p1;
  const c = 3 * p1;

  return ((a * t + b) * t + c) * t;
}

/**
 * How many halvings are spent inverting the curve's x coordinate.
 *
 * Bisection rather than Newton–Raphson: every curve here has both x control
 * points inside `[0, 1]`, which makes x(t) monotonic, which makes bisection
 * unconditionally convergent — no divergence to guard against and no slope of
 * zero to special-case. Twenty-four halvings leave t accurate to about 6e-8,
 * far below a pixel of consequence.
 */
const BISECTION_ITERATIONS = 24;

/** The curve parameter `t` at which the curve's x coordinate equals `x`. */
function solveForT(x: number, x1: number, x2: number): number {
  let low = 0;
  let high = 1;
  let t = x;

  for (let i = 0; i < BISECTION_ITERATIONS; i += 1) {
    if (bezierAt(t, x1, x2) < x) {
      low = t;
    } else {
      high = t;
    }
    t = (low + high) / 2;
  }

  return t;
}

function defineEasing(name: MotionEasingName, points: CubicBezierPoints): MotionEasing {
  const [x1, y1, x2, y2] = points;
  const isLinear = x1 === y1 && x2 === y2;

  return Object.freeze({
    name,
    points: Object.freeze([x1, y1, x2, y2] as const),
    css: `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`,
    at: (progress: number): number => {
      const x = clampProgress(progress);

      // Both ends are exact by construction; returning them without solving
      // keeps a finished transition at precisely 1 rather than 0.9999999.
      if (isLinear || x === 0 || x === 1) {
        return x;
      }

      return bezierAt(solveForT(x, x1, x2), y1, y2);
    },
  });
}

/**
 * The three curves.
 *
 * Every control point is within the unit square, so none of these can overshoot
 * its destination or double back — the property that separates a gentle curve
 * from a springy one, and the reason a bounce cannot be introduced here by
 * editing four numbers without a test failing.
 */
export const MOTION_EASINGS: Readonly<Record<MotionEasingName, MotionEasing>> = Object.freeze({
  enter: defineEasing('enter', [0, 0, 0.2, 1]),
  exit: defineEasing('exit', [0.4, 0, 1, 1]),
  inOut: defineEasing('inOut', [0.4, 0, 0.6, 1]),
});

/** The curves in a fixed order, for iteration and for tests. */
export const MOTION_EASING_NAMES: readonly MotionEasingName[] = Object.freeze([
  'enter',
  'exit',
  'inOut',
]);

/** The curve with this name. */
export function easingOf(name: MotionEasingName): MotionEasing {
  return MOTION_EASINGS[name];
}
