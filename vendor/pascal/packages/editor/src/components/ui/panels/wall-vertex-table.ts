import { type AnyNode, type AnyNodeId, planWallDivisions, planWallMerge, type WallNode } from '@pascal-app/core'

export type WallVertexEnd = 'start' | 'end'
type PlanPoint = [number, number]

const CORNER_EPSILON = 1e-6

const samePoint = (a: PlanPoint, b: PlanPoint) =>
  Math.abs(a[0] - b[0]) < CORNER_EPSILON && Math.abs(a[1] - b[1]) < CORNER_EPSILON

/**
 * Patches that move one corner of a wall to `to`, dragging every wall on the
 * same level that shares that corner along (3A), so the panel edit keeps the
 * same topology a drag in the viewport keeps. One `updateNodes` call with
 * these patches is one undo step.
 */
export function moveWallCorner(
  nodes: Record<string, AnyNode>,
  wall: WallNode,
  end: WallVertexEnd,
  to: PlanPoint,
): Array<{ id: AnyNodeId; data: Partial<WallNode> }> {
  const from = wall[end] as PlanPoint
  if (samePoint(from, to)) return []

  const patches: Array<{ id: AnyNodeId; data: Partial<WallNode> }> = []
  for (const node of Object.values(nodes)) {
    if (node.type !== 'wall' || node.parentId !== wall.parentId) continue
    const data: Partial<WallNode> = {}
    if (node.id === wall.id ? end === 'start' : samePoint(node.start as PlanPoint, from)) {
      data.start = to
    }
    if (node.id === wall.id ? end === 'end' : samePoint(node.end as PlanPoint, from)) {
      data.end = to
    }
    if (data.start || data.end) patches.push({ id: node.id as AnyNodeId, data })
  }
  return patches
}

/** Reads a user-typed coordinate in meters ("3,25" or "3.25"); `null` when invalid. */
export function parseCoordinate(text: string): number | null {
  const trimmed = text.trim().replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

type WallChanges = ReturnType<typeof planWallMerge>['changes']

/** Adds a vertex `distance` meters from the wall start: the wall becomes two, openings stay on their span. */
export function planAddVertex(
  nodes: Record<string, AnyNode>,
  wall: WallNode,
  distance: number,
): { changes: WallChanges } | { error: string } {
  try {
    return { changes: planWallDivisions(nodes as Record<AnyNodeId, AnyNode>, wall.id, [distance]).changes }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Removes the vertex at `end`: merges the wall with the one continuing it in line (errors if none/not mergeable). */
export function planRemoveVertex(
  nodes: Record<string, AnyNode>,
  wall: WallNode,
  end: WallVertexEnd,
): { changes: WallChanges } | { error: string } {
  const at = wall[end] as PlanPoint
  const other = Object.values(nodes).find(
    (n) =>
      n.type === 'wall' &&
      n.id !== wall.id &&
      n.parentId === wall.parentId &&
      (samePoint(n.start as PlanPoint, at) || samePoint(n.end as PlanPoint, at)),
  )
  if (!other) return { error: 'No wall continues here.' }
  try {
    return { changes: planWallMerge(nodes as Record<AnyNodeId, AnyNode>, [wall.id, other.id as AnyNodeId]).changes }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
