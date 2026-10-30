'use client'
/**
 * AppFront addition (P55), not an upstream file. Wraps three editor pieces that live only in
 * `vendor/pascal` (which this repo must not edit):
 * - G5-10 / G5-08: the upstream camera hint ("Camera controls hint") and the contextual shortcut
 *   panel are hidden by scoped CSS; this renders one Vietnamese, collapsible "Điều khiển" pill
 *   instead (collapsed by default) that names the mouse buttons and, when open, shows the shortcut
 *   panel again.
 * - G5-16: the level card's add-above/below dots sit outside the card edge, are larger, and the
 *   storey-height badge gets readable contrast.
 * - G5-09: keeps the selected object's action bars (Move/Duplicate/Delete…) inside the window.
 * - G5-11 / G5-12 / G5-44: the bottom action bar stays inside the viewer pane and loses its
 *   unlabelled camera group; measurement distance labels get a solid, readable chip.
 * - G5-14: while the Delete tool (X) is armed, a banner says so. It sits in the same column as
 *   the pill (above it), so the two never overlap (RV3 #9).
 * - N5-11: while measuring, a "Xoá vạch đo" button removes every measurement (Ctrl+Z undoes).
 * The selectors target upstream title/aria-label/class strings; if Pascal renames them the CSS
 * simply stops matching (no breakage).
 */

import { type AnyNodeId, useScene } from '@pascal-app/core'
import { useEditor } from '@pascal-app/editor'
import { ChevronDown, ChevronUp, CircleHelp, Mouse } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useScaleUnresolved } from '../../scaleUnresolved'
import { requestTour } from '../../tour/tourLogic'
import { clampShift, clearOfShift, unionBox } from '../lib/clamp-shift'

const OPEN_KEY = 'appfront-3d-help-open:v1'

// The upstream shortcut panel: `pointer-events-none fixed top-1/2 right-4 … max-w-[260px]`.
const SHORTCUT_PANEL = '.fixed.top-1\\/2.right-4.max-w-\\[260px\\]'

// G5-11 / G5-12: the upstream bottom action bar (`action-menu/index.tsx`, desktop branch). Its
// camera group (Orbit Left/Right, Top View) is hidden; `CameraButtons` in the top-right toolbar
// replaces it with Vietnamese labels. Anchored on the icon file, which translation never touches.
const BOTTOM_BAR = 'div.fixed.bottom-6.rounded-2xl.backdrop-blur-md'
const VENDOR_CAMERA_BUTTON = '> button img[src*="/topview."], > button img[src*="/rotate."]'
// G5-44: the distance label of a measurement (`nodes/src/measurement/renderer.tsx`, drei <Html>).
const MEASURE_LABEL = 'div.whitespace-nowrap.font-medium.text-base.text-white'

