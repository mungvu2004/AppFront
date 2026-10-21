/**
 * Plugin dịch Pascal lúc dựng: mọi chuỗi gốc trong bảng phải còn trong vendor, và
 * chuỗi gốc mất thì lượt dựng phải hỏng (không lặng lẽ để lại tiếng Anh).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { applyTable, pascalVi, PASCAL_VI_TABLES } from '../pascal-vi.mjs';
import { ITEM_NAME_VI, MATERIAL_LABEL_VI } from '../pascal-vi/materials-ui.mjs';

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
  it('mọi tên vật liệu (129) và mọi tên đồ đạc catalog (111) đều có bản dịch', () => {
    const labels = [...readFileSync(path.join(PACKAGES, 'core/src/material-library.ts'), 'utf8').matchAll(/^ {4}label: '([^']+)',/gm)].map((m) => m[1]);
    expect(labels).toHaveLength(129);
    expect(labels.filter((l) => !(l in MATERIAL_LABEL_VI))).toEqual([]);
    const names = [...readFileSync(path.join(PACKAGES, 'editor/src/components/ui/item-catalog/catalog-items.tsx'), 'utf8').matchAll(/name: '([^']+)'/g)].map((m) => m[1]);
    expect(names).toHaveLength(111);
    expect(names.filter((n) => !(n in ITEM_NAME_VI))).toEqual([]);
  });

  it('tiêu đề mục và nhãn nút tra bảng Việt, chữ lạ vẫn hiện bản gốc', () => {
    const file = 'editor/src/components/ui/controls/panel-section.tsx';
    const out = applyTable(readFileSync(path.join(PACKAGES, file), 'utf8'), file, PASCAL_VI_TABLES[file]);
    expect(out).toContain('{PANEL_TITLE_VI[title] ?? title}');
    expect(out).toMatch(/const PANEL_TITLE_VI: Record<string, string> = \{[^\n]*"Position":"Vị trí"/);
    const picker = 'editor/src/components/ui/controls/material-picker.tsx';
    const pickerOut = applyTable(readFileSync(path.join(PACKAGES, picker), 'utf8'), picker, PASCAL_VI_TABLES[picker]);
    expect(pickerOut).toContain('return CATEGORY_VI[category] ?? ');
    expect(pickerOut).toContain('"fabric":"Vải"');
  });

  it('L11: bấm lại biểu tượng rail đang mở không thu gọn thanh bên', () => {
    const file = 'editor/src/components/editor/editor-layout-v2.tsx';
    const src = readFileSync(path.join(PACKAGES, file), 'utf8');
    const out = applyTable(src, file, PASCAL_VI_TABLES[file]).replaceAll('\r\n', '\n');
    expect(out).toContain('      if (id === activePanel) return\n');
    expect(out).not.toMatch(/id === activePanel\) \{\n\s+setIsCollapsed\(true\)/);
    // Bỏ đúng một lời gọi; các lời gọi khác (kéo thu gọn) giữ nguyên.
    const calls = (s) => s.split('setIsCollapsed(true)').length - 1;
    expect(calls(out)).toBe(calls(src.replaceAll('\r\n', '\n')) - 1);
  });
});
