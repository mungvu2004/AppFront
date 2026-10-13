import { expect, test } from 'bun:test'
import { vi } from '../i18n/vi'
import { formatTriangles } from './perf-format'

test('triangle chip uses a decimal comma and Vietnamese unit', () => {
  expect(formatTriangles(12345)).toBe('12,3 nghìn')
  expect(formatTriangles(0)).toBe('0,0 nghìn')
})

test('triangle chip label is Vietnamese', () => {
  expect(vi.perfPanel.triangles).toBe('Tam giác')
})