const SCOPED_CSS = `
.appfront-help-btn {
  display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px;
  font-size: 13px; font-weight: 500; color: var(--pa-text-2); cursor: pointer;
  background: var(--pa-surface); border: 1px solid var(--pa-border); border-radius: var(--pa-radius-lg, 12px);
  box-shadow: var(--pa-shadow-float); transition: background 120ms var(--pa-ease), color 120ms var(--pa-ease);
}
.appfront-help-btn:hover { background: var(--pa-sunken); color: var(--pa-text); }
.appfront-help-btn:active { background: var(--pa-selected); }
.appfront-help-btn:focus-visible { outline: 2px solid transparent; outline-offset: 2px; box-shadow: var(--pa-focus), var(--pa-shadow-float); }
.appfront-help-panel {
  padding: 12px 16px; font-size: 13px; color: var(--pa-text);
  background: var(--pa-surface); border: 1px solid var(--pa-border); border-radius: var(--pa-radius-lg, 12px);
  box-shadow: var(--pa-shadow-float);
}
.appfront-help-how { color: var(--pa-text-2); }
.appfront-help-kbd {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; padding: 1px 6px;
  border: 1px solid var(--pa-border); background: var(--pa-sunken); color: var(--pa-text-2); border-radius: 4px;
}
@media (prefers-reduced-motion: reduce) { .appfront-help-btn { transition: none; } }
section[aria-label="Camera controls hint"], section[aria-label="Gợi ý điều khiển camera"] { display: none !important; }
[data-appfront-help="closed"] ${SHORTCUT_PANEL} { display: none !important; }
button[title="Thêm tầng phía trên"], button[title="Thêm tầng phía dưới"] {
  width: 1.5rem !important; height: 1.5rem !important; /* ≥ 24px vùng bấm (WCAG 2.5.8) */
  color: var(--foreground) !important;
}
/* "+" buttons stay 8px clear of the level card: "above" sits right of the card (above it is the top
 * bar), "below" 8px under it. */
button[title="Thêm tầng phía trên"] {
  top: 50% !important; left: 100% !important; bottom: auto !important; right: auto !important;
  translate: 8px -50% !important;
}
button[title="Thêm tầng phía dưới"] {
  translate: -50% calc(100% + 8px) !important;
}
button[title="Chiều cao tầng"] {
  color: var(--foreground) !important; opacity: 0.85; font-size: 11px !important;
}
${BOTTOM_BAR} { max-width: calc(100% - 24px); overflow-x: auto; scrollbar-width: thin; }
@media (max-width: 899px) { ${BOTTOM_BAR} { zoom: 0.9; } }
${BOTTOM_BAR} div.flex.items-center.gap-1:has(${VENDOR_CAMERA_BUTTON}),
${BOTTOM_BAR} div.w-px:has(+ div.flex.items-center.gap-1 > button img[src*="/topview."]),
${BOTTOM_BAR} div.w-px:has(+ div.flex.items-center.gap-1 > button img[src*="/rotate."]) {
  display: none !important;
}
${MEASURE_LABEL} {
  background: color-mix(in oklab, var(--background) 88%, transparent);
  color: var(--foreground) !important; border: 1px solid var(--border);
  border-radius: 6px; padding: 2px 8px; font-size: 14px !important; font-weight: 700 !important;
  text-shadow: none !important; box-shadow: 0 2px 8px color-mix(in oklab, var(--foreground) 35%, transparent);
}
`

// Action bars rendered by drei <Html> next to the selected object (node + quick-action menus).
const ACTION_BARS = [
  'div.pointer-events-auto.flex.items-center.gap-1.rounded-lg.border.p-1.shadow-xl',
  'div.pointer-events-auto.mt-1.inline-flex.w-max.rounded-lg.border.shadow-md',
].join(',')

