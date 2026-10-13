import { describe, expect, test } from 'bun:test'
import { type InspectorStateInput, inspectorStateOf } from './inspector-state'

const base: InspectorStateInput = {
  readOnly: false,
  sceneLoaded: true,
  selectedCount: 1,
  missingCount: 0,
  homogeneous: true,
  collapsed: false,
}

describe('inspectorStateOf — seven states', () => {
  test('each state is reachable', () => {
    expect(inspectorStateOf({ ...base, sceneLoaded: false })).toBe('loading')
    expect(inspectorStateOf({ ...base, selectedCount: 0 })).toBe('empty')
    expect(inspectorStateOf({ ...base, readOnly: true })).toBe('forbidden')
    expect(inspectorStateOf({ ...base, missingCount: 1 })).toBe('error')
    expect(inspectorStateOf({ ...base, selectedCount: 2, homogeneous: false })).toBe('partial')
    expect(inspectorStateOf({ ...base, collapsed: true })).toBe('collapsed')
    expect(inspectorStateOf(base)).toBe('success')
  })

  test('a homogeneous multi-selection is edited, not partial', () => {
    expect(inspectorStateOf({ ...base, selectedCount: 3 })).toBe('success')
  })
})
