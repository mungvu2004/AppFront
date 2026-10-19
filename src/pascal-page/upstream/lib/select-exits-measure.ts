/**
 * AppFront edit (R3f, N5-11): while the Measure tool is armed, the bottom-bar Select button
 * (arrow) or the V key returns to Select and drops any half-drawn measurement. Wraps the
 * vendor toolbar from outside (DECISIONS A: no vendor byte changed) with capture-phase
 * listeners. The button is found by stable, untranslated hooks: the vendor's
 * `data-guide-target="mode-select"` or its image file `/select.<ext>` (never the label/alt,
 * which pascal-vi translates). If Pascal renames both, the guard just stops matching.
 */

type ToolState = { mode: string; tool: string | null }
type KeyLike = { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }

export function isMeasureActive(s: ToolState): boolean {
  return s.mode === 'build' && (s.tool === 'measurement' || s.tool === 'construction-dimension')
}

/** Same chord as the vendor's own V shortcut (use-keyboard.ts): plain `v`, no Ctrl/Cmd/Alt. */
export function isSelectKey(e: KeyLike): boolean {
  return e.key.toLowerCase() === 'v' && !e.ctrlKey && !e.metaKey && !e.altKey
}

/** `/icons/select.webp` yes; `/icons/box-select.webp` or a label text no. */
export function isSelectControl(guide: string | null, imgSrc: string | null): boolean {
  return guide === 'mode-select' || (imgSrc !== null && /\/select\.[a-z]+(?:[?#]|$)/i.test(imgSrc))
}

