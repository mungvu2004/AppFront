/**
 * Đồ đạc dùng mô hình GLB thật (T14): chọn thư mục, khớp vào hộp bao, và — bắt
 * buộc — lượt về không đổi gì (node.scale [1,1,1], asset.id cũ, không sinh `model`).
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SpatialGraphDocumentSchema } from '@/api/schemas/spatialGraph';
import type { Furniture, SpatialGraph } from '@/domain/spatial/types';

import { fixtureF1, fixtureF2 } from '../__fixtures__';
import { toPascalScene } from '../toPascal';
import { toSpatialGraph } from '../toSpatial';
import type { PascalItemNode } from '../types';

const graphOf = (doc: unknown): SpatialGraph => SpatialGraphDocumentSchema.parse(doc).graph as SpatialGraph;

const itemsOf = (graph: SpatialGraph): PascalItemNode[] =>
  Object.values(toPascalScene(graph).scene.nodes).filter((n): n is PascalItemNode => n.type === 'item');

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
