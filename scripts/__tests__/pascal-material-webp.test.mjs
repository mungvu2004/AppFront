import { test } from 'vitest';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { WEBP_MATERIAL_IDS, sourceFor, webpPathOf } from '../pascal-material-webp.mjs';

const LIB = new URL('../../vendor/pascal/packages/core/src/material-library.ts', import.meta.url);

test('14 id cố định', () => {
  assert.equal(WEBP_MATERIAL_IDS.length, 14);
  assert.equal(new Set(WEBP_MATERIAL_IDS).size, 14);
});

test('webpPathOf chỉ nhận _512.ktx2', () => {
  assert.equal(webpPathOf('/material/a/b_normal_512.ktx2'), '/material/a/b_normal_512.webp');
  assert.throws(() => webpPathOf('/material/a/b.webp'));
  assert.throws(() => webpPathOf('/material/a/b_256.ktx2'));
});

test('sourceFor ném lỗi rõ khi thiếu', () => {
  assert.throws(() => sourceFor('/material/nope/x_basecolor_512.ktx2'), /thiếu thư mục/);
  assert.throws(() => sourceFor('/material/wood/woodplank_48/x_height_512.ktx2'), /vai trò/);
});

test('sourceFor tìm được ảnh gốc cho mọi map của 14 id trong material-library.ts thật', () => {
  const src = readFileSync(LIB, 'utf8');
  for (const id of WEBP_MATERIAL_IDS) {
    const at = src.indexOf(`id: '${id}'`);
    assert.ok(at >= 0, `thiếu ${id}`);
    const block = src.slice(at, src.indexOf('mapProperties', at));
    const maps = [...block.matchAll(/'([^']+_512\.ktx2)'/g)].map((m) => m[1]);
    assert.ok(maps.length > 0, `${id} không có map ktx2`);
    const seen = new Set();
    for (const m of maps) {
      const s = sourceFor(m);
      assert.ok(existsSync(s), s);
      assert.ok(!seen.has(s), `${id}: hai map trùng ảnh gốc ${s}`);
      seen.add(s);
    }
  }
});
