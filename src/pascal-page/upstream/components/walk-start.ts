/**
 * AppFront addition (Editor3D đợt 2), not an upstream file. "Đi bộ" with no spawn point: vendor
 * `deriveFirstPersonSpawn` starts the walk under the camera (x, z) and faces the camera's heading, so
 * the old orbit pose put the walker outside the home or on a roof. Before entering the walk the
 * camera is moved to an eye point inside a room (this pose), then the vendor derives the spawn there.
 */
import type { CameraPose } from '@pascal-app/core'

type Pt = [number, number]

export const WALK_EYE_HEIGHT = 1.6
/** Camera-controls keeps the target ≥ 2 m away (minDistance); aim 3 m ahead so the eye is not pushed back. */
const AIM_AHEAD = 3

const points = (polygon: unknown): Pt[] =>
  Array.isArray(polygon)
    ? polygon.filter((p): p is Pt => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    : []

/** Area centroid of a simple polygon (falls back to the vertex mean for a degenerate one). */
function centroid(pts: Pt[]): Pt {
  let a = 0
  let cx = 0
  let cz = 0
  pts.forEach(([x0, z0], i) => {
    const [x1, z1] = pts[(i + 1) % pts.length]!
    const cross = x0 * z1 - x1 * z0
    a += cross
    cx += (x0 + x1) * cross
    cz += (z0 + z1) * cross
  })
  if (Math.abs(a) < 1e-9) {
    return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length]
  }
  return [cx / (3 * a), cz / (3 * a)]
}

/**
 * Eye pose inside a room: a quarter of the long side back from the centre, 1.6 m above the floor,
 * looking along the long side across the centre. `baseY` = the floor's presentation height.
 * ponytail: an L-shaped room's centroid can fall outside it; fine for apartment rooms (near-rectangles).
 */
export function walkStartPose(polygon: unknown, baseY: number): CameraPose | null {
  const pts = points(polygon)
  if (pts.length < 3) return null
  const xs = pts.map((p) => p[0])
  const zs = pts.map((p) => p[1])
  const width = Math.max(...xs) - Math.min(...xs)
  const depth = Math.max(...zs) - Math.min(...zs)
  const [cx, cz] = centroid(pts)
  const alongX = width >= depth
  const back = (alongX ? width : depth) / 4
  const eye: Pt = alongX ? [cx - back, cz] : [cx, cz - back]
  const y = baseY + WALK_EYE_HEIGHT
  return {
    position: [eye[0], y, eye[1]],
    target: alongX ? [eye[0] + AIM_AHEAD, y, eye[1]] : [eye[0], y, eye[1] + AIM_AHEAD],
    projection: 'perspective',
  }
}

type RoomLike = { id: string; areaM2: number }

/** The room to start in: the one picked in "Phòng ▾" / on a label if still listed, else the largest. */
export function pickWalkRoom(rooms: readonly RoomLike[], preferredId: string | null): string | null {
  if (preferredId && rooms.some((room) => room.id === preferredId)) return preferredId
  let best: RoomLike | null = null
  for (const room of rooms) if (!best || room.areaM2 > best.areaM2) best = room
  return best?.id ?? null
}
