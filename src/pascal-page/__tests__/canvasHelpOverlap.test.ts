import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

// HIG: panel-wrapper và contextual-helper-panel cùng right-4 — chọn vật thì bảng thuộc tính che bảng trợ giúp.
describe('canvas-help: bảng trợ giúp né bảng thuộc tính', () => {
  const src = read('../upstream/components/canvas-help.tsx');

  it('có luật đẩy bảng trợ giúp sang trái ≥ 340px khi có bảng thuộc tính, và ẩn ở màn hẹp', () => {
    expect(src).toContain("const PROPERTIES_PANEL = 'div.fixed.top-20.right-4.z-50'");
    expect(src).toContain('html:has(${PROPERTIES_PANEL}) ${SHORTCUT_PANEL} { right: calc(1rem + 352px) !important; }');
    expect(src).toMatch(/@media \(max-width: 1279px\) \{ html:has\(\$\{PROPERTIES_PANEL\}\) \$\{SHORTCUT_PANEL\} \{ display: none !important; \} \}/);
  });

  it('bộ chọn khớp class thật của panel-wrapper', () => {
    const vendor = read('../../../vendor/pascal/packages/editor/src/components/ui/panels/panel-wrapper.tsx');
    const classes = /'pointer-events-auto fixed top-20 right-4 z-50 [^']*'/.exec(vendor)?.[0].split(/\s+/) ?? [];
    for (const c of ['fixed', 'top-20', 'right-4', 'z-50']) expect(classes).toContain(c);
  });
});
