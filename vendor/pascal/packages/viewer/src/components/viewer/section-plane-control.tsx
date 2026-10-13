import { vi } from '../../i18n/vi'
import {
  SECTION_PLANE_MAX_M,
  SECTION_PLANE_MIN_M,
  SECTION_PLANE_STEP_M,
  useSectionPlane,
} from '../../systems/section-plane/section-plane'

/** Height in metres with a decimal comma (AppFront A15). */
export const formatSectionHeight = (height: number): string =>
  `${height.toFixed(1).replace('.', ',')} m`

/**
 * Drag handle of the section plane (#32). A native range input: dragging,
 * arrow keys and Page Up/Down all move the cut, and the value is announced
 * without extra ARIA. Not mounted at all while the cut is off.
 */
export function SectionPlaneControl() {
  const enabled = useSectionPlane((s) => s.enabled)
  const height = useSectionPlane((s) => s.height)
  const setHeight = useSectionPlane((s) => s.setHeight)
  const setEnabled = useSectionPlane((s) => s.setEnabled)
  if (!enabled) return null

  const labels = vi.sectionPlane
  const valueText = formatSectionHeight(height)
  return (
    <div className="pointer-events-auto absolute top-3 right-3 z-10 flex items-center gap-2 rounded-lg border border-border bg-background/90 px-3 py-2 text-xs shadow-sm">
      <label className="flex items-center gap-2">
        <span>{labels.label}</span>
        <input
          aria-valuetext={valueText}
          max={SECTION_PLANE_MAX_M}
          min={SECTION_PLANE_MIN_M}
          onChange={(e) => setHeight(Number(e.currentTarget.value))}
          step={SECTION_PLANE_STEP_M}
          type="range"
          value={height}
        />
      </label>
      <output className="w-14 tabular-nums">{valueText}</output>
      <button
        className="rounded px-2 py-1 hover:bg-accent"
        onClick={() => setEnabled(false)}
        type="button"
      >
        {labels.off}
      </button>
    </div>
  )
}
