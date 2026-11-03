import { describe, expect, it } from 'vitest';

import { isEmptyChange, nodeChangesTo } from '../sceneRevert';

const level = { id: 'level_1', type: 'level', parentId: null, children: ['wall_1', 'door_1'] };
const wall = { id: 'wall_1', type: 'wall', parentId: 'level_1', thickness: 0.2, children: [] };
const door = { id: 'door_1', type: 'door', parentId: 'level_1', width: 0.9 };

describe('nodeChangesTo — đặt lại cảnh bằng phần chênh, không setScene cả cây', () => {
  it('cảnh đã khớp (kể cả khi node hiện tại có thêm trường mặc định): không đổi gì', () => {
    const filled = { level_1: level, wall_1: { ...wall, visible: true, frontSide: 'unknown' }, door_1: door };

    expect(isEmptyChange(nodeChangesTo(filled, { level_1: level, wall_1: wall, door_1: door }))).toBe(true);
  });

  it('cửa vừa xoá bị từ chối: chỉ tạo lại đúng cửa ấy, dưới đúng cha', () => {
    const changes = nodeChangesTo({ level_1: { ...level, children: ['wall_1'] }, wall_1: wall }, { level_1: level, wall_1: wall, door_1: door });

    expect(changes.create).toEqual([{ node: door, parentId: 'level_1' }]);
    expect(changes.update.map((item) => item.id)).toEqual(['level_1']);
    expect(changes.delete).toEqual([]);
  });

  it('node sửa ma được trả về; node lạ bị xoá, chỉ gốc của cành (vendor xoá kéo theo con)', () => {
    const extraParent = { id: 'slab_x', type: 'slab', parentId: 'level_1', children: ['item_y'] };
    const extraChild = { id: 'item_y', type: 'item', parentId: 'slab_x' };
    const changes = nodeChangesTo(
      { level_1: level, wall_1: { ...wall, thickness: 0.4 }, door_1: door, slab_x: extraParent, item_y: extraChild },
      { level_1: level, wall_1: wall, door_1: door },
    );

    expect(changes.update).toEqual([{ id: 'wall_1', data: wall }]);
    expect(changes.delete).toEqual(['slab_x']);
  });

  it('tạo cả cành: cha trước con', () => {
    const lamp = { id: 'item_lamp', type: 'item', parentId: 'ceiling_1' };
    const ceiling = { id: 'ceiling_1', type: 'ceiling', parentId: 'level_1', children: ['item_lamp'] };
    const changes = nodeChangesTo({ level_1: level }, { level_1: level, item_lamp: lamp, ceiling_1: ceiling });

    expect(changes.create.map((item) => item.node.id)).toEqual(['ceiling_1', 'item_lamp']);
  });
});
