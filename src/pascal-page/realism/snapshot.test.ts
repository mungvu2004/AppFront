import { describe, expect, it } from 'vitest'
import { averageFrames, jitterOffsets, withJitter } from './snapshot'

describe('realism snapshot HQ (R3S)', () => {
  it('jitter offsets are distinct sub-pixel shifts', () => {
    const o = jitterOffsets(8)
    expect(o).toHaveLength(8)
    expect(o[0]).toEqual([0, 1 / 3 - 0.5])
    for (const [x, y] of o) {
      expect(Math.abs(x)).toBeLessThan(0.5)
      expect(Math.abs(y)).toBeLessThan(0.5)
    }
    expect(new Set(o.map((p) => p.join())).size).toBe(8)
  })

  it('averages frames byte by byte', () => {
    expect(Array.from(averageFrames([Uint8Array.of(0, 255, 10), Uint8Array.of(255, 255, 11)]))).toEqual([128, 255, 11])
  })

  it('jitters the camera and puts it back', () => {
    const calls: number[][] = []
    let cleared = 0
    const cam = {
      view: null,
      setViewOffset: (...a: number[]) => calls.push(a),
      clearViewOffset: () => cleared++,
    }
    const seen: number[] = []
    withJitter(cam, 100, 50, [[0.25, -0.25]], (i) => seen.push(i))
    expect(seen).toEqual([0])
    expect(calls).toEqual([[100, 50, 0.25, -0.25, 100, 50]])
    expect(cleared).toBe(1)
  })

  it('keeps an existing tile view offset', () => {
    const view = { enabled: true, fullWidth: 400, fullHeight: 200, offsetX: 100, offsetY: 50, width: 200, height: 100 }
    const calls: number[][] = []
    const cam = { view, setViewOffset: (...a: number[]) => calls.push(a), clearViewOffset: () => { throw new Error('no') } }
    withJitter(cam, 100, 50, [[0.5, 0.5]], () => {})
    expect(calls[0]).toEqual([400, 200, 101, 51, 200, 100])
    expect(calls[1]).toEqual([400, 200, 100, 50, 200, 100])
  })
})
