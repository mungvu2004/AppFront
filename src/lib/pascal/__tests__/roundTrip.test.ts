/**
 * Bộ mẫu chuẩn đi sang Pascal rồi về, và về **đúng bộ cũ**.
 *
 * Đây là phép kiểm mà cả Bước 8 tồn tại để vượt qua. Nó không đo tổng diện
 * tích: `totalArea()` đo hình học ở cả hai đầu nên hai bên luôn bằng nhau,
 * trong khi `areaM2` khai tay là thứ đổi im lặng được — nên bài kiểm so **từng
 * trường của từng phòng** (A14 và chính lời "Đạt khi" của kế hoạch).
 */

import { describe, expect, it } from 'vitest';

import {
  createSampleBuilding,
  SAMPLE_AXIS_COUNT,
  SAMPLE_DIMENSION_COUNT,
  SAMPLE_DOOR_COUNT,
  SAMPLE_FURNITURE_COUNT,
  SAMPLE_LEVEL_COUNT,
  SAMPLE_ROOM_COUNT,
  SAMPLE_WALL_COUNT,
  SAMPLE_WINDOW_COUNT,
} from '@/domain/spatial/__fixtures__/sampleBuilding';
import type { Furniture, SpatialGraph } from '@/domain/spatial/types';

import { BUILDING_NODE_ID, SITE_NODE_ID } from '../ids';
import { toPascalScene } from '../toPascal';
import { toSpatialGraph } from '../toSpatial';
import type { PascalScene, PascalZoneNode } from '../types';

/** Một vòng đổi qua rồi đổi về. */
const roundTrip = (graph: SpatialGraph): SpatialGraph =>
  toSpatialGraph(toPascalScene(graph).scene).graph;

const byId = <T extends { id: string }>(items: readonly T[]): readonly T[] =>
  [...items].sort((left, right) => left.id.localeCompare(right.id));

/** Phần đồ thị mà lượt đi có mang sang — trục, kích thước và ghi chú thì không. */
const surviving = (graph: SpatialGraph): unknown => ({
  building: graph.building,
  levels: byId(graph.levels),
  walls: byId(graph.walls),
  openings: byId(graph.openings),
  furniture: byId(graph.furniture),
  rooms: byId(graph.rooms),
});

const EMPTY_GRAPH: SpatialGraph = {
  building: { confidence: 1, source: 'human', reviewed: false, name: 'Dự án rỗng', datumElevationMm: 0 },
  levels: [],
  walls: [],
  openings: [],
  furniture: [],
  rooms: [],
  axes: [],
  dimensions: [],
  notes: [],
};

describe('toPascalScene — lượt đi', () => {
  const { scene, skipped } = toPascalScene(createSampleBuilding());

  it('dựng đúng một gốc là khu đất, và công trình nằm dưới nó', () => {
    expect(scene.rootNodeIds).toEqual([SITE_NODE_ID]);
    expect(scene.nodes[SITE_NODE_ID]?.type).toBe('site');
    expect(scene.nodes[BUILDING_NODE_ID]?.parentId).toBe(SITE_NODE_ID);
  });

  it('viết đủ bảy loại node, mỗi loại đúng số lượng của bộ mẫu chuẩn', () => {
    const countOf = (type: string): number =>
      Object.values(scene.nodes).filter((node) => node.type === type).length;

    expect(countOf('level')).toBe(SAMPLE_LEVEL_COUNT);
    expect(countOf('wall')).toBe(SAMPLE_WALL_COUNT);
    expect(countOf('door')).toBe(SAMPLE_DOOR_COUNT);
    expect(countOf('window')).toBe(SAMPLE_WINDOW_COUNT);
    expect(countOf('zone')).toBe(SAMPLE_ROOM_COUNT);
    // Mỗi phòng có HAI node: `zone` là khối không gian, `slab` là mặt sàn thật.
    expect(countOf('slab')).toBe(SAMPLE_ROOM_COUNT);
    expect(countOf('item')).toBe(SAMPLE_FURNITURE_COUNT);
  });

  it('bỏ qua trục định vị, kích thước và ghi chú — mỗi thứ kèm một lý do đọc được', () => {
    expect(skipped).toHaveLength(SAMPLE_AXIS_COUNT + SAMPLE_DIMENSION_COUNT + 1);
    expect(skipped.every((item) => item.reason.length > 0)).toBe(true);
    expect(skipped.filter((item) => item.kind === 'trục định vị')).toHaveLength(SAMPLE_AXIS_COUNT);
    expect(skipped.filter((item) => item.kind === 'kích thước')).toHaveLength(SAMPLE_DIMENSION_COUNT);
    expect(skipped.filter((item) => item.kind === 'ghi chú')).toHaveLength(1);
  });

  it('đổi milimét sang mét, không để lọt một số milimét nào', () => {
    const wall = Object.values(scene.nodes).find((node) => node.type === 'wall');

    expect(wall?.type === 'wall' ? wall.thickness : null).toBe(0.22);
    expect(wall?.type === 'wall' ? wall.height : null).toBe(3.6);
  });

  it('đặt ô mở theo tâm, đúng quy ước mà Pascal đọc', () => {
    const door = Object.values(scene.nodes).find((node) => node.type === 'door');

    // Bộ mẫu: cửa rộng 900 mm, mép trái cách đầu tường 300 mm, cao 2 200 mm,
    // bệ 0 → tâm ở 300 + 450 = 750 mm và 0 + 1 100 = 1 100 mm.
    expect(door?.type === 'door' ? door.position : null).toEqual([0.75, 1.1, 0]);
  });
});

