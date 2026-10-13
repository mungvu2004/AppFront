import type { AnyNode, AnyNodeId, DoorNode, WallNode, WindowNode } from '@pascal-app/core'

type PlanPoint = [number, number]

const planLength = (start: PlanPoint, end: PlanPoint) =>
  Math.hypot(end[0] - start[0], end[1] - start[1])

/**
 * Patches that slide a wall's doors/windows along it in proportion to the
 * wall's new length, so an opening at 40% of the wall stays at 40% after an
 * endpoint drag. `position[0]` is the distance from `start` (wall-local), and
 * is clamped so the opening keeps fitting inside the wall.
 * ponytail: straight walls only — curved hosts keep their offsets.
 */
export function rescaleWallOpenings(
  wall: WallNode,
  from: { start: PlanPoint; end: PlanPoint },
  to: { start: PlanPoint; end: PlanPoint },
  nodes: Record<string, AnyNode>,
): Array<{ id: AnyNodeId; data: Partial<DoorNode | WindowNode> }> {
  if (wall.curveOffset) return []
  const oldLength = planLength(from.start, from.end)
  const newLength = planLength(to.start, to.end)
  if (oldLength < 1e-6 || newLength < 1e-6 || Math.abs(newLength - oldLength) < 1e-9) return []
  const ratio = newLength / oldLength

  const patches: Array<{ id: AnyNodeId; data: Partial<DoorNode | WindowNode> }> = []
  for (const node of Object.values(nodes)) {
    if (node.type !== 'door' && node.type !== 'window') continue
    if (node.parentId !== wall.id && node.wallId !== wall.id) continue
    const half = Math.min(node.width / 2, newLength / 2)
    const x = Math.min(Math.max(node.position[0] * ratio, half), newLength - half)
    patches.push({
      id: node.id as AnyNodeId,
      data: { position: [x, node.position[1], node.position[2]] },
    })
  }
  return patches
}
