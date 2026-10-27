/** Plugin vá lớp UI: neo còn trong vendor, mất neo thì dựng hỏng, không đụng tệp khác. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { applyUiPatches, pascalUiPatch, UI_PATCHES } from '../pascal-ui-patch.mjs';

const PACKAGES = path.resolve('vendor/pascal/packages');

describe('pascal-ui-patch', () => {
  it.each(Object.entries(UI_PATCHES))('mọi neo còn đúng số lần trong %s', (file, pairs) => {
    const out = applyUiPatches(readFileSync(path.join(PACKAGES, file), 'utf8'), file, pairs);
    for (const [from, to] of pairs) {
      expect(out).toContain(to);
      // Vá chỉ-thêm-thuộc tính giữ nguyên neo trong kết quả; còn lại neo phải biến mất.
      if (!to.includes(from)) expect(out).not.toContain(from);
    }
  });

  it('nút chèn tầng ra cột riêng bên trái, không còn neo giữa ô (Codex P2)', () => {
    const file = 'editor/src/components/ui/floating-level-selector.tsx';
    const out = applyUiPatches(readFileSync(path.join(PACKAGES, file), 'utf8'), file, UI_PATCHES[file]);
    expect(out).toContain("data-level-gutter={reversedLevels.length > 1 ? '' : undefined}");
    expect(out).toMatch(/data-level-insert="" onClick=\{\(\) => handleInsertBetween\(/);
    // Nút thêm trên/dưới (ở mép ô) không bị dời vào cột.
    expect(out.match(/data-level-insert=""/g)).toHaveLength(1);
  });

  it('ném lỗi khi thiếu neo hoặc sai số lần', () => {
    expect(() => applyUiPatches('<b/>', 'x.tsx', [['bg-neutral-100', 'bg-background', 1]])).toThrow(/0 lần/);
    expect(() => applyUiPatches('bg-neutral-100 bg-neutral-100', 'x.tsx', [['bg-neutral-100', 'bg-background', 1]])).toThrow(/2 lần/);
  });

  it('chỉ đổi tệp trong bảng và báo tệp không được dựng tới', () => {
    const plugin = pascalUiPatch({ packagesDir: PACKAGES, patches: { 'a/b.tsx': [['x', 'y', 1]] } });
    expect(plugin.transform('x', path.join(PACKAGES, 'a/c.tsx'))).toBeNull();
    expect(() => plugin.buildEnd()).toThrow(/a\/b\.tsx/);
    expect(plugin.transform('x', path.join(PACKAGES, 'a/b.tsx') + '?v=1').code).toBe('y');
    expect(() => plugin.buildEnd()).not.toThrow();
  });
});
