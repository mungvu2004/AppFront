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
import { partitionSkirtingData, RULES as R9V_RULES } from '../realism/r9v-partition-skirt.mjs';

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

describe('r9v-partition-skirt: vach giua hai phong bo phao ngoai, gop vao lo cap nhat mat tuong', () => {
  const skirting = { enabled: true, sides: 'both', height: 0.1, exterior: { height: 0.25, proud: 0.02, profile: 'flat' } };

  it('hai mat trong phong -> bo exterior, sides interior; con lai giu nguyen', () => {
    assert.deepEqual(partitionSkirtingData(skirting, true, true), { skirting: { enabled: true, sides: 'interior', height: 0.1 } });
    assert.equal(partitionSkirtingData(skirting, true, false), null);
    assert.equal(partitionSkirtingData(skirting, false, false), null);
    assert.equal(partitionSkirtingData({ ...skirting, exterior: undefined }, true, true), null);
    assert.equal(partitionSkirtingData(undefined, true, true), null);
  });

  it('khop space-detection.ts cua vendor, khong them updateNodes rieng', () => {
    const id = 'core/src/lib/space-detection.ts';
    const code = readFileSync(path.join(PACKAGES, id), 'utf8');
    const out = transformRealism(code, path.join(PACKAGES, id), [{ source: 'r9v-partition-skirt.mjs', file: id, pairs: R9V_RULES[id] }]);
    assert.equal((out.match(/withPartitionSkirting\(/g) ?? []).length, 3);
    assert.equal((out.match(/updateNodes\(wallBatch\)/g) ?? []).length, 2);
  });
});
