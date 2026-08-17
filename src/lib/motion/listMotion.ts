/**
 * How a list changes without losing the reader's place.
 *
 * Three things happen to a QC list — a row arrives, a row leaves, rows change
 * order — and each is worth showing *briefly*, because the alternative is a
 * table that silently becomes a different table and the reader has to re-find
 * their row. This module turns two snapshots of the list's keys into a timed
 * plan: which rows enter, which exit, which slide, and when.
 *
 * ## Motion is a luxury the list gives up first
 *
 * Above {@link LIST_MOTION_ITEM_LIMIT} rows the plan is empty — not shortened,
 * empty. Every animated row costs a compositor layer, and a FLIP pass over
 * hundreds of rows means hundreds of `getBoundingClientRect` calls before the
 * first frame; at that size the animation *causes* the jank it exists to paper
 * over. The rule from the brief is "add/remove motion off past 200"; moves are
 * switched off with them because a move is the most expensive of the three.
 *
 * ## What each change is allowed to animate
 *
 * Enter and exit fade and shift (`opacity`, `transform`); a move only slides
 * (`transform`). Nothing here animates height, and that is the point: a row
 * that grows open animates the *content's* transform inside a clip, never the
 * row box. All three sets are checked against the compositor allowlist in
 * `orchestrate.ts` by the tests.
 *
 * ## The scroll position is data, not luck
 *
 * When rows above the viewport appear or disappear, the browser keeps
 * `scrollTop` and lets the content slide underneath it — the reader's row jumps.
 * {@link preservedScrollTopPx} does the opposite: it finds the row at the top
 * edge before the change (the *anchor*), finds where that row lands after, and
 * returns the scroll offset that pins it to the same place on screen. The view
 * measures row tops; this module only does the arithmetic, which is what makes
 * the arithmetic testable.
 */

import { conditionedDurationMs, type CompositedProperty, type MotionConditions } from './orchestrate';
import { staggerDelaysMs } from './stagger';
import { type MotionDurationName, type MotionEasingName } from './tokens';

/** A row key: whatever uniquely names a row across renders. */
export type ListKey = string | number;

/* -------------------------------------------------------------------------- */
/* Diffing two snapshots of the list.                                          */
/* -------------------------------------------------------------------------- */

/** A key and where it sits in one snapshot. */
export interface ListKeyPlacement<K extends ListKey> {
  readonly key: K;
  readonly index: number;
}

/** A key that survived the change, and both of its positions. */
export interface ListKeyMove<K extends ListKey> {
  readonly key: K;
  readonly fromIndex: number;
  readonly toIndex: number;
}

/** Everything that happened between two snapshots, sorted into four bins. */
export interface ListDiff<K extends ListKey> {
  /** Keys only in the next snapshot, with their new index. */
  readonly added: readonly ListKeyPlacement<K>[];
  /** Keys only in the previous snapshot, with their old index. */
  readonly removed: readonly ListKeyPlacement<K>[];
  /** Surviving keys whose index changed — including rows merely pushed by an insertion, which do visibly slide. */
  readonly moved: readonly ListKeyMove<K>[];
  /** Surviving keys that did not move at all. */
  readonly stable: readonly ListKeyMove<K>[];
}

/**
 * Index every key once. A duplicate key keeps its first position — duplicates
 * are a caller bug, but a diff that throws mid-render would turn that bug into
 * a blank screen.
 */
function indexByKey<K extends ListKey>(keys: readonly K[]): Map<K, number> {
  const byKey = new Map<K, number>();

  keys.forEach((key, index) => {
    if (!byKey.has(key)) {
      byKey.set(key, index);
    }
  });

  return byKey;
}

/** Sort the change between two snapshots into added, removed, moved and stable. */
export function diffListKeys<K extends ListKey>(
  previousKeys: readonly K[],
  nextKeys: readonly K[],
): ListDiff<K> {
  const previousIndex = indexByKey(previousKeys);
  const nextIndex = indexByKey(nextKeys);

  const added: ListKeyPlacement<K>[] = [];
  const removed: ListKeyPlacement<K>[] = [];
  const moved: ListKeyMove<K>[] = [];
  const stable: ListKeyMove<K>[] = [];

  nextKeys.forEach((key, toIndex) => {
    if (nextIndex.get(key) !== toIndex) {
      return; // A duplicate; its first occurrence has already been classified.
    }

    const fromIndex = previousIndex.get(key);

    if (fromIndex === undefined) {
      added.push({ key, index: toIndex });
    } else if (fromIndex === toIndex) {
      stable.push({ key, fromIndex, toIndex });
    } else {
      moved.push({ key, fromIndex, toIndex });
    }
  });

  previousKeys.forEach((key, index) => {
    if (previousIndex.get(key) === index && !nextIndex.has(key)) {
      removed.push({ key, index });
    }
  });

  return { added, removed, moved, stable };
}

