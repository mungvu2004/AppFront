import { describe, expect, it } from 'bun:test'
import {
  MAX_POLAR,
  MIN_DISTANCE,
  orbitPose,
  panPose,
  pinchDelta,
  poseFromPosition,
  positionFromPose,
  zoomPose,
} from './camera-gesture'

const pose = poseFromPosition([10, 10, 10], [0, 0, 0])

describe('camera-gesture', () => {
  it('round-trips position <-> pose', () => {
    const p = positionFromPose(pose)
    expect(p[0]).toBeCloseTo(10)
    expect(p[1]).toBeCloseTo(10)
    expect(p[2]).toBeCloseTo(10)
  })

  it('orbit changes heading and clamps polar above the ground', () => {
    expect(orbitPose(pose, 100, 0).azimuth).toBeLessThan(pose.azimuth)
    expect(orbitPose(pose, 0, -1e6).polar).toBe(MAX_POLAR)
  })

  it('pinch apart zooms in, clamped', () => {
    expect(zoomPose(pose, 2).distance).toBeCloseTo(pose.distance / 2)
    expect(zoomPose(pose, 1e9).distance).toBe(MIN_DISTANCE)
    expect(zoomPose(pose, 0)).toBe(pose)
  })

  it('pinchDelta gives scale and midpoint shift', () => {
    const d = pinchDelta(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      [
        { x: 10, y: 5 },
        { x: 210, y: 5 },
      ],
    )
    expect(d.scale).toBe(2)
    expect(d.dx).toBe(60)
    expect(d.dy).toBe(5)
  })

  it('pan keeps height and moves target', () => {
    const p = panPose(pose, 50, 0, 800, 50)
    expect(p.target[1]).toBe(0)
    expect(Math.hypot(p.target[0], p.target[2])).toBeGreaterThan(0)
    expect(panPose(pose, 50, 0, 0, 50)).toBe(pose)
  })
})
