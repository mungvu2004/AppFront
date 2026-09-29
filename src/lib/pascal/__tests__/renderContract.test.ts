/**
 * Những trường bộ vẽ của Pascal đọc THẲNG, không qua zod.
 *
 * Vì sao cần một tệp riêng cho việc này: lược đồ Pascal khai các trường dưới
 * đây là `.optional().default(...)`, nên `validateBuildJson` — vốn **parse**
 * trước khi kiểm — báo xanh dù cảnh không có chúng. Nhưng đường chạy thật nạp
 * cảnh bằng `setScene`, và `setScene` **không** parse. Thiếu trường là:
 *
 * - `site.polygon` thiếu → bộ vẽ khu đất trả `null`, **cả cây con biến mất
 *   trong im lặng** (`nodes/dist/site/renderer.js:293`);
 * - `building.position` / `building.rotation` thiếu → bộ vẽ đọc
 *   `node.rotation[0]` và **ném lỗi**, ranh giới lỗi của viewer nuốt mất.
 *
 * Đo ngày 2026-09-28 trên `@pascal-app@1.0.0` trong Chromium: thiếu chúng thì
 * 85/105 node ở lại trạng thái "bẩn" mãi và màn hình chỉ có nền trời. Thêm đủ
 * chúng thì `dirty` về 0 và cảnh hiện. Chi tiết:
 * `docs/pascal/IMPLEMENTATION_STATUS.md` §4.9.
 */

import { describe, expect, it } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import type { SpatialGraph } from '@/domain/spatial/types';

import { BUILDING_NODE_ID, SITE_NODE_ID } from '../ids';
import { toPascalScene } from '../toPascal';

const sceneOf = (graph: SpatialGraph = createSampleBuilding()) => toPascalScene(graph).scene;