/* -------------------------------------------------------------------------- */
/* Turning a diff into a timed plan.                                           */
/* -------------------------------------------------------------------------- */

/** Past this many rows, no list motion is scheduled at all. See the module note. */
export const LIST_MOTION_ITEM_LIMIT = 200;

/** An arriving row fades and shifts into place. */
const ENTER_PROPERTIES: readonly CompositedProperty[] = Object.freeze(['opacity', 'transform']);

/** A leaving row fades and shifts out. */
const EXIT_PROPERTIES: readonly CompositedProperty[] = Object.freeze(['opacity', 'transform']);

/** A surviving row only slides — it is still the same row, so it must not fade. */
const MOVE_PROPERTIES: readonly CompositedProperty[] = Object.freeze(['transform']);

/**
 * The slots. A row is a small thing appearing where the reader is looking, so
 * it enters at `fast`; it leaves at `instant` because a departure should close
 * the gap before the eye asks what was there; it slides at `fast` because a
 * slower slide across other rows reads as the list rearranging itself at
 * leisure.
 */
const ENTER_DURATION: MotionDurationName = 'fast';
const EXIT_DURATION: MotionDurationName = 'instant';
const MOVE_DURATION: MotionDurationName = 'fast';

/** One row's entrance, timed. Delays follow the stepped schedule in `stagger.ts`. */
export interface ListEnterMotion<K extends ListKey> {
  readonly key: K;
  readonly index: number;
  readonly delayMs: number;
  readonly durationMs: number;
  readonly easing: MotionEasingName;
  readonly properties: readonly CompositedProperty[];
}

/** One row's departure, timed. Departures all start at once. */
export interface ListExitMotion<K extends ListKey> {
  readonly key: K;
  readonly fromIndex: number;
  readonly delayMs: number;
  readonly durationMs: number;
  readonly easing: MotionEasingName;
  readonly properties: readonly CompositedProperty[];
}

/** One surviving row's slide from its old slot to its new one (FLIP-style). */
export interface ListMoveMotion<K extends ListKey> {
  readonly key: K;
  readonly fromIndex: number;
  readonly toIndex: number;
  readonly delayMs: number;
  readonly durationMs: number;
  readonly easing: MotionEasingName;
  readonly properties: readonly CompositedProperty[];
}

/** The whole change, timed. Empty when the list is too big to animate. */
export interface ListMotionPlan<K extends ListKey> {
  /** True when the row count switched the motion off entirely. */
  readonly suppressed: boolean;
  readonly enter: readonly ListEnterMotion<K>[];
  readonly exit: readonly ListExitMotion<K>[];
  readonly move: readonly ListMoveMotion<K>[];
  /** When the last scheduled motion has finished; `0` for an empty plan. */
  readonly totalMs: number;
}

const EMPTY_PLAN: ListMotionPlan<never> = Object.freeze({
  suppressed: true,
  enter: Object.freeze([]),
  exit: Object.freeze([]),
  move: Object.freeze([]),
  totalMs: 0,
});

/**
 * Time every row's part in the change. Pure — nothing has moved yet.
 *
 * The size gate reads the *larger* snapshot: clearing a 300-row list down to 5
 * would otherwise animate 295 departures, which is the exact freeze the gate
 * exists to prevent.
 */
