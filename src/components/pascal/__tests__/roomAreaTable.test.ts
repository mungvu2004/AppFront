/**
 * Bảng "Diện tích phòng" của vendor (`lib/floorplan/room-area.ts`) — thứ tự nhóm tầng
 * (23R-C-004) và lọc tầng không rò thông báo phòng hỏng của tầng khác (23R-B-007).
 * Bài kiểm vendor chạy bằng bun; tệp này giữ hai luật ấy trong vitest của AppFront.
 */

import type { AnyNode } from '@pascal-app/core';
import { describe, expect, it } from 'vitest';

import { roomAreaTable } from '../../../../vendor/pascal/packages/editor/src/lib/floorplan/room-area';

const square = (x: number): [number, number][] => [
  [x, 0],
  [x + 4, 0],
  [x + 4, 4],
  [x, 4],
];

function fixture(): Record<string, AnyNode> {
  const nodes: Record<string, AnyNode> = {};
  const node = (value: Record<string, unknown>): void => {
    nodes[value['id'] as string] = {
      object: 'node',
      parentId: null,
      visible: true,
      metadata: {},
      children: [],
      ...value,
    } as unknown as AnyNode;
  };
  const zone = (id: string, parentId: string, polygon: [number, number][]): void =>
    node({
      id,
      parentId,
      type: 'zone',
      name: id,
      spaceRole: 'room',
      roomNumber: '',
      ceilingHeight: 3,
      occupancy: '',
      enclosureStatus: 'auto',
      boundaryWallIds: [],
      polygon,
    });

  node({ id: 'level_10', type: 'level', name: 'Tầng 10', level: 9, children: ['z_10', 'z_broken'] });
  node({ id: 'level_2', type: 'level', name: 'Tầng 2', level: 1, children: ['z_2'] });
  zone('z_10', 'level_10', square(0));
  zone('z_2', 'level_2', square(10));
  zone('z_broken', 'level_10', [
    [0, 0],
    [1, 0],
  ]);

  return nodes;
}

describe('roomAreaTable', () => {
  it('23R-C-004: nhóm theo tầng xếp theo thứ tự tầng, "Tầng 2" trước "Tầng 10"', () => {
    const table = roomAreaTable(fixture(), { grouping: 'level' });

    expect(table.groups.map((group) => group.label)).toEqual(['Tầng 2', 'Tầng 10']);
  });

  it('23R-B-007: lọc "Tầng 2" không báo phòng hỏng của "Tầng 10"', () => {
    expect(roomAreaTable(fixture()).issues).toHaveLength(1);
    expect(roomAreaTable(fixture(), { levelIds: ['level_2'] }).issues).toEqual([]);
  });
});
