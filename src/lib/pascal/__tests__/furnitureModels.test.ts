/**
 * Đồ đạc dùng mô hình GLB thật (T14): chọn thư mục, khớp vào hộp bao, và — bắt
 * buộc — lượt về không đổi gì (node.scale [1,1,1], asset.id cũ, không sinh `model`).
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SpatialGraphDocumentSchema } from '@/api/schemas/spatialGraph';
import type { Furniture, RoomUsage, SpatialGraph } from '@/domain/spatial/types';
import { millimetres } from '@/domain/units/types';

import { fixtureF1, fixtureF2 } from '../__fixtures__';
import { APPFRONT_MODELS, CATALOG_MODELS, VARIANT_MODEL, VENDOR_MODELS, modelSrcOf, setRealismModels } from '../furnitureCatalog';
import { toPascalId } from '../ids';
import { isGeneratedNodeId } from '../sceneDressing';
import { SCENE_STYLES, type SceneStyle } from '../sceneStyles';
import { toPascalScene } from '../toPascal';
import { toSpatialGraph } from '../toSpatial';
import type { PascalItemNode } from '../types';

const graphOf = (doc: unknown): SpatialGraph => SpatialGraphDocumentSchema.parse(doc).graph as SpatialGraph;

const itemsOf = (graph: SpatialGraph): PascalItemNode[] =>
  Object.values(toPascalScene(graph).scene.nodes).filter((n): n is PascalItemNode => n.type === 'item' && !isGeneratedNodeId(n.id));

const metresOfMm = (mm: number): number => mm / 1000;

const ROOT = resolve(__dirname, '../../../..');
const modelExists = (src: string): boolean =>
  existsSync(resolve(ROOT, 'public/pascal', `.${src}`)) ||
  existsSync(resolve(ROOT, 'vendor/pascal/assets', `.${src}`).replace(/model\.glb$/, '')) ||
  // Mẫu AppFront không có bản Pascal (mặt bếp hob-sf).
  existsSync(resolve(ROOT, 'assets/appfront-items', `.${src.slice('/items'.length)}`));

/** F2 với danh sách đồ thay bằng `furniture` (giữ tầng + phòng của F2). */
const withFurniture = (furniture: (base: Furniture) => Furniture[]): SpatialGraph => {
  const g = graphOf(fixtureF2().doc);
  return { ...g, furniture: furniture(g.furniture[0]!) };
};