function useClampActionBars() {
  useEffect(() => {
    let frame = 0
    const tick = () => {
      for (const el of document.querySelectorAll<HTMLElement>(ACTION_BARS)) {
        const prevX = Number(el.dataset.clampX ?? 0)
        const prevY = Number(el.dataset.clampY ?? 0)
        const r = el.getBoundingClientRect()
        // ancestors scale the bar with distance; convert screen px to the element's own px
        const scale = el.offsetWidth ? r.width / el.offsetWidth : 1
        const base = {
          left: r.left - prevX * scale,
          right: r.right - prevX * scale,
          top: r.top - prevY * scale,
          bottom: r.bottom - prevY * scale,
        }
        const { dx, dy } = clampShift(base, window.innerWidth, window.innerHeight)
        const x = Math.round(dx / scale)
        const y = Math.round(dy / scale)
        if (x !== prevX || y !== prevY) {
          el.dataset.clampX = String(x)
          el.dataset.clampY = String(y)
          el.style.translate = x || y ? `${x}px ${y}px` : ''
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])
}

function readOpen(): boolean {
  try {
    return window.localStorage.getItem(OPEN_KEY) === '1'
  } catch {
    return false
  }
}

function writeOpen(open: boolean) {
  try {
    window.localStorage.setItem(OPEN_KEY, open ? '1' : '0')
  } catch {}
}

/** Chữ "Space" hiện bằng chip kbd. */
function renderKeys(text: string) {
  return text.split(/(Space)/).map((part, i) =>
    part === 'Space' ? (
      <kbd className="appfront-help-kbd" key={`${part}-${i}`}>
        Space
      </kbd>
    ) : (
      part
    ),
  )
}

const EDITOR_HINTS:Array<[string, string]> = [
  // UX41 U20: chuột trái cũng xoay (scripts/realism/u20-left-orbit.mjs); quét chọn cần Shift.
  ['Xoay', 'Kéo chuột trái hoặc chuột phải'],
  ['Kéo khung', 'Space + chuột trái, hoặc chuột giữa'],
  ['Phóng to/thu nhỏ', 'Lăn chuột'],
  ['Chọn', 'Bấm chuột trái vào đối tượng'],
  ['Chọn nhiều', 'Shift + kéo chuột trái'],
]
const PREVIEW_HINTS: Array<[string, string]> = [
  ['Xoay', 'Giữ chuột phải và kéo'],
  ['Kéo khung', 'Chuột trái'],
  ['Phóng to/thu nhỏ', 'Lăn chuột'],
]

/** Floating floor card (vendor `floating-level-selector`) the centred pill must not cover on narrow canvases. */
const FLOOR_CARD = '.absolute.top-14.left-3.z-20'
/** Its "+" add-level dots sit outside the card edge (G5-16 CSS above), so the card's own rect misses them. */
const ADD_LEVEL = 'button[title="Thêm tầng phía trên"], button[title="Thêm tầng phía dưới"]'

/** Floor card rect grown to cover its "+" dots (768 px: the scale banner covered the right-hand "+"). */
function floorCardBox() {
  const card = document.querySelector<HTMLElement>(FLOOR_CARD)
  if (!card) return undefined
  const dots = [...card.querySelectorAll<HTMLElement>(ADD_LEVEL)].map((dot) => dot.getBoundingClientRect())
  return unionBox(card.getBoundingClientRect(), dots.filter((r) => r.width))
}

/** pascal-polish: nudge the pill right (or below) while it would overlap the floor card (same rAF pattern as above). */
function useClearOfFloorCard(ref: { current: HTMLElement | null }) {
  useEffect(() => {
    let frame = 0
    const tick = () => {
      const el = ref.current
      const card = floorCardBox()
      if (el) {
        const prevX = Number(el.dataset.clearX ?? 0)
        const prevY = Number(el.dataset.clearY ?? 0)
        const r = el.getBoundingClientRect()
        const base = { left: r.left - prevX, right: r.right - prevX, top: r.top - prevY, bottom: r.bottom - prevY }
        const { dx, dy } = card && card.right > card.left ? clearOfShift(base, card, window.innerWidth) : { dx: 0, dy: 0 }
        const [x, y] = [Math.round(dx), Math.round(dy)]
        if (x !== prevX || y !== prevY) {
          el.dataset.clearX = String(x)
          el.dataset.clearY = String(y)
          el.style.translate = x || y ? `${x}px ${y}px` : ''
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [ref])
}

/**
 * `banner` (the scale warning) heads the same centred column, so it never sits under the help pills;
 * while it shows, the pills fold to icons (names stay as aria-label + title).
 */
export function CanvasHelp({ banner }: { banner?: ReactNode }) {
  const compact = useScaleUnresolved()
  const [userOpen, setOpen] = useState(false)
  const [tourOn, setTourOn] = useState(false)
  const open = userOpen && !tourOn // tour đang hiện thì gập, tránh chồng lấn
  const isPreview = useEditor((state) => state.isPreviewMode)
  const isDelete = useEditor((state) => state.mode === 'delete')
  useClampActionBars()
  const pillRef = useRef<HTMLDivElement>(null)
  useClearOfFloorCard(pillRef)

  useEffect(() => setOpen(readOpen()), [])
  useEffect(() => {
    const sync = () => setTourOn(document.documentElement.dataset.pascalTour === 'open')
    sync()
    window.addEventListener('pascal-tour:state', sync)
    return () => window.removeEventListener('pascal-tour:state', sync)
  }, [])
  useEffect(() => {
    document.documentElement.dataset.appfrontHelp = open ? 'open' : 'closed'
  }, [open])

  const toggle = () => {
    setOpen((prev) => {
      writeOpen(!prev)
      return !prev
    })
  }
  const hints = isPreview ? PREVIEW_HINTS : EDITOR_HINTS
  const toggleLabel = open ? 'Ẩn hướng dẫn điều khiển' : 'Điều khiển chuột và phím tắt'

  return (
    <>
      <style>{SCOPED_CSS}</style>
      <div className="appfront-canvas-help pointer-events-none absolute top-14 left-1/2 z-40 -translate-x-1/2">
        <div className="pointer-events-auto flex flex-col items-center gap-1.5" ref={pillRef}>
          {banner}
          {isDelete ? (
            <div
              className="pointer-events-none rounded-full bg-destructive px-4 py-1.5 font-medium text-background text-sm shadow-lg"
              role="status"
            >
              Đang ở chế độ xoá: bấm vào đối tượng sẽ xoá nó · Esc để thoát
            </div>
          ) : null}
          <div className="flex items-center gap-1.5">
            <button
              aria-expanded={open}
              aria-label={toggleLabel}
              className="appfront-help-btn"
              onClick={toggle}
              title={compact ? toggleLabel : undefined}
              type="button"
            >
              <Mouse aria-hidden="true" className="h-4 w-4" />
              {compact ? null : toggleLabel}
              {open ? (
                <ChevronUp aria-hidden="true" className="h-4 w-4" />
              ) : (
                <ChevronDown aria-hidden="true" className="h-4 w-4" />
              )}
            </button>
            <button
              aria-label="Xem lại hướng dẫn thao tác"
              className="appfront-help-btn"
              onClick={requestTour}
              title={compact ? 'Xem lại hướng dẫn thao tác' : undefined}
              type="button"
            >
              <CircleHelp aria-hidden="true" className="h-4 w-4" />
              {compact ? null : 'Hướng dẫn'}
            </button>
          </div>
          {open ? (
            <section aria-label="Hướng dẫn điều khiển camera" className="appfront-help-panel">
              <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5">
              {hints.map(([action, how]) => (
                <div className="contents" key={action}>
                  <dt className="font-medium">{action}</dt>
                  <dd className="appfront-help-how m-0">{renderKeys(how)}</dd>
                </div>
              ))}
              </dl>
            </section>
          ) : null}
        </div>
      </div>
    </>
  )
}

/** N5-11: clear all measurement lines while the Measure tool is armed (undo with Ctrl+Z). */
export function MeasureClearButton() {
  const measuring = useEditor((state) => state.mode === 'build' && state.tool === 'measurement')
  const count = useScene(
    (state) => Object.values(state.nodes).filter((node) => node?.type === 'measurement').length,
  )
  if (!measuring || count === 0) return null
  const clear = () => {
    const { nodes, deleteNodes } = useScene.getState()
    const ids = Object.values(nodes)
      .filter((node) => node?.type === 'measurement')
      .map((node) => node.id as AnyNodeId)
    deleteNodes(ids)
  }
  return (
    <div className="pointer-events-auto absolute bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border/50 bg-background/90 py-1 pr-1 pl-3 text-foreground text-xs shadow-md backdrop-blur-md">
      <span>
        {count} vạch đo · Esc để thoát thước · Ctrl+Z để hoàn tác
      </span>
      <button
        className="min-h-7 rounded-full px-2.5 py-1 font-medium transition-colors hover:bg-accent"
        onClick={clear}
        type="button"
      >
        Xoá vạch đo
      </button>
    </div>
  )
}
