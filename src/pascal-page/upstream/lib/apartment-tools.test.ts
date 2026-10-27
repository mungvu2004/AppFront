import { describe, expect, it } from 'vitest'
import { splitApartmentTools } from './apartment-tools'

describe('splitApartmentTools (UX-R1 K38)', () => {
  it('keeps the apartment tools in fixed order and moves the rest behind "Thêm"', () => {
    const ids = ['wall', 'fence', 'slab', 'ceiling', 'roof', 'stair', 'door', 'window', 'column', 'box', 'kitchen', 'mep', 'painting', 'terrain']
    const { main, more } = splitApartmentTools(ids.map((id) => ({ id })))
    expect(main.map((t) => t.id)).toEqual(['wall', 'door', 'window', 'slab', 'ceiling', 'column', 'kitchen', 'painting'])
    expect(more.map((t) => t.id)).toEqual(['fence', 'roof', 'stair', 'box', 'mep', 'terrain'])
  })
})
