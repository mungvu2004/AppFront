import { describe, expect, test } from 'bun:test'
import { createFrameClock, frameDemanded, INTERACTION_TAIL_MS } from './frame-limiter'

describe('createFrameClock', () => {
  test('uses the first rAF sample only as a wall-time baseline', () => {
    const clock = createFrameClock(12)

    expect(clock.sample(60_000, 20)).toBeNull()
    expect(clock.sample(60_020, 20)).toBeCloseTo(12.02)
  })

  test('preserves the synthetic time across limiter restarts', () => {
    const firstLimiter = createFrameClock(0)
    firstLimiter.sample(1_000, 20)
    const priorTime = firstLimiter.sample(2_000, 20)
    if (priorTime === null) throw new Error('frame expected')

    const restartedLimiter = createFrameClock(priorTime)
    expect(restartedLimiter.sample(75_000, 1000 / 30)).toBeNull()
    expect(restartedLimiter.sample(75_034, 1000 / 30)).toBeCloseTo(priorTime + 1 / 30)
  })

  test('carries sub-frame remainder into the next sample', () => {
    const clock = createFrameClock()
    clock.sample(100, 20)

    expect(clock.sample(145, 20)).toBeCloseTo(0.04)
    expect(clock.sample(160, 20)).toBeCloseTo(0.06)
  })

  test('supports monotonic timer and resume kicks', () => {
    const clock = createFrameClock(2)

    expect(clock.step(0.02)).toBeCloseTo(2.02)
    expect(clock.step(0.001)).toBeCloseTo(2.021)
  })
})

describe('frameDemanded', () => {
  const idle = {
    frames: 0,
    hotUntilMs: 0,
    liveFrameHeld: false,
    now: 10_000,
    pendingWork: false,
  }

  test('a scene standing still owes no frame', () => {
    expect(frameDemanded(idle)).toBe(false)
  })

  test("R3F's demand counter wakes the loop", () => {
    expect(frameDemanded({ ...idle, frames: 1 })).toBe(true)
  })

  test('pending build or animation work wakes the loop', () => {
    expect(frameDemanded({ ...idle, pendingWork: true })).toBe(true)
  })

  test('a capture holding the live frame keeps pumping', () => {
    expect(frameDemanded({ ...idle, liveFrameHeld: true })).toBe(true)
  })

  test('interaction keeps the loop at full rate for the tail, then lets it sleep', () => {
    const hotUntilMs = idle.now + INTERACTION_TAIL_MS
    expect(frameDemanded({ ...idle, hotUntilMs })).toBe(true)
    expect(frameDemanded({ ...idle, hotUntilMs, now: hotUntilMs - 1 })).toBe(true)
    expect(frameDemanded({ ...idle, hotUntilMs, now: hotUntilMs })).toBe(false)
  })

  test('an idle second costs no frames where it used to cost fps of them', () => {
    const fps = 50
    let advanced = 0
    for (let tick = 0; tick < fps; tick++) {
      if (frameDemanded({ ...idle, now: 10_000 + tick * (1000 / fps) })) advanced++
    }
    expect(advanced).toBe(0)
  })
})
