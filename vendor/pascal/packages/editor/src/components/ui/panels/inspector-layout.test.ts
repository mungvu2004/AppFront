import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (file: string) => readFileSync(join(import.meta.dir, file), 'utf8')

test('panel footer stays pinned: shrink-0 outside the scrolling body', () => {
  const wrapper = read('panel-wrapper.tsx')
  expect(wrapper).toContain('no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto')
  expect(wrapper).toContain('shrink-0 border-border/50 border-t p-3')
})

test('slider value never wraps, so a long value cannot change the row height', () => {
  const slider = read('../controls/slider-control.tsx')
  expect(slider).toContain('flex min-w-0 items-center whitespace-nowrap text-xs')
  expect(slider).toContain('min-w-0 truncate font-mono tabular-nums')
})