describe('vòng tròn AppFront → Pascal → AppFront', () => {
  const original = createSampleBuilding();
  const returned = roundTrip(original);

  it('vẫn đủ 4 tầng, 48 tường, 16 ô mở, 21 đồ đạc, 14 phòng', () => {
    expect(returned.levels).toHaveLength(SAMPLE_LEVEL_COUNT);
    expect(returned.walls).toHaveLength(SAMPLE_WALL_COUNT);
    expect(returned.openings).toHaveLength(SAMPLE_DOOR_COUNT + SAMPLE_WINDOW_COUNT);
    expect(returned.furniture).toHaveLength(SAMPLE_FURNITURE_COUNT);
    expect(returned.rooms).toHaveLength(SAMPLE_ROOM_COUNT);
  });

  it('so từng trường của từng phòng: id, diện tích khai, dấu xác minh', () => {
    const before = byId(original.rooms);
    const after = byId(returned.rooms);

    expect(after.map((room) => room.id)).toEqual(before.map((room) => room.id));
    expect(after.map((room) => room.areaM2)).toEqual(before.map((room) => room.areaM2));
    expect(after.map((room) => room.reviewed)).toEqual(before.map((room) => room.reviewed));
    expect(after.every((room) => room.reviewed)).toBe(true);
  });

  it('không mất một trường nào của năm loại đối tượng còn lại', () => {
    expect(surviving(returned)).toEqual(surviving(original));
  });

  it('trả trục, kích thước và ghi chú về rỗng — lượt đi không mang chúng sang', () => {
    expect(returned.axes).toEqual([]);
    expect(returned.dimensions).toEqual([]);
    expect(returned.notes).toEqual([]);
  });

  it('một trăm vòng liền nhau lệch 0 mm', () => {
    let graph = returned;

    for (let round = 0; round < 99; round += 1) {
      graph = roundTrip(graph);
    }

    expect(surviving(graph)).toEqual(surviving(returned));
  });

  it('giữ nguyên cao độ từng tầng, kể cả khi các tầng không khít nhau', () => {
    const gappy = createSampleBuilding();

    // Tầng trên cùng nhấc thêm 1 200 mm: nếu `baseElevation` bị bỏ trống thì
    // Pascal xếp khít và cao độ này trôi về 10 800.
    gappy.levels = gappy.levels.map((level) =>
      level.order === SAMPLE_LEVEL_COUNT - 1 ? { ...level, elevationMm: 12_000 } : level,
    );

    expect(roundTrip(gappy).levels.map((level) => level.elevationMm)).toEqual([0, 3600, 7200, 12_000]);
  });

  it('giữ góc quay của đồ đạc qua phép đổi độ ↔ radian', () => {
    const turned = createSampleBuilding();
    const first = turned.furniture[0] as Furniture;

    turned.furniture = [{ ...first, rotationDeg: 90 }, ...turned.furniture.slice(1)];

    expect(roundTrip(turned).furniture.find((item) => item.id === first.id)?.rotationDeg).toBe(90);
  });

  it('dự án rỗng ra một cảnh chỉ có khu đất và công trình, rồi về lại rỗng', () => {
    const { scene, skipped } = toPascalScene(EMPTY_GRAPH);

    expect(Object.keys(scene.nodes)).toEqual([BUILDING_NODE_ID, SITE_NODE_ID]);
    expect(skipped).toEqual([]);
    expect(toSpatialGraph(scene).graph).toEqual(EMPTY_GRAPH);
  });
});

describe('A5 — dấu xác minh không đi ngược qua tường', () => {
  const sceneWithStranger = (): PascalScene => {
    const { scene } = toPascalScene(createSampleBuilding());
    const levelId = Object.values(scene.nodes).find((node) => node.type === 'level')?.id ?? '';
    const level = scene.nodes[levelId];
    const stranger: PascalZoneNode = {
      object: 'node',
      // Id do Pascal tự đẻ: thân là nanoid, không phải id AppFront.
      id: 'zone_k3n9qv12ab34cd56',
      type: 'zone',
      name: 'Phòng vẽ trong Pascal',
      parentId: levelId,
      polygon: [
        [0, 0],
        [4, 0],
        [4, 4],
      ],
      spaceRole: 'room',
      boundaryWallIds: [],
      // Bên kia tường khai thẳng rằng phòng này đã được duyệt.
      metadata: { appfront: { confidence: 1, source: 'human', reviewed: true } },
    };

    return {
      rootNodeIds: scene.rootNodeIds,
      nodes: {
        ...scene.nodes,
        [stranger.id]: stranger,
        ...(level !== undefined && level.type === 'level'
          ? { [levelId]: { ...level, children: [...level.children, stranger.id] } }
          : {}),
      },
    };
  };

  it('phòng Pascal tự đẻ về với dấu xác minh TẮT, dù siêu dữ liệu khai là bật', () => {
    const { graph } = toSpatialGraph(sceneWithStranger());
    const stranger = graph.rooms.find((room) => room.name === 'Phòng vẽ trong Pascal');

    expect(stranger).toBeDefined();
    expect(stranger?.reviewed).toBe(false);
    expect(stranger?.source).toBe('human');
  });

  it('cấp cho phòng mới một id AppFront hợp lệ, không giữ id nanoid của Pascal', () => {
    const { graph } = toSpatialGraph(sceneWithStranger());
    const stranger = graph.rooms.find((room) => room.name === 'Phòng vẽ trong Pascal');

    expect(stranger?.id.startsWith('R-')).toBe(true);
  });

  it('tính diện tích cho phòng mới từ đường bao, vì Pascal không khai diện tích', () => {
    const { graph } = toSpatialGraph(sceneWithStranger());
    const stranger = graph.rooms.find((room) => room.name === 'Phòng vẽ trong Pascal');

    // Tam giác 4 m × 4 m = 8 m².
    expect(stranger?.areaM2).toBe(8);
  });
});
