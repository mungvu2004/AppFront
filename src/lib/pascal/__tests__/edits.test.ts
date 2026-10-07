/**
 * Lượt sửa trong Pascal thành lệnh, và phần chênh đẩy ngược sang Pascal.
 *
 * Bài đầu tiên là bài quan trọng nhất của cả Bước 8: **nạp một bản vẽ vào
 * Pascal rồi đọc ngược ra phải cho 0 lệnh.** Hỏng bài đó thì đồng hồ tự lưu
 * 800 ms của A7 sẽ ghi đè dữ liệu máy chủ bằng chính dữ liệu vừa nạp, mỗi lần
 * mở màn hình một lần — và không có nút lưu nào để người dùng dừng tay.
 */

import { describe, expect, it } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';

import { diffScenes, isEmptyDiff } from '../diff';
import { createPascalEditCommand, PASCAL_COMMAND_TYPE } from '../fromPascal';
import { BUILDING_NODE_ID } from '../ids';
import { toPascalScene } from '../toPascal';
import type { PascalIdBook } from '../toSpatial';
import type { PascalNode, PascalScene, PascalZoneNode } from '../types';

const ACTOR = 'U-1';
const graph = normalizeSpatial(createSampleBuilding());
const baseScene = toPascalScene(createSampleBuilding()).scene;
const everyNodeId = Object.keys(baseScene.nodes);

const firstWallId = Object.values(baseScene.nodes).find((node) => node.type === 'wall')?.id ?? '';

/** Cảnh nền với một node bị thay hoặc bị bỏ (`undefined`). */
const sceneWith = (nodeId: string, node: PascalNode | undefined): PascalScene => {
  const nodes: Record<string, PascalNode> = { ...baseScene.nodes };

  if (node === undefined) {
    delete nodes[nodeId];
  } else {
    nodes[nodeId] = node;
  }

  return { nodes, rootNodeIds: baseScene.rootNodeIds };
};

/** Tường đầu tiên của cảnh, đã dày thêm 110 mm. */
const thickerWall = (): PascalNode => {
  const wall = baseScene.nodes[firstWallId];

  if (wall === undefined || wall.type !== 'wall') {
    throw new Error('cảnh nền phải có ít nhất một tường');
  }

  return { ...wall, thickness: 0.33 };
};

