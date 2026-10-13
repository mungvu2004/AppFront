import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { toFixedVi } from '../../../i18n/format'
import { controlsAndPanels as vi } from '../../../i18n/regions/controlsAndPanels'

const source = readFileSync(join(import.meta.dir, 'reference-panel.tsx'), 'utf8')

test('guide opacity slider is a Vietnamese percent control', () => {
  expect(vi.referencePanel.opacity).toBe('Độ mờ')
  expect(source).toMatch(/label=\{vi\.referencePanel\.opacity\}[\s\S]*?max=\{100\}[\s\S]*?unit="%"/)
  expect(source).toContain('handleUpdate({ opacity: v })')
})

test('percent values use the decimal comma', () => {
  expect(toFixedVi(62.5, 1)).toBe('62,5')
  expect(toFixedVi(80, 0)).toBe('80')
})
