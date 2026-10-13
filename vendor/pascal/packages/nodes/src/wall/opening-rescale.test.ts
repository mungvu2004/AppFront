import { describe, expect, test } from 'bun:test'
import type { AnyNode, WallNode } from '@pascal-app/core'
import { rescaleWallOpenings } from './opening-rescale'

const wall = { id: 'wall_a', type: 'wall', start: [0, 0], end: [4, 0] } as unknown as WallNode
const door = (id: string, x: number, width = 0.9) =>
  ({ id, type: 'door', parentId: 'wall_a', width, position: [x, 1.05, 0] }) as unknown as AnyNode

describe('rescaleWallOpenings', () => {
  test('keeps a door at the same fraction of the wall', () => {
    const nodes = { d: door('d', 1.6), w: wall as unknown as AnyNode }
    const patches = rescaleWallOpenings(
      wall,
      { start: [0, 0], end: [4, 0] },
      { start: [0, 0], end: [8, 0] },
      nodes,
    )
    expect(patches).toEqual([{ id: 'd', data: { position: [3.2, 1.05, 0] } }] as never)
  })

  test('clamps an opening so it still fits on a shortened wall', () => {
    const nodes = { d: door('d', 3.5) }
    const [patch] = rescaleWallOpenings(
      wall,
      { start: [0, 0], end: [4, 0] },
      { start: [0, 0], end: [2, 0] },
      nodes,
    )
    expect((patch?.data.position as number[])[0]).toBeCloseTo(1.55)
  })

  test('ignores openings on other walls and unchanged lengths', () => {
    const other = { ...door('o', 1), parentId: 'wall_b' } as AnyNode
    expect(
      rescaleWallOpenings(wall, { start: [0, 0], end: [4, 0] }, { start: [0, 0], end: [6, 0] }, { other }),
    ).toEqual([])
    expect(
      rescaleWallOpenings(wall, { start: [0, 0], end: [4, 0] }, { start: [1, 0], end: [5, 0] }, { d: door('d', 1) }),
    ).toEqual([])
  })
})
