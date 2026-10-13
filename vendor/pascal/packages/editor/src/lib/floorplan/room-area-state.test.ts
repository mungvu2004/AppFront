import { describe, expect, test } from 'bun:test'
import { type RoomAreaStateInput, roomAreaStateOf } from './room-area-state'

const base: RoomAreaStateInput = {
  sceneLoaded: true,
  rowCount: 3,
  issueCount: 0,
  readOnly: false,
  collapsed: false,
}

describe('roomAreaStateOf — seven states', () => {
  test('each state is reachable', () => {
    expect(roomAreaStateOf({ ...base, sceneLoaded: false })).toBe('loading')
    expect(roomAreaStateOf({ ...base, rowCount: 0 })).toBe('empty')
    expect(roomAreaStateOf({ ...base, rowCount: 0, issueCount: 2 })).toBe('error')
    expect(roomAreaStateOf({ ...base, issueCount: 1 })).toBe('partial')
    expect(roomAreaStateOf({ ...base, readOnly: true })).toBe('forbidden')
    expect(roomAreaStateOf({ ...base, collapsed: true })).toBe('collapsed')
    expect(roomAreaStateOf(base)).toBe('success')
  })

  test('loading wins over everything else', () => {
    expect(roomAreaStateOf({ ...base, sceneLoaded: false, readOnly: true, rowCount: 0 })).toBe(
      'loading',
    )
  })
})
