import { describe, expect, it } from 'vitest';

import viMessages from './vi.json';

interface Pair {
  readonly path: string;
  readonly title: string;
  readonly description: string;
}

function collectPairs(node: unknown, path: string, out: Pair[]): Pair[] {
  if (node !== null && typeof node === 'object') {
    const { title, description } = node as Record<string, unknown>;
    if (typeof title === 'string' && typeof description === 'string') {
      out.push({ path, title, description });
    }
    for (const [key, value] of Object.entries(node)) {
      collectPairs(value, path === '' ? key : `${path}.${key}`, out);
    }
  }
  return out;
}

/**
 * Màn nào dựng `title` + `description` cùng nhánh (EmptyState, InlineAlert…) thì câu thân
 * chép lại tiêu đề đọc thành "Mất kết nối / Mất kết nối máy chủ…" (BUG-021).
 */
describe('vi.json — tiêu đề và câu thân', () => {
  it('không câu thân nào chứa nguyên tiêu đề cùng nhánh', () => {
    const pairs = collectPairs(viMessages, '', []);
    const offenders = pairs
      .filter(({ title, description }) => description.toLocaleLowerCase('vi').includes(title.toLocaleLowerCase('vi')))
      .map(({ path, title, description }) => `${path}: "${title}" / "${description}"`);

    expect(pairs.length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });
});
