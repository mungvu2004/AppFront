import { describe, expect, test } from 'bun:test'
import type { CatalogItem } from './catalog-items'
import {
  filterFurnitureItems,
  foldDiacritics,
  FURNITURE_GROUP_IDS,
  furnitureGroupCounts,
} from './catalog-filter'

function item(value: Partial<CatalogItem> & { id: string }): CatalogItem {
  return {
    name: value.id,
    category: 'furniture',
    tags: [],
    thumbnail: '',
    src: '',
    ...value,
  } as CatalogItem
}

const items: CatalogItem[] = [
  item({ id: 'desk_1', name: 'Bàn làm việc', tags: ['desk', 'table'] }),
  item({ id: 'chair_1', name: 'Ghế xoay', tags: ['chair'] }),
  item({ id: 'bed_1', name: 'Giường đôi', tags: ['bed'] }),
  item({ id: 'sofa_1', name: 'Sofa ba chỗ', tags: ['sofa', 'couch'] }),
  item({ id: 'shelf_1', name: 'Tủ sách', tags: ['shelf', 'storage'] }),
  item({ id: 'toilet_1', name: 'Bồn cầu', category: 'bathroom', tags: [] }),
  item({ id: 'stove_1', name: 'Bếp từ', category: 'kitchen', tags: ['stove'] }),
  item({ id: 'washer_1', name: 'Máy giặt', category: 'appliance', tags: ['washer'] }),
  item({ id: 'user_1', name: 'Đồ của tôi', tags: [] }),
]

describe('foldDiacritics', () => {
  test('strips tone marks and folds đ', () => {
    expect(foldDiacritics('Ghế xoay')).toBe('ghe xoay')
    expect(foldDiacritics('Giường đôi')).toBe('giuong doi')
    expect(foldDiacritics('Đồ của tôi')).toBe('do cua toi')
  })
})

describe('filterFurnitureItems', () => {
  test('there are nine groups plus "Tất cả"', () => {
    expect(FURNITURE_GROUP_IDS).toHaveLength(10)
    expect(FURNITURE_GROUP_IDS[0]).toBe('all')
  })

  test('every group picks its own items', () => {
    const idsOf = (group: Parameters<typeof filterFurnitureItems>[1]) =>
      filterFurnitureItems(items, group).map((row) => row.id)
    expect(idsOf({ group: 'table' })).toEqual(['desk_1'])
    expect(idsOf({ group: 'chair' })).toEqual(['chair_1'])
    expect(idsOf({ group: 'bed' })).toEqual(['bed_1'])
    expect(idsOf({ group: 'sofa' })).toEqual(['sofa_1'])
    expect(idsOf({ group: 'cabinet' })).toEqual(['shelf_1'])
    expect(idsOf({ group: 'sanitary' })).toEqual(['toilet_1'])
    expect(idsOf({ group: 'kitchen' })).toEqual(['stove_1'])
    expect(idsOf({ group: 'equipment' })).toEqual(['washer_1'])
    expect(idsOf({ group: 'mine' })).toEqual(['user_1'])
    expect(idsOf({ group: 'all' })).toHaveLength(items.length)
  })

  test('a category alone is enough when the item carries no tag', () => {
    expect(filterFurnitureItems(items, { group: 'sanitary' })[0]?.name).toBe('Bồn cầu')
  })

  test('search ignores tone marks, in both directions', () => {
    expect(filterFurnitureItems(items, { search: 'ghe' }).map((row) => row.id)).toEqual([
      'chair_1',
    ])
    expect(filterFurnitureItems(items, { search: 'Ghế' }).map((row) => row.id)).toEqual([
      'chair_1',
    ])
    expect(filterFurnitureItems(items, { search: 'giuong doi' }).map((row) => row.id)).toEqual([
      'bed_1',
    ])
  })

  test('search also reads the English tags, so "desk" still finds a Vietnamese name', () => {
    expect(filterFurnitureItems(items, { search: 'desk' }).map((row) => row.id)).toEqual([
      'desk_1',
    ])
  })

  test('a chip and the search box narrow together', () => {
    expect(filterFurnitureItems(items, { group: 'chair', search: 'giuong' })).toEqual([])
    expect(filterFurnitureItems(items, { group: 'table', search: 'ban' })).toHaveLength(1)
  })

  test('an empty search is not a filter', () => {
    expect(filterFurnitureItems(items, { search: '   ' })).toHaveLength(items.length)
  })
})

describe('furnitureGroupCounts', () => {
  test('each chip knows how many items it would show', () => {
    const counts = furnitureGroupCounts(items)
    expect(counts.all).toBe(items.length)
    expect(counts.chair).toBe(1)
    const searched = furnitureGroupCounts(items, 'ghe')
    expect(searched.all).toBe(1)
    expect(searched.bed).toBe(0)
  })
})
