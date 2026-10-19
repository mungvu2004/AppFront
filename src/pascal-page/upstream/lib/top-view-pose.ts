/**
 * AppFront addition (G5-48), not an upstream file. Upstream "Top View" only tilts the camera to
 * 0° around the current target, so an off-centre model stays half outside the frame. This builds
 * a `camera-controls:apply-pose` pose that looks straight down at the model's plan centre and
 * sizes the view so the whole footprint fits.
 */
import type { CameraPose } from '@pascal-app/core'

type Bounds = { center: [number, number]; size: [number, number] }

const MARGIN = 1.2
const MIN_VIEW_WIDTH = 10
// Upstream toggles back to 45° below this polar angle (`handleTopView`, ~5.7°).
const TOP_DOWN_POLAR = 0.1

export function topViewPose(
  bounds: Bounds | null,
  projection: CameraPose['projection'],
  aspect: number,
): CameraPose {
  const [cx, cz] = bounds?.center ?? [0, 0]
  const [w, d] = bounds?.size ?? [0, 0]
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9
  const viewWidth = Math.max(Math.max(w, d * safeAspect) * MARGIN, MIN_VIEW_WIDTH)
  // The tiny +z offset keeps camera-controls' azimuth defined (north stays up).
  return { position: [cx, 30, cz + 0.01], target: [cx, 0, cz], projection, viewWidth }
}

export function isTopDown(pose: Pick<CameraPose, 'position' | 'target'> | null): boolean {
  if (!pose) return false
  const dx = pose.position[0] - pose.target[0]
  const dy = pose.position[1] - pose.target[1]
  const dz = pose.position[2] - pose.target[2]
  const len = Math.hypot(dx, dy, dz)
  return len > 0 && Math.acos(Math.min(1, dy / len)) < TOP_DOWN_POLAR
}
