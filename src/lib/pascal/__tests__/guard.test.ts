/**
 * Cổng lọc thay đổi ma — bốn luật, và không một con số thời gian nào.
 *
 * Bài kiểm cố ý **không** dùng đồng hồ giả. Nếu một luật nào của `guard.ts`
 * cần tới thời gian thì nó sẽ phải xuất hiện ở đây dưới dạng một lượt `advance`,
 * và lúc ấy cả file này là lời tố giác. Bốn luật đều xét trạng thái, nên bốn
 * bài dưới đây chỉ đổi trạng thái rồi hỏi.
 */

import { describe, expect, it } from 'vitest';

import { createChangeGate, MASS_DELETE_RATIO, type PascalCommit } from '../guard';
import { BUILDING_NODE_ID, SITE_NODE_ID } from '../ids';
import type { PascalNode, PascalScene } from '../types';

const LEVEL_ID = 'level_L-LEVEL00';

/** Một cảnh phẳng: một tầng với `wallCount` tường, mỗi tường không có ô mở. */
const sceneWithWalls = (wallCount: number): PascalScene => {
  const wallIds = Array.from({ length: wallCount }, (_unused, index) => `wall_W-WALL${String(index)}`);
  const walls: PascalNode[] = wallIds.map((id) => ({
    object: 'node',
    id,
    type: 'wall',
    parentId: LEVEL_ID,
    children: [],
    start: [0, 0],
    end: [1, 0],
    thickness: 0.22,
    height: 3.6,
  }));

  const nodes: Record<string, PascalNode> = {
    [SITE_NODE_ID]: {
      object: 'node',
      id: SITE_NODE_ID,
      type: 'site',
      parentId: null,
      children: [BUILDING_NODE_ID],
      polygon: { type: 'polygon', points: [[-15, -15], [15, -15], [15, 15], [-15, 15]] },
    },
    [BUILDING_NODE_ID]: {
      object: 'node',
      id: BUILDING_NODE_ID,
      type: 'building',
      parentId: SITE_NODE_ID,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      children: [LEVEL_ID],
    },
    [LEVEL_ID]: {
      object: 'node',
      id: LEVEL_ID,
      type: 'level',
      parentId: BUILDING_NODE_ID,
      children: wallIds,
      level: 0,
      baseElevation: 0,
      height: 3.6,
    },
  };

  for (const wall of walls) {
    nodes[wall.id] = wall;
  }

  return { nodes, rootNodeIds: [SITE_NODE_ID] };
};

const commitOf = (changed: readonly string[], removed?: readonly string[]): PascalCommit => ({
  origin: 'local',
  changedNodeIds: changed,
  ...(removed === undefined ? {} : { removedNodeIds: removed }),
});

const readyGate = (): ReturnType<typeof createChangeGate> => {
  const gate = createChangeGate();

  gate.beginLoad();
  gate.acknowledgeLoad();

  return gate;
};

describe('createChangeGate', () => {
  const scene = sceneWithWalls(10);

  it('chặn mọi thay đổi đến trước khi bản vẽ được nạp xong lần đầu', () => {
    const gate = createChangeGate();
    const verdict = gate.admit(commitOf(['wall_W-WALL0']), scene);

    expect(gate.hasLoaded()).toBe(false);
    expect(verdict).toEqual({
      admitted: false,
      code: 'PASCAL_BEFORE_LOAD',
      reason: 'Bỏ qua một thay đổi đến trước khi bản vẽ được nạp xong lần đầu.',
    });
  });

  it('chặn thay đổi đến trong lúc đang nạp lại', () => {
    const gate = readyGate();

    gate.beginLoad();

    expect(gate.admit(commitOf(['wall_W-WALL0']), scene)).toMatchObject({
      admitted: false,
      code: 'PASCAL_WHILE_LOADING',
    });
  });

  it('chặn thay đổi không nêu được đối tượng nào', () => {
    expect(readyGate().admit(commitOf([]), scene)).toMatchObject({
      admitted: false,
      code: 'PASCAL_EMPTY_COMMIT',
    });
  });

  it('cho qua ngay thay đổi thật đầu tiên sau khi nạp — không có cửa sổ chờ nào', () => {
    expect(readyGate().admit(commitOf(['wall_W-WALL0']), scene)).toEqual({ admitted: true });
  });

  it('cho qua lượt xoá nhỏ: một trong mười đối tượng của tầng', () => {
    const verdict = readyGate().admit(commitOf(['wall_W-WALL0'], ['wall_W-WALL0']), scene);

    expect(verdict).toEqual({ admitted: true });
  });

  it('chặn lượt xoá chạm ngưỡng một phần năm số đối tượng của tầng', () => {
    const removed = ['wall_W-WALL0', 'wall_W-WALL1'];
    const verdict = readyGate().admit(commitOf(removed, removed), scene);

    expect(removed.length / 10).toBe(MASS_DELETE_RATIO);
    expect(verdict).toMatchObject({ admitted: false, code: 'PASCAL_MASS_DELETE' });
    expect(verdict.admitted ? '' : verdict.reason).toContain('2 trong 10');
  });

  it('đếm cả ô mở nằm dưới tường khi đo sức tàn phá của lượt xoá', () => {
    const withDoor = sceneWithWalls(4);
    const wall = withDoor.nodes['wall_W-WALL0'];
    const scene: PascalScene = {
      rootNodeIds: withDoor.rootNodeIds,
      nodes: {
        ...withDoor.nodes,
        ...(wall !== undefined && wall.type === 'wall'
          ? { [wall.id]: { ...wall, children: ['door_D-DOOR0'] } }
          : {}),
        'door_D-DOOR0': {
          object: 'node',
          id: 'door_D-DOOR0',
          type: 'door',
          parentId: 'wall_W-WALL0',
          wallId: 'wall_W-WALL0',
          position: [0.5, 1.1, 0],
          rotation: [0, 0, 0],
          width: 0.9,
          height: 2.2,
        },
      },
    };

    // Tầng có 5 đối tượng (4 tường + 1 cửa). Xoá tường kéo cửa theo: 2/5 = 40 %.
    const removed = ['wall_W-WALL0', 'door_D-DOOR0'];

    expect(readyGate().admit(commitOf(removed, removed), scene)).toMatchObject({
      admitted: false,
      code: 'PASCAL_MASS_DELETE',
    });
  });

  it('không coi lượt sửa lớn là lượt xoá lớn', () => {
    const everyWall = Array.from({ length: 10 }, (_unused, index) => `wall_W-WALL${String(index)}`);

    expect(readyGate().admit(commitOf(everyWall), scene)).toEqual({ admitted: true });
  });
});
