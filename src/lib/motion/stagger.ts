/**
 * A list that arrives in order, and stops arriving in order before it drags.
 *
 * When a list of rooms or violations appears all at once it reads as a flash and
 * the eye has nowhere to start. Delaying each row a little makes the order
 * legible: the reader's attention is handed down the list rather than dropped on
 * it. That is the whole benefit, and it is spent within the first few rows.
 *
 * ## Why the stagger stops
 *
 * The obvious implementation — `index × 24 ms` — is a bug on any real list. A
 * results panel with forty violations would spend `39 × 24 = 936 ms` dealing
 * itself out, and the reader is left watching a progress bar made of their own
 * data. Worse, the rows they are most likely to want are at the bottom, arriving
 * last.
 *
 * So the ramp stops. {@link MAX_STAGGERED_ITEMS} rows are staggered; everything
 * after them shares the final delay and appears together. Eight rows is enough
 * to establish the direction of travel, which is all the effect is for.
 *
 * ```
 *   row 0   1   2   3   4   5   6   7   8   9  …  39
 *    ms 0  24  48  72  96 120 144 168 168 168 … 168
 *                                   └── the ramp stops here ──┘
 * ```
 *
 * The longest any row waits is therefore `(8 − 1) × 24 = 168 ms`, under the
 * 200 ms ceiling whatever the list length. {@link STAGGER_BUDGET_MS} states that
 * ceiling and `orchestrate.test.ts` checks the two constants against it, so
 * raising either one fails a test rather than quietly slowing a panel down.
 *
 * ## Nothing is delayed when movement is cut back
 *
 * Under `prefers-reduced-motion` every delay is zero, for the same reason every
 * duration is.
 *
 * Under low performance every delay is *also* zero, which is worth saying out
 * loud because the rest of the motion system merely shortens. A stagger is
 * useless below the frame rate it is measured against: at 20 fps a frame lasts
 * 50 ms, so a 24 ms step lands two rows on the same frame and the order the
 * effect exists to show is not drawn at all. It becomes latency with no
 * compensating legibility, which is worth removing rather than shortening.
 */

import { conditionedDurationMs, type MotionConditions } from './orchestrate';
import { type MotionDurationName } from './tokens';

/** How much later each row arrives than the one above it. */
export const STAGGER_STEP_MS = 24;

/** How many rows are staggered before the rest share the final delay. */
export const MAX_STAGGERED_ITEMS = 8;

/** The ceiling the whole ramp must stay under, however long the list. */
export const STAGGER_BUDGET_MS = 200;

/** Is the stagger switched off entirely? See the module note. */
function isSuppressed(conditions: MotionConditions): boolean {
  return conditions.reducedMotion === true || conditions.lowPerformance === true;
}

/**
 * How long the row at `index` waits before it starts.
 *
 * Clamped at both ends: a negative or non-finite index is treated as the first
 * row, and every row past the ramp shares {@link maxStaggerMs}.
 */
export function staggerDelayMs(index: number, conditions: MotionConditions = {}): number {
  if (isSuppressed(conditions)) {
    return 0;
  }

  if (!Number.isFinite(index) || index <= 0) {
    return 0;
  }

  const step = Math.min(Math.floor(index), MAX_STAGGERED_ITEMS - 1);

  return step * STAGGER_STEP_MS;
}

/** The longest any row waits — the delay every row past the ramp shares. */
export function maxStaggerMs(conditions: MotionConditions = {}): number {
  return staggerDelayMs(MAX_STAGGERED_ITEMS - 1, conditions);
}

/** The delay for each of `count` rows, in order. */
export function staggerDelaysMs(count: number, conditions: MotionConditions = {}): readonly number[] {
  if (!Number.isFinite(count) || count <= 0) {
    return [];
  }

  return Array.from({ length: Math.floor(count) }, (_unused, index) =>
    staggerDelayMs(index, conditions),
  );
}

/** One row's place in the schedule, in milliseconds from the list appearing. */
export interface StaggeredItem {
  readonly index: number;
  readonly delayMs: number;
  readonly durationMs: number;
  /** When this row starts moving. Same as {@link StaggeredItem.delayMs}. */
  readonly startMs: number;
  /** When this row has finished arriving. */
  readonly endMs: number;
}

export interface StaggerScheduleOptions extends MotionConditions {
  /** How long each row's own entrance takes. Defaults to `fast`. */
  readonly duration?: MotionDurationName;
}

/**
 * The whole list's schedule: when each row starts and when it has arrived.
 *
 * Every row moves for the same length of time; only the start is staggered. A
 * ramp that also stretched the durations would have the last row still settling
 * long after the first, which reads as the list being unsure it has finished.
 */
export function staggerSchedule(
  count: number,
  options: StaggerScheduleOptions = {},
): readonly StaggeredItem[] {
  const durationMs = conditionedDurationMs(options.duration ?? 'fast', options);

  return staggerDelaysMs(count, options).map((delayMs, index) => ({
    index,
    delayMs,
    durationMs,
    startMs: delayMs,
    endMs: delayMs + durationMs,
  }));
}

/** When the last row has finished arriving; `0` for an empty list. */
export function staggerScheduleEndMs(
  count: number,
  options: StaggerScheduleOptions = {},
): number {
  return staggerSchedule(count, options).reduce((latest, item) => Math.max(latest, item.endMs), 0);
}
