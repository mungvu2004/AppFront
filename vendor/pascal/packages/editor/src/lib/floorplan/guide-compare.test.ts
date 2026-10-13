import { describe, expect, test } from 'bun:test'
import {
  clampSwipePercent,
  getSideBySideOffsetX,
  getSwipeClipRect,
  getSwipeHandleX,
  nextSwipePercent,
} from './guide-compare'

describe('guide-compare', () => {
  test('clip theo %', () => {
    expect(getSwipeClipRect(200, 100, 25)).toEqual({ x: -100, y: -50, width: 50, height: 100 })
    expect(getSwipeClipRect(200, 100, 150).width).toBe(200)
    expect(getSwipeClipRect(200, 100, -5).width).toBe(0)
  })
  test('tay cầm', () => {
    expect(getSwipeHandleX(200, 50)).toBe(0)
    expect(getSwipeHandleX(200, 100)).toBe(100)
  })
  test('phím', () => {
    expect(nextSwipePercent(50, 'ArrowLeft')).toBe(45)
    expect(nextSwipePercent(98, 'ArrowRight')).toBe(100)
    expect(nextSwipePercent(50, 'a')).toBeNull()
    expect(clampSwipePercent(Number.NaN)).toBe(50)
  })
  test('cạnh nhau', () => {
    expect(getSideBySideOffsetX(100)).toBeCloseTo(105)
  })
})
