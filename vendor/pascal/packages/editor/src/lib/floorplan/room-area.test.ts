import { describe, expect, test } from 'bun:test'
import type { AnyNode } from '@pascal-app/core'
import { roomAreaRows, roomAreaTable, roomAreaTableToText } from './room-area'

function fixture(): Record<string, AnyNode> {
  const nodes: Record<string, AnyNode> = {}
  const node = (value: Record<string, unknown>) => {
    nodes[value.id as string] = {
      object: 'node',
      parentId: null,
      visible: true,
      metadata: {},
      children: [],
      ...value,
    } as unknown as AnyNode
  }

  node({ id: 'level_1', type: 'level', name: 'Tầng 1', level: 0, children: ['w_n', 'z_a', 'z_b'] })
  node({ id: 'level_2', type: 'level', name: 'Tầng 2', level: 1, children: ['z_c'] })
  node({
    id: 'w_n',
    type: 'wall',
    parentId: 'level_1',
    start: [0, 0],
    end: [6, 0],
    thickness: 0.15,
    frontSide: 'exterior',
    backSide: 'interior',
    children: ['d_1', 'win_1'],
  })
  node({
    id: 'd_1',
    type: 'door',
    parentId: 'w_n',
    wallId: 'w_n',
    doorType: 'hinged',
    openingKind: 'door',
    width: 0.9,
    height: 2.05,
    position: [1, 1.05, 0],
  })
  node({
    id: 'win_1',
    type: 'window',
    parentId: 'w_n',
    wallId: 'w_n',
    windowType: 'casement',
    openingKind: 'window',
    width: 1.2,
    height: 1.2,
    position: [4, 1.1, 0],
  })

  const zone = (value: Record<string, unknown>) =>
    node({
      type: 'zone',
      spaceRole: 'room',
      roomNumber: '',
      floorFinish: '',
      wallFinish: '',
      ceilingFinish: '',
      ceilingHeight: 2.7,
      occupancy: '',
      enclosureStatus: 'auto',
      ...value,
    })

  // 6 x 4 = 24 m², with the two openings of `w_n` in its boundary.
  zone({
    id: 'z_a',
    parentId: 'level_1',
    name: 'Phòng khách',
    roomNumber: '101',
    occupancy: 'Ở',
    boundaryWallIds: ['w_n'],
    polygon: [
      [0, 0],
      [6, 0],
      [6, 4],
      [0, 4],
    ],
  })
  // 2 x 4 = 8 m², flagged unsure by the model.
  zone({
    id: 'z_b',
    parentId: 'level_1',
    name: 'Bếp',
    occupancy: 'Phụ trợ',
    review: { confidence: 0.4 },
    polygon: [
      [6, 0],
      [8, 0],
      [8, 4],
      [6, 4],
    ],
  })
  // 4 x 4 = 16 m², verified by a reviewer.
  zone({
    id: 'z_c',
    parentId: 'level_2',
    name: 'Phòng ngủ',
    occupancy: 'Ở',
    review: { reviewed: true },
    polygon: [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ],
  })
  // Degenerate boundary — measured as nothing, so it becomes an issue, not a row.
  zone({
    id: 'z_broken',
    parentId: 'level_1',
    name: 'Hành lang',
    polygon: [
      [0, 0],
      [1, 0],
    ],
  })
  // Not a room: a generic analysis zone never reaches the area table.
  zone({
    id: 'z_site',
    parentId: 'level_1',
    spaceRole: 'generic',
    name: 'Lô đất',
    polygon: [
      [0, 0],
      [20, 0],
      [20, 20],
      [0, 20],
    ],
  })

  return nodes
}

describe('roomAreaRows', () => {
  test('only measurable rooms become rows; the rest become issues', () => {
    const { rows, issues } = roomAreaRows(fixture())
    expect(rows.map((row) => row.id).sort()).toEqual(['z_a', 'z_b', 'z_c'])
    expect(issues).toHaveLength(1)
    expect(issues[0]).toContain('Hành lang')
  })

  test('a row carries area, perimeter, height and the openings of its walls', () => {
    const { rows } = roomAreaRows(fixture())
    const living = rows.find((row) => row.id === 'z_a')
    expect(living).toMatchObject({
      levelId: 'level_1',
      name: 'Phòng khách',
      number: '101',
      occupancy: 'Ở',
      area: 24,
      doorCount: 1,
      windowCount: 1,
      status: 'trusted',
    })
    // A15: comma decimal separator, unit split off by a space.
    expect(living?.areaText).toBe('24 m²')
    expect(living?.ceilingHeightText).toBe('2,7 m')
    expect(living?.perimeter).toBeCloseTo(20, 6)
  })

  test('a room with no boundary wall counts no openings', () => {
    const { rows } = roomAreaRows(fixture())
    expect(rows.find((row) => row.id === 'z_b')).toMatchObject({
      doorCount: 0,
      windowCount: 0,
    })
  })

  test('A5: green only comes from `reviewed`, low confidence is suspect', () => {
    const { rows } = roomAreaRows(fixture())
    expect(rows.find((row) => row.id === 'z_c')?.status).toBe('reviewed')
    expect(rows.find((row) => row.id === 'z_b')?.status).toBe('suspect')
  })
})

