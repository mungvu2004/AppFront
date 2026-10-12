import { describe, expect, test } from 'bun:test'
import { vi } from './vi'

const SHORT_ALLOWED = new Set(['X', 'Y', 'Z', '2D', '3D', 'Xoay'])
const VIETNAMESE_CHARS = /[àáâãèéêìíòóôõùúăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i

function isCapitalized(value: string): boolean {
  if (SHORT_ALLOWED.has(value)) return true
  const first = value.trimStart()[0] ?? ''
  if (/[0-9]/.test(first)) return true
  return first === first.toUpperCase()
}

function looksVietnamese(value: string): boolean {
  if (SHORT_ALLOWED.has(value)) return true
  return VIETNAMESE_CHARS.test(value) || /[^\x00-\x7F]/.test(value)
}

function collectStrings(node: unknown, path: string, out: Array<[string, string]>): void {
  if (typeof node === 'string') {
    out.push([path, node])
    return
  }
  if (typeof node === 'function') return
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      collectStrings(value, path ? `${path}.${key}` : key, out)
    }
  }
}

describe('nodes i18n vi table', () => {
  const strings: Array<[string, string]> = []
  collectStrings(vi, '', strings)

  test('bảng không rỗng', () => {
    expect(strings.length).toBeGreaterThan(0)
  })

  test('mọi chuỗi không rỗng', () => {
    for (const [path, value] of strings) {
      expect(value.trim().length, `rỗng tại ${path}`).toBeGreaterThan(0)
    }
  })

  test('mọi chuỗi viết hoa chữ đầu', () => {
    for (const [path, value] of strings) {
      expect(isCapitalized(value), `không viết hoa chữ đầu tại ${path}: "${value}"`).toBe(true)
    }
  })

  test('mọi chuỗi có ký tự tiếng Việt hoặc thuộc danh sách cho phép', () => {
    for (const [path, value] of strings) {
      expect(looksVietnamese(value), `thiếu dấu tiếng Việt tại ${path}: "${value}"`).toBe(true)
    }
  })
})
