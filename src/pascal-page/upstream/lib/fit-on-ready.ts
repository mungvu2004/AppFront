/**
 * AppFront addition (QA-2 L2), not an upstream file. The editor canvas and the Preview canvas
 * each mount their own camera controls; a fresh instance starts at a fixed pose (20,20,20 in the
 * editor, the Viewer default in Preview) and upstream's `fit-scene` handler ignores Preview.
 * A fixed timer fired before the controls existed on a cold first open, so the fit was lost.
 * Here we wait for the controls to publish their first pose, then fit with `apply-pose`
 * (honoured in Preview too). The pose follows upstream `handleFitScene` (45° azimuth), but
 * higher (≈40° elevation instead of ≈30°) with a narrower 40° lens (upstream 50°) (FE3D-FIX-002
 * Q2), at the distance that makes the plan fill ~80% of the free viewport (V5 D13).
 */
import type { CameraPose } from '@pascal-app/core'

type Bounds = { center: [number, number]; size: [number, number] }
type Viewport = { width: number; height: number }

const FIT_FOV = 40
const ELEVATION = (40 * Math.PI) / 180
/** Share of the free viewport the plan fills (FE3D-FIX-002 V5 D13: plans sat small in dead space). */
const FILL = 0.8
/** Top toolbar overlaying the canvas (px). */
const TOOLBAR_PX = 70
/** Walls stand above the XZ bounds; frame their tops too. ponytail: fixed 3 m, not per level. */
const WALL_TOP = 3
const MIN_DISTANCE = 6

const viewportOf = (): Viewport =>
  typeof window === 'undefined'
    ? { width: 1920, height: 1080 }
    : { width: window.innerWidth || 1920, height: window.innerHeight || 1080 }

/**
 * 45° azimuth, 40° elevation, 40° lens. The distance is the smallest one at which every corner of
 * the plan box (floor to wall tops) projects inside FILL of the viewport below the toolbar — exact
 * per-corner perspective test, so long or square plans fill the frame alike.
 */
export function fitPose(
  bounds: Bounds | null,
  projection: CameraPose['projection'],
  viewport: Viewport = viewportOf(),
): CameraPose {
  if (!bounds) return { position: [20, 20, 20], target: [0, 0, 0], projection }
  const [cx, cz] = bounds.center
  const [sx, sz] = bounds.size
  const cos = Math.cos(ELEVATION)
  const sin = Math.sin(ELEVATION)
  // Camera basis: back (target -> camera), right, up.
  const back = [cos * Math.SQRT1_2, sin, cos * Math.SQRT1_2] as const
  const right = [Math.SQRT1_2, 0, -Math.SQRT1_2] as const
  const up = [-sin * Math.SQRT1_2, cos, -sin * Math.SQRT1_2] as const
  const tanV = Math.tan((FIT_FOV * Math.PI) / 360)
  const tanH = tanV * (viewport.width / viewport.height)
  // The toolbar covers the top TOOLBAR_PX of the upper half-frame; the target stays at the canvas centre.
  const tanUp = tanV * Math.max(0.5, 1 - (2 * TOOLBAR_PX) / viewport.height)
  const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!
  let distance = MIN_DISTANCE
  for (const x of [-sx / 2, sx / 2])
    for (const y of [0, WALL_TOP])
      for (const z of [-sz / 2, sz / 2]) {
        const corner = [x, y, z]
        const depthGain = dot(corner, back)
        const r = Math.abs(dot(corner, right))
        const u = dot(corner, up)
        distance = Math.max(
          distance,
          r / (FILL * tanH) + depthGain,
          Math.abs(u) / (FILL * (u > 0 ? tanUp : tanV)) + depthGain,
        )
      }
  return {
    position: [cx + distance * back[0], distance * back[1], cz + distance * back[2]],
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
