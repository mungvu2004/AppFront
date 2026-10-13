import { describe, expect, it } from 'bun:test'
import { foldedCommandFilter, foldForSearch } from './fold-search'

describe('foldForSearch', () => {
  it('strips Vietnamese tone and hat marks', () => {
    expect(foldForSearch('Hoàn tác')).toBe('hoan tac')
    expect(foldForSearch('Phòng ngủ 1')).toBe('phong ngu 1')
  })

  it('folds đ and Đ, which have no NFD decomposition', () => {
    expect(foldForSearch('Đồ đạc')).toBe('do dac')
  })

  it('leaves unaccented text alone', () => {
    expect(foldForSearch('Export GLB')).toBe('export glb')
  })
})

describe('foldedCommandFilter', () => {
  it('matches an accented label from an unaccented query', () => {
    expect(foldedCommandFilter('Hoàn tác', 'hoan tac')).toBe(1)
  })

  it('matches the accented query too', () => {
    expect(foldedCommandFilter('Hoàn tác', 'Hoàn')).toBe(1)
  })

  it('scores a mid-string hit below a prefix hit', () => {
    expect(foldedCommandFilter('Thư viện đồ đạc', 'do dac')).toBe(0.5)
    expect(foldedCommandFilter('Thư viện đồ đạc', 'thu vien')).toBe(1)
  })

  it('misses what is not there', () => {
    expect(foldedCommandFilter('Hoàn tác', 'xuat ban')).toBe(0)
  })

  it('searches keywords as well as the value', () => {
    expect(foldedCommandFilter('Undo', 'hoan tac', ['Hoàn tác'])).toBe(1)
  })

  it('keeps every item while the query is empty', () => {
    expect(foldedCommandFilter('Hoàn tác', '   ')).toBe(1)
  })
})
