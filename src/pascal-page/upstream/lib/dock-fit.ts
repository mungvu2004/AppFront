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
