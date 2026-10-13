import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { RoomAreaTable } from '../../../lib/floorplan/room-area'
import { RoomAreaFullTable } from './room-area-full-page'

const row = {
  id: 'a',
  levelId: 'l1',
  name: 'Bếp',
  number: '',
  occupancy: 'Ở',
  area: 12.5,
  areaText: '12,5 m²',
  perimeter: 14,
  perimeterText: '14 m',
  ceilingHeight: 3,
  ceilingHeightText: '3 m',
  doorCount: 0,
  windowCount: 0,
  status: 'trusted' as const,
}

const table: RoomAreaTable = {
  groups: [{ key: 'l1', label: 'Tầng 1', rows: [row], subtotal: 12.5, subtotalText: '12,5 m²' }],
  bands: [],
  total: 12.5,
  totalText: '12,5 m²',
  issues: [],
}

const noop = () => {}
const props = {
  grouping: 'level' as const,
  sort: 'area-desc' as const,
  copied: false,
  onGroupingChange: noop,
  onSortChange: noop,
  onCopy: noop,
  onClose: noop,
}

describe('RoomAreaFullTable', () => {
  test('renders group, row, subtotal and total with comma decimals', () => {
    const html = renderToStaticMarkup(<RoomAreaFullTable {...props} table={table} />)
    expect(html).toContain('role="dialog"')
    for (const text of ['Tầng 1', 'Bếp', 'Tổng phụ', 'Tổng diện tích', '12,5 m²', 'Đóng bảng toàn trang']) {
      expect(html).toContain(text)
    }
  })

  test('empty table shows the empty state', () => {
    const empty = { ...table, groups: [], total: 0, totalText: '0 m²' }
    const html = renderToStaticMarkup(<RoomAreaFullTable {...props} table={empty} />)
    expect(html).toContain('Chưa có phòng nào đo được')
  })
})
