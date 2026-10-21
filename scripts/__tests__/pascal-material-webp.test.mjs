import { test } from 'vitest';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LIBRARY_MATERIALS, WEBP_MATERIAL_IDS, sourceFor, webpPathOf } from '../pascal-material-webp.mjs';

const ASSETS = fileURLToPath(new URL('../../vendor/pascal/assets', import.meta.url));

const LIB = new URL('../../vendor/pascal/packages/core/src/material-library.ts', import.meta.url);

test('danh sách webp rút từ bản kê: mọi vật liệu có map đều dựng được (đủ ktx2 hoặc webp)', () => {
  const withMaps = LIBRARY_MATERIALS.filter(({ maps }) => maps.length > 0);
  assert.equal(LIBRARY_MATERIALS.length, 129);
  assert.equal(withMaps.length, 66);
  assert.equal(new Set(WEBP_MATERIAL_IDS).size, WEBP_MATERIAL_IDS.length);
  assert.ok(WEBP_MATERIAL_IDS.includes('flooring-terrazzo19'));
  assert.equal(WEBP_MATERIAL_IDS.length, 49);
  const webp = new Set(WEBP_MATERIAL_IDS);
  const broken = withMaps.filter(({ id, maps }) => !webp.has(id) && maps.some((m) => !existsSync(ASSETS + m)));
  assert.deepEqual(broken.map(({ id }) => id), []);
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

test('sourceFor tìm được ảnh gốc cho mọi map của mọi id webp trong material-library.ts thật', () => {
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
