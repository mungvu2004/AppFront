import { describe, expect, test } from 'bun:test'
import {
  findLevelMisalignments,
  isLevelLabelVisible,
  LEVEL_LABEL_MIN_EXPLODE,
  resolveLevelVisibility,
  useLevelExplode,
} from './level-utils'

const decide = (
  overrides: Partial<Parameters<typeof resolveLevelVisibility>[0]> = {},
): ReturnType<typeof resolveLevelVisibility> =>
  resolveLevelVisibility({
    levelMode: 'stacked',
    hasSelectedLevel: false,
    isSelected: false,
    index: 0,
    selectedIndex: undefined,
    nodeVisible: true,
    ...overrides,
  })

describe('resolveLevelVisibility', () => {
  test('shows every level outside solo mode', () => {
    expect(decide()).toEqual({ visible: true, shadowOnly: false })
    expect(decide({ levelMode: 'exploded', index: 2 })).toEqual({
      visible: true,
      shadowOnly: false,
    })
  })

  test('solo keeps the soloed level, plain-hides the ones below it', () => {
    expect(
      decide({ levelMode: 'solo', hasSelectedLevel: true, isSelected: true, index: 1 }),
    ).toEqual({ visible: true, shadowOnly: false })
    expect(
      decide({ levelMode: 'solo', hasSelectedLevel: true, index: 0, selectedIndex: 1 }),
    ).toEqual({ visible: false, shadowOnly: false })
  })

  test('solo keeps the levels above the soloed one as shadow casters', () => {
    expect(
      decide({ levelMode: 'solo', hasSelectedLevel: true, index: 2, selectedIndex: 1 }),
    ).toEqual({ visible: true, shadowOnly: true })
  })

  test('solo plain-hides everything when the selected level is not registered', () => {
    expect(
      decide({ levelMode: 'solo', hasSelectedLevel: true, index: 2, selectedIndex: undefined }),
    ).toEqual({ visible: false, shadowOnly: false })
  })

  test('a level the author hid is hidden outright, never a shadow caster', () => {
    expect(decide({ nodeVisible: false })).toEqual({ visible: false, shadowOnly: false })
    expect(
      decide({
        levelMode: 'solo',
        hasSelectedLevel: true,
        index: 2,
        selectedIndex: 1,
        nodeVisible: false,
      }),
    ).toEqual({ visible: false, shadowOnly: false })
    expect(
      decide({
        levelMode: 'solo',
        hasSelectedLevel: true,
        isSelected: true,
        index: 1,
        selectedIndex: 1,
        nodeVisible: false,
      }),
    ).toEqual({ visible: false, shadowOnly: false })
  })
})

describe('continuous explode (AppFront)', () => {
  test('amount is clamped to 0..1', () => {
    useLevelExplode.getState().setAmount(3)
    expect(useLevelExplode.getState().amount).toBe(1)
    useLevelExplode.getState().setAmount(-1)
    expect(useLevelExplode.getState().amount).toBe(0)
    useLevelExplode.getState().setAmount(1)
  })

  test('labels show only once levels are far enough apart', () => {
    expect(isLevelLabelVisible('exploded', LEVEL_LABEL_MIN_EXPLODE)).toBe(true)
    expect(isLevelLabelVisible('exploded', LEVEL_LABEL_MIN_EXPLODE - 0.01)).toBe(false)
    expect(isLevelLabelVisible('stacked', 1)).toBe(false)
  })

  test('misalignment flags consecutive levels whose walls are offset', () => {
    const level = (id: string, n: number) => ({ id, type: 'level', level: n })
    const wall = (id: string, parentId: string, dx: number) => ({
      id,
      type: 'wall',
      parentId,
      start: [dx, 0],
      end: [dx + 4, 0],
    })
    const nodes = {
      l0: level('l0', 0),
      l1: level('l1', 1),
      l2: level('l2', 2),
      w0: wall('w0', 'l0', 0),
      w1: wall('w1', 'l1', 0.1),
      w2: wall('w2', 'l2', 2),
    }
    const found = findLevelMisalignments(nodes)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ lowerLevelId: 'l1', upperLevelId: 'l2' })
    expect(found[0]!.offsetM).toBeCloseTo(1.9)
  })
})
