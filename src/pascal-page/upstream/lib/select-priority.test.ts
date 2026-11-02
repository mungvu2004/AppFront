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

  it('never steals from handles or non-surface kinds', () => {
    const items = [{ id: 'bed', entry: 1 }]
    expect(pickItemOnRay({ kind: 'ceiling', viaHandle: true }, [5], items)).toBeNull()
    expect(pickItemOnRay({ kind: 'stair' }, [5], items)).toBeNull()
  })

  it('camera inside an item box (entry 0) does not count as clicking it', () => {
    expect(pickItemOnRay(slab, [3], [{ id: 'room-sized', entry: 0 }])).toBeNull()
  })
})

describe('select priority between items (đợt 3 nhóm D)', () => {
  const item = { kind: 'item' }
  const cabinet = { id: 'cabinet', volume: 0.6 * 0.6 * 2, height: 2 }
  const plant = { id: 'plant', volume: 0.4 * 0.4 * 1, height: 1 }

  it('ray through a plant onto the cabinet behind it: the plant wins', () => {
    // Pascal hit the cabinet mesh at 3.3 m; the ray entered the plant box at 3.0 m without hitting a leaf.
    expect(pickItemOnRay(item, [6], [{ ...cabinet, entry: 3.25, hit: 3.3 }, { ...plant, entry: 3 }])).toBe('plant')
  })

  it('overlapping boxes (plant against the cabinet): the smaller box wins', () => {
    const items = [
      { ...cabinet, entry: 3, hit: 3 },
      { ...plant, entry: 3.1 },
    ]
    expect(pickItemOnRay(item, [6], items)).toBe('plant')
  })

  it('pillow on a bed: the pillow wins even though the bed box starts earlier', () => {
    const items = [
      { id: 'bed', entry: 2.6, hit: 3.1, volume: 1.8 * 2 * 1, height: 1 },
      { id: 'pillow', entry: 2.98, hit: 3, volume: 0.05, height: 0.15 },
    ]
    expect(pickItemOnRay(item, [5], items)).toBe('pillow')
  })

  it('clicking the cabinet itself, nothing small in front: keeps the cabinet', () => {
    expect(pickItemOnRay(item, [6], [{ ...cabinet, entry: 3, hit: 3 }, { ...plant, entry: 3.6 }])).toBe('cabinet')
  })

  it('a big box the ray only passes through does not shadow a smaller item it really hits', () => {
    // Lamp on the nightstand, seen across the empty space above the bed.
    const items = [
      { id: 'bed', entry: 2, volume: 3.6, height: 1 },
      { id: 'lamp', entry: 2.95, hit: 3, volume: 0.03, height: 0.5 },
    ]
    expect(pickItemOnRay(item, [5], items)).toBe('lamp')
  })

  it('rug under a table: ray between the legs hits the rug, the table wins', () => {
    const items = [
      { id: 'rug', entry: 4.58, hit: 4.6, volume: 0.06, height: 0.01 },
      { id: 'table', entry: 4, volume: 1.1, height: 0.75 },
    ]
    expect(pickItemOnRay(item, [4.62], items)).toBe('table')
    // Slab under the rug got the click (rug mesh missed): same answer.
    expect(pickItemOnRay(slab, [4.62], items)).toBe('table')
  })

  it('rug with nothing else on the ray is still selectable', () => {
    const rug = { id: 'rug', entry: 4.58, hit: 4.6, volume: 0.06, height: 0.01 }
    expect(pickItemOnRay(item, [4.62], [rug])).toBe('rug')
    expect(pickItemOnRay(slab, [4.62], [{ id: 'rug', entry: 4.58, volume: 0.06, height: 0.01 }])).toBe('rug')
  })

  it('items behind a visible wall stay out of reach', () => {
    expect(pickItemOnRay(item, [3], [{ ...cabinet, entry: 2.5, hit: 2.6 }, { ...plant, entry: 3.5 }])).toBe('cabinet')
  })
})
