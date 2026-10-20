/**
 * Mọi vật liệu cảnh trỏ tới phải dựng được mà không gọi tệp nào bị thiếu (T21).
 *
 * Repo Pascal chỉ commit một phần `.ktx2` của thư viện vật liệu; tham chiếu tới cái
 * thiếu là 404 im lặng (máy chủ dev trả `index.html` mã 200) và mặt ra không vân.
 * Đọc thẳng nguồn đã commit (`vendor/pascal/assets`) để bài không cần `pnpm pascal`.
 * Riêng 14 id `WEBP_MATERIAL_IDS` dùng `.webp` tự dựng (`pascal-material-local.mjs`): có
 * `public/pascal/material` (đã `pnpm pascal`) thì tệp webp phải có ở đó.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SpatialGraphDocumentSchema } from '@/api/schemas/spatialGraph';

import { fixtureF1, fixtureF2, fixtureF5 } from '../__fixtures__';
import { CATALOG_MODELS } from '../furnitureCatalog';
import { itemSlotsOf, SCENE_MATERIALS } from '../sceneDressing';
import { toPascalScene } from '../toPascal';

const ROOT = resolve(__dirname, '../../../..');
const ASSETS = resolve(ROOT, 'vendor/pascal/assets');
const PUBLIC_MATERIAL = resolve(ROOT, 'public/pascal/material');

// Đường dẫn không phải chuỗi cố định: tsc không đòi tệp khai kiểu cho `.mjs`.
const WEBP_MANIFEST = resolve(ROOT, 'scripts/pascal-material-webp.mjs');
const { WEBP_MATERIAL_IDS, webpPathOf } = (await import(/* @vite-ignore */ WEBP_MANIFEST)) as {
  WEBP_MATERIAL_IDS: readonly string[];
  webpPathOf: (ktx2Path: string) => string;
};
const WEBP_IDS = new Set(WEBP_MATERIAL_IDS);

/** id thư viện → các tệp map, đọc từ `material-library.ts` như `copy-pascal-assets.mjs`. */
const LIBRARY_MAPS = new Map(
  readFileSync(resolve(ROOT, 'vendor/pascal/packages/core/src/material-library.ts'), 'utf8')
    .split(/\n {4}id: '/u)
    .slice(1)
    .map((block): [string, string[]] => {
      const end = block.indexOf('\n  },\n  {');
      const body = end < 0 ? block : block.slice(0, end);
      return [block.slice(0, block.indexOf("'")), [...body.matchAll(/'\/material\/([^']+\.ktx2)'/gu)].map((m) => m[1]!)];
    }),
);
const SCENE_IDS = new Set<string>(SCENE_MATERIALS.map((material) => material.id));

/** Lý do tham chiếu này gọi tệp thiếu, hoặc `null` nếu dựng được. */
const problemOf = (ref: string): string | null => {
  if (ref.startsWith('#')) return null;
  if (ref.startsWith('scene:')) return SCENE_IDS.has(ref.slice(6)) ? null : 'không có trong SCENE_MATERIALS';
  if (!ref.startsWith('library:')) return 'không phải scene:/library:';
  const id = ref.slice(8);
  const maps = LIBRARY_MAPS.get(id);
  if (maps === undefined) return 'không có trong thư viện';
  const missing = WEBP_IDS.has(id)
    ? maps.map(webpPathOf).filter((rel) => existsSync(PUBLIC_MATERIAL) && !existsSync(resolve(PUBLIC_MATERIAL, rel)))
    : maps.filter((rel) => !existsSync(resolve(ASSETS, 'material', rel)));
  return missing.length === 0 ? null : `thiếu ${missing.join(', ')}`;
};

/** Khe `slot_*` của GLB → `extras.pascal_material` (tên khe như `deriveSlotId`). */
const glbSlotRefs = (folder: string): Record<string, string> => {
  const buf = readFileSync(resolve(ASSETS, 'items', folder, 'model.glb'));
  const json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8')) as {
    materials?: { name?: string; extras?: { pascal_material?: string } }[];
  };
  const refs: Record<string, string> = {};
  for (const m of json.materials ?? []) {
    const raw = m.extras?.pascal_material;
    if (raw === undefined || !/^slot_/iu.test(m.name ?? '')) continue;
    const slotId = m.name!.slice(5).replace(/\.\d+$/u, '').toLowerCase();
    refs[slotId] = raw.startsWith('library:') || raw.startsWith('scene:') ? raw : `library:${raw}`;
  }
  return refs;
};

describe('vật liệu chỉ trỏ tới tệp có thật (T21)', () => {
  it('bảng thư viện đọc được và có cả vật liệu đủ tệp lẫn thiếu tệp', () => {
    expect(problemOf('library:concrete-polished')).toBeNull();
    expect(problemOf('library:flooring-ground13')).toMatch(/thiếu/u);
    expect(problemOf('library:wood-woodplank48')).toBeNull();
    // Bộ đọc GLB thấy khe thật — không thì hai bài dưới xanh vì không quét gì.
    expect(glbSlotRefs('bookshelf')).toMatchObject({ body: 'library:wood-finewood27' });
  });

  it('mọi mô hình trong bảng: khe nào trỏ vật liệu thiếu tệp đều bị itemSlotsOf đè', () => {
    const bad: string[] = [];
    for (const folder of Object.keys(CATALOG_MODELS)) {
      const slots = { ...glbSlotRefs(folder), ...itemSlotsOf(folder) };
      for (const [slotId, ref] of Object.entries(slots)) {
        const problem = problemOf(ref);
        if (problem !== null) bad.push(`${folder}.${slotId} = ${ref}: ${problem}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it.each([
    ['F1-ext', fixtureF1({ ext: true })],
    ['F2', fixtureF2()],
    ['F5', fixtureF5()],
  ])('%s: mọi khe của mọi node phát ra dựng được', (_name, fixture) => {
    const { scene } = toPascalScene(SpatialGraphDocumentSchema.parse(fixture.doc).graph);
    const bad: string[] = [];
    let items = 0;
    for (const node of Object.values(scene.nodes)) {
      const own = 'slots' in node ? node.slots : undefined;
      const folder = node.type === 'item' ? /^\/items\/([^/]+)\/model\.glb$/u.exec(node.asset.src)?.[1] : undefined;
      if (folder !== undefined) items += 1;
      const slots = { ...(folder === undefined ? {} : glbSlotRefs(folder)), ...own };
      for (const [slotId, ref] of Object.entries(slots)) {
        const problem = problemOf(ref);
        if (problem !== null) bad.push(`${node.id}.${slotId} = ${ref}: ${problem}`);
      }
    }
    expect(items).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });
});
