import type { AnyNode, AnyNodeId, WallNode } from '@pascal-app/core'

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
