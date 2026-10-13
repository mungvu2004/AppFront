import { beforeEach, describe, expect, test } from 'bun:test'
import { type AnyNode, type AnyNodeId, ItemNode, useScene } from '@pascal-app/core'
import { applyReplaceAll, groupDetectedItems, planReplaceAll } from './batch-replace'

type RafFn = (callback: (time: number) => void) => number
;(globalThis as { requestAnimationFrame?: RafFn }).requestAnimationFrame ??= (callback) => {
  callback(0)
  return 0
}
;(globalThis as { cancelAnimationFrame?: (id: number) => void }).cancelAnimationFrame ??= () => {}

const placeholder = { id: 'appfront-sofa', category: 'sofa', name: 'Ghế sofa', thumbnail: '', src: 'asset://appfront/sofa' }
const target = { id: 'sofa-modern', category: 'furniture', name: 'Sofa hiện đại', thumbnail: '', src: 'asset://sofa-modern' }

const item = (id: string, asset = placeholder) =>
  ItemNode.parse({ id: `item_${id}`, asset }) as AnyNode

describe('batch replace', () => {
  beforeEach(() => {
    useScene.setState({ nodes: {}, rootNodeIds: [], dirtyNodes: new Set() } as never)
    useScene.temporal.getState().clear()
    useScene.temporal.getState().resume()
    for (const node of [item('a'), item('b'), item('c', target)]) useScene.getState().createNode(node)
  })

  test('groups only detected placeholders', () => {
    const groups = groupDetectedItems(useScene.getState().nodes)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.itemIds).toEqual(['item_a', 'item_b'] as AnyNodeId[])
  })

  test('plan is a dry run, apply is one undo step', () => {
    const [group] = groupDetectedItems(useScene.getState().nodes)
    const plan = planReplaceAll(group!, target)
    expect(plan.rows.map((row) => row.to)).toEqual(['Sofa hiện đại', 'Sofa hiện đại'])
    expect(groupDetectedItems(useScene.getState().nodes)).toHaveLength(1)

    const past = useScene.temporal.getState().pastStates.length
    expect(applyReplaceAll(plan)).toBe(2)
    expect(useScene.temporal.getState().pastStates.length).toBe(past + 1)
    expect(groupDetectedItems(useScene.getState().nodes)).toHaveLength(0)

    useScene.temporal.getState().undo()
    expect(groupDetectedItems(useScene.getState().nodes)[0]?.itemIds).toHaveLength(2)
  })
})
