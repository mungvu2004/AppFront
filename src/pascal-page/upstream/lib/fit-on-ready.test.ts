import { afterEach, describe, expect, it, vi } from 'vitest'
import { fitAzimuth, fitPose, fitRoomPose, fitWhenControlsReady, planBoundsXZ, roomsOf, TOP_RESERVED_PX } from './fit-on-ready'

describe('roomsOf (UX-R4 U40)', () => {
  it('lists zones of one floor with name + area, sorted by name; unnamed zones read "Phòng"', () => {
    const nodes = {
      z1: { type: 'zone', parentId: 'level_1', name: 'Phòng ngủ', polygon: [[0, 0], [4, 0], [4, 3], [0, 3]] },
      z2: { type: 'zone', parentId: 'level_1', name: 'Bếp', polygon: [[0, 0], [2, 0], [2, 2.5], [0, 2.5]] },
      z3: { type: 'zone', parentId: 'level_1', name: '  ', polygon: [[0, 0], [1, 0], [1, 1]] },
      z4: { type: 'zone', parentId: 'level_2', name: 'Sân thượng', polygon: [[0, 0], [5, 0], [5, 5], [0, 5]] },
      w: { type: 'wall', parentId: 'level_1', start: [0, 0], end: [4, 0] },
    }
    expect(roomsOf(nodes, 'level_1')).toEqual([
      { id: 'z2', name: 'Bếp', areaM2: 5 },
      { id: 'z3', name: 'Phòng', areaM2: 0.5 },
      { id: 'z1', name: 'Phòng ngủ', areaM2: 12 },
    ])
    expect(roomsOf(nodes).map((r) => r.id)).toContain('z4')
    expect(roomsOf({})).toEqual([])
  })
})

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
    const tanV = Math.tan(12 * DEG)
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

  it('orbits the plan centre at ~52 deg elevation, 24 deg lens; square plans at 45 deg azimuth', () => {
    const pose = fitPose({ center: [10, -4], size: [12, 11] }, 'perspective', VIEW)
    expect(pose.target).toEqual([10, 0, -4])
    expect(pose.position[0] - 10).toBeCloseTo(pose.position[2] + 4)
    expect(pose.fov).toBe(24)
    const horizontal = Math.hypot(pose.position[0] - 10, pose.position[2] + 4)
    expect(Math.atan2(pose.position[1], horizontal) / DEG).toBeCloseTo(52)
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
  ] as [[number, number]][])('plan %j fills ~97%% of the free landscape frame on its tightest side', (size) => {
    const pose = fitPose({ center: [3, 2], size }, 'perspective', VIEW)
    const { maxX, maxUp, maxDown } = screenFill(pose, size, [3, 2])
    const upLimit = 1 - (2 * TOP_RESERVED_PX) / VIEW.height
    const fill = 0.97
    // Nothing leaves the fill (top: below the toolbar)...
    expect(maxX).toBeLessThanOrEqual(fill + 1e-6)
    expect(maxDown).toBeLessThanOrEqual(fill + 1e-6)
    expect(maxUp).toBeLessThanOrEqual(fill * upLimit + 1e-6)
    // ...and one side touches it (no dead space).
    expect(Math.max(maxX / fill, maxDown / fill, maxUp / (fill * upLimit))).toBeGreaterThan(0.999)
  })

  it('UX-R2 K38: baseY lifts target and camera together (a solo floor keeps its stacked height)', () => {
    const bounds = { center: [3, 2], size: [12, 9] } as { center: [number, number]; size: [number, number] }
    const ground = fitPose(bounds, 'perspective', VIEW)
    const lifted = fitPose(bounds, 'perspective', VIEW, 6.6)
    expect(lifted.target).toEqual([3, 6.6, 2])
    expect(lifted.position[1]).toBeCloseTo(ground.position[1] + 6.6)
    expect(lifted.position[0]).toBeCloseTo(ground.position[0])
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
  it('bỏ mảnh sàn lạc ngoài nhà, giữ lô gia chạm tường', () => {
    const nodes = {
      a: { type: 'wall', start: [0, 0], end: [10, 0] },
      b: { type: 'wall', start: [10, 0], end: [10, 8] },
      loggia: { type: 'zone', polygon: [[10, 2], [12, 2], [12, 6], [10, 6]] },
      stray: { type: 'zone', polygon: [[-9, 3], [-7, 3], [-7, 5], [-9, 5]] },
    }
    expect(planBoundsXZ(nodes)).toEqual({ center: [6, 4], size: [12, 8] })
  })

  it('không có tường thì vẫn tính mọi vùng', () => {
    expect(planBoundsXZ({ z: { type: 'zone', polygon: [[0, 0], [2, 0], [2, 2]] } })).toEqual({ center: [1, 1], size: [2, 2] })
  })

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

  it('UX-R2 K38: with a level id, frames only that floor (walls and zones whose parent is the level)', () => {
    const nodes = {
      a: { type: 'wall', parentId: 'level_1', start: [0, 0], end: [10, 0] },
      b: { type: 'zone', parentId: 'level_1', polygon: [[0, 0], [10, 0], [10, 6], [0, 6]] },
      c: { type: 'wall', parentId: 'level_2', start: [100, 50], end: [140, 50] },
    }
    expect(planBoundsXZ(nodes, 'level_1')).toEqual({ center: [5, 3], size: [10, 6] })
    expect(planBoundsXZ(nodes, 'level_9')).toBeNull()
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

describe('fitRoomPose (fit-room 04/11)', () => {
  /** Pixel box of the room (floor..1.2 m) as a pinhole camera at `pose` sees it. */
  function pixelBox(pose: ReturnType<typeof fitRoomPose>, room: { center: [number, number]; size: [number, number] }, view: { width: number; height: number }) {
    const [px, py, pz] = pose.position
    const [tx, ty, tz] = pose.target
    const raw = [tx - px, ty - py, tz - pz]
    const len = Math.hypot(...raw)
    const f = raw.map((v) => v / len)
    const rl = Math.hypot(f[2]!, f[0]!)
    const r = [-f[2]! / rl, 0, f[0]! / rl]
    const u = [r[1]! * f[2]! - r[2]! * f[1]!, r[2]! * f[0]! - r[0]! * f[2]!, r[0]! * f[1]! - r[1]! * f[0]!]
    const tanV = Math.tan((24 * Math.PI) / 360)
    const tanH = (tanV * view.width) / view.height
    const xs: number[] = []
    const ys: number[] = []
    for (const dx of [-0.5, 0.5]) for (const dz of [-0.5, 0.5]) for (const y of [0, 1.2]) {
      const v = [room.center[0] + dx * room.size[0] - px, y - py, room.center[1] + dz * room.size[1] - pz]
      const depth = v[0]! * f[0]! + v[1]! * f[1]! + v[2]! * f[2]!
      xs.push(((v[0]! * r[0]! + v[2]! * r[2]!) / depth / tanH + 1) * (view.width / 2))
      ys.push((1 - (v[0]! * u[0]! + v[1]! * u[1]! + v[2]! * u[2]!) / depth / tanV) * (view.height / 2))
    }
    return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) }
  }

  const VIEW = { width: 744, height: 620 }
  const FREE = { left: 0, top: 120, right: 744, bottom: 540 }

  it('a small room fills the free area, nearer than the whole-frame fit, and stays inside it', () => {
    const room = { center: [10, 6] as [number, number], size: [4, 4] as [number, number] }
    const pose = fitRoomPose(room, 'perspective', VIEW, FREE)
    const box = pixelBox(pose, room, VIEW)
    expect(box.left).toBeGreaterThanOrEqual(FREE.left - 1)
    expect(box.right).toBeLessThanOrEqual(FREE.right + 1)
    expect(box.top).toBeGreaterThanOrEqual(FREE.top - 1)
    expect(box.bottom).toBeLessThanOrEqual(FREE.bottom + 1)
    expect(Math.max((box.bottom - box.top) / (FREE.bottom - FREE.top), (box.right - box.left) / (FREE.right - FREE.left))).toBeGreaterThan(0.8)
    const dist = (p: typeof pose) => Math.hypot(p.position[0] - p.target[0], p.position[1] - p.target[1], p.position[2] - p.target[2])
    expect(dist(pose)).toBeLessThan(dist(fitPose(room, 'perspective', VIEW)))
    expect(pose.target[1]).toBeCloseTo(0)
  })

  it('a covering panel on the right moves the room left of it', () => {
    const room = { center: [0, 0] as [number, number], size: [6, 5] as [number, number] }
    const free = { ...FREE, right: 460 }
    const box = pixelBox(fitRoomPose(room, 'perspective', VIEW, free), room, VIEW)
    expect(box.right).toBeLessThanOrEqual(461)
    expect(Math.abs((box.left + box.right) / 2 - 230)).toBeLessThan(15)
  })

  it('a bigger room stands further back; a floor above lifts the frame', () => {
    const small = fitRoomPose({ center: [0, 0], size: [3, 3] }, 'perspective', VIEW, FREE)
    const big = fitRoomPose({ center: [0, 0], size: [8, 8] }, 'perspective', VIEW, FREE)
    expect(big.position[1]).toBeGreaterThan(small.position[1])
    expect(fitRoomPose({ center: [0, 0], size: [3, 3] }, 'perspective', VIEW, FREE, 6.6).target[1]).toBeCloseTo(6.6)
    expect(fitRoomPose(null, 'perspective', VIEW, FREE).position).toEqual([20, 20, 20])
  })
})
