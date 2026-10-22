/**
 * Plugin gom luật editor-realism: mỗi luật trong `scripts/realism/*.mjs` khớp đúng số lần trên tệp
 * vendor thật (sau `pascal-render`), neo mất thì ném lỗi, tệp không được dựng tới thì lượt dựng hỏng.
 * Chạy bằng `node --test` hoặc vitest (như pascal-render.test.mjs).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { pascalRealism, REALISM_RULES, transformRealism } from '../pascal-realism.mjs';
import { RENDER_RULES, transformRender } from '../pascal-render.mjs';

const { describe, it } = globalThis.describe ? globalThis : await import('node:test');
const PACKAGES = path.resolve('vendor/pascal/packages');
const ID = '/x/vendor/pascal/packages/viewer/src/a.ts';
const rule = (pairs) => [{ source: 'r9-test.mjs', file: 'viewer/src/a.ts', pairs }];

describe('pascal-realism', () => {
  for (const file of new Set(REALISM_RULES.map((r) => r.file))) {
    it(`luật áp được trên ${file} (sau pascal-render)`, () => {
      const id = path.join(PACKAGES, file);
      const raw = readFileSync(id, 'utf8');
      const code = RENDER_RULES[file] ? transformRender(raw, id) : raw;
      const out = transformRealism(code, id);
      assert.notEqual(out, code);
    });
  }

  it('thay đúng số lần, ném lỗi kèm tên file luật khi sai số lần', () => {
    assert.equal(transformRealism('a b a', ID, rule([['a', 'c', 2]])), 'c b c');
    assert.equal(transformRealism('a b', ID, rule([['a', 'c']])), 'c b');
    assert.throws(() => transformRealism('a b a', ID, rule([['a', 'c']])), /gặp 2 lần \(cần 1\).*r9-test\.mjs/);
    assert.throws(() => transformRealism('b', ID, rule([['a', 'c']])), /gặp 0 lần/);
  });

  it('tệp ngoài bảng → null; CRLF giữ CRLF', () => {
    assert.equal(transformRealism('a', '/x/packages/viewer/src/b.ts', rule([['a', 'c']])), null);
    assert.equal(transformRealism('x\r\ny', ID, rule([['x\ny', 'x\nz']])), 'x\r\nz');
  });

  it('buildEnd ném lỗi khi tệp trong bảng không được dựng tới', () => {
    const plugin = pascalRealism({ rules: rule([['a', 'c']]) });
    assert.throws(() => plugin.buildEnd(), /không được dựng tới: viewer\/src\/a\.ts/);
    assert.deepEqual(plugin.transform('a', ID), { code: 'c', map: null });
    plugin.buildEnd();
  });
});
