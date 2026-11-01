import { describe, expect, it } from 'vitest'
import { pickWalkRoom, walkStartPose } from './walk-start'

describe('walkStartPose', () => {
  it('stands 1.6 m up, a quarter of the long side back from the centre, facing along it', () => {
    // 8 m × 4 m room, x 0..8, z 0..4, floor at 3 m
    const pose = walkStartPose([[0, 0], [8, 0], [8, 4], [0, 4]], 3)
    expect(pose?.position).toEqual([2, 4.6, 2])
    expect(pose?.target).toEqual([5, 4.6, 2])
    expect(pose?.projection).toBe('perspective')
  })

  it('uses the z axis for a deep room', () => {
    const pose = walkStartPose([[0, 0], [3, 0], [3, 6], [0, 6]], 0)
    expect(pose?.position).toEqual([1.5, 1.6, 1.5])
    expect(pose?.target).toEqual([1.5, 1.6, 4.5])
  })

  it('needs a polygon', () => {
    expect(walkStartPose(undefined, 0)).toBeNull()
    expect(walkStartPose([[0, 0], [1, 1]], 0)).toBeNull()
  })
})

describe('pickWalkRoom', () => {
  const rooms = [
    { id: 'a', areaM2: 9 },
    { id: 'b', areaM2: 18 },
  ]
  it('keeps the picked room, else the largest', () => {
    expect(pickWalkRoom(rooms, 'a')).toBe('a')
    expect(pickWalkRoom(rooms, 'gone')).toBe('b')
    expect(pickWalkRoom(rooms, null)).toBe('b')
    expect(pickWalkRoom([], null)).toBeNull()
  })
})
