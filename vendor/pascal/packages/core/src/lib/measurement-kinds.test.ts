import { describe, expect, it } from 'vitest'
import { MeasurementPayload } from '../schema/nodes/measurement'
import { measurementHeight, measurementPerpendicularDistance } from './measurement-geometry'

describe('perpendicular and height measurements', () => {
  it('measures height as the vertical offset', () => {
    expect(measurementHeight([1, 0.5, 2], [9, 3, -4])).toBe(2.5)
  })

  it('measures distance to the surface along its normal', () => {
    expect(measurementPerpendicularDistance([0, 0, 0], [3, 2, 4], [0, 5, 0])).toBe(2)
    expect(measurementPerpendicularDistance([0, 0, 0], [3, 2, 4], [1, 0, 0])).toBe(3)
  })

  it('parses both kinds and rejects a zero normal', () => {
    const points = [[0, 0, 0], [1, 1, 1]]
    expect(MeasurementPayload.safeParse({ kind: 'height', points }).success).toBe(true)
    expect(
      MeasurementPayload.safeParse({ kind: 'perpendicular', points, normal: [0, 1, 0] }).success,
    ).toBe(true)
    expect(
      MeasurementPayload.safeParse({ kind: 'perpendicular', points, normal: [0, 0, 0] }).success,
    ).toBe(false)
  })
})
