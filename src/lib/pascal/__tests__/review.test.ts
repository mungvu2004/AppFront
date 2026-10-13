/**
 * Trạng thái duyệt đi sang Pascal thành trường `review` hạng nhất, và về lại;
 * cộng bề rộng bao nội thất khi người dùng kéo `scale` trong Pascal (#21).
 *
 * Hai thứ này đi cùng một bài vì cùng một lý do: cái mà Pascal **sửa được**
 * phải là cái mà lượt về **đọc**. Panel "Kiểm duyệt" ghi vào `review`, tay cầm
 * kéo ghi vào `scale` — đọc `metadata.appfront` cho cả hai là đọc lại bản lượt
 * đi và mất trắng thao tác vừa rồi.
 */

import { describe, expect, it } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import type { Furniture } from '@/domain/spatial/types';

import { toPascalScene } from '../toPascal';
import { toSpatialGraph } from '../toSpatial';
import type { PascalItemNode, PascalNode, PascalScene } from '../types';

const sceneOf = (): PascalScene => toPascalScene(createSampleBuilding()).scene;

const firstOfType = <T extends PascalNode['type']>(
  scene: PascalScene,
  type: T,
): Extract<PascalNode, { type: T }> => {
  const found = Object.values(scene.nodes).find((node) => node.type === type);

  if (found === undefined) throw new Error(`Cảnh mẫu không có node loại "${type}".`);

  return found as Extract<PascalNode, { type: T }>;
};

/** Thay một node trong cảnh, giữ nguyên phần còn lại. */
const withNode = (scene: PascalScene, node: PascalNode): PascalScene => ({
  ...scene,
  nodes: { ...scene.nodes, [node.id]: node },
});

/**
 * Thêm một node **mới** vào cảnh, có nối vào `children` của cha.
 *
 * Lượt về đi theo `children`, không quét bảng `nodes`, nên một node chỉ gắn
 * vào bảng mà không gắn vào cha thì không bao giờ được ghé qua.
 */
const withAddedNode = (scene: PascalScene, node: PascalNode): PascalScene => {
  const parentId = node.parentId;

  if (parentId === null) throw new Error('Node thêm vào phải có cha.');

  const parent = scene.nodes[parentId];

  if (parent === undefined || !('children' in parent)) {
    throw new Error(`Cha "${parentId}" không nhận con.`);
  }

  return {
    ...scene,
    nodes: {
      ...scene.nodes,
      [node.id]: node,
      [parentId]: { ...parent, children: [...parent.children, node.id] },
    },
  };
};

describe('trường `review` của Pascal', () => {
  it('mọi node AppFront gắn đều mang đủ ba trường', () => {
    const scene = sceneOf();
    const owned = Object.values(scene.nodes).filter(
      (node) => node.metadata?.appfront !== undefined,
    );

    expect(owned.length).toBeGreaterThan(0);
    for (const node of owned) {
      expect(node.review, node.id).toBeDefined();
      expect(typeof node.review?.reviewed, node.id).toBe('boolean');
      expect(typeof node.review?.confidence, node.id).toBe('number');
      expect(node.review?.source === 'ai' || node.review?.source === 'human', node.id).toBe(true);
    }
  });

  it('`review` khớp với `metadata.appfront` của cùng node', () => {
    const wall = firstOfType(sceneOf(), 'wall');
    const origin = wall.metadata?.appfront;

    expect(wall.review).toEqual({
      reviewed: origin?.reviewed,
      confidence: origin?.confidence,
      source: origin?.source,
    });
  });

  // A5: cú bấm "Duyệt" trong Pascal ghi vào `review`, và lượt về phải thấy nó.
  it('người duyệt bấm "Duyệt" trong Pascal thì lượt về mang `reviewed: true`', () => {
    const scene = sceneOf();
    const zone = firstOfType(scene, 'zone');
    const origin = zone.metadata?.appfront;

    if (origin === undefined) throw new Error('Vùng mẫu thiếu `metadata.appfront`.');

    const unreviewed = withNode(scene, {
      ...zone,
      review: { ...zone.review, reviewed: false },
      metadata: { appfront: { ...origin, reviewed: false } },
    });

    const before = toSpatialGraph(unreviewed).graph.rooms.find((room) => room.id === zone.id.slice(5));
    expect(before?.reviewed).toBe(false);

    // Chỉ `review` đổi — `metadata.appfront` vẫn là bản cũ, như khi Pascal ghi.
    const approved = withNode(unreviewed, {
      ...zone,
      review: { ...zone.review, reviewed: true },
      metadata: { appfront: { ...origin, reviewed: false } },
    });
    const after = toSpatialGraph(approved).graph.rooms.find((room) => room.id === zone.id.slice(5));

    expect(after?.reviewed).toBe(true);
  });

  it('node Pascal tự đẻ (id nanoid) không mang được dấu duyệt về', () => {
    const scene = sceneOf();
    const zone = firstOfType(scene, 'zone');
    const foreign = withAddedNode(scene, {
      ...zone,
      id: 'zone_x7h2k9qp',
      name: 'Phòng Pascal vừa vẽ',
      review: { reviewed: true, confidence: 1, source: 'human' },
    });

    const minted = toSpatialGraph(foreign).graph.rooms.find(
      (room) => room.name === 'Phòng Pascal vừa vẽ',
    );

    expect(minted).toBeDefined();
    expect(minted?.reviewed).toBe(false);
  });
});

