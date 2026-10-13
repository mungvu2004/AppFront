import { describe, expect, test } from 'bun:test'
import type { AnyNode, WallNode } from '@pascal-app/core'
import { moveWallCorner, parseCoordinate } from './wall-vertex-table'

const wall = (id: string, start: [number, number], end: [number, number], parentId = 'level_1') =>
  ({ id, type: 'wall', parentId, start, end }) as unknown as WallNode

describe('moveWallCorner', () => {
  const a = wall('wall_a', [0, 0], [4, 0])
  const b = wall('wall_b', [4, 0], [4, 3])
  const c = wall('wall_c', [4, 0], [8, 0], 'level_2')
  const nodes = { a, b, c } as unknown as Record<string, AnyNode>

  test('moves the corner and the wall joined to it on the same level', () => {
    expect(moveWallCorner(nodes, a, 'end', [5, 0])).toEqual([
      { id: 'wall_a', data: { end: [5, 0] } },
      { id: 'wall_b', data: { start: [5, 0] } },
    ] as never)
  })

  test('does nothing when the corner does not move', () => {
    expect(moveWallCorner(nodes, a, 'start', [0, 0])).toEqual([])
  })
})

describe('parseCoordinate', () => {
  test('reads a decimal comma or point', () => {
    expect(parseCoordinate('3,25')).toBe(3.25)
    expect(parseCoordinate(' -1.5 ')).toBe(-1.5)
  })

  test('refuses anything that is not a number', () => {
    expect(parseCoordinate('abc')).toBeNull()
    expect(parseCoordinate('')).toBeNull()
    expect(parseCoordinate('1,2,3')).toBeNull()
  })
})
