/**
 * Pure camera math for touch/mouse gestures on the view-only `<Viewer>`.
 * A pose is an orbit around `target`: no inertia, so reduced-motion is the
 * default behaviour rather than a special case.
 */

export type Vec3 = [number, number, number]

export type OrbitPose = {
  target: Vec3
  /** Radians around the Y axis. */
  azimuth: number
  /** Radians from +Y (0 = straight down onto the model). */
  polar: number
  distance: number
}

export const MIN_POLAR = 0.05
export const MAX_POLAR = Math.PI / 2 - 0.02
export const MIN_DISTANCE = 1
export const MAX_DISTANCE = 400
const ORBIT_RAD_PER_PX = 0.006

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function poseFromPosition(position: Vec3, target: Vec3): OrbitPose {
  const dx = position[0] - target[0]
  const dy = position[1] - target[1]
  const dz = position[2] - target[2]
  const distance = Math.hypot(dx, dy, dz) || 1
  return {
    target,
    azimuth: Math.atan2(dx, dz),
    polar: clamp(Math.acos(clamp(dy / distance, -1, 1)), MIN_POLAR, MAX_POLAR),
    distance: clamp(distance, MIN_DISTANCE, MAX_DISTANCE),
  }
}

export function positionFromPose(pose: OrbitPose): Vec3 {
  const s = Math.sin(pose.polar) * pose.distance
  return [
    pose.target[0] + s * Math.sin(pose.azimuth),
    pose.target[1] + Math.cos(pose.polar) * pose.distance,
    pose.target[2] + s * Math.cos(pose.azimuth),
  ]
}

/** One finger / left mouse button drag, in screen pixels. */
export function orbitPose(pose: OrbitPose, dxPx: number, dyPx: number): OrbitPose {
  return {
    ...pose,
    azimuth: pose.azimuth - dxPx * ORBIT_RAD_PER_PX,
    polar: clamp(pose.polar - dyPx * ORBIT_RAD_PER_PX, MIN_POLAR, MAX_POLAR),
  }
}

/** `scale` > 1 = fingers moved apart / wheel up = closer. */
export function zoomPose(pose: OrbitPose, scale: number): OrbitPose {
  if (!(scale > 0)) return pose
  return { ...pose, distance: clamp(pose.distance / scale, MIN_DISTANCE, MAX_DISTANCE) }
}

/**
 * Two-finger drag: slide the target on the ground plane, relative to the
 * current heading. `viewportHeightPx` and `fovDeg` convert pixels to metres at
 * the target's distance.
 */
export function panPose(
  pose: OrbitPose,
  dxPx: number,
  dyPx: number,
  viewportHeightPx: number,
  fovDeg: number,
): OrbitPose {
  if (viewportHeightPx <= 0) return pose
  const worldPerPx = (2 * pose.distance * Math.tan((fovDeg * Math.PI) / 360)) / viewportHeightPx
  const rightX = Math.cos(pose.azimuth)
  const rightZ = -Math.sin(pose.azimuth)
  const fwdX = -Math.sin(pose.azimuth)
  const fwdZ = -Math.cos(pose.azimuth)
  const r = -dxPx * worldPerPx
  const f = dyPx * worldPerPx
  return {
    ...pose,
    target: [
      pose.target[0] + rightX * r + fwdX * f,
      pose.target[1],
      pose.target[2] + rightZ * r + fwdZ * f,
    ],
  }
}

type Pt = { x: number; y: number }

/** Previous → next pair of pointers: pinch scale and midpoint shift. */
export function pinchDelta(prev: [Pt, Pt], next: [Pt, Pt]) {
  const d0 = Math.hypot(prev[0].x - prev[1].x, prev[0].y - prev[1].y)
  const d1 = Math.hypot(next[0].x - next[1].x, next[0].y - next[1].y)
  return {
    scale: d0 > 0 && d1 > 0 ? d1 / d0 : 1,
    dx: (next[0].x + next[1].x - prev[0].x - prev[1].x) / 2,
    dy: (next[0].y + next[1].y - prev[0].y - prev[1].y) / 2,
  }
}
