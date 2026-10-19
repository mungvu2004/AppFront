import { describe, expect, it } from 'vitest'
import { isMeasureActive, isSelectControl, isSelectKey } from './select-exits-measure'

const key = (k: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
})

describe('select exits measure (N5-11)', () => {
  it('only acts while a measure tool is armed', () => {
    expect(isMeasureActive({ mode: 'build', tool: 'measurement' })).toBe(true)
    expect(isMeasureActive({ mode: 'build', tool: 'construction-dimension' })).toBe(true)
    expect(isMeasureActive({ mode: 'build', tool: 'wall' })).toBe(false)
    expect(isMeasureActive({ mode: 'select', tool: null })).toBe(false)
  })

  it('V is select, Ctrl/Cmd+V (paste) and other keys are not', () => {
    expect(isSelectKey(key('v'))).toBe(true)
    expect(isSelectKey(key('V'))).toBe(true)
    expect(isSelectKey(key('v', { ctrlKey: true }))).toBe(false)
    expect(isSelectKey(key('v', { metaKey: true }))).toBe(false)
    expect(isSelectKey(key('m'))).toBe(false)
  })

  it('finds the Select button by guide hook or image file, not by text', () => {
    expect(isSelectControl('mode-select', null)).toBe(true)
    expect(isSelectControl(null, '/icons/select.webp')).toBe(true)
    expect(isSelectControl(null, '/assets/pascal/icons/select.webp?v=2')).toBe(true)
    expect(isSelectControl(null, '/icons/box-select.webp')).toBe(false)
    expect(isSelectControl(null, '/icons/zone.webp')).toBe(false)
    expect(isSelectControl(null, null)).toBe(false)
  })
})
