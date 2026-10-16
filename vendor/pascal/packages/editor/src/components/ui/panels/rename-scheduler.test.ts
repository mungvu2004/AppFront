import { describe, expect, test } from 'bun:test'
import { createRenameScheduler } from './rename-scheduler'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('createRenameScheduler', () => {
  test('runs the last scheduled rename after the delay', async () => {
    const s = createRenameScheduler(10)
    const seen: string[] = []
    s.schedule(() => seen.push('a'))
    s.schedule(() => seen.push('ab'))
    await wait(30)
    expect(seen).toEqual(['ab'])
  })

  test('cancel (Esc / Hoàn tác) drops the pending rename', async () => {
    const s = createRenameScheduler(10)
    const seen: string[] = []
    s.schedule(() => seen.push('WC2'))
    s.cancel()
    await wait(30)
    expect(seen).toEqual([])
  })
})
