import { describe, expect, test } from 'bun:test'
import { type AnyNode, GuideNode } from '@pascal-app/core'
import { findGuideScaleMismatch } from './guide-scale'

const reference = {
  start: [0, 0] as [number, number],
  end: [1, 0] as [number, number],
  realLengthMeters: 1,
  measuredLengthUnits: 1,
  metersPerUnit: 1,
  label: '1 m',
}

const guide = (id: string, parentId: string, scale: number, calibrated = true) =>
  GuideNode.parse({
    id: `guide_${id}`,
    parentId,
    url: 'asset://plan.png',
    scale,
    scaleReference: calibrated ? reference : null,
  })

const nodesOf = (...guides: GuideNode[]) =>
  Object.fromEntries(guides.map((g) => [g.id, g as AnyNode])) as Record<string, AnyNode>

describe('findGuideScaleMismatch', () => {
  test('flags another floor beyond tolerance', () => {
    const a = guide('a', 'level_1', 1)
    const b = guide('b', 'level_2', 1.1)
    const mismatch = findGuideScaleMismatch(a, nodesOf(a, b))
    expect(mismatch?.levelId).toBe('level_2')
    expect(mismatch?.percent).toBeCloseTo(10)
  })

  test('ignores same floor, uncalibrated sheets and small drift', () => {
    const a = guide('a', 'level_1', 1)
    const nodes = nodesOf(a, guide('b', 'level_1', 2), guide('c', 'level_2', 2, false), guide('d', 'level_3', 1.01))
    expect(findGuideScaleMismatch(a, nodes)).toBeNull()
    expect(findGuideScaleMismatch(guide('e', 'level_1', 1, false), nodes)).toBeNull()
  })
})
