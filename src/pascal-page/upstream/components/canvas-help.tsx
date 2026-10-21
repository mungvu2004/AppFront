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
import { ChevronDown, ChevronUp, Mouse } from 'lucide-react'
import { useEffect, useState } from 'react'
import { clampShift } from '../lib/clamp-shift'

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
section[aria-label="Camera controls hint"] { display: none !important; }
[data-appfront-help="closed"] ${SHORTCUT_PANEL} { display: none !important; }
button[title="Thêm tầng phía trên"], button[title="Thêm tầng phía dưới"] {
  width: 1.25rem !important; height: 1.25rem !important;
  color: var(--foreground) !important;
}
button[title="Thêm tầng phía trên"] {
  translate: -50% -50% !important;
}
button[title="Thêm tầng phía dưới"] {
  translate: -50% calc(100% + 2px) !important;
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

const EDITOR_HINTS: Array<[string, string]> = [
  ['Xoay', 'Giữ chuột phải và kéo'],
  ['Kéo khung', 'Space + chuột trái, hoặc chuột giữa'],
  ['Phóng to/thu nhỏ', 'Lăn chuột'],
  ['Chọn', 'Bấm chuột trái vào đối tượng'],
]
const PREVIEW_HINTS: Array<[string, string]> = [
  ['Xoay', 'Giữ chuột phải và kéo'],
  ['Kéo khung', 'Chuột trái'],
  ['Phóng to/thu nhỏ', 'Lăn chuột'],
]

export function CanvasHelp() {
  const [open, setOpen] = useState(false)
  const isPreview = useEditor((state) => state.isPreviewMode)
  const isDelete = useEditor((state) => state.mode === 'delete')
  useClampActionBars()

  useEffect(() => setOpen(readOpen()), [])
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

  return (
    <>
      <style>{SCOPED_CSS}</style>
      <div className="appfront-canvas-help pointer-events-none absolute top-14 left-1/2 z-40 -translate-x-1/2">
        <div className="pointer-events-auto flex flex-col items-center gap-1.5">
          {isDelete ? (
            <div
              className="pointer-events-none rounded-full bg-destructive px-4 py-1.5 font-medium text-background text-sm shadow-lg"
              role="status"
            >
              Đang ở chế độ xoá: bấm vào đối tượng sẽ xoá nó · Esc để thoát
            </div>
          ) : null}
          <button
            aria-expanded={open}
            className="flex items-center gap-1.5 rounded-full border border-border/50 bg-background/90 px-3 py-1 font-medium text-foreground text-xs shadow-md backdrop-blur-md transition-colors hover:bg-accent"
            onClick={toggle}
            type="button"
          >
            <Mouse aria-hidden="true" className="h-3.5 w-3.5" />
            {open ? 'Ẩn hướng dẫn điều khiển' : 'Điều khiển chuột và phím tắt'}
            {open ? (
              <ChevronUp aria-hidden="true" className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
            )}
          </button>
          {open ? (
            <section
              aria-label="Hướng dẫn điều khiển camera"
              className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 rounded-xl border border-border/50 bg-background/90 px-3.5 py-2.5 text-xs shadow-md backdrop-blur-md"
            >
              {hints.map(([action, how]) => (
                <div className="contents" key={action}>
                  <span className="font-medium text-foreground">{action}</span>
                  <span className="text-foreground/80">{how}</span>
                </div>
              ))}
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
        className="rounded-full px-2.5 py-1 font-medium transition-colors hover:bg-accent"
        onClick={clear}
        type="button"
      >
        Xoá vạch đo
      </button>
    </div>
  )
}
