import { afterEach, describe, expect, it, vi } from 'vitest'
import { fitPose, fitWhenControlsReady } from './fit-on-ready'

describe('fitPose (QA-2 L2)', () => {
  it('orbits the plan centre sized by the longer side, ~40 deg elevation, 40 deg lens', () => {
    const pose = fitPose({ center: [10, -4], size: [40, 20] }, 'perspective')
    expect(pose.target).toEqual([10, 0, -4])
    expect(pose.position[1]).toBeCloseTo(60)
    expect(pose.position[0]).toBeCloseTo(10 + 72 * 0.7)
    expect(pose.position[2]).toBeCloseTo(-4 + 72 * 0.7)
    expect(pose.fov).toBe(40)
    const elevation = Math.atan2(60, 72 * 0.7 * Math.SQRT2) * (180 / Math.PI)
    expect(elevation).toBeGreaterThan(38)
    expect(elevation).toBeLessThan(42)
  })
  it('falls back to the default pose without bounds', () => {
    expect(fitPose(null, 'orthographic')).toEqual({
      position: [20, 20, 20],
      target: [0, 0, 0],
      projection: 'orthographic',
    })
  })
})

describe('fitWhenControlsReady', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function fakeSubscribe() {
    let listener: (() => void) | null = null
    const unsubscribe = vi.fn(() => {
      listener = null
    })
    return {
      subscribe: (l: () => void) => {
        listener = l
        return unsubscribe
      },
      publish: () => listener?.(),
      unsubscribe,
    }
  }

  it('waits for the controls, then fits two frames later, once', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame'] })
    const bus = fakeSubscribe()
    const fit = vi.fn()
    fitWhenControlsReady(bus.subscribe, fit)
    vi.advanceTimersByTime(100)
    expect(fit).not.toHaveBeenCalled()
    bus.publish()
    expect(bus.unsubscribe).toHaveBeenCalled()
    vi.advanceTimersByTime(50)
    expect(fit).toHaveBeenCalledTimes(1)
    bus.publish()
    vi.advanceTimersByTime(50)
    expect(fit).toHaveBeenCalledTimes(1)
  })

  it('handles a synchronous first pose and gives up after the timeout', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame'] })
    const fit = vi.fn()
    const unsub = vi.fn()
    fitWhenControlsReady((l) => {
      l()
      return unsub
    }, fit)
    expect(unsub).toHaveBeenCalled()
    vi.advanceTimersByTime(50)
    expect(fit).toHaveBeenCalledTimes(1)

    const bus = fakeSubscribe()
    const late = vi.fn()
    fitWhenControlsReady(bus.subscribe, late, 1000)
    vi.advanceTimersByTime(1000)
    expect(bus.unsubscribe).toHaveBeenCalled()
    bus.publish()
    vi.advanceTimersByTime(50)
    expect(late).not.toHaveBeenCalled()
  })
})
