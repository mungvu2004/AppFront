/**
 * AppFront addition (QA-2 L2), not an upstream file. The editor canvas and the Preview canvas
 * each mount their own camera controls; a fresh instance starts at a fixed pose (20,20,20 in the
 * editor, the Viewer default in Preview) and upstream's `fit-scene` handler ignores Preview.
 * A fixed timer fired before the controls existed on a cold first open, so the fit was lost.
 * Here we wait for the controls to publish their first pose, then fit with `apply-pose`
 * (honoured in Preview too). The pose is ≈40° elevation with a 40° lens (upstream 50°) (FE3D-FIX-002
 * Q2), at the distance that makes the plan fill ~80% of the canvas (V5 D13).
 * FE3D-FIX-004 V14: bounds come from walls + zones only (`planBoundsXZ`), the frame is the real
 * canvas rect (not the window, which counts the sidebar), and the azimuth turns the long side of
 * the plan across the screen.
 */
import type { CameraPose } from '@pascal-app/core'

type Bounds = { center: [number, number]; size: [number, number] }
type Viewport = { width: number; height: number }

const FIT_FOV = 40
const ELEVATION = (40 * Math.PI) / 180
/** Share of the free viewport the plan fills (FE3D-FIX-002 V5 D13: plans sat small in dead space). */
const FILL = 0.8
/** Top toolbar plus the one-line scale banner under it, overlaying the canvas (px; UX-R2 K38). */
export const TOP_RESERVED_PX = 120
/** Walls stand above the XZ bounds; frame their tops too. ponytail: fixed 3 m, not per level. */
const WALL_TOP = 3
const MIN_DISTANCE = 6
/** Long plans: look ~25° off the short axis so the long side runs across the screen. */
const LONG_PLAN_RATIO = 1.3
const OFF_SHORT_AXIS = (25 * Math.PI) / 180

/**
 * XZ bounds of the house itself: wall endpoints and zone polygons, both in level coordinates.
 * Vendor `computeSceneBoundsXZ` also adds raw node positions (doors/windows are wall-local,
 * building/stair sit at the origin) and the site polygon, so the origin was always inside the box
 * and long houses came out tiny. ponytail: ignores building/level offsets (AppFront keeps them 0).
 * With `levelId` (UX-R2 K38): only that floor's walls and zones (their `parentId` is the level).
 */
export function planBoundsXZ(nodes: Record<string, unknown> | unknown[], levelId?: string): Bounds | null {
  let minX = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxZ = -Infinity
  const add = (p: unknown) => {
    if (!Array.isArray(p) || typeof p[0] !== 'number' || typeof p[1] !== 'number') return
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) return
    minX = Math.min(minX, p[0])
    maxX = Math.max(maxX, p[0])
    minZ = Math.min(minZ, p[1])
    maxZ = Math.max(maxZ, p[1])
  }
  for (const node of Object.values(nodes) as { type?: unknown; parentId?: unknown; start?: unknown; end?: unknown; polygon?: unknown }[]) {
    if (levelId !== undefined && node?.parentId !== levelId) continue
    if (node?.type === 'wall') {
      add(node.start)
      add(node.end)
    } else if (node?.type === 'zone' && Array.isArray(node.polygon)) {
      for (const p of node.polygon) add(p)
    }
  }
  if (minX > maxX) return null
  return { center: [(minX + maxX) / 2, (minZ + maxZ) / 2], size: [maxX - minX, maxZ - minZ] }
}

export type RoomEntry = { id: string; name: string; areaM2: number }

/**
 * UX-R4 U40: rooms (zones) for the "Đi tới phòng" list — name + floor area (m², shoelace),
 * sorted by name. With `levelId`: only that floor's zones. Unnamed zones read "Phòng".
 */
export function roomsOf(nodes: Record<string, unknown>, levelId?: string | null): RoomEntry[] {
  const rooms: RoomEntry[] = []
  for (const [id, node] of Object.entries(nodes) as [string, { type?: unknown; parentId?: unknown; name?: unknown; polygon?: unknown }][]) {
    if (node?.type !== 'zone' || !Array.isArray(node.polygon)) continue
    if (levelId && node.parentId !== levelId) continue
    const pts = (node.polygon as unknown[]).filter(
      (p): p is [number, number] => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]),
    )
    let twice = 0
    pts.forEach(([x, z], i) => {
      const [nx, nz] = pts[(i + 1) % pts.length]!
      twice += x * nz - nx * z
    })
    const name = typeof node.name === 'string' && node.name.trim() !== '' ? node.name.trim() : 'Phòng'
    rooms.push({ id, name, areaM2: Math.abs(twice) / 2 })
  }
  return rooms.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
}

/** Largest canvas on the page (the 3D view; thumbnails/previews are smaller), else the window. */
const viewportOf = (): Viewport => {
  if (typeof document === 'undefined') return { width: 1920, height: 1080 }
  let best: Viewport | null = null
  for (const canvas of document.querySelectorAll('canvas')) {
    const { width, height } = canvas.getBoundingClientRect()
    if (width > 0 && height > 0 && (!best || width * height > best.width * best.height)) best = { width, height }
  }
  return best ?? { width: window.innerWidth || 1920, height: window.innerHeight || 1080 }
}

/** Azimuth (from +Z towards +X): 45° for squarish plans; long plans look ~25° off the short axis. */
export function fitAzimuth([sx, sz]: [number, number]): number {
  if (sx >= sz * LONG_PLAN_RATIO) return OFF_SHORT_AXIS
  if (sz >= sx * LONG_PLAN_RATIO) return Math.PI / 2 - OFF_SHORT_AXIS
  return Math.PI / 4
}

/**
 * Azimuth from `fitAzimuth`, 40° elevation, 40° lens. The distance is the smallest one at which every
 * corner of the plan box (floor to wall tops) projects inside FILL of the canvas below the toolbar —
 * exact per-corner perspective test, so long or square plans fill the frame alike. `baseY` lifts the
 * frame to a floor that stands above ground (solo mode keeps its stacked height, UX-R2 K38).
 */
export function fitPose(
  bounds: Bounds | null,
  projection: CameraPose['projection'],
  viewport: Viewport = viewportOf(),
  baseY = 0,
): CameraPose {
  if (!bounds) return { position: [20, 20, 20], target: [0, 0, 0], projection }
  const [cx, cz] = bounds.center
  const [sx, sz] = bounds.size
  const cos = Math.cos(ELEVATION)
  const sin = Math.sin(ELEVATION)
  const azimuth = fitAzimuth([sx, sz])
  const sa = Math.sin(azimuth)
  const ca = Math.cos(azimuth)
  // Camera basis: back (target -> camera), right, up.
  const back = [cos * sa, sin, cos * ca] as const
  const right = [ca, 0, -sa] as const
  const up = [-sin * sa, cos, -sin * ca] as const
  const tanV = Math.tan((FIT_FOV * Math.PI) / 360)
  const tanH = tanV * (viewport.width / viewport.height)
  // The toolbar + banner cover the top TOP_RESERVED_PX of the upper half-frame; the target stays at the canvas centre.
  const tanUp = tanV * Math.max(0.5, 1 - (2 * TOP_RESERVED_PX) / viewport.height)
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
    position: [cx + distance * back[0], baseY + distance * back[1], cz + distance * back[2]],
    target: [cx, baseY, cz],
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
