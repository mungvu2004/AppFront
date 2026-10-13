import { getLevelElevations, type LevelNode, sceneRegistry, useScene } from '@pascal-app/core'
import { create } from 'zustand'

export const EXPLODED_GAP = 5

/**
 * How far apart exploded levels sit, 0 (stacked) → 1 (full `EXPLODED_GAP`).
 * AppFront addition: the stock viewer only knew stacked/exploded as two
 * discrete steps; a slider drives this continuously. Only read while
 * `levelMode === 'exploded'`, and defaults to 1 so the stock toggle is
 * unchanged.
 */
export const useLevelExplode = create<{
  amount: number
  setAmount: (amount: number) => void
}>((set) => ({
  amount: 1,
  setAmount: (amount) => set({ amount: Math.min(1, Math.max(0, amount)) }),
}))

/** Separation below which floating level labels stay hidden (#100). */
export const LEVEL_LABEL_MIN_EXPLODE = 0.35

export function isLevelLabelVisible(
  levelMode: 'stacked' | 'exploded' | 'solo' | 'manual',
  amount: number,
): boolean {
  return levelMode === 'exploded' && amount >= LEVEL_LABEL_MIN_EXPLODE
}

/** `prefers-reduced-motion: reduce` — exploded transitions snap instead of easing. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Wall-centroid offset (m) between consecutive levels above which they read as misaligned. */
export const LEVEL_MISALIGN_TOLERANCE_M = 0.25

export type LevelMisalignment = {
  lowerLevelId: string
  upperLevelId: string
  offsetM: number
}

/**
 * Consecutive level pairs whose wall footprints do not line up (#101): the
 * centroid of each level's wall endpoints is compared to the next one up.
 * Levels without walls are skipped. Heuristic, not a structural check — a
 * deliberately set-back upper storey is reported too.
 */
export function findLevelMisalignments(
  nodes: Record<string, unknown>,
  tolerance = LEVEL_MISALIGN_TOLERANCE_M,
): LevelMisalignment[] {
  const levels: LevelNode[] = []
  const sums = new Map<string, { x: number; z: number; n: number }>()
  for (const node of Object.values(nodes) as Array<{
    type?: string
    id: string
    parentId?: string | null
    start?: [number, number]
    end?: [number, number]
  }>) {
    if (node?.type === 'level') levels.push(node as unknown as LevelNode)
    else if (node?.type === 'wall' && node.parentId && node.start && node.end) {
      const acc = sums.get(node.parentId) ?? { x: 0, z: 0, n: 0 }
      acc.x += node.start[0] + node.end[0]
      acc.z += node.start[1] + node.end[1]
      acc.n += 2
      sums.set(node.parentId, acc)
    }
  }
  const walled = levels
    .filter((level) => sums.has(level.id))
    .sort((a, b) => a.level - b.level)
  const result: LevelMisalignment[] = []
  for (let i = 1; i < walled.length; i++) {
    const a = sums.get(walled[i - 1]!.id)!
    const b = sums.get(walled[i]!.id)!
    const offsetM = Math.hypot(a.x / a.n - b.x / b.n, a.z / a.n - b.z / b.n)
    if (offsetM > tolerance) {
      result.push({ lowerLevelId: walled[i - 1]!.id, upperLevelId: walled[i]!.id, offsetM })
    }
  }
  return result
}

/**
 * The Y a level settles at under the given presentation mode — its stacked
 * elevation plus the exploded gap. Analytic (scene store + mode), never a
 * mesh read: a level created this frame has its Object3D at y=0 until
 * LevelSystem lerps it, and a mode switch leaves meshes mid-lerp — camera
 * code framing a level must aim at the destination, not the moving target.
 */
export function getLevelPresentationY(
  levelId: string,
  nodes: Record<string, unknown>,
  levelMode: 'stacked' | 'exploded' | 'solo' | 'manual',
): number {
  const level = nodes[levelId] as LevelNode | undefined
  const baseY = getLevelElevations(nodes as never).get(levelId)?.baseY ?? 0
  const explodedExtra =
    levelMode === 'exploded' && level
      ? level.level * EXPLODED_GAP * useLevelExplode.getState().amount
      : 0
  return baseY + explodedExtra
}

/**
 * Whether a level renders this frame, and whether it renders as a
 * shadow-caster only.
 *
 * Two unrelated things hide a level and they do not compose: the author's own
 * `visible` flag (the sidebar eye), which hides the floor outright, and solo
 * mode, which hides every level but the soloed one — keeping the levels ABOVE
 * it in the shadow map so the sun still shadows the soloed floor through them.
 * A level the author hid never enters that shadow-caster branch: its shadows
 * on the floor below would be exactly what hiding it was meant to remove.
 */
export function resolveLevelVisibility({
  levelMode,
  hasSelectedLevel,
  isSelected,
  index,
  selectedIndex,
  nodeVisible,
}: {
  levelMode: 'stacked' | 'exploded' | 'solo' | 'manual'
  hasSelectedLevel: boolean
  isSelected: boolean
  index: number
  selectedIndex: number | undefined
  nodeVisible: boolean
}): { visible: boolean; shadowOnly: boolean } {
  if (!nodeVisible) return { visible: false, shadowOnly: false }

  const hidden = levelMode === 'solo' && hasSelectedLevel && !isSelected
  const shadowOnly = hidden && selectedIndex !== undefined && index > selectedIndex
  return { visible: shadowOnly || !hidden, shadowOnly }
}

/**
 * Instantly snaps all level Objects3D to their true stacked Y positions
 * (ignores levelMode — always uses stacked, no exploded gap). Presentation
 * hiding is undone with it, but a level the author hid stays hidden: the
 * capture has to match the export, which prunes it.
 *
 * Returns a restore function that reverts each level's Y to what it was
 * before the snap, so lerp animations in LevelSystem can continue undisturbed.
 *
 * Usage:
 *   const restore = snapLevelsToTruePositions()
 *   renderer.render(scene, camera)
 *   restore()
 */
export function snapLevelsToTruePositions(): () => void {
  const nodes = useScene.getState().nodes

  type LevelEntry = {
    obj: NonNullable<ReturnType<typeof sceneRegistry.nodes.get>>
    levelId: string
    nodeVisible: boolean
  }

  const entries: LevelEntry[] = []
  sceneRegistry.byType.level!.forEach((levelId) => {
    const obj = sceneRegistry.nodes.get(levelId)
    const level = nodes[levelId as LevelNode['id']] as LevelNode | undefined
    if (obj && level) {
      entries.push({
        levelId,
        obj,
        nodeVisible: level.visible !== false,
      })
    }
  })
  const levelElevations = getLevelElevations(nodes)

  // Snapshot current Y and visibility so we can restore them after the render
  const snapshot = new Map(
    entries.map(({ levelId, obj }) => [levelId, { y: obj.position.y, visible: obj.visible }]),
  )

  // Snap to true stacked positions and undo presentation hiding
  for (const { levelId, obj, nodeVisible } of entries) {
    obj.position.y = levelElevations.get(levelId)?.baseY ?? 0
    obj.visible = nodeVisible
  }

  return () => {
    for (const { levelId, obj } of entries) {
      const saved = snapshot.get(levelId)
      if (saved !== undefined) {
        obj.position.y = saved.y
        obj.visible = saved.visible
      }
    }
  }
}