describe('đồ đạc → mô hình Pascal thật (T14)', () => {
  it('F1-ext: không món nào dùng asset://, mọi src có tệp, node.scale luôn [1,1,1]', () => {
    const items = itemsOf(graphOf(fixtureF1({ ext: true }).doc));
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.asset.src, item.id).not.toMatch(/^asset:\/\//);
      expect(modelExists(item.asset.src), item.asset.src).toBe(true);
      expect(item.scale).toEqual([1, 1, 1]);
      expect(item.asset.id).toMatch(/^appfront-/);
    }
  });

  it('F1-ext: lượt về cả nhà không sinh `model`, hộp bao/tâm/góc giữ nguyên', () => {
    const graph = graphOf(fixtureF1({ ext: true }).doc);
    const back = new Map(toSpatialGraph(toPascalScene(graph).scene).graph.furniture.map((f) => [f.id, f]));
    for (const before of graph.furniture) {
      const after = back.get(before.id)!;
      expect(after, before.id).not.toHaveProperty('model');
      expect(after.boundingBox).toEqual(before.boundingBox);
      expect(after.centre).toEqual(before.centre);
      expect(after.rotationDeg).toBe(before.rotationDeg);
    }
  });

  it('giường 2000×600 xoay 90° có variant: lượt về giữ nguyên hộp bao/góc/loại/tâm, không sinh `model`', () => {
    const graph = withFurniture((base) => [
      {
        ...base,
        kind: 'bed',
        variant: 'bed',
        rotationDeg: 90 as Furniture['rotationDeg'],
        centre: { x: 2000, y: 2000 } as Furniture['centre'],
        boundingBox: { min: { x: 1000, y: 1700 }, max: { x: 3000, y: 2300 } } as Furniture['boundingBox'],
      },
    ]);
    const [item] = itemsOf(graph);
    expect(item!.asset.src).toBe('/items/double-bed/model.glb');
    expect(item!.asset.scale).toBeDefined();

    const back = toSpatialGraph(toPascalScene(graph).scene).graph.furniture[0]!;
    const before = graph.furniture[0]!;
    expect(back).not.toHaveProperty('model');
    expect(back.boundingBox).toEqual(before.boundingBox);
    expect(back.rotationDeg).toBe(before.rotationDeg);
    expect(back.kind).toBe(before.kind);
    expect(back.centre).toEqual(before.centre);
  });

  it('gương đặt ở y = 1,2 m, lưng áp mép sau hộp bao', () => {
    const graph = withFurniture((base) => [
      {
        ...base,
        kind: 'other',
        variant: 'mirror',
        boundingBox: { min: { x: 0, y: 0 }, max: { x: 600, y: 100 } } as Furniture['boundingBox'],
        centre: { x: 300, y: 50 } as Furniture['centre'],
      },
    ]);
    const [item] = itemsOf(graph);
    expect(item!.position[1]).toBeCloseTo(1.2);
    expect(item!.asset.src).toBe('/items/round-mirror/model.glb');
    expect(item!.asset.offset![2]).toBeLessThan(0);
  });

  it('F1-ext (có heightMm) và F1 thường (không): không món nào cao quá heightMm / trần tầng / 2,2 m với cây', () => {
    for (const ext of [true, false]) {
      const graph = graphOf(fixtureF1({ ext }).doc);
      const levelH = metresOfMm(graph.levels[0]!.heightMm);
      const byId = new Map(itemsOf(graph).map((n) => [n.id, n]));
      for (const f of graph.furniture) {
        const item = byId.get(toPascalId('item', f.id))!;
        const folder = /^\/items\/([^/]+)\//.exec(item.asset.src)?.[1];
        if (folder === undefined) continue; // thang: chỗ giữ chỗ
        const cat = CATALOG_MODELS[folder]!;
        // Cao thật = cao GLB gốc × asset.scale; GLB gốc = dimensions ÷ scale riêng của catalog.
        const rendered = (cat.dimensions[1] * item.asset.scale![1]) / (cat.scale?.[1] ?? 1);
        const limit =
          // hob-sf: heightMm (20 mm) là bề dày tấm trên bản vẽ, mẫu giữ cao thật (OWN_HEIGHT_FOLDERS).
          f.heightMm === undefined || folder === 'hob-sf'
            ? folder === 'palm' || folder === 'fir-tree' ? 2.2 : levelH
            : metresOfMm(f.heightMm);
        const why = `${ext ? 'ext' : 'plain'} ${f.id} ${folder} rendered=${rendered.toFixed(2)} limit=${limit}`;
        expect(rendered, why).toBeLessThanOrEqual(limit * 1.02);
        expect(item.asset.dimensions[1], why).toBeLessThanOrEqual(limit * 1.02);
      }
    }
  });

  it('tre 500×500×2000 → cây trong nhà (không còn cây thông), không cao quá heightMm', () => {
    const [item] = itemsOf(
      withFurniture((base) => [
        {
          ...base,
          kind: 'other',
          variant: 'bamboo',
          heightMm: millimetres(2000),
          boundingBox: { min: { x: 0, y: 0 }, max: { x: 500, y: 500 } } as Furniture['boundingBox'],
          centre: { x: 250, y: 250 } as Furniture['centre'],
        },
      ]),
    );
    const folder = /^\/items\/([^/]+)\//.exec(item!.asset.src)?.[1];
    expect(['indoor-plant', 'small-indoor-plant']).toContain(folder);
    expect(CATALOG_MODELS[folder!]!.dimensions[1] * item!.asset.scale![1]).toBeLessThanOrEqual(2.0001);
  });

  it('bụi cây (catalog scale 0,96): asset.scale nhân cả scale riêng của catalog', () => {
    const graph = withFurniture((base) => [
      {
        ...base,
        kind: 'other',
        variant: 'shrub',
        heightMm: millimetres(1000),
        boundingBox: { min: { x: 0, y: 0 }, max: { x: 3000, y: 1010 } } as Furniture['boundingBox'],
        centre: { x: 1500, y: 505 } as Furniture['centre'],
      },
    ]);
    const [item] = itemsOf(graph);
    expect(item!.asset.src).toBe('/items/bush/model.glb');
    // s = min(3/3, 1,01/1,01, 1/1,04) → GLB gốc nhân s × 0,96.
    expect(item!.asset.scale![1]).toBeCloseTo((1 / 1.04) * 0.96, 4);
  });

  it('tất định: F2 dựng hai lần, và với mảng đồ đạc đảo ngược → cùng node (mọi phong cách)', () => {
    const g = graphOf(fixtureF2().doc);
    const reversed = { ...g, furniture: [...g.furniture].reverse() };
    // Thứ tự `children` theo thứ tự đồ thị — so tập hợp, còn lại so từng giá trị.
    const normalised = (graph: SpatialGraph, style: SceneStyle) =>
      Object.fromEntries(
        Object.entries(toPascalScene(graph, { style }).scene.nodes).map(([id, n]) => [
          id,
          'children' in n && Array.isArray(n.children) ? { ...n, children: [...n.children].sort() } : n,
        ]),
      );
    for (const style of Object.values(SCENE_STYLES)) {
      const first = normalised(g, style);
      expect(normalised(g, style)).toEqual(first);
      expect(normalised(reversed, style)).toEqual(first);
    }
  });

  it('máy giặt (kitchenCabinet/cabinet) ở phòng tắm/kỹ thuật → washing-machine; bếp giữ mô hình cũ', () => {
    const g = graphOf(fixtureF2().doc);
    const srcIn = (usage: RoomUsage): string => {
      const room = { ...g.rooms[0]!, usage };
      const [item] = itemsOf({
        ...g,
        rooms: [room],
        furniture: [
          {
            ...g.furniture[0]!,
            kind: 'kitchenCabinet',
            variant: 'cabinet',
            roomId: room.id,
            boundingBox: { min: { x: 0, y: 0 }, max: { x: 600, y: 600 } } as Furniture['boundingBox'],
            centre: { x: 300, y: 300 } as Furniture['centre'],
          },
        ],
      });
      return item!.asset.src;
    };
    expect(srcIn('bathroom')).toBe('/items/washing-machine/model.glb');
    expect(srcIn('utility')).toBe('/items/washing-machine/model.glb');
    expect(srcIn('kitchen')).toBe('/items/dresser/model.glb');
  });

  /** Một món ở gốc, hộp `w × d` mm, với `variant` / `heightMm` cho trước. */
  const oneItem = (variant: NonNullable<Furniture['variant']>, w: number, d: number, heightMm?: number): PascalItemNode =>
    itemsOf(
      withFurniture((base) => [
        {
          ...base,
          kind: 'other',
          variant,
          ...(heightMm === undefined ? {} : { heightMm: millimetres(heightMm) }),
          boundingBox: { min: { x: 0, y: 0 }, max: { x: w, y: d } } as Furniture['boundingBox'],
          centre: { x: w / 2, y: d / 2 } as Furniture['centre'],
        },
      ]),
    )[0]!;
  /** Mặt bằng mô hình đã khớp (m): [rộng, sâu] = catalog × asset.scale ÷ scale riêng catalog. */
  const footprintOf = (item: PascalItemNode): readonly [number, number] => {
    const folder = /^\/items\/([^/]+)\//.exec(item.asset.src)![1]!;
    const cat = CATALOG_MODELS[folder]!;
    const k = cat.scale ?? [1, 1, 1];
    return [(cat.dimensions[0] * item.asset.scale![0]) / k[0], (cat.dimensions[2] * item.asset.scale![2]) / k[2]];
  };

  it('C1 khớp theo nhóm: thảm phủ đúng mặt bằng dù heightMm 10', () => {
    const rug = oneItem('rug', 3000, 2000, 10);
    expect(rug.asset.src).toMatch(/carpet/);
    const [w, d] = footprintOf(rug);
    expect(w).toBeCloseTo(3, 3);
    expect(d).toBeCloseTo(2, 3);
    expect(rug.scale).toEqual([1, 1, 1]);
  });

  it('C1 khớp theo nhóm: tủ áo 3 × 0,6 m phủ ≥ 90% mặt bằng, cao theo heightMm', () => {
    const wardrobe = oneItem('wardrobe', 3000, 600, 2200);
    expect(wardrobe.asset.src).toBe('/items/closet/model.glb');
    const [w, d] = footprintOf(wardrobe);
    expect((w * d) / (3 * 0.6)).toBeGreaterThanOrEqual(0.9);
    expect(CATALOG_MODELS.closet!.dimensions[1] * wardrobe.asset.scale![1]).toBeCloseTo(2.2, 3);
    expect(wardrobe.asset.dimensions[1]).toBeCloseTo(2.2, 3);
  });

  it('C1 khớp theo nhóm: dãy bếp rất dài bị chặn lệch 1,8× và nằm giữa hộp', () => {
    const run = oneItem('baseRun', 5000, 600, 900);
    const [sx, , sz] = run.asset.scale!;
    expect(sx / sz).toBeCloseTo(1.8, 4);
    const [w] = footprintOf(run);
    expect(w).toBeLessThan(5);
    expect(run.position[0]).toBeCloseTo(2.5); // tâm giữ đúng centre — mô hình ngắn hơn nằm giữa
  });

  it('C1 khớp theo nhóm: đồ thường (giường) vẫn một tỉ lệ chung như cũ', () => {
    const bed = oneItem('bed', 1800, 2100, 700);
    const [sx, sy, sz] = bed.asset.scale!;
    const [cw, ch, cd] = CATALOG_MODELS['double-bed']!.dimensions;
    const s = Math.min(1.8 / cw, 2.1 / cd, 0.7 / ch);
    expect([sx, sy, sz]).toEqual([s, s, s]);
    expect(bed.asset.dimensions[1]).toBeCloseTo(0.7);
  });

  it('C1 đèn: đèn cây/bàn/trần/tường có interactive phát sáng bật sẵn; đồ khác không', () => {
    for (const variant of ['floorLamp', 'tableLamp', 'pendant', 'sconce'] as const) {
      const lamp = oneItem(variant, 500, 500);
      const interactive = lamp.asset.interactive as {
        controls: { kind: string; default?: unknown }[];
        effects: { kind: string }[];
      };
      expect(interactive, variant).toBeDefined();
      expect(interactive.effects.some((e) => e.kind === 'light'), variant).toBe(true);
      expect(interactive.controls.find((c) => c.kind === 'toggle')?.default, variant).toBe(true);
    }
    expect(oneItem('bed', 1800, 2100).asset.interactive).toBeUndefined();
  });

  it('F2 (không variant): đoán thư mục theo loại + phòng + hộp bao; thang thành node stair thật', () => {
    const expected: Record<string, string> = {
      // Bàn 900×600 của F2 nằm ở phòng khách → bàn ăn (desk chỉ ở phòng ngủ/kho/khác).
      table: '/items/dining-table/model.glb',
      chair: '/items/dining-chair/model.glb',
      bed: '/items/single-bed/model.glb',
      wardrobe: '/items/closet/model.glb',
      // FR1-F2: tủ bếp dưới có cửa + tay nắm, không còn khối hộp trơn kitchen-counter.
      kitchenCabinet: '/items/kitchen-cabinet/model.glb',
      sanitaryFixture: '/items/bathroom-sink/model.glb',
      other: '/items/indoor-plant/model.glb',
    };
    const items = itemsOf(graphOf(fixtureF2().doc));
    // 32 đồ đạc, 4 cái là thang → node `stair` thật (U13, stair.test.ts), không còn item giữ chỗ.
    expect(items).toHaveLength(28);
    for (const item of items) {
      expect(item.asset.src, item.asset.category).toBe(expected[item.asset.category]);
    }
  });

  it('B1: cờ realism bật → sofa/ghế bành/ghế ăn F1 dùng mẫu Poly Haven có tệp; tắt (mặc định) → mẫu cũ', () => {
    const srcs = () => itemsOf(graphOf(fixtureF1({ ext: false }).doc)).map((i) => i.asset.src);
    const old = srcs();
    try {
      setRealismModels(true);
      const ph = srcs().filter((s) => s.includes('-ph/'));
      expect(new Set(ph)).toEqual(new Set(['/items/sofa-ph/model.glb', '/items/armchair-ph/model.glb', '/items/dining-chair-ph/model.glb', '/items/plant-ph/model.glb', '/items/planter-ph/model.glb', '/items/bedside-table-ph/model.glb']));
      for (const s of ph) expect(existsSync(resolve(ROOT, 'assets/appfront-items', `.${s.slice('/items'.length)}`)), s).toBe(true);
      expect(modelSrcOf('rectangular-carpet')).toBe('/items/rug-nf/model.glb');
      expect(existsSync(resolve(ROOT, 'assets/appfront-items/rug-nf/model.glb'))).toBe(true);
    } finally {
      setRealismModels(false);
    }
    expect(srcs()).toEqual(old);
    expect(old.some((s) => s.includes('-ph/'))).toBe(false);
  });

  it('P1/2A: cờ realism bật → cây cao dùng plant-ph, chậu nhỏ dùng planter-ph, luống ban công (bush) dùng planter-long', () => {
    const before = CATALOG_MODELS['indoor-plant'];
    try {
      setRealismModels(true);
      expect(modelSrcOf('indoor-plant')).toBe('/items/plant-ph/model.glb');
      expect(CATALOG_MODELS['indoor-plant']?.dimensions).toEqual(APPFRONT_MODELS['plant-ph']?.dimensions);
      expect(modelSrcOf('small-indoor-plant')).toBe('/items/planter-ph/model.glb');
      expect(CATALOG_MODELS['small-indoor-plant']?.dimensions).toEqual(APPFRONT_MODELS['planter-ph']?.dimensions);
      expect(VARIANT_MODEL.planter).toEqual({ folder: 'bush' });
      expect(modelSrcOf('bush')).toBe('/items/planter-long/model.glb');
      expect(CATALOG_MODELS.bush?.dimensions).toEqual(APPFRONT_MODELS['planter-long']?.dimensions);
      // Đèn trần đổi tệp nhưng giữ gắn trần + khối interactive (nguồn sáng) của dòng Pascal.
      expect(CATALOG_MODELS['ceiling-lamp']?.attachTo).toBe('ceiling');
      expect(CATALOG_MODELS['ceiling-lamp']?.interactive).toBe(VENDOR_MODELS['ceiling-lamp']?.interactive);
      expect(CATALOG_MODELS.picture?.attachTo).toBe('wall-side');
      for (const f of ['plant-ph', 'planter-ph', 'planter-long']) {
        expect(existsSync(resolve(ROOT, 'assets/appfront-items', f, 'model.glb')), f).toBe(true);
      }
    } finally {
      setRealismModels(false);
    }
    expect(CATALOG_MODELS['indoor-plant']).toBe(before);
    expect(modelSrcOf('indoor-plant')).toBe('/items/indoor-plant/model.glb');
    expect(modelSrcOf('small-indoor-plant')).toBe('/items/small-indoor-plant/model.glb');
    expect(modelSrcOf('bush')).toBe('/items/bush/model.glb');
  });

  it('gói 4B + 5 + 6: cờ realism bật → tủ bếp / kệ TV dùng mẫu -gen, đồ Sketchfab dùng mẫu -sf; tắt → mẫu Pascal', () => {
    const swaps = {
      closet: 'wardrobe-sf',
      fridge: 'fridge-sf',
      toilet: 'toilet-sf',
      'bathroom-sink': 'vanity-sf',
      'dining-table': 'dining-table-sf',
      dresser: 'dresser-sf',
      television: 'tv-sf',
      'double-bed': 'bed-sf',
      'shower-square': 'shower-sf',
      hood: 'hood-sf',
      stove: 'stove-sf',
      'coffee-table': 'coffee-table-sf',
      'kitchen-counter': 'kitchen-counter-gen',
      'kitchen-cabinet': 'kitchen-cabinet-gen',
      'kitchen-shelf': 'kitchen-shelf-gen',
      'tv-stand': 'tv-stand-gen',
    };
    try {
      setRealismModels(true);
      for (const [pascal, gen] of Object.entries(swaps)) {
        expect(modelSrcOf(pascal)).toBe(`/items/${gen}/model.glb`);
        expect(CATALOG_MODELS[pascal]?.dimensions).toEqual(APPFRONT_MODELS[gen]?.dimensions);
        expect(CATALOG_MODELS[pascal]?.folder).toBe(pascal);
        expect(existsSync(resolve(ROOT, 'assets/appfront-items', gen, 'model.glb')), gen).toBe(true);
      }
      expect(CATALOG_MODELS['kitchen-shelf']?.attachTo).toBe('wall-side');
      expect(CATALOG_MODELS.hood?.attachTo).toBe('wall-side');
    } finally {
      setRealismModels(false);
    }
    for (const pascal of Object.keys(swaps)) expect(modelSrcOf(pascal)).toBe(`/items/${pascal}/model.glb`);
  });
});