describe('roomAreaTable', () => {
  test('groups by level with subtotals that add up to the total', () => {
    const table = roomAreaTable(fixture())
    expect(table.groups.map((group) => group.label)).toEqual(['Tầng 1', 'Tầng 2'])
    expect(table.groups[0]?.subtotal).toBe(32)
    expect(table.groups[1]?.subtotal).toBe(16)
    expect(table.total).toBe(48)
    expect(table.totalText).toBe('48 m²')
    const sum = table.groups.reduce((acc, group) => acc + group.subtotal, 0)
    expect(sum).toBe(table.total)
  })

  test('grouping by occupancy regroups the same rows', () => {
    const table = roomAreaTable(fixture(), { grouping: 'occupancy' })
    expect([...table.groups.map((group) => group.label)].sort()).toEqual(['Phụ trợ', 'Ở'])
    expect(table.groups.find((group) => group.label === 'Ở')?.subtotal).toBe(40)
    expect(table.total).toBe(48)
  })

  test('sorting runs inside each group', () => {
    const ascending = roomAreaTable(fixture(), { sort: 'area-asc' })
    expect(ascending.groups[0]?.rows.map((row) => row.id)).toEqual(['z_b', 'z_a'])
    const descending = roomAreaTable(fixture(), { sort: 'area-desc' })
    expect(descending.groups[0]?.rows.map((row) => row.id)).toEqual(['z_a', 'z_b'])
    const byName = roomAreaTable(fixture(), { sort: 'name' })
    expect(byName.groups[0]?.rows.map((row) => row.name)).toEqual(['Bếp', 'Phòng khách'])
  })

  test('the level filter narrows the table without touching the app-wide level', () => {
    const table = roomAreaTable(fixture(), { levelIds: ['level_2'] })
    expect(table.groups).toHaveLength(1)
    expect(table.total).toBe(16)
    // An empty filter means "every level", not "no level".
    expect(roomAreaTable(fixture(), { levelIds: [] }).total).toBe(48)
  })

  // AppFront 23R-B-007: a clean level must not report another level's broken room.
  test('the level filter also filters the unmeasurable-room issues', () => {
    expect(roomAreaTable(fixture(), { levelIds: ['level_2'] }).issues).toEqual([])
    expect(roomAreaTable(fixture(), { levelIds: ['level_1'] }).issues).toHaveLength(1)
  })

  // AppFront 23R-C-004: "Tầng 2" before "Tầng 10" — floor order, not string order.
  test('level groups follow the floor order, not the label order', () => {
    const nodes = fixture()
    nodes.level_1 = { ...(nodes.level_1 as object), name: 'Tầng 2', level: 1 } as unknown as AnyNode
    nodes.level_2 = { ...(nodes.level_2 as object), name: 'Tầng 10', level: 9 } as unknown as AnyNode
    expect(roomAreaTable(nodes).groups.map((group) => group.label)).toEqual(['Tầng 2', 'Tầng 10'])
  })

  test('the collapsed mode keeps the N largest rooms of the whole table', () => {
    const table = roomAreaTable(fixture(), { limit: 2 })
    const ids = table.groups.flatMap((group) => group.rows.map((row) => row.id))
    expect(ids.sort()).toEqual(['z_a', 'z_c'])
    expect(table.total).toBe(40)
    expect(roomAreaTable(fixture(), { limit: 0 }).groups).toEqual([])
  })

  test('A4: the bar never grows a fourth band', () => {
    const table = roomAreaTable(fixture())
    expect(table.bands).toHaveLength(2)
    expect(table.bands[0]).toMatchObject({ label: 'Ở', area: 40 })
    const percent = table.bands.reduce((acc, band) => acc + band.percent, 0)
    expect(percent).toBeCloseTo(100, 1)

    const many = fixture()
    for (const [index, occupancy] of ['Kỹ thuật', 'Thương mại', 'Giao thông'].entries()) {
      many[`z_x${index}`] = {
        ...(many.z_c as unknown as Record<string, unknown>),
        id: `z_x${index}`,
        occupancy,
        metadata: {},
      } as unknown as AnyNode
    }
    const capped = roomAreaTable(many)
    expect(capped.bands).toHaveLength(3)
    expect(capped.bands.at(-1)?.label).toBe('Khác')
  })

  test('an empty scene reports no group, no band and a zero total', () => {
    const table = roomAreaTable({})
    expect(table.groups).toEqual([])
    expect(table.bands).toEqual([])
    expect(table.total).toBe(0)
    expect(table.totalText).toBe('0 m²')
  })
})

describe('roomAreaTableToText', () => {
  test('copies a header, every group with its subtotal, then the total', () => {
    const text = roomAreaTableToText(roomAreaTable(fixture()))
    const lines = text.split('\n')
    expect(lines[0]).toBe('Số phòng\tTên phòng\tCông năng\tDiện tích')
    expect(lines).toContain('Tầng 1')
    expect(lines).toContain('101\tPhòng khách\tỞ\t24 m²')
    expect(lines.filter((line) => line.startsWith('Tổng phụ'))).toHaveLength(2)
    expect(lines.at(-1)).toBe('Tổng diện tích\t\t\t48 m²')
  })
})