describe('bề rộng bao nội thất theo `scale` (#21)', () => {
  const widthOf = (furniture: Furniture): number =>
    furniture.boundingBox.max.x - furniture.boundingBox.min.x;
  const depthOf = (furniture: Furniture): number =>
    furniture.boundingBox.max.y - furniture.boundingBox.min.y;

  const itemBack = (scene: PascalScene, item: PascalItemNode): Furniture => {
    const found = toSpatialGraph(withNode(scene, item)).graph.furniture.find(
      (entry) => entry.id === item.id.slice(5),
    );

    if (found === undefined) throw new Error('Món đồ không về được.');

    return found;
  };

  it('tỉ lệ 1 giữ nguyên đúng số mm đã lưu, không qua mét rồi về', () => {
    const scene = sceneOf();
    const item = firstOfType(scene, 'item');
    const stored = item.metadata?.appfront?.fields?.['boundingBox'] as Furniture['boundingBox'];

    expect(itemBack(scene, item).boundingBox).toEqual(stored);
  });

  it('kéo rộng gấp đôi thì bề rộng về gấp đôi, chiều sâu không đổi', () => {
    const scene = sceneOf();
    const item = firstOfType(scene, 'item');
    const before = itemBack(scene, item);

    const wider = itemBack(scene, { ...item, scale: [2, 1, 1] });

    expect(widthOf(wider)).toBeCloseTo(widthOf(before) * 2, 6);
    expect(depthOf(wider)).toBeCloseTo(depthOf(before), 6);
  });

  it('kéo sâu gấp rưỡi thì chiều sâu về gấp rưỡi', () => {
    const scene = sceneOf();
    const item = firstOfType(scene, 'item');
    const before = itemBack(scene, item);

    const deeper = itemBack(scene, { ...item, scale: [1, 1, 1.5] });

    expect(depthOf(deeper)).toBeCloseTo(depthOf(before) * 1.5, 6);
    expect(widthOf(deeper)).toBeCloseTo(widthOf(before), 6);
  });

  it('kéo vẫn giữ tâm món đồ tại chỗ', () => {
    const scene = sceneOf();
    const item = firstOfType(scene, 'item');
    const before = itemBack(scene, item);
    const scaled = itemBack(scene, { ...item, scale: [2, 1, 2] });

    const centreOf = (furniture: Furniture) => ({
      x: (furniture.boundingBox.min.x + furniture.boundingBox.max.x) / 2,
      y: (furniture.boundingBox.min.y + furniture.boundingBox.max.y) / 2,
    });

    expect(centreOf(scaled).x).toBeCloseTo(centreOf(before).x, 6);
    expect(centreOf(scaled).y).toBeCloseTo(centreOf(before).y, 6);
  });

  it('món đồ Pascal vừa đặt (chưa có hộp đã lưu) lấy `dimensions × scale`', () => {
    const scene = sceneOf();
    const item = firstOfType(scene, 'item');
    const fresh: PascalItemNode = {
      ...item,
      id: 'item_m3k8d1pq',
      position: [0, 0, 0],
      scale: [2, 1, 1],
      metadata: {},
    };

    const back = toSpatialGraph(withAddedNode(scene, fresh)).graph.furniture.find(
      (entry) => entry.centre.x === 0 && entry.centre.y === 0,
    );

    expect(back).toBeDefined();
    expect(widthOf(back!)).toBeCloseTo(item.asset.dimensions[0] * 2 * 1000, 6);
    expect(depthOf(back!)).toBeCloseTo(item.asset.dimensions[2] * 1000, 6);
  });
});
