/**
 * Plugin chất lượng dựng hình: mỗi luật khớp đúng một lần trên tệp vendor thật, chỉ đổi
 * đúng chỗ đó, và chuỗi gốc mất thì lượt dựng phải hỏng.
 *
 * Chạy được bằng cả `node --test` (thẻ U06) lẫn vitest (thư mục này nằm trong bộ vitest,
 * `globals: true`): có `describe` toàn cục thì là vitest, không thì lấy của `node:test`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { pascalRender, RENDER_RULES, transformRender } from '../pascal-render.mjs';

const { describe, it } = globalThis.describe ? globalThis : await import('node:test');
const PACKAGES = path.resolve('vendor/pascal/packages');

describe('pascal-render', () => {
  for (const [file, pairs] of Object.entries(RENDER_RULES)) {
    it(`áp luật đúng một lần trên ${file}`, () => {
      const id = path.join(PACKAGES, file);
      const code = readFileSync(id, 'utf8');
      // Bản checkout Windows là CRLF; luật viết theo `\n` nên so trên bản đã chuẩn hoá.
      const crlf = (s) => (code.includes('\r\n') ? s.replaceAll('\n', '\r\n') : s);
      const out = transformRender(code, id);
      let back = out;
      for (const [from, to] of pairs.map((p) => p.map(crlf))) {
        assert.equal(out.split(to).length - 1, 1, `thiếu ${to}`);
        back = back.replace(to, from);
      }
      assert.equal(back, code, 'ngoài các chỗ thay, tệp phải giữ nguyên');
    });
  }

  it('ném lỗi kèm tên tệp khi chuỗi gốc không còn hoặc lặp', () => {
    const id = path.join(PACKAGES, 'viewer/src/components/viewer/scene-environment.tsx');
    assert.throws(() => transformRender('const X = 1', id), /scene-environment\.tsx/);
    assert.throws(() => transformRender('const ENV_INTENSITY_DARK = 0.2\nconst ENV_INTENSITY_DARK = 0.2', id), /2 lần/);
  });

  it('giữ CRLF', () => {
    const id = path.join(PACKAGES, 'editor/src/components/editor/index.tsx');
    const code = '      selectionManager="default"\r\n    >\r\n      <ExportManager />\r\n';
    assert.equal(transformRender(code, id), '      selectionManager="default"\r\n    >\r\n      <SceneEnvironment />\r\n      <ExportManager />\r\n');
  });

  it('bỏ qua tệp ngoài bảng và báo tệp trong bảng không được dựng tới', () => {
    const plugin = pascalRender();
    assert.equal(plugin.transform('x', path.join(PACKAGES, 'a/b.tsx')), null);
    assert.throws(() => plugin.buildEnd(), /site-boundary\.ts/);
    for (const file of Object.keys(RENDER_RULES)) {
      const id = path.join(PACKAGES, file);
      plugin.transform(readFileSync(id, 'utf8'), `${id}?v=1`);
    }
    assert.doesNotThrow(() => plugin.buildEnd());
  });
});
