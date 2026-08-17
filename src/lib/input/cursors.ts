/**
 * The cursor, declared once.
 *
 * On the canvas the cursor is how the product says what a click would do
 * right now, so it must never be decided ad hoc in a component. This module
 * is the one table: seven semantic kinds — select, draggable, dragging,
 * draw, forbidden, zoom, pan — a base cursor per tool, and one priority
 * ladder that folds the interaction state on top.
 *
 * The ladder, highest first, and why:
 *
 * 1. **forbidden** — a drag hovering an illegal drop point. The refusal must
 *    be visible *while dragging*, not discovered at release; this outranks
 *    everything.
 * 2. **dragging** — something is in hand; also what an active viewport pan
 *    shows (the consumer passes `dragging` while the pan gesture is down,
 *    and `panningViewport` alone while the pan is merely armed).
 * 3. **zoom** — the zoom gesture is armed.
 * 4. **pan** — the pan override (Space held) or the pan tool, at rest.
 * 5. **draggable** — the pointer rests on something that could be picked up.
 * 6. the tool's own base cursor.
 *
 * Kinds are semantic, CSS is a lookup: two kinds may share a CSS value
 * (`draggable` and `pan` both read `grab`) without the callers knowing.
 */

import type { ToolId } from '../tools/toolMachine';

/** The seven things a cursor can say. */
export type CursorKind =
  | 'select'
  | 'draggable'
  | 'dragging'
  | 'draw'
  | 'forbidden'
  | 'zoom'
  | 'pan';

/** The CSS `cursor` value each kind renders as. */
export const CURSOR_CSS: Readonly<Record<CursorKind, string>> = {
  select: 'default',
  draggable: 'grab',
  dragging: 'grabbing',
  draw: 'crosshair',
  forbidden: 'not-allowed',
  zoom: 'zoom-in',
  pan: 'grab',
};

/** Vietnamese name per kind, lower case sentence style (invariant A6). */
export const CURSOR_LABELS: Readonly<Record<CursorKind, string>> = {
  select: 'chọn',
  draggable: 'kéo được',
  dragging: 'đang kéo',
  draw: 'vẽ',
  forbidden: 'cấm',
  zoom: 'thu phóng',
  pan: 'di chuyển khung nhìn',
};

/**
 * The cursor each tool rests on when nothing else is happening. A complete
 * record, so a ninth tool fails the build here instead of shipping with a
 * default arrow.
 */
export const TOOL_CURSORS: Readonly<Record<ToolId, CursorKind>> = {
  select: 'select',
  pan: 'pan',
  drawWall: 'draw',
  placeOpening: 'draw',
  placeFurniture: 'draw',
  measure: 'draw',
  splitWall: 'draw',
  annotate: 'select',
};

/** Everything the cursor decision reads. Absent flags read as false. */
export interface CursorSituation {
  readonly tool: ToolId;
  /** A drag session (furniture, gizmo, viewport pan gesture) is in flight. */
  readonly dragging?: boolean;
  /** Read only while dragging: is the current drop point legal? */
  readonly dropAllowed?: boolean;
  /** The pointer rests on something that could be picked up. */
  readonly overDraggable?: boolean;
  /** The pan override (Space held) or pan gesture is armed but not moving. */
  readonly panningViewport?: boolean;
  /** The zoom gesture is armed. */
  readonly zooming?: boolean;
}

/** The one answer, folded down the priority ladder documented above. */
export function cursorFor(situation: CursorSituation): CursorKind {
  if (situation.dragging === true && situation.dropAllowed === false) {
    return 'forbidden';
  }

  if (situation.dragging === true) {
    return 'dragging';
  }

  if (situation.zooming === true) {
    return 'zoom';
  }

  if (situation.panningViewport === true) {
    return 'pan';
  }

  if (situation.overDraggable === true) {
    return 'draggable';
  }

  return TOOL_CURSORS[situation.tool];
}

/** The CSS value for a situation, for callers that only want the string. */
export const cursorCssFor = (situation: CursorSituation): string =>
  CURSOR_CSS[cursorFor(situation)];
