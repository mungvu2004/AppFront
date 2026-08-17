import { describe, expect, it } from 'vitest';

import {
  diffListKeys,
  LIST_MOTION_ITEM_LIMIT,
  planListMotion,
  preservedScrollTopPx,
  scrollAnchorOf,
  type ListItemLayout,
} from '../listMotion';
import { conditionsFor, layoutTriggeringIn } from '../orchestrate';
import {
  createSidePanelResizeDrag,
  planSidePanelSnapBack,
  planSidePanelToggle,
  SIDE_PANEL_SNAP_MODES,
  SIDE_PANEL_WIDTHS_PX,
  sidePanelEdgeOffsetPx,
  sidePanelWidthPx,
  snapSidePanelMode,
} from '../sidePanel';
import { MOTION_DURATIONS_MS } from '../tokens';
import { COUNT_UP_DURATION, createCountUp, sampleCountUp } from '../useCountUp';

const keys = (count: number, prefix = 'row'): string[] =>
  Array.from({ length: count }, (_unused, index) => `${prefix}-${String(index)}`);

/* -------------------------------------------------------------------------- */
/* Diffing two snapshots.                                                      */
/* -------------------------------------------------------------------------- */

describe('diffListKeys', () => {
  it('sorts a change into added, removed, moved and stable', () => {
    const diff = diffListKeys(['a', 'b', 'c', 'd'], ['a', 'c', 'b', 'e']);

    expect(diff.added).toEqual([{ key: 'e', index: 3 }]);
    expect(diff.removed).toEqual([{ key: 'd', index: 3 }]);
    expect(diff.moved).toEqual([
      { key: 'c', fromIndex: 2, toIndex: 1 },
      { key: 'b', fromIndex: 1, toIndex: 2 },
    ]);
    expect(diff.stable).toEqual([{ key: 'a', fromIndex: 0, toIndex: 0 }]);
  });

  it('counts a row pushed down by an insertion as moved, because it visibly slides', () => {
    const diff = diffListKeys(['a', 'b'], ['new', 'a', 'b']);

    expect(diff.moved).toEqual([
      { key: 'a', fromIndex: 0, toIndex: 1 },
      { key: 'b', fromIndex: 1, toIndex: 2 },
    ]);
  });

  it('handles empty snapshots on either side', () => {
    expect(diffListKeys([], ['a']).added).toEqual([{ key: 'a', index: 0 }]);
    expect(diffListKeys(['a'], []).removed).toEqual([{ key: 'a', index: 0 }]);
    expect(diffListKeys([], [])).toEqual({ added: [], removed: [], moved: [], stable: [] });
  });

  it('keeps the first occurrence of a duplicate key instead of throwing mid-render', () => {
    const diff = diffListKeys(['a'], ['a', 'a']);

    expect(diff.stable).toEqual([{ key: 'a', fromIndex: 0, toIndex: 0 }]);
    expect(diff.added).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* Planning the change.                                                        */
/* -------------------------------------------------------------------------- */

describe('planListMotion', () => {
  it('staggers entrances down the stepped schedule', () => {
    const plan = planListMotion([], keys(4));

    expect(plan.enter.map((motion) => motion.delayMs)).toEqual([0, 24, 48, 72]);
    expect(plan.enter.every((motion) => motion.durationMs === MOTION_DURATIONS_MS.fast)).toBe(true);
    expect(plan.enter.every((motion) => motion.easing === 'enter')).toBe(true);
  });

  it('starts every departure at once, at the quick slot', () => {
    const plan = planListMotion(keys(3), []);

    expect(plan.exit.every((motion) => motion.delayMs === 0)).toBe(true);
    expect(plan.exit.every((motion) => motion.durationMs === MOTION_DURATIONS_MS.instant)).toBe(
      true,
    );
    expect(plan.exit.every((motion) => motion.easing === 'exit')).toBe(true);
  });

  it('slides a surviving row without fading it', () => {
    const plan = planListMotion(['a', 'b'], ['b', 'a']);

    expect(plan.move).toHaveLength(2);
    expect(plan.move.some((motion) => motion.properties.includes('opacity'))).toBe(false);
    expect(plan.move.every((motion) => motion.easing === 'inOut')).toBe(true);
  });

  it('never schedules a motion on a layout-triggering property', () => {
    const plan = planListMotion(['a', 'b', 'c'], ['c', 'a', 'd']);

    [...plan.enter, ...plan.exit, ...plan.move].forEach((motion) => {
      expect(layoutTriggeringIn(motion.properties)).toEqual([]);
    });
  });

  it('reports when the last scheduled motion has finished', () => {
    const plan = planListMotion([], keys(3));

    // Third entrance: 48ms delay + 180ms fast entrance.
    expect(plan.totalMs).toBe(48 + MOTION_DURATIONS_MS.fast);
    expect(planListMotion([], []).totalMs).toBe(0);
  });

  it('schedules nothing at all for a list of 300', () => {
    const plan = planListMotion([], keys(300));

    expect(plan.suppressed).toBe(true);
    expect(plan.enter).toEqual([]);
    expect(plan.exit).toEqual([]);
    expect(plan.move).toEqual([]);
    expect(plan.totalMs).toBe(0);
  });

  it('reads the larger snapshot, so clearing a big list is also silent', () => {
    expect(planListMotion(keys(300), keys(5)).suppressed).toBe(true);
  });

  it('still animates at exactly the limit', () => {
    const plan = planListMotion([], keys(LIST_MOTION_ITEM_LIMIT));

    expect(plan.suppressed).toBe(false);
    expect(plan.enter).toHaveLength(LIST_MOTION_ITEM_LIMIT);
  });

  it('collapses to zero-length motions under reduced motion', () => {
    const plan = planListMotion([], keys(3), { reducedMotion: true });

    [...plan.enter, ...plan.exit, ...plan.move].forEach((motion) => {
      expect(motion.delayMs).toBe(0);
      expect(motion.durationMs).toBe(0);
    });
    expect(plan.totalMs).toBe(0);
  });

  it('drops to the instant slot with no stagger on a struggling machine', () => {
    const plan = planListMotion([], keys(3), conditionsFor({ frameRate: 20 }));

    expect(plan.enter.every((motion) => motion.delayMs === 0)).toBe(true);
    expect(plan.enter.every((motion) => motion.durationMs === MOTION_DURATIONS_MS.instant)).toBe(
      true,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Keeping the reader's place.                                                 */
/* -------------------------------------------------------------------------- */

const uniformRows = (count: number, rowHeightPx: number): ListItemLayout<string>[] =>
  keys(count).map((key, index) => ({ key, topPx: index * rowHeightPx }));

describe('scroll preservation', () => {
  it('anchors to the row straddling the top edge', () => {
    expect(scrollAnchorOf(uniformRows(10, 40), 130)).toEqual({ key: 'row-3', offsetPx: 10 });
  });

  it('anchors to the first row when scrolled to the very top', () => {
    expect(scrollAnchorOf(uniformRows(10, 40), 0)).toEqual({ key: 'row-0', offsetPx: 0 });
  });

  it('has no anchor in an empty list', () => {
    expect(scrollAnchorOf([], 100)).toBeNull();
  });

  it('holds the anchored row still when rows above it are removed', () => {
    const prev = uniformRows(10, 40);
    // Rows 0 and 1 removed: every remaining row's top drops by 80.
    const next = prev.slice(2).map((item) => ({ key: item.key, topPx: item.topPx - 80 }));

    // Anchored on row-3 at offset 10; row-3 moved from 120 to 40.
    expect(preservedScrollTopPx(prev, next, 130)).toBe(50);
  });

  it('holds the anchored row still when rows are inserted above it', () => {
    const prev = uniformRows(5, 40);
    const next = [
      { key: 'inserted', topPx: 0 },
      ...prev.map((item) => ({ key: item.key, topPx: item.topPx + 40 })),
    ];

    expect(preservedScrollTopPx(prev, next, 90)).toBe(130);
  });

  it('falls back to the nearest surviving row when the anchor itself was removed', () => {
    const prev = uniformRows(6, 40);
    // row-2 (the anchor at scrollTop 80) is removed; rows below shift up.
    const next = [
      { key: 'row-0', topPx: 0 },
      { key: 'row-1', topPx: 40 },
      { key: 'row-3', topPx: 80 },
      { key: 'row-4', topPx: 120 },
      { key: 'row-5', topPx: 160 },
    ];

    // The next survivor down, row-3, was at 120 and lands at 80: shift −40.
    expect(preservedScrollTopPx(prev, next, 80)).toBe(40);
  });

  it('never returns a scroll offset above the top', () => {
    const prev = uniformRows(4, 40);
    const next = prev.map((item) => ({ key: item.key, topPx: Math.max(0, item.topPx - 200) }));

    expect(preservedScrollTopPx(prev, next, 40)).toBe(0);
  });

  it('treats a nonsense scroll reading as the top', () => {
    expect(preservedScrollTopPx(uniformRows(3, 40), uniformRows(3, 40), Number.NaN)).toBe(0);
    expect(scrollAnchorOf(uniformRows(3, 40), -50)).toEqual({ key: 'row-0', offsetPx: 0 });
  });
});

/* -------------------------------------------------------------------------- */
/* The side panel.                                                             */
/* -------------------------------------------------------------------------- */

describe('side panel widths', () => {
  it('has exactly the three widths from the brief', () => {
    expect(SIDE_PANEL_WIDTHS_PX).toEqual({ rail: 56, compact: 280, wide: 344 });
    expect(sidePanelWidthPx('compact')).toBe(280);
  });

  it('snaps a released width to the nearer of the two open widths', () => {
    expect(snapSidePanelMode(280)).toBe('compact');
    expect(snapSidePanelMode(311)).toBe('compact');
    expect(snapSidePanelMode(312)).toBe('wide');
    expect(snapSidePanelMode(344)).toBe('wide');
  });

  it('never snaps to the rail — collapsing belongs to the toggle', () => {
    expect(SIDE_PANEL_SNAP_MODES).toEqual(['compact', 'wide']);
    expect(snapSidePanelMode(56)).toBe('compact');
    expect(snapSidePanelMode(Number.NaN)).toBe('compact');
  });
});

describe('createSidePanelResizeDrag', () => {
  it('follows the pointer within the physical range of the panel', () => {
    const drag = createSidePanelResizeDrag(280);

    expect(drag.move(30)).toBe(310);
    expect(drag.move(500)).toBe(SIDE_PANEL_WIDTHS_PX.wide);
    expect(drag.move(-500)).toBe(SIDE_PANEL_WIDTHS_PX.rail);
  });

  it('reads total displacement, so a missed event cannot accumulate error', () => {
    const drag = createSidePanelResizeDrag(280);

    drag.move(10);
    drag.move(20);

    // 20 is the total since pointer-down, not 10 + 20.
    expect(drag.widthPx).toBe(300);
  });

  it('snaps to the nearer open width on release', () => {
    const drag = createSidePanelResizeDrag(280);
    drag.move(25);

    expect(drag.release()).toEqual({ mode: 'compact', widthPx: 280, fromWidthPx: 305 });
  });

  it('returns to where it started on cancel', () => {
    const drag = createSidePanelResizeDrag(344);
    drag.move(-100);

    expect(drag.cancel().mode).toBe('wide');
  });

  it('ignores moves after it has finished', () => {
    const drag = createSidePanelResizeDrag(280);
    drag.release();

    expect(drag.isActive).toBe(false);
    expect(drag.move(50)).toBe(280);
  });
});

describe('side panel motion plans', () => {
  it('opens and closes at the standard slot, on the transform alone', () => {
    const plan = planSidePanelToggle('rail', 'compact');

    expect(plan.durationMs).toBe(MOTION_DURATIONS_MS.standard);
    expect(plan.properties).toEqual(['transform']);
    expect(layoutTriggeringIn(plan.properties)).toEqual([]);
  });

  it('decelerates in when growing and accelerates away when shrinking', () => {
    expect(planSidePanelToggle('rail', 'wide').easing).toBe('enter');
    expect(planSidePanelToggle('wide', 'rail').easing).toBe('exit');
  });

  it('corrects a released drag at the instant slot', () => {
    const drag = createSidePanelResizeDrag(280);
    drag.move(25);
    const plan = planSidePanelSnapBack(drag.release());

    expect(plan).toMatchObject({ fromPx: 305, toPx: 280 });
    expect(plan.durationMs).toBe(MOTION_DURATIONS_MS.instant);
  });

  it('slides the edge the full width difference at 0 and exactly into place at 1', () => {
    const plan = planSidePanelToggle('rail', 'compact');

    expect(sidePanelEdgeOffsetPx(plan, 0)).toBe(56 - 280);
    expect(sidePanelEdgeOffsetPx(plan, 1)).toBe(0);
    expect(sidePanelEdgeOffsetPx(plan, Number.NaN)).toBe(56 - 280);
  });

  it('collapses to nothing under reduced motion', () => {
    expect(planSidePanelToggle('rail', 'wide', { reducedMotion: true }).durationMs).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* The count-up.                                                               */
/* -------------------------------------------------------------------------- */

/** Vietnamese notation with exactly two decimals: `0,00`, `117,23`, `1.234,56`. */
const TWO_DECIMALS = /^\d{1,3}(?:\.\d{3})*,\d{2}$/u;

describe('count-up', () => {
  it('runs at the standard slot from the ladder', () => {
    // The brief asked for 240ms; rule B has no such duration, so the nearest slot.
    expect(createCountUp({ to: 1 }).durationMs).toBe(MOTION_DURATIONS_MS[COUNT_UP_DURATION]);
  });

  it('shows exactly two decimals at every frame from 0 to 248,60', () => {
    const spec = { to: 248.6, format: { fractionDigits: 2 } };

    for (let elapsedMs = 0; elapsedMs <= 260; elapsedMs += 10) {
      expect(sampleCountUp(spec, elapsedMs).text).toMatch(TWO_DECIMALS);
    }
  });

  it('comes to rest on the exact target, formatted like any other number', () => {
    const sample = sampleCountUp({ to: 248.6, format: { fractionDigits: 2 } }, 260);

    expect(sample).toEqual({ value: 248.6, text: '248,60', done: true });
  });

  it('never overshoots the target and never counts backwards', () => {
    const spec = { to: 248.6, format: { fractionDigits: 2 } };
    let previous = -1;

    for (let elapsedMs = 0; elapsedMs <= 300; elapsedMs += 5) {
      const { value } = sampleCountUp(spec, elapsedMs);

      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeLessThanOrEqual(248.6);
      previous = value;
    }
  });

  it('shows whole numbers all the way for a count', () => {
    const spec = { to: 14, format: { fractionDigits: 0 } };

    for (let elapsedMs = 0; elapsedMs <= 260; elapsedMs += 10) {
      expect(sampleCountUp(spec, elapsedMs).text).toMatch(/^\d+$/u);
    }
  });

  it('groups thousands correctly even mid-run', () => {
    const sample = sampleCountUp({ to: 5000, format: { fractionDigits: 2 } }, 200);

    expect(sample.text).toMatch(TWO_DECIMALS);
  });

  it('is already over when there is no distance to run', () => {
    // A caller mounting at rest must not get a quarter second of no-op frames.
    const sample = sampleCountUp({ from: 42, to: 42, format: { fractionDigits: 0 } }, 0);

    expect(sample).toEqual({ value: 42, text: '42', done: true });
  });

  it('can start from a value other than zero, in either direction', () => {
    expect(sampleCountUp({ from: 100, to: 50 }, 0).value).toBe(100);
    expect(sampleCountUp({ from: 100, to: 50 }, 260).value).toBe(50);
  });

  it('is its value immediately under reduced motion', () => {
    const sample = sampleCountUp({ to: 248.6, format: { fractionDigits: 2 }, reducedMotion: true }, 0);

    expect(sample).toEqual({ value: 248.6, text: '248,60', done: true });
  });

  it('runs at the instant slot on a struggling machine', () => {
    const countUp = createCountUp({ to: 100, ...conditionsFor({ frameRate: 20 }) });

    expect(countUp.durationMs).toBe(MOTION_DURATIONS_MS.instant);
    expect(countUp.advance(120).done).toBe(true);
  });

  it('shows the missing-value dash for a target that is not a number', () => {
    const sample = sampleCountUp({ to: Number.NaN, format: { fractionDigits: 2 } }, 0);

    expect(sample.text).toBe('—');
    expect(sample.done).toBe(true);
  });

  it('keeps its own time when driven by an external clock', () => {
    const countUp = createCountUp({ to: 248.6, format: { fractionDigits: 2 } });

    expect(countUp.sample().value).toBe(0);

    countUp.advance(130);
    expect(countUp.done).toBe(false);
    expect(countUp.text).toMatch(TWO_DECIMALS);

    countUp.advance(130);
    expect(countUp.done).toBe(true);
    expect(countUp.text).toBe('248,60');
  });

  it('ignores a step that is zero, negative or not a number', () => {
    const countUp = createCountUp({ to: 100 });

    countUp.advance(0);
    countUp.advance(-40);
    countUp.advance(Number.NaN);

    expect(countUp.sample().value).toBe(0);
  });

  it('jumps straight to rest when told to finish', () => {
    const countUp = createCountUp({ to: 248.6, format: { fractionDigits: 2 } });

    expect(countUp.finish()).toEqual({ value: 248.6, text: '248,60', done: true });
  });
});
