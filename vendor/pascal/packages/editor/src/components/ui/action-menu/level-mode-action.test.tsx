import { afterEach, describe, expect, test } from 'bun:test'
import { useViewer } from '@pascal-app/viewer'
import { Window } from 'happy-dom'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { TooltipProvider } from '../primitives/tooltip'
import { LevelModeAction } from './level-mode-action'

// AppFront 24-A-013: the v1 layout had no level-mode control, so a project opened
// with `?view=exploded` had no on-screen way back to stacked.
describe('LevelModeAction', () => {
  afterEach(() => useViewer.getState().setLevelMode('stacked'))

  test('shows the current mode and toggles exploded ↔ stacked', () => {
    const g = globalThis as unknown as Record<string, unknown>
    const saved = { window: g.window, document: g.document, act: g.IS_REACT_ACT_ENVIRONMENT }
    const win = new Window()
    g.window = win
    g.document = win.document
    g.IS_REACT_ACT_ENVIRONMENT = true
    try {
      useViewer.getState().setLevelMode('exploded')
      const doc = win.document as unknown as Document
      const host = doc.createElement('div')
      doc.body.append(host)
      const root = createRoot(host)
      act(() =>
        root.render(
          <TooltipProvider>
            <LevelModeAction />
          </TooltipProvider>,
        ),
      )
      const control = () => doc.querySelector('button[aria-label^="Chế độ tầng"]')
      expect(control()?.getAttribute('aria-label')).toBe('Chế độ tầng: Tách tầng')
      expect(control()?.getAttribute('aria-pressed')).toBe('true')

      act(() => (control() as HTMLButtonElement).click())

      expect(useViewer.getState().levelMode).toBe('stacked')
      expect(control()?.getAttribute('aria-label')).toBe('Chế độ tầng: Xếp tầng')
      expect(control()?.getAttribute('aria-pressed')).toBe('false')
      act(() => root.unmount())
    } finally {
      g.window = saved.window
      g.document = saved.document
      g.IS_REACT_ACT_ENVIRONMENT = saved.act
      void win.happyDOM.close()
    }
  })
})
