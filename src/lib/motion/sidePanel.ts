/**
 * The side panel's three widths, and how it moves between them.
 *
 * The panel has exactly three sizes — a 56 px rail of icons, a 280 px compact
 * panel, a 344 px wide one — and no fourth. A freely resizable panel drifts to
 * a different width on every machine, and with it every screenshot, every bug
 * report and every reviewer's sense of the layout. So the drag handle is an
 * *illusion of* free resize: the width follows the pointer while the button is
 * down, and on release it snaps to whichever of the two open widths is nearer.
 * The rail is not a snap target — collapsing is a decision, made through the
 * toggle, not a thing a slightly-too-long drag does to you.
 *
 * ## Nothing here animates `width`
 *
 * Animating a panel's width re-runs layout for the whole screen on every frame,
 * and the canvas beside it repaints at panel-resize speed. So a toggle is
 * planned as a *transform*: the view renders the panel at its destination width
 * immediately (one layout pass, on frame one) and slides its edge into place
 * with `translateX`, which the compositor does alone. {@link
 * sidePanelEdgeOffsetPx} is that arithmetic. During a drag the width genuinely
 * changes — direct manipulation cannot be faked — but a drag runs at pointer
 * speed, not at sixty enforced frames of tweening.
 *
 * The open/close durations come off the ladder (`standard` for the panel — a
 * thing with its own area — and `instant` for the post-drag snap, which is a
 * correction, not a scene). Reduced motion and low performance shorten them
 * through the same `conditionedDurationMs` everything else uses.
 */

import { conditionedDurationMs, type CompositedProperty, type MotionConditions } from './orchestrate';
import { clampProgress, type MotionEasingName } from './tokens';

/* -------------------------------------------------------------------------- */
/* The three widths.                                                           */
/* -------------------------------------------------------------------------- */

/** The panel's three states. There is deliberately no fourth. */
export type SidePanelMode = 'rail' | 'compact' | 'wide';

/** The three widths, in px. The single place these numbers are written. */
export const SIDE_PANEL_WIDTHS_PX: Readonly<Record<SidePanelMode, number>> = Object.freeze({
  rail: 56,
  compact: 280,
  wide: 344,
});

/** The widths a drag may settle at. The rail is reached by the toggle only. */
export const SIDE_PANEL_SNAP_MODES: readonly SidePanelMode[] = Object.freeze(['compact', 'wide']);

/** The width of one mode, in px. */
export function sidePanelWidthPx(mode: SidePanelMode): number {
  return SIDE_PANEL_WIDTHS_PX[mode];
}

/** Halfway between the two open widths — the line a released drag falls either side of. */
const SNAP_MIDPOINT_PX = (SIDE_PANEL_WIDTHS_PX.compact + SIDE_PANEL_WIDTHS_PX.wide) / 2;

/**
 * The open mode a released drag settles into: whichever of the two open widths
 * is nearer. Never the rail — see the module note. A nonsense width settles at
 * `compact`, the default open size.
 */
export function snapSidePanelMode(widthPx: number): SidePanelMode {
  if (!Number.isFinite(widthPx)) {
    return 'compact';
  }

  return widthPx < SNAP_MIDPOINT_PX ? 'compact' : 'wide';
}

/* -------------------------------------------------------------------------- */
/* Dragging the edge.                                                          */
/* -------------------------------------------------------------------------- */

/** Where a finished drag left the panel: the snapped mode, and where it snapped from. */
export interface SidePanelSettle {
  readonly mode: SidePanelMode;
  readonly widthPx: number;
  /** The width the pointer released at, for animating the snap. */
  readonly fromWidthPx: number;
}

/**
 * One drag of the resize handle, from pointer-down to release.
 *
 * `move` takes the pointer's total displacement since the drag began — the
 * `currentX − startX` a pointer-capture handler already has — rather than
 * per-event deltas, so a missed event cannot accumulate into a wrong width.
 */
export interface SidePanelResizeDrag {
  readonly startWidthPx: number;
  /** The width under the pointer right now, clamped to the panel's range. */
  readonly widthPx: number;
  /** False once released or cancelled; a finished drag ignores further moves. */
  readonly isActive: boolean;
  /** Follow the pointer. Returns the clamped live width. */
  move(totalDeltaPx: number): number;
  /** Let go: the width snaps to the nearer open width. */
  release(): SidePanelSettle;
  /** Abandon the drag (Esc): the panel returns to where it started. */
  cancel(): SidePanelSettle;
}