export function planListMotion<K extends ListKey>(
  previousKeys: readonly K[],
  nextKeys: readonly K[],
  conditions: MotionConditions = {},
): ListMotionPlan<K> {
  if (Math.max(previousKeys.length, nextKeys.length) > LIST_MOTION_ITEM_LIMIT) {
    return EMPTY_PLAN;
  }

  const diff = diffListKeys(previousKeys, nextKeys);

  const enterDurationMs = conditionedDurationMs(ENTER_DURATION, conditions);
  const exitDurationMs = conditionedDurationMs(EXIT_DURATION, conditions);
  const moveDurationMs = conditionedDurationMs(MOVE_DURATION, conditions);
  const enterDelays = staggerDelaysMs(diff.added.length, conditions);

  const enter: ListEnterMotion<K>[] = diff.added.map((placement, order) => ({
    key: placement.key,
    index: placement.index,
    delayMs: enterDelays[order] ?? 0,
    durationMs: enterDurationMs,
    easing: 'enter',
    properties: ENTER_PROPERTIES,
  }));

  const exit: ListExitMotion<K>[] = diff.removed.map((placement) => ({
    key: placement.key,
    fromIndex: placement.index,
    delayMs: 0,
    durationMs: exitDurationMs,
    easing: 'exit',
    properties: EXIT_PROPERTIES,
  }));

  const move: ListMoveMotion<K>[] = diff.moved.map((change) => ({
    key: change.key,
    fromIndex: change.fromIndex,
    toIndex: change.toIndex,
    delayMs: 0,
    durationMs: moveDurationMs,
    easing: 'inOut',
    properties: MOVE_PROPERTIES,
  }));

  const totalMs = [...enter, ...exit, ...move].reduce(
    (latest, motion) => Math.max(latest, motion.delayMs + motion.durationMs),
    0,
  );

  return { suppressed: false, enter, exit, move, totalMs };
}

/* -------------------------------------------------------------------------- */
/* Keeping the reader's place.                                                 */
/* -------------------------------------------------------------------------- */

/** A row's measured top edge, in content coordinates. Pass rows in list order. */
export interface ListItemLayout<K extends ListKey> {
  readonly key: K;
  readonly topPx: number;
}

/**
 * The row the viewport is holding onto, and how far the top edge is inside it.
 *
 * `offsetPx` is `scrollTop − top`: positive when the row straddles the top
 * edge, negative only when the list is scrolled above its first row.
 */
export interface ScrollAnchor<K extends ListKey> {
  readonly key: K;
  readonly offsetPx: number;
}

/** A scroll offset a container will accept: finite and not above the top. */
function sanitizeScrollTop(scrollTopPx: number): number {
  return Number.isFinite(scrollTopPx) ? Math.max(0, scrollTopPx) : 0;
}

/**
 * The row to pin the viewport to: the last row starting at or above the top
 * edge, or the first row when the list is scrolled above all of them.
 * `null` only for an empty list.
 */
export function scrollAnchorOf<K extends ListKey>(
  items: readonly ListItemLayout<K>[],
  scrollTopPx: number,
): ScrollAnchor<K> | null {
  const top = sanitizeScrollTop(scrollTopPx);
  let anchor: ListItemLayout<K> | null = null;

  for (const item of items) {
    if (item.topPx <= top && (anchor === null || item.topPx >= anchor.topPx)) {
      anchor = item;
    }
  }

  const pinned = anchor ?? items[0] ?? null;

  return pinned === null ? null : { key: pinned.key, offsetPx: top - pinned.topPx };
}

/**
 * The scroll offset that keeps the anchored row where the reader sees it now.
 *
 * When the anchor itself was removed, the nearest surviving row takes over —
 * first looking down the list, then up — and the viewport pins to that instead,
 * which is what a reader whose row vanished would do with their own eyes.
 * The result is clamped at zero; clamping at the bottom needs the container
 * height, which the caller's scroller already enforces.
 */
export function preservedScrollTopPx<K extends ListKey>(
  previousItems: readonly ListItemLayout<K>[],
  nextItems: readonly ListItemLayout<K>[],
  scrollTopPx: number,
): number {
  const top = sanitizeScrollTop(scrollTopPx);
  const anchor = scrollAnchorOf(previousItems, top);

  if (anchor === null) {
    return top;
  }

  const nextTopByKey = new Map<K, number>();
  nextItems.forEach((item) => {
    if (!nextTopByKey.has(item.key)) {
      nextTopByKey.set(item.key, item.topPx);
    }
  });

  const anchorPosition = previousItems.findIndex((item) => item.key === anchor.key);
  const candidates = [
    ...previousItems.slice(anchorPosition),
    ...previousItems.slice(0, anchorPosition).reverse(),
  ];

  for (const candidate of candidates) {
    const nextTop = nextTopByKey.get(candidate.key);

    if (nextTop !== undefined) {
      return Math.max(0, nextTop + (top - candidate.topPx));
    }
  }

  return top;
}
