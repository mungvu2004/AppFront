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
