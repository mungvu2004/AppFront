/**
 * Đường hỏng của cả hai lượt đổi: **không đối tượng nào rơi không dấu vết.**
 *
 * Một bản vẽ đang dò dở có toạ độ vô hạn, có tường trỏ vào tầng không tồn tại,
 * có phòng hai điểm. Bộ đổi dữ liệu không được ném lỗi vì thứ đó — nó phải viết
 * một dòng lý do. Phép kiểm cuối file là phép đếm: **số node viết ra cộng số
 * dòng bỏ qua phải bằng số đối tượng vào**. Không có nó thì một đối tượng biến
 * mất giữa đường vẫn cho một lượt đổi "thành công".
 */

import { describe, expect, it } from 'vitest';

import type { Furniture, Level, Room, SpatialGraph, Wall } from '@/domain/spatial/types';

import { BUILDING_NODE_ID, SITE_NODE_ID } from '../ids';
import { toPascalScene } from '../toPascal';
import { toSpatialGraph } from '../toSpatial';
import type {
  PascalBuildingNode,
  PascalLevelNode,
  PascalNode,
  PascalScene,
  PascalSiteNode,
} from '../types';

const REVIEW = { confidence: 1, source: 'human', reviewed: false } as const;

const LEVEL: Level = { ...REVIEW, id: 'L-AAAA000001', name: 'Tầng 1', order: 0, elevationMm: 0, heightMm: 3600 };

const WALL: Wall = {
  ...REVIEW,
  id: 'W-AAAA000001',
  levelId: LEVEL.id,
  centreline: { start: { x: 0, y: 0 }, end: { x: 4000, y: 0 } },
  thicknessMm: 220,
  heightMm: 3400,
  kind: 'partition',
  openingIds: [],
};

const ROOM: Room = {
  ...REVIEW,
  id: 'R-AAAA000001',
  levelId: LEVEL.id,
  name: 'Phòng 1',
  usage: 'bedroom',
  outline: [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 4000 },
  ],
  areaM2: 8,
  wallIds: [WALL.id],
};

const ITEM: Furniture = {
  ...REVIEW,
  id: 'F-AAAA000001',
  levelId: LEVEL.id,
  kind: 'table',
  centre: { x: 1000, y: 1000 },
  boundingBox: { min: { x: 600, y: 600 }, max: { x: 1400, y: 1400 } },
  rotationDeg: 0,
};

const graphOf = (parts: Partial<SpatialGraph>): SpatialGraph => ({
  building: { ...REVIEW, name: 'Nhà thử', datumElevationMm: 0 },
  levels: [LEVEL],
  walls: [],
  openings: [],
  furniture: [],
  rooms: [],
  axes: [],
  dimensions: [],
  notes: [],
  ...parts,
});

/** Số node thật sự viết ra, không tính hai node tổng hợp. */
const entityNodeCount = (scene: PascalScene): number =>
  Object.values(scene.nodes).filter((node) => node.type !== 'site' && node.type !== 'building').length;