describe('hợp đồng dựng hình — trường bộ vẽ đọc thẳng', () => {
  it('khu đất có đường bao, và đường bao ấy bọc trọn hình học công trình', () => {
    const scene = sceneOf();
    const site = scene.nodes[SITE_NODE_ID];

    expect(site?.type).toBe('site');
    if (site?.type !== 'site') return;

    expect(site.polygon.type).toBe('polygon');
    expect(site.polygon.points.length).toBeGreaterThanOrEqual(3);

    const xs = site.polygon.points.map(([x]) => x);
    const zs = site.polygon.points.map(([, z]) => z);

    for (const node of Object.values(scene.nodes)) {
      if (node.type === 'wall') {
        for (const [x, z] of [node.start, node.end]) {
          expect(x).toBeGreaterThanOrEqual(Math.min(...xs));
          expect(x).toBeLessThanOrEqual(Math.max(...xs));
          expect(z).toBeGreaterThanOrEqual(Math.min(...zs));
          expect(z).toBeLessThanOrEqual(Math.max(...zs));
        }
      }
      if (node.type === 'zone') {
        for (const [x, z] of node.polygon) {
          expect(x).toBeGreaterThanOrEqual(Math.min(...xs));
          expect(x).toBeLessThanOrEqual(Math.max(...xs));
          expect(z).toBeGreaterThanOrEqual(Math.min(...zs));
          expect(z).toBeLessThanOrEqual(Math.max(...zs));
        }
      }
    }
  });

  it('bản vẽ rỗng vẫn có đường bao hợp lệ, không phải mảng rỗng', () => {
    const empty: SpatialGraph = {
      ...createSampleBuilding(),
      axes: [],
      dimensions: [],
      furniture: [],
      levels: [],
      notes: [],
      openings: [],
      rooms: [],
      walls: [],
    };
    const site = sceneOf(empty)[`nodes`][SITE_NODE_ID];

    expect(site?.type).toBe('site');
    if (site?.type !== 'site') return;
    expect(site.polygon.points.length).toBeGreaterThanOrEqual(3);
  });

  it('công trình có cả `position` lẫn `rotation`, vì bộ vẽ đọc `rotation[0]`', () => {
    const building = sceneOf().nodes[BUILDING_NODE_ID];

    expect(building?.type).toBe('building');
    if (building?.type !== 'building') return;

    expect(building.position).toHaveLength(3);
    expect(building.rotation).toHaveLength(3);
    expect(building.position.every(Number.isFinite)).toBe(true);
    expect(building.rotation.every(Number.isFinite)).toBe(true);
  });

  it('mọi ô mở có `rotation`, không để lược đồ tự điền', () => {
    const openings = Object.values(sceneOf().nodes).filter(
      (node) => node.type === 'door' || node.type === 'window',
    );

    expect(openings.length).toBeGreaterThan(0);
    for (const opening of openings) {
      if (opening.type !== 'door' && opening.type !== 'window') continue;
      expect(opening.rotation).toHaveLength(3);
      expect(opening.rotation.every(Number.isFinite)).toBe(true);
    }
  });

  it('mọi món đồ có `scale`, vì `getScaledDimensions` bung mảng ấy không hỏi', () => {
    const items = Object.values(sceneOf().nodes).filter((node) => node.type === 'item');

    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      if (item.type !== 'item') continue;
      // `core/schema/nodes/item.ts:210` viết `const [sx, sy, sz] = item.scale`.
      // Thiếu trường là `TypeError` giữa lượt render, và ranh giới lỗi của
      // Pascal nuốt trọn món đồ — cảnh vẫn hiện, chỉ là thiếu đồ đạc.
      expect(item.scale).toHaveLength(3);
      expect(item.scale.every(Number.isFinite)).toBe(true);
    }
  });

  it('không món đồ nào cao 0 m — hộp dày 0 mm là món đồ vô hình', () => {
    const items = Object.values(sceneOf().nodes).filter((node) => node.type === 'item');

    for (const item of items) {
      if (item.type !== 'item') continue;
      // `PreviewModel` (`nodes/item/renderer.tsx:521`) dựng `boxGeometry [w, h, d]`.
      expect(item.asset.dimensions[1]).toBeGreaterThan(0);
    }
  });

  it('cái thang cao trọn tầng, không lấy số danh nghĩa', () => {
    // Bộ mẫu chuẩn chỉ có đồ đạc loại `table`, nên đổi loại của một món để có
    // cái thang — thay vì dựng một bộ mẫu thứ hai.
    const graph = createSampleBuilding();
    const first = graph.furniture[0];

    expect(first).toBeDefined();
    if (first === undefined) return;

    graph.furniture = [{ ...first, kind: 'stair' }, ...graph.furniture.slice(1)];

    const level = graph.levels.find((item) => item.id === first.levelId);
    const node = sceneOf(graph).nodes[`item_${first.id}`];

    expect(level?.heightMm).toBeGreaterThan(0);
    expect(node?.type).toBe('item');
    if (node?.type !== 'item') return;
    expect(node.asset.dimensions[1]).toBe((level?.heightMm ?? 0) / 1000);
  });

  it('mỗi phòng có MỘT tấm sàn, và tấm sàn khai đủ trường bộ vẽ đọc thẳng', () => {
    const graph = createSampleBuilding();
    const scene = sceneOf(graph);
    const slabs = Object.values(scene.nodes).filter((node) => node.type === 'slab');

    expect(slabs).toHaveLength(graph.rooms.length);

    for (const slab of slabs) {
      if (slab.type !== 'slab') continue;
      // `zone` KHÔNG dựng mặt sàn; thiếu `slab` là nhìn xuống thấy nền trời.
      expect(slab.polygon.length).toBeGreaterThanOrEqual(3);
      expect(slab.polygon.flat().every(Number.isFinite)).toBe(true);
      // Năm trường dưới đây đều là `.default()` của lược đồ, mà `setScene`
      // không parse — nên chúng phải có mặt đích danh.
      expect(slab.holes).toEqual([]);
      expect(slab.holeMetadata).toEqual([]);
      expect(slab.elevation).toBe(0);
      expect(slab.thickness).toBeGreaterThan(0);
      expect(slab.recessed).toBe(false);
      expect(slab.autoFromWalls).toBe(false);
    }
  });

  it('sàn dày XUỐNG dưới mặt phẳng tầng, không chèn vào chân tường', () => {
    const slab = Object.values(sceneOf().nodes).find((node) => node.type === 'slab');

    expect(slab?.type).toBe('slab');
    if (slab?.type !== 'slab') return;

    // Khối chiếm `[elevation − thickness, elevation]`. Tường và đồ đạc mọc từ
    // 0, nên mặt trên của sàn phải đúng bằng 0 chứ không phải 0,05 của lược đồ.
    expect(slab.elevation).toBe(0);
    expect(slab.elevation - slab.thickness).toBeLessThan(0);
  });

  it('sàn và phòng cùng một đường bao — hai node, một hình học', () => {
    const graph = createSampleBuilding();
    const scene = sceneOf(graph);
    const room = graph.rooms[0];

    expect(room).toBeDefined();
    if (room === undefined) return;

    const zone = scene.nodes[`zone_${room.id}`];
    const slab = scene.nodes[`slab_${room.id}`];

    expect(zone?.type).toBe('zone');
    expect(slab?.type).toBe('slab');
    if (zone?.type !== 'zone' || slab?.type !== 'slab') return;
    expect(slab.polygon).toEqual(zone.polygon);
    expect(slab.parentId).toBe(zone.parentId);
  });

  it('không node nào của tám loại thiếu `object`, `id`, `type`, `parentId`', () => {
    const scene = sceneOf();

    for (const [id, node] of Object.entries(scene.nodes)) {
      expect(node.object).toBe('node');
      expect(node.id).toBe(id);
      expect(typeof node.type).toBe('string');
      expect(node.parentId === null || typeof node.parentId === 'string').toBe(true);
    }
  });
});
