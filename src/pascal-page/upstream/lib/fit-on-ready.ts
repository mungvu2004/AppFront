/**
 * AppFront addition (QA-2 L2), not an upstream file. The editor canvas and the Preview canvas
 * each mount their own camera controls; a fresh instance starts at a fixed pose (20,20,20 in the
 * editor, the Viewer default in Preview) and upstream's `fit-scene` handler ignores Preview.
 * A fixed timer fired before the controls existed on a cold first open, so the fit was lost.
 * Here we wait for the controls to publish their first pose, then fit with `apply-pose`
 * (honoured in Preview too). The pose follows upstream `handleFitScene` (45° azimuth), but
 * higher (≈40° elevation instead of ≈30°) with a narrower 40° lens (upstream 50°), pulled back
 * by tan(25°)/tan(20°) ≈ 1.28 so the plan still fits (FE3D-FIX-002 Q2).
 */
import type { CameraPose } from '@pascal-app/core'

type Bounds = { center: [number, number]; size: [number, number] }

const FIT_FOV = 40

export function fitPose(bounds: Bounds | null, projection: CameraPose['projection']): CameraPose {
  if (!bounds) return { position: [20, 20, 20], target: [0, 0, 0], projection }
  const [cx, cz] = bounds.center
  const maxExtent = Math.max(bounds.size[0], bounds.size[1])
  const distance = Math.max(maxExtent * 1.8, 19)
  const height = Math.max(maxExtent * 1.5, 16)
  return {
    position: [cx + distance * 0.7, height, cz + distance * 0.7],
    target: [cx, 0, cz],
    projection,
    fov: FIT_FOV,
  }
}

/**
 * Run `fit` once the next camera-controls instance has published a pose (it fires right away
 * if one is already mounted), two frames later so its own mount-time `setLookAt` has run.
 * ponytail: gives up after `timeoutMs`; the "Xem toàn bộ" button is the manual fallback.
 */
export function fitWhenControlsReady(
  subscribe: (listener: () => void) => () => void,
  fit: () => void,
  timeoutMs = 10_000,
): () => void {
  let done = false
  let raf = 0
  let unsubscribe: (() => void) | null = null
  const stop = () => {
    done = true
    unsubscribe?.()
    unsubscribe = null
  }
  const timer = setTimeout(stop, timeoutMs)
  unsubscribe = subscribe(() => {
    if (done) return
    stop()
    clearTimeout(timer)
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(fit)
    })
  })
  if (done) unsubscribe?.()
  return () => {
    stop()
    clearTimeout(timer)
    cancelAnimationFrame(raf)
  }
}
