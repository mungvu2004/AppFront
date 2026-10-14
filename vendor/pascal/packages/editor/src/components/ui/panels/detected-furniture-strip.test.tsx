import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { type AnyNode, ItemNode, useScene } from '@pascal-app/core'
import { Window } from 'happy-dom'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import useEditor from '../../../store/use-editor'
import { CATALOG_DRAG_TYPE } from '../item-catalog/batch-replace'

type RafFn = (callback: (time: number) => void) => number
;(globalThis as { requestAnimationFrame?: RafFn }).requestAnimationFrame ??= (callback) => {
  callback(0)
  return 0
}
;(globalThis as { cancelAnimationFrame?: (id: number) => void }).cancelAnimationFrame ??= () => {}

const chair = { id: 'appfront-chair', category: 'chair', name: 'ghế', thumbnail: '', src: 'asset://appfront/chair' }
const target = { id: 'dining-chair', category: 'furniture', name: 'Ghế ăn', thumbnail: '', src: 'asset://dining-chair' }

// Radix picks its layout-effect hook at import time (a no-op without `document`), so the DOM must exist before the import.
const g = globalThis as unknown as Record<string, unknown>
const saved = { window: g.window, document: g.document, act: g.IS_REACT_ACT_ENVIRONMENT }
const win = new Window()
const doc = win.document as unknown as Document
g.window = win
g.document = win.document
for (const name of ['getComputedStyle', 'MutationObserver', 'HTMLElement', 'Node', 'Element', 'Event', 'CustomEvent', 'FocusEvent', 'KeyboardEvent', 'MouseEvent', 'PointerEvent', 'NodeFilter', 'HTMLInputElement', 'ShadowRoot', 'DocumentFragment']) g[name] = (win as unknown as Record<string, unknown>)[name]
const { DetectedFurnitureStrip } = await import('./detected-furniture-strip')
let root: Root

beforeEach(() => {
  g.window = win
  g.document = win.document
  g.IS_REACT_ACT_ENVIRONMENT = true
  doc.body.innerHTML = ''
  useScene.setState({ nodes: {}, rootNodeIds: [], dirtyNodes: new Set() } as never)
  for (const id of ['a', 'b', 'c']) useScene.getState().createNode(ItemNode.parse({ id: `item_${id}`, asset: chair }) as AnyNode)
  useEditor.setState({ selectedItem: target } as never)
  const pascalRoot = doc.createElement('div')
  pascalRoot.className = 'pascal-root'
  const host = doc.createElement('div')
  pascalRoot.append(host)
  doc.body.append(pascalRoot)
  root = createRoot(host)
  act(() => root.render(<DetectedFurnitureStrip readOnly={false} />))
})

afterEach(() => {
  act(() => root.unmount())
  g.window = saved.window
  g.document = saved.document
  g.IS_REACT_ACT_ENVIRONMENT = saved.act
})

afterAll(() => void win.happyDOM.close())

const buttonNamed = (name: string, scope: ParentNode = doc) =>
  [...scope.querySelectorAll('button')].find((b) => b.textContent === name) as HTMLButtonElement

describe('DetectedFurnitureStrip', () => {
  // AppFront 23F-E-005 / FL-23F-03: the dialog has no Radix trigger, so closing it dropped focus on <body>.
  test('closing the preview returns focus to the row "Thay thế tất cả"', async () => {
    const replace = buttonNamed('Thay thế tất cả')
    act(() => {
      replace.focus()
      replace.dispatchEvent(new win.MouseEvent('click', { bubbles: true }) as unknown as Event)
    })
    const dialog = doc.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog).not.toBeNull()
    act(() => void buttonNamed('Huỷ', dialog).dispatchEvent(new win.MouseEvent('click', { bubbles: true }) as unknown as Event))
    expect(doc.querySelector('[role="dialog"]')).toBeNull()
    await new Promise((resolve) => setTimeout(resolve, 0)) // FocusScope restores focus on a 0 ms timer
    expect(doc.activeElement?.textContent).toBe('Thay thế tất cả')
  })

  // AppFront BUG-649 / 23F-A-029: dragging over the row's own label/button must keep `border-primary`.
  test('drop highlight survives dragleave into a row child', () => {
    const row = doc.querySelector('li') as HTMLElement
    const label = row.querySelector('span') as HTMLElement
    const fire = (el: Element, type: string, relatedTarget: Element | null = null) => {
      const event = new win.Event(type, { bubbles: true, cancelable: true }) as unknown as Event
      Object.defineProperty(event, 'dataTransfer', { value: { types: [CATALOG_DRAG_TYPE], getData: () => '' } })
      Object.defineProperty(event, 'relatedTarget', { value: relatedTarget })
      act(() => void el.dispatchEvent(event))
    }
    fire(label, 'dragenter')
    fire(label, 'dragover')
    expect(row.className).toContain('border-primary')
    const button = row.querySelector('button') as HTMLElement
    fire(label, 'dragleave', button)
    fire(button, 'dragenter', label)
    fire(button, 'dragover')
    expect(row.className).toContain('border-primary')
    fire(row, 'dragleave', doc.body)
    expect(row.className).not.toContain('border-primary')
  })
})
