import { describe, expect, it } from 'vitest'
import { BEHIND_SURFACE_EPSILON, pickItemOnRay } from './select-priority'

const wall = { kind: 'wall' }
const slab = { kind: 'slab' }

describe('select priority (đợt sửa 2 H1, C2)', () => {
  it('ray slips between chair legs onto the floor: the chair wins', () => {
    // Ray enters the chair box at 4.0 m, hits the slab under it at 4.6 m.
    expect(pickItemOnRay(slab, [4.6], [{ id: 'chair', entry: 4 }])).toBe('chair')
  })

  it('hidden (cutaway) wall in front of a bed: the bed wins, up to the next opaque surface', () => {
    // Clicked wall is see-through, so it is not in `opaque`; the floor behind the bed is at 9 m.
    expect(pickItemOnRay(wall, [9], [{ id: 'bed', entry: 6 }])).toBe('bed')
    expect(pickItemOnRay(wall, [], [{ id: 'bed', entry: 6 }])).toBe('bed')
  })

  it('visible wall with furniture in the next room: keeps the wall', () => {
    expect(pickItemOnRay(wall, [5], [{ id: 'sofa', entry: 5 + BEHIND_SURFACE_EPSILON + 0.5 }])).toBeNull()
  })

  it('item flush with the surface (within tolerance) still wins', () => {
    expect(pickItemOnRay(wall, [5], [{ id: 'cabinet', entry: 5.2 }])).toBe('cabinet')
  })

  it('a visible wall between a hidden wall and the item blocks it', () => {
    expect(pickItemOnRay(wall, [7], [{ id: 'bed', entry: 8 }])).toBeNull()
  })

  it('picks the nearest of several items', () => {
    const items = [
      { id: 'far', entry: 5 },
      { id: 'near', entry: 3 },
    ]
    expect(pickItemOnRay(slab, [6], items)).toBe('near')
  })

  it('floor with nothing in front: keeps Pascal pick', () => {
    expect(pickItemOnRay(slab, [4], [])).toBeNull()
  })

  it('never steals from items, handles or non-surface kinds', () => {
    const items = [{ id: 'bed', entry: 1 }]
    expect(pickItemOnRay({ kind: 'item' }, [5], items)).toBeNull()
    expect(pickItemOnRay({ kind: 'ceiling', viaHandle: true }, [5], items)).toBeNull()
    expect(pickItemOnRay({ kind: 'stair' }, [5], items)).toBeNull()
  })

  it('camera inside an item box (entry 0) does not count as clicking it', () => {
    expect(pickItemOnRay(slab, [3], [{ id: 'room-sized', entry: 0 }])).toBeNull()
  })
})
