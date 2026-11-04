/**
 * HIG-A: pure layout maths for the viewer chrome (viewer-toolbar.tsx measures, these decide).
 */

/** 0 = labels, 1 = icons only, 2 = icons + the camera/share buttons folded into "…". */
export type DockFit = 0 | 1 | 2

/**
 * `full` = labelled dock width, `icons` = icon-only width (0 = not measured yet), `room` = free px right of
 * the action menu. Unmeasured icons step to 1 first so the next poll can measure them.
 */
export function dockFit(full: number, icons: number, room: number): DockFit {
  if (full <= room) return 0
  return icons === 0 || icons <= room ? 1 : 2
}

/** Bottom row keeps this clear of each canvas edge: compass (12 + 32 px) + 8 px, mirrored so the row stays centred. */
export const DOCK_SIDE_PX = 52

export type DockWidths = {
  readonly canvas: number
  readonly tools: number
  /** Labelled / icon-only widths; 0 = not measured yet (or, for undo, read-only: no undo group). */
  readonly full: number
  readonly icons: number
  readonly undo: number
  readonly undoIcons: number
}

/**
 * The bottom row (undo + tools + dock) centres on the whole canvas, so the budget is the canvas width.
 * Steps: labels everywhere -> dock icons -> undo icons too -> dock folded into "…".
 */
export function dockLayout(w: DockWidths, gap: number): { fit: DockFit; undoCompact: boolean } {
  const room = w.canvas - DOCK_SIDE_PX * 2 - w.tools - gap
  const fit = dockFit(w.full, w.icons, room - (w.undo > 0 ? w.undo + gap : 0))
  if (fit < 2) return { fit, undoCompact: false }
  const roomWithUndoIcons = room - (w.undo > 0 ? (w.undoIcons || UNDO_ICONS_PX) + gap : 0)
  return { fit: w.icons <= roomWithUndoIcons ? 1 : 2, undoCompact: true }
}

/** Undo group as icons before it was ever measured that small. */
const UNDO_ICONS_PX = 66

/** `margin-left` that centres undo + tools + dock when the tools bar itself is centred on the canvas. */
export function toolsShift(undo: number, dock: number, gap: number): number {
  return Math.round(((undo > 0 ? undo + gap : 0) - (dock + gap)) / 2)
}

type Box = { readonly top: number; readonly bottom: number; readonly left: number }

/**
 * CSS variables for the floor card / canvas-help pill / first-use hint: the bar's bottom edge relative to the
 * viewer column top (the floor card's containing block), and the column's left edge in the viewport
 * (the pills are positioned in the full-window page root, so they centre at 50% + left / 2).
 */
export function barLayoutVars(bar: Box, column: Box): Record<'--appfront-bar-bottom' | '--appfront-viewer-left', string> {
  return {
    '--appfront-bar-bottom': `${Math.round(bar.bottom - column.top)}px`,
    '--appfront-viewer-left': `${Math.round(column.left)}px`,
  }
}

/** First-use hint (PascalTour) needs this much canvas; narrower (768 + sidebar ≈ 424 px) it hides, unseen. */
export const HINT_MIN_CANVAS_PX = 560

/** `viewerLeftVar` = computed `--appfront-viewer-left` ('' before the bar mounted = whole window). */
export function hintFits(windowWidth: number, viewerLeftVar: string): boolean {
  return windowWidth - (Number.parseFloat(viewerLeftVar) || 0) >= HINT_MIN_CANVAS_PX
}
