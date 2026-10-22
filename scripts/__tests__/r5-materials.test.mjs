const { it: test } = globalThis.describe ? globalThis : await import('node:test');
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import ts from 'typescript';

import { LIBRARY_FILE } from '../pascal-material-webp.mjs';
import { rewriteMaterialLibrary } from '../pascal-material-local.mjs';
import { ANCHOR, R5_MATERIALS, ROLES, applyR5, mapPath, sourceOf, thumbPath } from '../realism/r5-materials.mjs';

const library = readFileSync(LIBRARY_FILE, 'utf8');
const ids = (code) => [...code.matchAll(/\n {4}id: '([^']+)'/g)].map((m) => m[1]);

test('chèn đúng 5 mục mới vào cuối MATERIAL_CATALOG, mục cũ giữ nguyên thứ tự', () => {
  const out = applyR5(library);
  const before = ids(library.replaceAll('\r\n', '\n'));
  assert.deepEqual(ids(out), [...before, ...R5_MATERIALS.map((m) => m.id)]);
  const { diagnostics } = ts.transpileModule(out, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022 } });
  assert.equal(diagnostics.length, 0, diagnostics.map((d) => d.messageText).join('\n'));
});

test('repeat = 1/cạnh thật (m), đủ 4 map webp + ảnh xem trước có /pascal', () => {
  const out = applyR5(library);
  for (const m of R5_MATERIALS) {
    const block = out.slice(out.indexOf(`id: '${m.id}',`));
    assert.match(block, new RegExp(`repeatX: ${String(Math.round(1000 / m.sizeM) / 1000)},`));
    for (const role of Object.keys(ROLES)) assert.ok(block.includes(`'${mapPath(m.id, role)}'`), `${m.id} ${role}`);
    assert.ok(block.includes(`previewThumbnailUrl: '${thumbPath(m.id)}'`));
    assert.doesNotMatch(block.slice(0, block.indexOf('\n  },')), /DoubleSide|side: 2/);
  }
});

test('ảnh nguồn có đủ, mỗi tệp ≤ 2 MB', () => {
  for (const m of R5_MATERIALS) {
    for (const role of Object.keys(ROLES)) {
      const file = sourceOf(m.id, role);
      assert.ok(existsSync(file), file);
      assert.ok(readFileSync(file).length <= 2 * 1024 * 1024, file);
    }
  }
});

test('pascal-material-local không ném lỗi trên thư viện đã chèn (trước hay sau đều được)', () => {
  const after = rewriteMaterialLibrary(applyR5(library));
  assert.equal(after, applyR5(rewriteMaterialLibrary(library)));
  for (const m of R5_MATERIALS) assert.ok(after.includes(`previewThumbnailUrl: '${thumbPath(m.id)}'`), 'không bị thêm /pascal lần hai');
});

test('giữ kiểu xuống dòng của tệp gốc', () => {
  const lf = library.replaceAll('\r\n', '\n');
  assert.ok(!applyR5(lf).includes('\r'));
  assert.equal(applyR5(lf.replaceAll('\n', '\r\n')), applyR5(lf).replaceAll('\n', '\r\n'));
});

test('neo mất hoặc id trùng → ném lỗi', () => {
  assert.throws(() => applyR5(library.replaceAll('\r\n', '\n').replace(ANCHOR, '\n]\n')), /neo/);
  assert.throws(() => applyR5(applyR5(library)), /đã có/);
});
