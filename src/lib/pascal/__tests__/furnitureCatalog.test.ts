import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APPFRONT_MODELS, CATALOG_MODELS, VARIANT_MODEL, VENDOR_MODELS, modelSrcOf, thumbnailOf } from '../furnitureCatalog';
import { itemSlotsOf, lampInteractiveOf } from '../sceneDressing';

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
      const ok = ['public/pascal/items', 'vendor/pascal/assets/items', 'assets/appfront-items'].some((d) =>
        existsSync(resolve(ROOT, d, f, 'model.glb')),
      );
      expect(ok, `thiếu model.glb cho ${f}`).toBe(true);
    }
  });

  it('mọi dòng VENDOR_MODELS khớp catalog-items.tsx; CATALOG_MODELS = vendor + AppFront, không trùng', () => {
    expect(Object.keys(CATALOG_MODELS).sort()).toEqual([...Object.keys(VENDOR_MODELS), ...Object.keys(APPFRONT_MODELS)].sort());
    for (const f of Object.keys(APPFRONT_MODELS)) expect(VENDOR_MODELS[f], f).toBeUndefined();
    for (const [f, row] of Object.entries(VENDOR_MODELS)) {
      expect(row.folder).toBe(f);
      expect(row.dimensions, f).toEqual(catalogField(f, 'dimensions'));
      expect(row.offset, f).toEqual(catalogField(f, 'offset'));
      expect(row.rotation, f).toEqual(catalogField(f, 'rotation'));
      expect(row.scale ?? [1, 1, 1], f).toEqual(catalogField(f, 'scale') ?? [1, 1, 1]);
      expect(row.attachTo, f).toEqual(catalogField(f, 'attachTo'));
      expect(row.interactive, f).toEqual(catalogField(f, 'interactive'));
    }
  });

  it('C1: variant trước đây null/sai nay có mô hình hợp (không còn null nào)', () => {
    // D: đèn tường / bình gốm / ghế đôn nay là mẫu AppFront thật.
    expect(VARIANT_MODEL.sconce).toEqual({ folder: 'wall-sconce', liftMm: 1800 });
    expect(VARIANT_MODEL.vase).toEqual({ folder: 'ceramic-vase' });
    expect(VARIANT_MODEL.planter).toEqual({ folder: 'bush' });
    expect(VARIANT_MODEL.bamboo).toEqual({ folder: 'indoor-plant' });
    expect(VARIANT_MODEL.bench).toEqual({ folder: 'ottoman' });
    expect(Object.values(VARIANT_MODEL)).not.toContain(null);
    for (const f of ['cactus', 'books', 'tv-stand', 'lounge-chair', 'shelf']) expect(CATALOG_MODELS[f], f).toBeDefined();
  });

  it('dòng AppFront (D): model.glb + thumbnail.webp ở assets/appfront-items, có giấy phép, cỡ hợp lý, offset/rotation 0', () => {
    const licenses = readFileSync(resolve(ROOT, 'assets/appfront-items/LICENSES.md'), 'utf8');
    for (const [f, row] of Object.entries(APPFRONT_MODELS)) {
      expect(row.folder).toBe(f);
      for (const file of ['model.glb', 'thumbnail.webp'])
        expect(existsSync(resolve(ROOT, 'assets/appfront-items', f, file)), `${f}/${file}`).toBe(true);
      expect(licenses, f).toContain(f);
      expect(row.dimensions.every((v) => v > 0.01 && v <= 2.5), f).toBe(true);
      expect(row.offset).toEqual([0, 0, 0]);
      expect(row.rotation).toEqual([0, 0, 0]);
    }
    expect(CATALOG_MODELS['wall-sconce']?.attachTo).toBe('wall-side');
    // Đèn tường phát sáng: lampInteractiveOf đọc khối interactive của dòng AppFront, bật sẵn.
    const lamp = lampInteractiveOf('wall-sconce') as { controls: { kind: string; default?: unknown }[]; effects: { kind: string }[] };
    expect(lamp.controls.find((c) => c.kind === 'toggle')?.default).toBe(true);
    expect(lamp.effects.map((e) => e.kind)).toEqual(['light']);
    expect(CATALOG_MODELS['fancy-picture-frame']?.attachTo).toBe('wall-side');
  });

  it('modelSrcOf / thumbnailOf', () => {
    expect(modelSrcOf('sofa')).toBe('/items/sofa/model.glb');
    expect(thumbnailOf('sofa')).toBe('/items/sofa/thumbnail.webp');
  });

  it('mọi khe đè vật liệu (itemSlotsOf) có thật trong GLB của mô hình (slot_<khe>)', () => {
    for (const folder of Object.keys(CATALOG_MODELS)) {
      const slots = itemSlotsOf(folder);
      if (slots === undefined) continue;
      const dir = folder in APPFRONT_MODELS ? 'assets/appfront-items' : 'vendor/pascal/assets/items';
      const glb = readFileSync(resolve(ROOT, dir, folder, 'model.glb'));
      const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as { materials?: { name?: string }[] };
      const names = new Set((json.materials ?? []).map((m) => m.name));
      for (const slot of Object.keys(slots)) expect(names.has(`slot_${slot}`), `${folder} slot_${slot}`).toBe(true);
    }
  });
});
