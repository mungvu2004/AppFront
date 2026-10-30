import type { AnyNodeDefinition } from '@pascal-app/core'
import { describe, expect, it } from 'vitest'
import { kindNameVi, translateDefinition, viHint } from './pascal-vi'

function wallLike() {
  return {
    presentation: { label: 'Wall' },
    toolHints: [
      { key: 'Left click', label: 'Set wall start / end' },
      { key: 'R', label: 'Shape', chip: { labels: { line: 'Shape: Line' }, tooltip: 'Wall shape — click or press R to toggle' } },
      { key: 'Hover gutter', label: 'Something new upstream' },
    ],
    affordanceHints: { split: [{ key: 'Scroll', label: 'Cuts', chip: { labels: { '3': 'Cuts: 3, even' } } }] },
  } as unknown as AnyNodeDefinition
}

describe('pascal-vi (G5-03 registry)', () => {
  it('translates kind name, hint labels, chips and free-text keys; keeps mouse keys', () => {
    const def = wallLike()
    translateDefinition(def)
    const hints = def.toolHints ?? []
    expect(def.presentation?.label).toBe('Tường')
    expect(hints[0]).toEqual({ key: 'Left click', label: 'Đặt điểm đầu / cuối tường' })
    expect(hints[1]?.chip?.labels.line).toBe('Hình dạng: Đường thẳng')
    expect(hints[1]?.chip?.tooltip).toBe('Hình dạng tường: bấm hoặc nhấn R để đổi')
    expect(hints[2]).toEqual({ key: 'Rê lên máng xối', label: 'Something new upstream' })
    expect(def.affordanceHints?.split?.[0]?.chip?.labels['3']).toBe('Số vết cắt: 3, chia đều')
  })

  it('is idempotent', () => {
    const def = wallLike()
    translateDefinition(def)
    translateDefinition(def)
    expect(def.presentation?.label).toBe('Tường')
    expect(viHint('Cuts: 1')).toBe('Số vết cắt: 1')
  })

  it('keeps labels Pascal matches on (Shift "Cycle snapping mode" is filtered by label)', () => {
    expect(viHint('Cycle snapping mode')).toBe('Cycle snapping mode')
  })

  it('UX41 U51: type id → Vietnamese kind for the multi-select summary', () => {
    expect(kindNameVi('wall')).toBe('tường')
    expect(kindNameVi('door')).toBe('cửa đi')
    expect(kindNameVi('item')).toBe('đồ vật')
    expect(kindNameVi('roof-segment')).toBe('mảng mái')
    expect(kindNameVi('made-up-kind')).toBe('made up kind')
  })
})
