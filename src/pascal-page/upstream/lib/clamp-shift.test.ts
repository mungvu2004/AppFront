import { describe, expect, it } from 'vitest'
import { clampShift, clearOfShift } from './clamp-shift'

describe('clampShift (G5-09)', () => {
  it('leaves a bar that fits alone', () => {
    expect(clampShift({ left: 100, right: 300, top: 200, bottom: 240 }, 1440, 900)).toEqual({
      dx: 0,
      dy: 0,
    })
  })
  it('pulls a bar back from the right and bottom edges', () => {
    expect(clampShift({ left: 1400, right: 1600, top: 860, bottom: 900 }, 1440, 900)).toEqual({
      dx: -168,
      dy: -72,
    })
  })
  it('pushes a bar off the left edge and below the top toolbar', () => {
    expect(clampShift({ left: -50, right: 150, top: 10, bottom: 50 }, 1024, 768)).toEqual({
      dx: 58,
      dy: 54,
    })
  })
})

describe('clearOfShift (pascal-polish)', () => {
  const card = { left: 356, right: 486, top: 56, bottom: 94 }
  it('pushes an overlapping pill right of the card plus the gap', () => {
    expect(clearOfShift({ left: 330, right: 690, top: 56, bottom: 88 }, card)).toBe(168)
  })
  it('leaves a pill that is already clear or on another row', () => {
    expect(clearOfShift({ left: 540, right: 900, top: 56, bottom: 88 }, card)).toBe(0)
    expect(clearOfShift({ left: 330, right: 690, top: 120, bottom: 150 }, card)).toBe(0)
  })
})
