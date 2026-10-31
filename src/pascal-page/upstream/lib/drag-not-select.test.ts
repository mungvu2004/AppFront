import { describe, expect, it, vi } from 'vitest'
import { CLICK_SLOP_PX, installDragNotSelect, isDrag } from './drag-not-select'

const ptr = (type: string, x: number, y = 0) =>
  // MouseEvent: jsdom may lack PointerEvent; the handlers read only button + clientX/Y.
  new MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true })

describe('drag not select (UX-R3 U16)', () => {
  it('small moves are clicks, longer ones are drags', () => {
    expect(isDrag(null, { x: 50, y: 50 })).toBe(false)
    expect(isDrag({ x: 0, y: 0 }, { x: CLICK_SLOP_PX, y: 0 })).toBe(false)
    expect(isDrag({ x: 0, y: 0 }, { x: 4, y: 4 })).toBe(true)
  })

  it('a drag release sets inputDragging during the release, then clears it', () => {
    vi.useFakeTimers()
    let value = false
    const seen: boolean[] = []
    const flag = { get: () => value, set: (v: boolean) => { value = v } }
    const off = installDragNotSelect(window, flag)
    const probe = () => seen.push(value)
    document.body.addEventListener('pointerup', probe)

    document.body.dispatchEvent(ptr('pointerdown', 0))
    document.body.dispatchEvent(ptr('pointerup', 2))
    document.body.dispatchEvent(ptr('pointerdown', 0))
    document.body.dispatchEvent(ptr('pointerup', 40))
    expect(seen).toEqual([false, true])
    vi.runAllTimers()
    expect(value).toBe(false)

    off()
    document.body.removeEventListener('pointerup', probe)
    vi.useRealTimers()
  })
})
