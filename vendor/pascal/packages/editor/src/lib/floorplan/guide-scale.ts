import type { AnyNode, GuideNode } from '@pascal-app/core'

/**
 * Scale mismatch between the reference drawings of two floors — AppFront
 * F-15 W2-D2 (#95).
 *
 * Every floor is drawn from its own sheet, and every sheet is calibrated on its
 * own. When two calibrated sheets end up at different scales, walls stacked
 * from them stop lining up — and nothing else in the editor says so.
 *
 * ponytail: compares `guide.scale` directly, which assumes the sheets were
 * exported at the same pixel size (true for one drawing set). Comparing
 * metres-per-pixel needs the image dimensions; add that when mixed sources show up.
 */

export const GUIDE_SCALE_TOLERANCE = 0.02

export type GuideScaleMismatch = { levelId: string; percent: number }

/** The worst-mismatched calibrated guide on another floor, or null. */
export function findGuideScaleMismatch(
  guide: GuideNode,
  nodes: Record<string, AnyNode>,
): GuideScaleMismatch | null {
  if (!guide.scaleReference || guide.scale <= 0) return null
  let worst: GuideScaleMismatch | null = null
  for (const other of Object.values(nodes)) {
    if (other.type !== 'guide' || !other.scaleReference || other.parentId === guide.parentId) continue
    if (!other.parentId || other.scale <= 0) continue
    const ratio = Math.abs(other.scale / guide.scale - 1)
    if (ratio > GUIDE_SCALE_TOLERANCE && (!worst || ratio * 100 > worst.percent)) {
      worst = { levelId: other.parentId, percent: ratio * 100 }
    }
  }
  return worst
}
