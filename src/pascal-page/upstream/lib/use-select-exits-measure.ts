/** AppFront edit (R3f, N5-11): wires lib/select-exits-measure.ts into the page. See that file. */
import { useEditor, useMeasurementDraft } from '@pascal-app/editor'
import { useEffect } from 'react'
import { isMeasureActive, isSelectControl, isSelectKey } from './select-exits-measure'

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement)
  )
}

function exitMeasure() {
  const ed = useEditor.getState()
  if (!isMeasureActive(ed)) return
  ed.armToolMode({ mode: 'select' })
  ed.setFloorplanSelectionTool('click')
  useMeasurementDraft.getState().reset()
}

export function useSelectExitsMeasure() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest('button') : null
      if (!button) return
      const guide = button.getAttribute('data-guide-target')
      const src = button.querySelector('img')?.getAttribute('src') ?? null
      if (isSelectControl(guide, src)) exitMeasure()
    }
    const onKey = (event: KeyboardEvent) => {
      if (isSelectKey(event) && !isTyping(event.target)) exitMeasure()
    }
    window.addEventListener('click', onClick, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('click', onClick, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [])
}