describe('toPascalScene — đường hỏng', () => {
  it('bỏ qua tầng có cao độ không đo được, và mọi thứ đứng trên tầng ấy', () => {
    const { scene, skipped } = toPascalScene(
      graphOf({
        levels: [{ ...LEVEL, elevationMm: Number.NaN }],
        walls: [WALL],
        rooms: [ROOM],
        furniture: [ITEM],
      }),
    );

    expect(entityNodeCount(scene)).toBe(0);
    expect(skipped.map((item) => item.kind)).toEqual(['tầng', 'tường', 'phòng', 'đồ đạc']);
    expect(skipped[1]?.reason).toContain(LEVEL.id);
  });

  it('bỏ qua tường có trục không đo được, và ô mở trên tường ấy', () => {
    const { scene, skipped } = toPascalScene(
      graphOf({
        walls: [{ ...WALL, centreline: { start: { x: 0, y: 0 }, end: { x: Number.POSITIVE_INFINITY, y: 0 } } }],
        openings: [
          {
            ...REVIEW,
            id: 'D-AAAA000001',
            wallId: WALL.id,
            kind: 'door',
            offsetMm: 300,
            widthMm: 900,
            heightMm: 2200,
            sillHeightMm: 0,
            swing: 'left',
          },
        ],
      }),
    );

    expect(entityNodeCount(scene)).toBe(1);
    expect(skipped.map((item) => item.kind)).toEqual(['tường', 'ô mở']);
    expect(skipped[1]?.reason).toContain(WALL.id);
  });

  it('bỏ qua ô mở có kích thước không đo được, tường vẫn sang', () => {
    const { skipped } = toPascalScene(
      graphOf({
        walls: [WALL],
        openings: [
          {
            ...REVIEW,
            id: 'D-AAAA000002',
            wallId: WALL.id,
            kind: 'window',
            offsetMm: 300,
            widthMm: Number.NaN,
            heightMm: 1400,
            sillHeightMm: 900,
            swing: 'sliding',
          },
        ],
      }),
    );

    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.kind).toBe('ô mở');
  });

  it('bỏ qua phòng có ít hơn ba điểm, và phòng có điểm không đo được', () => {
    const { skipped } = toPascalScene(
      graphOf({
        rooms: [
          { ...ROOM, id: 'R-AAAA000002', outline: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
          { ...ROOM, id: 'R-AAAA000003', outline: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: Number.NaN, y: 2 }] },
        ],
      }),
    );

    expect(skipped).toHaveLength(2);
    expect(skipped[0]?.reason).toContain('ba điểm');
    expect(skipped[1]?.reason).toContain('toạ độ');
  });

  it('bỏ qua đồ đạc có góc quay hoặc hộp bao không đo được', () => {
    const { skipped } = toPascalScene(
      graphOf({ furniture: [{ ...ITEM, rotationDeg: Number.NaN }] }),
    );

    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.kind).toBe('đồ đạc');
  });

  it('số node viết ra cộng số dòng bỏ qua bằng số đối tượng vào', () => {
    const graph = graphOf({
      levels: [LEVEL, { ...LEVEL, id: 'L-AAAA000002', order: 1, elevationMm: Number.NaN }],
      walls: [WALL, { ...WALL, id: 'W-AAAA000002', levelId: 'L-BBBB000009' }],
      rooms: [ROOM],
      furniture: [ITEM],
      axes: [
        {
          ...REVIEW,
          id: 'A-AAAA000001',
          levelId: LEVEL.id,
          label: 'A',
          direction: 'horizontal',
          line: { start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } },
        },
      ],
    });
    const { scene, skipped } = toPascalScene(graph);
    const entered =
      graph.levels.length +
      graph.walls.length +
      graph.openings.length +
      graph.rooms.length +
      graph.furniture.length +
      graph.axes.length +
      graph.dimensions.length +
      graph.notes.length;

    expect(entityNodeCount(scene) + skipped.length).toBe(entered);
  });
});

