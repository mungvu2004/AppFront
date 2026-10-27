import { describe, expect, it } from 'vitest'
import { isTopDown, topViewPose } from './top-view-pose'

describe('topViewPose (G5-48)', () => {
  it('looks straight down at the plan centre and fits the footprint', () => {
    const pose = topViewPose({ center: [12, -4], size: [20, 10] }, 'perspective', 2)
    expect(pose.target).toEqual([12, 0, -4])
    expect(pose.position[0]).toBe(12)
    expect(pose.viewWidth).toBeCloseTo(24)
    expect(isTopDown(pose)).toBe(true)
  })
  it('widens the view when the depth is the limiting side', () => {
    expect(topViewPose({ center: [0, 0], size: [10, 20] }, 'orthographic', 1.5).viewWidth).toBeCloseTo(36)
  })
  it('falls back to the origin with a minimum width', () => {
    const pose = topViewPose(null, 'orthographic', Number.NaN)
    expect(pose.target).toEqual([0, 0, 0])
    expect(pose.viewWidth).toBe(10)
  })
  it('looks down at the floor height when given one (UX-R2 K38)', () => {
    const pose = topViewPose({ center: [1, 2], size: [10, 10] }, 'perspective', 2, 6.6)
    expect(pose.target).toEqual([1, 6.6, 2])
    expect(pose.position[1]).toBeCloseTo(36.6)
    expect(isTopDown(pose)).toBe(true)
  })
  it('treats a 45 degree view as not top-down', () => {
    expect(isTopDown({ position: [10, 10, 0], target: [0, 0, 0] })).toBe(false)
    expect(isTopDown(null)).toBe(false)
  })
})
