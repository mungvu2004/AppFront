/**
 * Đồ đạc dùng mô hình GLB thật (T14): chọn thư mục, khớp vào hộp bao, và — bắt
 * buộc — lượt về không đổi gì (node.scale [1,1,1], asset.id cũ, không sinh `model`).
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SpatialGraphDocumentSchema } from '@/api/schemas/spatialGraph';
import type { Furniture, SpatialGraph } from '@/domain/spatial/types';
import { millimetres } from '@/domain/units/types';

import { fixtureF1, fixtureF2 } from '../__fixtures__';
import { CATALOG_MODELS } from '../furnitureCatalog';
import { toPascalId } from '../ids';
import { isGeneratedLightId } from '../sceneDressing';
import { toPascalScene } from '../toPascal';
import { toSpatialGraph } from '../toSpatial';
import type { PascalItemNode } from '../types';

const graphOf = (doc: unknown): SpatialGraph => SpatialGraphDocumentSchema.parse(doc).graph as SpatialGraph;

const itemsOf = (graph: SpatialGraph): PascalItemNode[] =>
  Object.values(toPascalScene(graph).scene.nodes).filter((n): n is PascalItemNode => n.type === 'item' && !isGeneratedLightId(n.id));

const metresOfMm = (mm: number): number => mm / 1000;

const ROOT = resolve(__dirname, '../../../..');
const modelExists = (src: string): boolean =>
  existsSync(resolve(ROOT, 'public/pascal', `.${src}`)) ||
  existsSync(resolve(ROOT, 'vendor/pascal/assets', `.${src}`).replace(/model\.glb$/, ''));

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
          f.heightMm === undefined
            ? folder === 'palm' || folder === 'fir-tree' ? 2.2 : levelH
            : metresOfMm(f.heightMm);
        const why = `${ext ? 'ext' : 'plain'} ${f.id} ${folder} rendered=${rendered.toFixed(2)} limit=${limit}`;
        expect(rendered, why).toBeLessThanOrEqual(limit * 1.02);
        expect(item.asset.dimensions[1], why).toBeLessThanOrEqual(limit * 1.02);
      }
    }
  });

  it('tre 500×500×2000 → thông (cây cao hẹp) cao ~2 m; không heightMm thì chặn ở 2,2 m (cây cao) và trần tầng', () => {
    const levelH = metresOfMm(graphOf(fixtureF2().doc).levels[0]!.heightMm);
    const tall = (heightMm?: number): number => {
      const [item] = itemsOf(
        withFurniture((base) => [
          {
            ...base,
            kind: 'other',
            variant: 'bamboo',
            ...(heightMm === undefined ? {} : { heightMm: millimetres(heightMm) }),
            boundingBox: { min: { x: 0, y: 0 }, max: { x: 500, y: 500 } } as Furniture['boundingBox'],
            centre: { x: 250, y: 250 } as Furniture['centre'],
          },
        ]),
      );
      expect(item!.asset.src).toBe('/items/fir-tree/model.glb');
      // Thông không có scale riêng của catalog: GLB gốc cao đúng 3 m.
      return CATALOG_MODELS['fir-tree']!.dimensions[1] * item!.asset.scale![1];
    };
    expect(tall(2000)).toBeCloseTo(2, 2);
    expect(tall()).toBeCloseTo(Math.min(levelH, 2.2), 2);
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

  it('F2 (không variant): đoán thư mục theo loại + phòng + hộp bao; thang vẫn là chỗ giữ chỗ', () => {
    const expected: Record<string, string> = {
      table: '/items/dining-table/model.glb',
      chair: '/items/dining-chair/model.glb',
      bed: '/items/single-bed/model.glb',
      wardrobe: '/items/closet/model.glb',
      kitchenCabinet: '/items/kitchen-counter/model.glb',
      sanitaryFixture: '/items/bathroom-sink/model.glb',
      stair: 'asset://appfront/stair',
      other: '/items/indoor-plant/model.glb',
    };
    const items = itemsOf(graphOf(fixtureF2().doc));
    expect(items).toHaveLength(32);
    for (const item of items) {
      expect(item.asset.src, item.asset.category).toBe(expected[item.asset.category]);
    }
  });
});
