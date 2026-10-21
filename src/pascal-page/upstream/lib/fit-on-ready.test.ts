import { afterEach, describe, expect, it, vi } from 'vitest'
import { fitAzimuth, fitPose, fitWhenControlsReady, planBoundsXZ } from './fit-on-ready'

describe('fitPose (QA-2 L2, FE3D-FIX-002 V5 D13)', () => {
  const VIEW = { width: 1920, height: 1080 }
  const DEG = Math.PI / 180

  /** Screen extents of the plan box (floor..3 m) as fractions of the half-frame, via a real look-at. */
  function screenFill(pose: ReturnType<typeof fitPose>, size: [number, number], center: [number, number]) {
    const [px, py, pz] = pose.position
    const [tx, ty, tz] = pose.target
    const f = [tx - px, ty - py, tz - pz]
    const fl = Math.hypot(f[0]!, f[1]!, f[2]!)
    const fw = f.map((v) => v / fl)
    const r = [-fw[2]!, 0, fw[0]!]
    const rl = Math.hypot(r[0]!, r[2]!)
    const rw = r.map((v) => v / rl)
    const u = [
      rw[1]! * fw[2]! - rw[2]! * fw[1]!,
      rw[2]! * fw[0]! - rw[0]! * fw[2]!,
      rw[0]! * fw[1]! - rw[1]! * fw[0]!,
    ]
    const tanV = Math.tan(20 * DEG)
    const tanH = tanV * (VIEW.width / VIEW.height)
    let maxX = 0
    let maxUp = 0
    let maxDown = 0
    for (const x of [-size[0] / 2, size[0] / 2])
      for (const y of [0, 3])
        for (const z of [-size[1] / 2, size[1] / 2]) {
          const v = [center[0] + x - px, y - py, center[1] + z - pz]
          const depth = v[0]! * fw[0]! + v[1]! * fw[1]! + v[2]! * fw[2]!
          const sx = (v[0]! * rw[0]! + v[2]! * rw[2]!) / depth / tanH
          const sy = (v[0]! * u[0]! + v[1]! * u[1]! + v[2]! * u[2]!) / depth / tanV
          maxX = Math.max(maxX, Math.abs(sx))
          maxUp = Math.max(maxUp, sy)
          maxDown = Math.max(maxDown, -sy)
        }
    return { maxX, maxUp, maxDown }
  }

  it('orbits the plan centre at ~40 deg elevation, 40 deg lens; square plans at 45 deg azimuth', () => {
    const pose = fitPose({ center: [10, -4], size: [12, 11] }, 'perspective', VIEW)
    expect(pose.target).toEqual([10, 0, -4])
    expect(pose.position[0] - 10).toBeCloseTo(pose.position[2] + 4)
    expect(pose.fov).toBe(40)
    const horizontal = Math.hypot(pose.position[0] - 10, pose.position[2] + 4)
    expect(Math.atan2(pose.position[1], horizontal) / DEG).toBeCloseTo(40)
  })

  it('V14: long plans look ~25 deg off the short axis so the long side runs across the screen', () => {
    expect(fitAzimuth([30, 8]) / DEG).toBeCloseTo(25)
    expect(fitAzimuth([8, 30]) / DEG).toBeCloseTo(65)
    // Long along X: the camera sits mostly on +Z, so X runs left-right on screen.
    const pose = fitPose({ center: [0, 0], size: [30, 8] }, 'perspective', VIEW)
    expect(Math.atan2(pose.position[0], pose.position[2]) / DEG).toBeCloseTo(25)
  })

  it('V14: uses the canvas rect, not the window (the sidebar is not part of the frame)', () => {
    const canvas = document.createElement('canvas')
    canvas.getBoundingClientRect = () => ({ width: 800, height: 900 }) as DOMRect
    document.body.appendChild(canvas)
    try {
      const bounds = { center: [0, 0], size: [30, 8] } as { center: [number, number]; size: [number, number] }
      expect(fitPose(bounds, 'perspective')).toEqual(fitPose(bounds, 'perspective', { width: 800, height: 900 }))
    } finally {
      canvas.remove()
    }
  })

  it.each([
    [[40, 20]],
    [[12, 12]],
    [[30, 6]],
    [[8, 25]],
  ] as [[number, number]][])('plan %j fills ~80%% of the free frame on its tightest side', (size) => {
    const pose = fitPose({ center: [3, 2], size }, 'perspective', VIEW)
    const { maxX, maxUp, maxDown } = screenFill(pose, size, [3, 2])
    const upLimit = 1 - 140 / VIEW.height
    // Nothing leaves 80% of the frame (top: below the toolbar)...
    expect(maxX).toBeLessThanOrEqual(0.8 + 1e-6)
    expect(maxDown).toBeLessThanOrEqual(0.8 + 1e-6)
    expect(maxUp).toBeLessThanOrEqual(0.8 * upLimit + 1e-6)
    // ...and one side touches it (no dead space).
    expect(Math.max(maxX / 0.8, maxDown / 0.8, maxUp / (0.8 * upLimit))).toBeGreaterThan(0.999)
  })

  it('falls back to the default pose without bounds', () => {
    expect(fitPose(null, 'orthographic')).toEqual({
      position: [20, 20, 20],
      target: [0, 0, 0],
      projection: 'orthographic',
    })
  })
})

describe('planBoundsXZ (FE3D-FIX-004 V14)', () => {
  it('frames walls + zones only: origin-placed building/stairs, wall-local doors and the site are ignored', () => {
    const nodes = {
      site: { type: 'site', polygon: { type: 'polygon', points: [[-40, -40], [40, -40], [40, 40], [-40, 40]] } },
      building: { type: 'building', position: [0, 0, 0] },
      stair: { type: 'stair', position: [0, 0, 0] },
      door: { type: 'door', position: [1.2, 0, 0] },
      w1: { type: 'wall', start: [10, 5], end: [30, 5] },
      w2: { type: 'wall', start: [30, 5], end: [30, 13] },
      zone: { type: 'zone', polygon: [[10, 5], [30, 5], [30, 13], [10, 13]] },
    }
    expect(planBoundsXZ(nodes)).toEqual({ center: [20, 9], size: [20, 8] })
  })

  it('returns null without walls or zones', () => {
    expect(planBoundsXZ({ b: { type: 'building', position: [0, 0, 0] } })).toBeNull()
    expect(planBoundsXZ([])).toBeNull()
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
