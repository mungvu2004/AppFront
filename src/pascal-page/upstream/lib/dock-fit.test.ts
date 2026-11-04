import { describe, expect, it } from 'vitest'
import { barLayoutVars, dockFit, dockLayout, hintFits, toolsShift } from './dock-fit'

describe('dockLayout', () => {
  const base = { tools: 126, full: 594, icons: 285, undo: 170, undoIcons: 66 }
  it('keeps every label at 1440 (the whole canvas is the budget)', () => {
    expect(dockLayout({ ...base, canvas: 1384 }, 8)).toEqual({ fit: 0, undoCompact: false })
  })
  it('drops dock labels, then undo labels, then folds', () => {
    expect(dockLayout({ ...base, canvas: 968 }, 8)).toEqual({ fit: 1, undoCompact: false })
    expect(dockLayout({ ...base, canvas: 620 }, 8)).toEqual({ fit: 1, undoCompact: true })
    expect(dockLayout({ ...base, canvas: 424 }, 8)).toEqual({ fit: 2, undoCompact: true })
  })
  it('has no undo group to budget when read-only', () => {
    expect(dockLayout({ ...base, undo: 0, undoIcons: 0, canvas: 860 }, 8)).toEqual({ fit: 0, undoCompact: false })
  })
})

describe('toolsShift', () => {
  it('moves the tools bar by half the side difference', () => {
    expect(toolsShift(170, 594, 8)).toBe(-212)
    expect(toolsShift(0, 100, 8)).toBe(-54)
  })
})

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