describe('createPascalEditCommand', () => {
  it('nạp bản vẽ vào Pascal rồi đọc ngược ra: 0 lệnh', () => {
    const result = createPascalEditCommand({
      graph,
      scene: baseScene,
      commit: { origin: 'load', changedNodeIds: everyNodeId },
      actorId: ACTOR,
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe('PASCAL_NO_CHANGE');
  });

  it('dự án rỗng: 0 lệnh', () => {
    const empty = normalizeSpatial({
      building: { confidence: 1, source: 'human', reviewed: false, name: 'Rỗng', datumElevationMm: 0 },
      levels: [],
      walls: [],
      openings: [],
      furniture: [],
      rooms: [],
      axes: [],
      dimensions: [],
      notes: [],
    });
    const scene = toPascalScene({
      building: { confidence: 1, source: 'human', reviewed: false, name: 'Rỗng', datumElevationMm: 0 },
      levels: [],
      walls: [],
      openings: [],
      furniture: [],
      rooms: [],
      axes: [],
      dimensions: [],
      notes: [],
    }).scene;

    const result = createPascalEditCommand({
      graph: empty,
      scene,
      commit: { origin: 'local', changedNodeIds: [BUILDING_NODE_ID] },
      actorId: ACTOR,
    });

    expect(result.ok ? null : result.error.code).toBe('PASCAL_NO_CHANGE');
  });

  it('đổi độ dày một tường thành một lệnh có nhãn tiếng Việt và ảnh chụp hai phía', () => {
    const result = createPascalEditCommand({
      graph,
      scene: sceneWith(firstWallId, thickerWall()),
      commit: { origin: 'local', changedNodeIds: [firstWallId] },
      actorId: ACTOR,
      id: 'C-TEST',
      timestamp: '2026-09-27T10:00:00+07:00',
    });

    expect(result.ok).toBe(true);

    const command = result.ok ? result.data : null;

    expect(command?.type).toBe(PASCAL_COMMAND_TYPE);
    expect(command?.actorId).toBe(ACTOR);
    expect(command?.description).toBe('Từ màn Pascal: sửa tường 1.');
    expect(command?.changes).toHaveLength(1);
    expect(command?.changes[0]?.before).not.toBeNull();
    expect(command?.changes[0]?.after).not.toBeNull();

    const after = command?.changes[0]?.after;

    expect(after !== null && after !== undefined && 'thicknessMm' in after ? after.thicknessMm : null).toBe(330);
  });

  it('A5 — Pascal sửa `reviewed` trong siêu dữ liệu thì lệnh KHÔNG mang dấu ấy về', () => {
    const wall = baseScene.nodes[firstWallId];

    if (wall === undefined || wall.type !== 'wall') {
      throw new Error('cảnh nền phải có ít nhất một tường');
    }

    // Bộ mẫu dựng tường bằng `DETECTED`: chưa ai duyệt. Bên kia tường khai
    // ngược lại, và đổi luôn độ dày để lượt này có thật một thay đổi.
    const tampered = {
      ...wall,
      thickness: 0.33,
      metadata: { appfront: { confidence: 1, source: 'human' as const, reviewed: true } },
    };

    const result = createPascalEditCommand({
      graph,
      scene: sceneWith(firstWallId, tampered),
      commit: { origin: 'local', changedNodeIds: [firstWallId] },
      actorId: ACTOR,
    });

    const change = result.ok ? result.data.changes[0] : null;

    expect(change?.before?.reviewed).toBe(false);
    expect(change?.after?.reviewed).toBe(false);
    expect(change?.after?.source).toBe('ai');
    expect(
      change?.after !== null && change?.after !== undefined && 'thicknessMm' in change.after
        ? change.after.thicknessMm
        : null,
    ).toBe(330);
  });

  it('xoá một tường thành lệnh xoá mang ảnh chụp cũ, nên hoàn tác được', () => {
    const result = createPascalEditCommand({
      graph,
      scene: sceneWith(firstWallId, undefined),
      commit: { origin: 'local', changedNodeIds: [firstWallId], removedNodeIds: [firstWallId] },
      actorId: ACTOR,
    });

    const change = result.ok ? result.data.changes[0] : null;

    expect(result.ok ? result.data.description : '').toBe('Từ màn Pascal: xoá tường 1.');
    expect(change?.after).toBeNull();
    expect(change?.before).not.toBeNull();
  });

  it('phòng người dùng vẽ trong Pascal thành lệnh thêm, id mới và dấu xác minh tắt', () => {
    const levelId = Object.values(baseScene.nodes).find((node) => node.type === 'level')?.id ?? '';
    const level = baseScene.nodes[levelId];
    const drawn: PascalZoneNode = {
      object: 'node',
      id: 'zone_pn44qv12ab34cd56',
      type: 'zone',
      name: 'Phòng mới',
      parentId: levelId,
      polygon: [
        [0, 0],
        [3, 0],
        [3, 3],
        [0, 3],
      ],
      spaceRole: 'room',
      boundaryWallIds: [],
      metadata: { appfront: { confidence: 1, source: 'human', reviewed: true } },
    };
    const scene: PascalScene = {
      rootNodeIds: baseScene.rootNodeIds,
      nodes: {
        ...baseScene.nodes,
        [drawn.id]: drawn,
        ...(level !== undefined && level.type === 'level'
          ? { [levelId]: { ...level, children: [...level.children, drawn.id] } }
          : {}),
      },
    };

    const result = createPascalEditCommand({
      graph,
      scene,
      commit: { origin: 'local', changedNodeIds: [drawn.id] },
      actorId: ACTOR,
    });

    const added = result.ok ? result.data.changes[0]?.after : null;

    expect(result.ok ? result.data.description : '').toBe('Từ màn Pascal: thêm phòng 1.');
    expect(result.ok ? result.data.changes[0]?.before : 'x').toBeNull();
    expect(added?.id.startsWith('R-')).toBe(true);
    expect(added?.reviewed).toBe(false);
  });

  it('sổ id giữ nguyên id của đối tượng mới qua hai lượt sửa liền nhau', () => {
    const idBook: PascalIdBook = new Map();
    const levelId = Object.values(baseScene.nodes).find((node) => node.type === 'level')?.id ?? '';
    const drawn: PascalZoneNode = {
      object: 'node',
      id: 'zone_pn55qv12ab34cd56',
      type: 'zone',
      name: 'Phòng mới',
      parentId: levelId,
      polygon: [
        [0, 0],
        [3, 0],
        [3, 3],
      ],
      spaceRole: 'room',
      boundaryWallIds: [],
    };
    const level = baseScene.nodes[levelId];
    const scene: PascalScene = {
      rootNodeIds: baseScene.rootNodeIds,
      nodes: {
        ...baseScene.nodes,
        [drawn.id]: drawn,
        ...(level !== undefined && level.type === 'level'
          ? { [levelId]: { ...level, children: [...level.children, drawn.id] } }
          : {}),
      },
    };

    const first = createPascalEditCommand({
      graph,
      scene,
      commit: { origin: 'local', changedNodeIds: [drawn.id] },
      actorId: ACTOR,
      idBook,
    });
    const second = createPascalEditCommand({
      graph,
      scene,
      commit: { origin: 'local', changedNodeIds: [drawn.id] },
      actorId: ACTOR,
      idBook,
    });

    const firstId = first.ok ? first.data.changes[0]?.id : 'a';
    const secondId = second.ok ? second.data.changes[0]?.id : 'b';

    expect(firstId).toBe(secondId);
    expect(idBook.get(drawn.id)).toBe(firstId);
  });

  it('từ chối kèm mã khi Pascal nhắc tới một node không quy được về loại nào', () => {
    const result = createPascalEditCommand({
      graph,
      scene: baseScene,
      commit: { origin: 'local', changedNodeIds: ['roof_qv12ab34cd56'] },
      actorId: ACTOR,
    });

    expect(result.ok ? null : result.error.code).toBe('PASCAL_UNKNOWN_NODE');
    expect(result.ok ? [] : result.error.reasons).toHaveLength(1);
  });
});

describe('diffScenes', () => {
  it('hai cảnh y hệt cho phần chênh rỗng', () => {
    const diff = diffScenes(baseScene, toPascalScene(createSampleBuilding()).scene);

    expect(isEmptyDiff(diff)).toBe(true);
  });

  it('đổi một tường chỉ đẩy lại đúng node ấy', () => {
    const diff = diffScenes(baseScene, sceneWith(firstWallId, thickerWall()));

    expect(diff.upsert.map((node) => node.id)).toEqual([firstWallId]);
    expect(diff.remove).toEqual([]);
  });

  it('xoá một node thì node ấy vào danh sách xoá', () => {
    const diff = diffScenes(baseScene, sceneWith(firstWallId, undefined));

    expect(diff.remove).toEqual([firstWallId]);
    expect(diff.upsert).toEqual([]);
  });

  it('xếp cha trước con trong danh sách phải áp', () => {
    const diff = diffScenes({ nodes: {}, rootNodeIds: [] }, baseScene);
    const depths = diff.upsert.map((node) => node.type);

    expect(depths[0]).toBe('site');
    expect(depths[1]).toBe('building');
    expect(depths.indexOf('level')).toBeLessThan(depths.indexOf('wall'));
    expect(depths.indexOf('wall')).toBeLessThan(depths.indexOf('door'));
  });

  it('báo danh sách gốc mới chỉ khi nó thật sự đổi', () => {
    expect(diffScenes(baseScene, baseScene).rootNodeIds).toBeUndefined();
    expect(diffScenes({ nodes: {}, rootNodeIds: [] }, baseScene).rootNodeIds).toEqual(
      baseScene.rootNodeIds,
    );
  });
});