/** Fold any width into the range the panel can physically be. */
function clampPanelWidthPx(widthPx: number): number {
  if (!Number.isFinite(widthPx)) {
    return SIDE_PANEL_WIDTHS_PX.compact;
  }

  return Math.min(SIDE_PANEL_WIDTHS_PX.wide, Math.max(SIDE_PANEL_WIDTHS_PX.rail, widthPx));
}

/** Begin a drag from the panel's current width. */
export function createSidePanelResizeDrag(startWidthPx: number): SidePanelResizeDrag {
  const start = clampPanelWidthPx(startWidthPx);
  let width = start;
  let active = true;

  const settle = (mode: SidePanelMode): SidePanelSettle => {
    active = false;

    return {
      mode,
      widthPx: SIDE_PANEL_WIDTHS_PX[mode],
      fromWidthPx: width,
    };
  };

  return {
    get startWidthPx() {
      return start;
    },
    get widthPx() {
      return width;
    },
    get isActive() {
      return active;
    },
    move: (totalDeltaPx) => {
      if (active && Number.isFinite(totalDeltaPx)) {
        width = clampPanelWidthPx(start + totalDeltaPx);
      }

      return width;
    },
    release: () => settle(snapSidePanelMode(width)),
    cancel: () => settle(snapSidePanelMode(start)),
  };
}

/* -------------------------------------------------------------------------- */
/* Moving between widths.                                                      */
/* -------------------------------------------------------------------------- */

/** A panel movement, timed and ready to draw. Transform-only by construction. */
export interface SidePanelMotionPlan {
  readonly fromPx: number;
  readonly toPx: number;
  readonly durationMs: number;
  readonly easing: MotionEasingName;
  readonly properties: readonly CompositedProperty[];
}

/** The one thing a panel movement may animate. */
const PANEL_PROPERTIES: readonly CompositedProperty[] = Object.freeze(['transform']);

/**
 * Time an open, close, or resize between two modes.
 *
 * Growing decelerates in (`enter`) and shrinking accelerates away (`exit`), the
 * same asymmetry every other arrival and departure in the product has.
 */
export function planSidePanelToggle(
  from: SidePanelMode,
  to: SidePanelMode,
  conditions: MotionConditions = {},
): SidePanelMotionPlan {
  const fromPx = SIDE_PANEL_WIDTHS_PX[from];
  const toPx = SIDE_PANEL_WIDTHS_PX[to];

  return Object.freeze({
    fromPx,
    toPx,
    durationMs: conditionedDurationMs('standard', conditions),
    easing: toPx >= fromPx ? ('enter' as MotionEasingName) : ('exit' as MotionEasingName),
    properties: PANEL_PROPERTIES,
  });
}

/**
 * Time the short correction from a released drag's width to its snapped width.
 * `instant`, because it is the interface tidying up, not a scene change.
 */
export function planSidePanelSnapBack(
  settle: SidePanelSettle,
  conditions: MotionConditions = {},
): SidePanelMotionPlan {
  return Object.freeze({
    fromPx: settle.fromWidthPx,
    toPx: settle.widthPx,
    durationMs: conditionedDurationMs('instant', conditions),
    easing: 'inOut' as MotionEasingName,
    properties: PANEL_PROPERTIES,
  });
}

/**
 * The `translateX` that makes a destination-width panel look `value`-of-the-way
 * there: the full width difference at `0`, exactly in place at `1`. The view
 * renders the panel at `toPx` and applies this offset to its edge; no frame
 * between the two ever changes layout.
 */
export function sidePanelEdgeOffsetPx(plan: SidePanelMotionPlan, value: number): number {
  const offsetPx = (plan.fromPx - plan.toPx) * (1 - clampProgress(value));

  // A finished slide multiplies a negative difference by zero, and `-0` in a
  // transform string reads as `translateX(-0px)`. The same quantity as zero.
  return offsetPx === 0 ? 0 : offsetPx;
}
