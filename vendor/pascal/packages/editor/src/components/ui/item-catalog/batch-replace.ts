import {
  type AnyNode,
  type AnyNodeId,
  type AssetInput,
  ItemNode,
  runAsSingleSceneHistoryStep,
  useScene,
} from '@pascal-app/core'

/**
 * "Đã phát hiện" + "Thay thế tất cả" — AppFront F-15 W2-D2 (#105, #106).
 *
 * Furniture that AppFront detected on the drawing reaches Pascal as items whose
 * asset id is `appfront-<kind>` (`src/lib/pascal/toPascal.ts`): a placeholder
 * box, not a real model. The strip pins those groups above the catalog so the
 * reviewer can swap a whole group for one catalog model.
 *
 * The flow is plan → preview → apply, never one click straight to the scene:
 * `planReplaceAll` is a dry run (#106) whose rows the panel shows in a dialog,
 * and only `applyReplaceAll` writes — as ONE history step, so a single undo
 * (and a single autosave round to AppFront) takes the whole batch back.
 */

export const DETECTED_ASSET_PREFIX = 'appfront-'

export type DetectedGroup = {
  /** The placeholder asset id, `appfront-<kind>`. */
  assetId: string
  name: string
  itemIds: AnyNodeId[]
}

export type ReplacePlan = {
  group: DetectedGroup
  target: AssetInput
  rows: { itemId: AnyNodeId; from: string; to: string }[]
}

const isDetectedItem = (node: AnyNode | undefined): node is ItemNode =>
  node?.type === 'item' && node.asset.id.startsWith(DETECTED_ASSET_PREFIX)

/** Detected items grouped by placeholder asset, in first-seen order. */
export function groupDetectedItems(nodes: Record<string, AnyNode>): DetectedGroup[] {
  const groups = new Map<string, DetectedGroup>()
  for (const node of Object.values(nodes)) {
    if (!isDetectedItem(node)) continue
    const group = groups.get(node.asset.id)
    if (group) group.itemIds.push(node.id)
    else groups.set(node.asset.id, { assetId: node.asset.id, name: node.asset.name, itemIds: [node.id] })
  }
  return [...groups.values()]
}

/** Dry run: what `applyReplaceAll` would change, touching nothing. */
export function planReplaceAll(group: DetectedGroup, target: AssetInput): ReplacePlan {
  return {
    group,
    target,
    rows: group.itemIds.map((itemId) => ({ itemId, from: group.name, to: target.name })),
  }
}

/** Apply a plan as one undo step. Items gone since the preview are skipped. */
export function applyReplaceAll(plan: ReplacePlan): number {
  const asset = ItemNode.shape.asset.parse(plan.target)
  const { nodes, updateNodes } = useScene.getState()
  const updates = plan.rows
    .filter((row) => isDetectedItem(nodes[row.itemId]))
    .map((row) => ({ id: row.itemId, data: { asset } as Partial<AnyNode> }))
  if (updates.length === 0) return 0
  runAsSingleSceneHistoryStep(useScene, () => updateNodes(updates))
  return updates.length
}

/** dataTransfer type for dragging a catalog tile onto a detected group (#107). */
export const CATALOG_DRAG_TYPE = 'application/x-pascal-catalog-item'
