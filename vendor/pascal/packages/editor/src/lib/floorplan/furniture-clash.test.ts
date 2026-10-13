import { describe, expect, test } from 'bun:test'
import type { AnyNode } from '@pascal-app/core'
import { FURNITURE_CLASH_RULE, findFurnitureClashes } from './furniture-clash'

const item = (id: string, name: string, x: number, parentId = 'level_1') =>
  ({
    id,
    type: 'item',
    parentId,
    name,
    position: [x, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    asset: { name: 'Mẫu', dimensions: [1, 1, 1] },
  }) as unknown as AnyNode

const scene = (...items: AnyNode[]): Record<string, AnyNode> => ({
  level_1: { id: 'level_1', type: 'level', parentId: null } as unknown as AnyNode,
  wall_1: { id: 'wall_1', type: 'wall', parentId: 'level_1' } as unknown as AnyNode,
  ...Object.fromEntries(items.map((node) => [node.id, node])),
})

describe('findFurnitureClashes (#22)', () => {
  test('overlapping floor items are reported by name with the rule code', () => {
    const clashes = findFurnitureClashes(scene(item('item_a', 'Ghế', 0), item('item_b', 'Bàn', 0.5)))
    expect(clashes).toEqual([
      { a: { id: 'item_a', name: 'Ghế' }, b: { id: 'item_b', name: 'Bàn' }, ruleCode: FURNITURE_CLASH_RULE },
    ])
  })

  test('items that only touch, sit apart, or hang on a wall do not clash', () => {
    expect(findFurnitureClashes(scene(item('item_a', 'Ghế', 0), item('item_b', 'Bàn', 1)))).toEqual([])
    expect(findFurnitureClashes(scene(item('item_a', 'Ghế', 0), item('item_b', 'Bàn', 3)))).toEqual([])
    expect(
      findFurnitureClashes(scene(item('item_a', 'Ghế', 0), item('item_b', 'Tranh', 0, 'wall_1'))),
    ).toEqual([])
  })
})
