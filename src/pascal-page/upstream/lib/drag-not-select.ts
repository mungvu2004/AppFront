/**
 * AppFront addition (UX-R3 U16), not an upstream file. Pascal synthesizes a node `click` on every
 * left pointer-up over a mesh (`use-node-events.ts`) and only skips it while `cameraDragging` is
 * set — which the camera controls clear before the release reaches the mesh. So orbiting with a
 * left drag that started on a wall selected that wall and opened its panel.
 * Here: a left press that travelled more than `CLICK_SLOP_PX` before release is a drag, so we set
 * `inputDragging` (which Pascal reads to drop selection events) for that one release only.
 */
/** Further than this between press and release = drag (orbit), not a click. */
export const CLICK_SLOP_PX = 5

type Point = { readonly x: number; readonly y: number }

export function isDrag(start: Point | null, end: Point): boolean {
  return start !== null && Math.hypot(end.x - start.x, end.y - start.y) > CLICK_SLOP_PX
}

/** Pascal's `useViewer` `inputDragging`, passed in so this file stays free of vendor imports. */
export type Flag = { get: () => boolean; set: (value: boolean) => void }

/** Listens on `target` (window) in the capture phase, before R3F sees the release. */
export function installDragNotSelect(target: Window, flag: Flag): () => void {
  let start: Point | null = null
  const onDown = (e: PointerEvent) => {
    start = e.button === 0 ? { x: e.clientX, y: e.clientY } : null
  }
  const onUp = (e: PointerEvent) => {
    const dragged = e.button === 0 && isDrag(start, { x: e.clientX, y: e.clientY })
    start = null
    if (!dragged || flag.get()) return
    flag.set(true)
    // R3F handles the release synchronously during this dispatch; clear right after it, even if a
    // listener stops propagation (a bubble-phase reset could then never run).
    target.setTimeout(() => flag.set(false), 0)
  }
  target.addEventListener('pointerdown', onDown, true)
  target.addEventListener('pointerup', onUp, true)
  return () => {
    target.removeEventListener('pointerdown', onDown, true)
    target.removeEventListener('pointerup', onUp, true)
  }
}
