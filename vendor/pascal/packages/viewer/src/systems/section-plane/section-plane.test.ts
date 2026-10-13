import { describe, expect, it } from 'bun:test'
import { Vector3 } from 'three'
import { formatSectionHeight } from '../../components/viewer/section-plane-control'
import { viewCubePose } from '../../components/viewer/view-cube'
import { clampSectionHeight, SECTION_PLANE_MAX_M, sectionPlaneAt } from './section-plane'

describe('section plane', () => {
  it('keeps what is below the cut and drops what is above', () => {
    const plane = sectionPlaneAt(3)
    expect(plane.distanceToPoint(new Vector3(0, 1, 0))).toBeGreaterThan(0)
    expect(plane.distanceToPoint(new Vector3(0, 5, 0))).toBeLessThan(0)
  })

  it('clamps the height to the slider range', () => {
    expect(clampSectionHeight(-4)).toBe(0)
    expect(clampSectionHeight(999)).toBe(SECTION_PLANE_MAX_M)
  })

  it('formats the height with a decimal comma', () => {
    expect(formatSectionHeight(1.25)).toBe('1,3 m')
  })
})

describe('viewCubePose', () => {
  it('puts the camera on the face side, at the given distance', () => {
    const pose = viewCubePose('right', [1, 2, 3], 10, 'perspective')
    expect(pose.position).toEqual([11, 2, 3])
    expect(pose.target).toEqual([1, 2, 3])
    expect(pose.projection).toBe('perspective')
  })

  it('looks straight down from the top', () => {
    const pose = viewCubePose('top', [0, 0, 0], 5, 'orthographic')
    expect(pose.position[1]).toBeCloseTo(5)
    expect(Math.abs(pose.position[0])).toBe(0)
  })
})
