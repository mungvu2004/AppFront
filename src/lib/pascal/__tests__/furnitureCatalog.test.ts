import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOG_MODELS, VARIANT_MODEL, modelSrcOf, thumbnailOf } from '../furnitureCatalog';

const ROOT = resolve(__dirname, '../../../..');
const CATALOG_TSX = readFileSync(
  resolve(ROOT, 'vendor/pascal/packages/editor/src/components/ui/item-catalog/catalog-items.tsx'),
  'utf8',
);

// 35 variant đăng nhập (CONTRACT I1) — cứng trong test tới khi FURNITURE_VARIANTS có mặt.
const VARIANTS = (
  'bed nightstand tableLamp wardrobe rug plant shower wc basin mirror artwork shelves table chair ' +
  'baseRun upperRun hood hob sink fridge stool cabinet sofa sconce tv armchair sideTable floorLamp ' +
  'bench pendant vase lounger planter bamboo shrub'
).split(' ');

/** Đọc một trường cấp 4 của entry `folder` trong catalog-items.tsx (mảng/object/giá trị đơn). */
function catalogField(folder: string, name: string): unknown {
  const s = CATALOG_TSX.indexOf(`\n    id: '${folder}',`);
  expect(s, `catalog thiếu ${folder}`).toBeGreaterThan(-1);
  const blk = CATALOG_TSX.slice(s, CATALOG_TSX.indexOf('\n  },', s));
  const m = new RegExp(`\\n    ${name}:\\s*`).exec(blk);
  if (!m) return undefined;
  const i = m.index + m[0].length;
  let end: number;
  if (blk[i] === '{' || blk[i] === '[') {
    let depth = 0;
    end = i;
    for (; end < blk.length; end++) {
      if ('{['.includes(blk[end]!)) depth++;
      if ('}]'.includes(blk[end]!) && --depth === 0) break;
    }
    end++;
  } else end = blk.indexOf('\n', i);
  // eslint-disable-next-line no-new-func -- literal JS lấy từ catalog vendor, chỉ trong test
  return new Function(`return ${blk.slice(i, end).replace(/,\s*$/, '')}`)();
}

describe('furnitureCatalog', () => {
  it('VARIANT_MODEL có đủ 35 variant, không thừa', () => {
    expect(Object.keys(VARIANT_MODEL).sort()).toEqual([...VARIANTS].sort());
  });

  it('mọi folder được tham chiếu có dòng catalog và model.glb thật', () => {
    const used = Object.values(VARIANT_MODEL).flatMap((v) => (v ? [v.folder] : []));
    for (const f of used) expect(CATALOG_MODELS[f], f).toBeDefined();
    for (const f of Object.keys(CATALOG_MODELS)) {
      const ok = ['public/pascal/items', 'vendor/pascal/assets/items'].some((d) =>
        existsSync(resolve(ROOT, d, f, 'model.glb')),
      );
      expect(ok, `thiếu model.glb cho ${f}`).toBe(true);
    }
  });

  it('mọi dòng CATALOG_MODELS khớp catalog-items.tsx', () => {
    for (const [f, row] of Object.entries(CATALOG_MODELS)) {
      expect(row.folder).toBe(f);
      expect(row.dimensions, f).toEqual(catalogField(f, 'dimensions'));
      expect(row.offset, f).toEqual(catalogField(f, 'offset'));
      expect(row.rotation, f).toEqual(catalogField(f, 'rotation'));
      expect(row.scale ?? [1, 1, 1], f).toEqual(catalogField(f, 'scale') ?? [1, 1, 1]);
      expect(row.attachTo, f).toEqual(catalogField(f, 'attachTo'));
      expect(row.interactive, f).toEqual(catalogField(f, 'interactive'));
    }
  });

  it('modelSrcOf / thumbnailOf', () => {
    expect(modelSrcOf('sofa')).toBe('/items/sofa/model.glb');
    expect(thumbnailOf('sofa')).toBe('/items/sofa/thumbnail.webp');
  });
});