describe('toSpatialGraph — đường hỏng', () => {
  const sceneOf = (nodes: readonly PascalNode[], rootNodeIds: readonly string[]): PascalScene => ({
    nodes: Object.fromEntries(nodes.map((node) => [node.id, node])),
    rootNodeIds,
  });

  const site = (children: readonly string[]): PascalSiteNode => ({
    object: 'node',
    id: SITE_NODE_ID,
    type: 'site',
    parentId: null,
    children,
  });

  const building = (id: string, children: readonly string[]): PascalBuildingNode => ({
    object: 'node',
    id,
    type: 'building',
    parentId: SITE_NODE_ID,
    children,
  });

  const level = (children: readonly string[]): PascalLevelNode => ({
    object: 'node',
    id: 'level_L-AAAA000001',
    type: 'level',
    parentId: BUILDING_NODE_ID,
    children,
    level: 0,
    baseElevation: 0,
    height: 3.6,
  });

  it('cảnh không có công trình nào cho một đồ thị rỗng, tên công trình mặc định', () => {
    const { graph } = toSpatialGraph(sceneOf([site([])], [SITE_NODE_ID]));

    expect(graph.levels).toEqual([]);
    expect(graph.building.name).toBe('Công trình');
    expect(graph.building.reviewed).toBe(false);
  });

  it('bỏ qua công trình thứ hai, chỉ dựng lại một', () => {
    const { graph, skipped } = toSpatialGraph(
      sceneOf(
        [
          site([BUILDING_NODE_ID, 'building_second']),
          building(BUILDING_NODE_ID, []),
          building('building_second', []),
        ],
        [SITE_NODE_ID],
      ),
    );

    expect(graph.levels).toEqual([]);
    expect(skipped.map((item) => item.id)).toEqual(['building_second']);
  });

  it('bỏ qua tầng có số đo không dùng được', () => {
    const broken: PascalLevelNode = { ...level([]), baseElevation: Number.NaN };
    const { graph, skipped } = toSpatialGraph(
      sceneOf([site([BUILDING_NODE_ID]), building(BUILDING_NODE_ID, [broken.id]), broken], [SITE_NODE_ID]),
    );

    expect(graph.levels).toEqual([]);
    expect(skipped[0]?.kind).toBe('tầng');
  });

  it('bỏ qua loại node AppFront không có, kèm tên loại trong lý do', () => {
    const roof = { object: 'node', id: 'roof_abc', type: 'roof', parentId: 'level_L-AAAA000001', children: [] };
    const { graph, skipped } = toSpatialGraph(
      sceneOf(
        [
          site([BUILDING_NODE_ID]),
          building(BUILDING_NODE_ID, ['level_L-AAAA000001']),
          level(['roof_abc']),
          roof as unknown as PascalNode,
        ],
        [SITE_NODE_ID],
      ),
    );

    expect(graph.walls).toEqual([]);
    expect(skipped[0]?.reason).toContain('roof');
  });

  it('bỏ qua node lạ gắn dưới tường, tường vẫn dựng lại', () => {
    const wall: PascalNode = {
      object: 'node',
      id: 'wall_W-AAAA000001',
      type: 'wall',
      parentId: 'level_L-AAAA000001',
      children: ['shelf_abc'],
      start: [0, 0],
      end: [4, 0],
      thickness: 0.22,
      height: 3.4,
    };
    const shelf = { object: 'node', id: 'shelf_abc', type: 'shelf', parentId: wall.id, children: [] };
    const { graph, skipped } = toSpatialGraph(
      sceneOf(
        [
          site([BUILDING_NODE_ID]),
          building(BUILDING_NODE_ID, ['level_L-AAAA000001']),
          level([wall.id]),
          wall,
          shelf as unknown as PascalNode,
        ],
        [SITE_NODE_ID],
      ),
    );

    expect(graph.walls).toHaveLength(1);
    expect(graph.walls[0]?.openingIds).toEqual([]);
    expect(skipped[0]?.id).toBe('shelf_abc');
  });

  it('dựng hộp bao quanh tâm cho đồ đạc Pascal đặt, khi siêu dữ liệu không có hộp', () => {
    const item: PascalNode = {
      object: 'node',
      id: 'item_qv12ab34cd56',
      type: 'item',
      parentId: 'level_L-AAAA000001',
      position: [2, 0, 3],
      rotation: [0, 0, 0],
      asset: {
        id: 'x',
        category: 'table',
        name: 'bàn',
        thumbnail: '',
        src: 'asset://x',
        dimensions: [0.8, 0.75, 0.6],
      },
    };
    const { graph } = toSpatialGraph(
      sceneOf(
        [site([BUILDING_NODE_ID]), building(BUILDING_NODE_ID, ['level_L-AAAA000001']), level([item.id]), item],
        [SITE_NODE_ID],
      ),
    );

    expect(graph.furniture[0]?.boundingBox).toEqual({
      min: { x: 1600, y: 2700 },
      max: { x: 2400, y: 3300 },
    });
  });

  it('không đưa vào đồ thị node mồ côi, thứ người dùng không thấy', () => {
    const orphan: PascalNode = {
      object: 'node',
      id: 'wall_W-AAAA000009',
      type: 'wall',
      parentId: null,
      children: [],
      start: [0, 0],
      end: [1, 0],
      thickness: 0.22,
      height: 3.4,
    };
    const { graph } = toSpatialGraph(
      sceneOf(
        [site([BUILDING_NODE_ID]), building(BUILDING_NODE_ID, ['level_L-AAAA000001']), level([]), orphan],
        [SITE_NODE_ID],
      ),
    );

    expect(graph.walls).toEqual([]);
  });

  it('đọc được cảnh mà gốc là chính công trình, không qua khu đất', () => {
    const { graph } = toSpatialGraph(
      sceneOf([building(BUILDING_NODE_ID, ['level_L-AAAA000001']), level([])], [BUILDING_NODE_ID]),
    );

    expect(graph.levels).toHaveLength(1);
  });
});
