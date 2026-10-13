import { type AnyNode, getScaledDimensions, type ItemNode } from '@pascal-app/core'
import { planFootprintCorners } from '@pascal-app/core/plan-footprint'
import { itemOverlapsPolygon } from '@pascal-app/core/spatial-grid'

/** Same code as AppFront's rule registry (`src/domain/rules/function`), so a row links to one rule. */
export const FURNITURE_CLASH_RULE = 'FURNITURE-CLASH'

/**
 * Footprints may touch: a sofa pushed flush against a table is a layout, not a
 * clash. 1 cm of inset keeps edge contact out of the report.
 */
const TOUCH_INSET_M = 0.01

export interface FurnitureClash {
  a: { id: string; name: string }
  b: { id: string; name: string }
  ruleCode: typeof FURNITURE_CLASH_RULE
}

/**
 * Floor items on the same level whose plan footprints overlap (#22). Only
 * items parented to a level are compared — wall- and ceiling-mounted items sit
 * in another frame and may legitimately overhang floor furniture.
 *
 * ponytail: O(n²) per level; fine for a room's worth of furniture, bucket by
 * the spatial grid if a level ever holds thousands of items.
 */
export function findFurnitureClashes(nodes: Readonly<Record<string, AnyNode>>): FurnitureClash[] {
  const byLevel = new Map<string, ItemNode[]>()
  for (const node of Object.values(nodes)) {
    if (node.type !== 'item' || !node.parentId) continue
    if (nodes[node.parentId]?.type !== 'level') continue
    const list = byLevel.get(node.parentId) ?? []
    list.push(node)
    byLevel.set(node.parentId, list)
  }

  const clashes: FurnitureClash[] = []
  for (const items of byLevel.values()) {
    for (let i = 0; i < items.length; i++) {
      const a = items[i] as ItemNode
      const footprintA = planFootprintCorners(a.position, getScaledDimensions(a), a.rotation[1], TOUCH_INSET_M)
      for (let j = i + 1; j < items.length; j++) {
        const b = items[j] as ItemNode
        if (itemOverlapsPolygon(b.position, getScaledDimensions(b), b.rotation, footprintA, TOUCH_INSET_M)) {
          clashes.push({
            a: { id: a.id, name: a.name ?? a.asset.name },
            b: { id: b.id, name: b.name ?? b.asset.name },
            ruleCode: FURNITURE_CLASH_RULE,
          })
        }
      }
    }
  }
  return clashes
}
