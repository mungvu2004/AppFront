import { describe, expect, it } from 'vitest'
import { barLayoutVars, dockFit, hintFits } from './dock-fit'

describe('dockFit', () => {
  it('keeps labels while the labelled dock fits', () => {
    expect(dockFit(420, 0, 500)).toBe(0)
  })
  it('drops to icons first, even before icons are measured', () => {
    expect(dockFit(420, 0, 140)).toBe(1)
    expect(dockFit(420, 120, 140)).toBe(1)
  })
  it('folds into "…" when icons alone overflow (768 px, sidebar open)', () => {
    expect(dockFit(420, 250, 140)).toBe(2)
  })
})

describe('barLayoutVars', () => {
  it('measures the bar bottom from the column top and the column left in the viewport', () => {
    // 768 px, sidebar to x=344, bar wrapped to three rows
    const bar = { top: 12, bottom: 120.4, left: 356 }
    const column = { top: 0, bottom: 1024, left: 344 }
    expect(barLayoutVars(bar, column)).toEqual({
      '--appfront-bar-bottom': '120px',
      '--appfront-viewer-left': '344px',
    })
  })
})

describe('hintFits', () => {
  it('hides the first-use hint on a narrow canvas only', () => {
    expect(hintFits(768, '344px')).toBe(false)
    expect(hintFits(1024, '344px')).toBe(true)
    expect(hintFits(768, '')).toBe(true)
  })
})
