/**
 * Plugin dịch Pascal lúc dựng: mọi chuỗi gốc trong bảng phải còn trong vendor, và
 * chuỗi gốc mất thì lượt dựng phải hỏng (không lặng lẽ để lại tiếng Anh).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { applyTable, pascalVi, PASCAL_VI_TABLES } from '../pascal-vi.mjs';

const PACKAGES = path.resolve('vendor/pascal/packages');

describe('pascal-vi', () => {
  it.each(Object.entries(PASCAL_VI_TABLES))('mọi chuỗi gốc còn trong %s', (file, pairs) => {
    const code = readFileSync(path.join(PACKAGES, file), 'utf8');
    const out = applyTable(code, file, pairs);
    for (const [, to] of pairs) expect(out.replaceAll('\r\n', '\n')).toContain(to);
  });

  it('ném lỗi khi chuỗi gốc không còn', () => {
    expect(() => applyTable('<b>Levels</b>', 'x.tsx', [['>Floors<', '>Tầng<']])).toThrow(/không thấy chuỗi gốc/);
  });

  it('giữ CRLF', () => {
    expect(applyTable('a\r\n  Levels\r\n', 'x.tsx', [['\n  Levels\n', '\n  Tầng\n']])).toBe('a\r\n  Tầng\r\n');
  });

  it('chỉ đổi tệp có trong bảng và báo tệp không được dựng tới', () => {
    const plugin = pascalVi({ packagesDir: PACKAGES, tables: { 'a/b.tsx': [['Levels', 'Tầng']] } });
    expect(plugin.transform('Levels', path.join(PACKAGES, 'a/c.tsx'))).toBeNull();
    expect(() => plugin.buildEnd()).toThrow(/a\/b\.tsx/);
    expect(plugin.transform('Levels', path.join(PACKAGES, 'a/b.tsx') + '?v=1').code).toBe('Tầng');
    expect(() => plugin.buildEnd()).not.toThrow();
  });
});
