import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { type AnyNode, type AnyNodeId, BuildingNode, ItemNode, LevelNode, WallNode } from '../../schema'
import useScene, { clearSceneHistory } from '../use-scene'

beforeEach(() => {
  useScene.getState().unloadScene()
  useScene.setState({ readOnly: false })
  clearSceneHistory()
})

afterEach(() => {
  useScene.getState().unloadScene()
  clearSceneHistory()
})

const asset = { id: 't', name: 't', category: 't', thumbnail: '', src: '/t.glb', dimensions: [0.5, 1, 0.5] }

function setup() {
  const building = BuildingNode.parse({})
  const level = LevelNode.parse({ parentId: building.id })
  const wall = WallNode.parse({ parentId: level.id, start: [0, 0], end: [4, 0] })
  const other = WallNode.parse({ parentId: level.id, start: [4, 0], end: [4, 4] })
  const sofa = ItemNode.parse({ parentId: level.id, position: [1, 0, 1], asset })
  const chair = ItemNode.parse({ parentId: level.id, position: [2, 0, 2], asset })
  building.children = [level.id]
  level.children = [wall.id, other.id, sofa.id, chair.id]
  const nodes = Object.fromEntries(
    [building, level, wall, other, sofa, chair].map((n) => [n.id, n]),
  ) as Record<AnyNodeId, AnyNode>
  useScene.setState({ nodes, rootNodeIds: [building.id], dirtyNodes: new Set<AnyNodeId>(), collections: {} })
  clearSceneHistory()
  return { level, wall, other, sofa, chair }
}

describe('deleteNodes dirty marking', () => {
  test('item delete marks only the parent, not every sibling', () => {
    const { wall, other, sofa, chair } = setup()
    useScene.getState().deleteNodes([sofa.id as AnyNodeId])
    const dirty = useScene.getState().dirtyNodes
    expect(dirty.has(chair.id as AnyNodeId)).toBe(false)
    expect(dirty.has(wall.id as AnyNodeId)).toBe(false)
    expect(dirty.has(other.id as AnyNodeId)).toBe(false)
  })

  test('wall delete still marks remaining siblings (joins/openings)', () => {
    const { wall, other } = setup()
    useScene.getState().deleteNodes([wall.id as AnyNodeId])
    expect(useScene.getState().dirtyNodes.has(other.id as AnyNodeId)).toBe(true)
  })
})
