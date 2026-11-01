/**
 * Cảnh 3D phần 2 (FE-F): bồn cầu thừa → lavabo, tủ đầu giường chỉ sát giường, đồ gợi ý chỉ là
 * viền mỏng trên sàn (C6), lỗi đặt đồ (C7) và lan can kính 1,4 m của lô gia.
 */

import { describe, expect, it } from 'vitest';

import { createSampleBuilding, sampleLevelId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import type { Furniture, Opening, Point, Room, SpatialGraph, Wall } from '@/domain/spatial/types';

import { scenePlacementIssues } from '../placement';
import { isGeneratedNodeId, LOGGIA_RAILING_MM, UNCONFIRMED_MATERIAL_REF } from '../sceneDressing';
import { contextRolesOf } from '../sceneVariety';
import { toPascalScene } from '../toPascal';
import { toSpatialGraph } from '../toSpatial';
import type { PascalItemNode, PascalWallNode } from '../types';

const LEVEL = sampleLevelId(0);
const meta = { source: 'ai', reviewed: false, confidence: 0.9 } as const;

const item = (id: string, kind: Furniture['kind'], cx: number, cy: number, w: number, d: number, extra: Partial<Furniture> = {}): Furniture =>
  ({
    ...meta,
    id,
    levelId: LEVEL,
    kind,
    centre: { x: cx, y: cy },
    boundingBox: { min: { x: -w / 2, y: -d / 2 }, max: { x: w / 2, y: d / 2 } },
    rotationDeg: 0,
    ...extra,
  }) as Furniture;
const room = (id: string, usage: Room['usage'], outline: Point[]): Room =>
  ({ ...meta, id, levelId: LEVEL, name: id, usage, outline, areaM2: 10, wallIds: [] }) as unknown as Room;
const wall = (id: string, start: Point, end: Point, kind: Wall['kind'] = 'envelope'): Wall =>
  ({ ...meta, id, levelId: LEVEL, centreline: { start, end }, thicknessMm: 200, heightMm: 2800, kind, openingIds: [] }) as unknown as Wall;
const square = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];
const graphOf = (parts: Partial<SpatialGraph>): SpatialGraph => ({
  ...createSampleBuilding(),
  walls: [],
  openings: [],
  rooms: [],
  furniture: [],
  ...parts,
});
const itemsOf = (graph: SpatialGraph): PascalItemNode[] =>
  Object.values(toPascalScene(graph).scene.nodes).filter((n): n is PascalItemNode => n.type === 'item');

describe('vai trò theo ngữ cảnh phòng (FE-A dở)', () => {
  const bath = room('R-BATH', 'bathroom', square(0, 0, 3000, 3000));
  const toilets = [0.9, 0.5, 0.7].map((confidence, i) =>
    item(`F-T${String(i)}`, 'sanitaryFixture', 500 + i * 800, 500, 400, 700, { roomId: bath.id, confidence }),
  );

  it('quá 2 bồn cầu một phòng: món độ tin thấp nhất thành lavabo, không ghi variant', () => {
    const roles = contextRolesOf(toilets, () => 'bathroom');
    expect([...roles]).toEqual([['F-T1', 'basin']]);

    const nodes = itemsOf(graphOf({ rooms: [bath], furniture: toilets }));
    const srcOf = (id: string) => nodes.find((n) => n.id === `item_${id}`)?.asset.src;
    expect(srcOf('F-T1')).toBe('/items/bathroom-sink/model.glb');
    expect(srcOf('F-T0')).toBe('/items/toilet/model.glb');
    expect(srcOf('F-T2')).toBe('/items/toilet/model.glb');
    expect(nodes.find((n) => n.id === 'item_F-T1')?.metadata?.appfront?.fields?.['variant']).toBeUndefined();
  });

  it('bàn nhỏ phòng ngủ: tủ đầu giường khi cách giường ≤ 0,3 m, xa hơn là bàn phụ', () => {
    const bed = item('F-BED', 'bed', 2000, 2000, 1600, 2000, { roomId: 'R-BED' as Room['id'] });
    const near = item('F-NEAR', 'table', 2000 + 800 + 200 + 250, 1200, 500, 400, { roomId: 'R-BED' as Room['id'] });
    const far = item('F-FAR', 'table', 4500, 3500, 500, 400, { roomId: 'R-BED' as Room['id'] });
    const roles = contextRolesOf([bed, near, far], () => 'bedroom');
    expect(roles.get('F-NEAR')).toBeUndefined();
    expect(roles.get('F-FAR')).toBe('coffeeTable');
  });
});

describe('C6 — đồ gợi ý chưa nhận là viền mỏng trên sàn', () => {
  const suggested = item('F-SUG', 'wardrobe', 1000, 1000, 1200, 600, { suggested: true });

  it('không dựng khối 3D: tấm ≤ 5 mm, vật liệu chưa xác nhận, đồ sinh ra', () => {
    const nodes = itemsOf(graphOf({ furniture: [suggested] }));
    expect(nodes.find((n) => n.id === 'item_F-SUG')).toBeUndefined();
    const outline = nodes.find((n) => n.id === 'item_DRESS-suggested-F-SUG');
    expect(outline).toBeDefined();
    expect(outline!.asset.dimensions[1]).toBeLessThanOrEqual(0.005);
    expect(Object.values(outline!.slots ?? {})).toEqual([UNCONFIRMED_MATERIAL_REF]);
    expect(outline!.metadata?.['generated']).toBe('part');
    expect(isGeneratedNodeId(outline!.id)).toBe(true);
  });

  it('không vào lượt lưu', () => {
    const { scene } = toPascalScene(graphOf({ furniture: [suggested] }));
    expect(toSpatialGraph(scene).graph.furniture).toEqual([]);
  });
});

describe('C7 — scenePlacementIssues', () => {
  it('báo chồng > 30 %, chắn cửa, lấn tường; chồng ít, thảm và đồ gợi ý thì không', () => {
    const w = wall('W-1', { x: 0, y: 0 }, { x: 6000, y: 0 }, 'partition');
    const door = { ...meta, id: 'O-1', wallId: 'W-1', kind: 'door', offsetMm: 4000, widthMm: 900, heightMm: 2100, sillHeightMm: 0, swing: 'left' } as unknown as Opening;
    const graph = graphOf({
      walls: [w],
      openings: [door],
      furniture: [
        item('F-A', 'bed', 1500, 2000, 1000, 1000),
        item('F-B', 'wardrobe', 1900, 2000, 1000, 1000), // chồng 60 %
        item('F-C', 'table', 1500, 3200, 1000, 1000), // chồng F-A 0 %
        item('F-D', 'chair', 1500, 3900, 1000, 600), // chồng F-C 10 %
        item('F-RUG', 'other', 1500, 2000, 2000, 2000, { heightMm: 10 } as Partial<Furniture>),
        item('F-SUG', 'bed', 1500, 2000, 1000, 1000, { suggested: true }),
        item('F-DOOR', 'chair', 4450, 500, 400, 400),
        item('F-WALL', 'wardrobe', 2500, 100, 600, 600),
      ],
    });
    const issues = scenePlacementIssues(graph);
    expect(issues.filter((i) => i.kind === 'overlap').map((i) => i.furnitureIds)).toEqual([['F-A', 'F-B']]);
    expect(issues.filter((i) => i.kind === 'doorSwing').map((i) => i.furnitureIds[0])).toEqual(['F-DOOR']);
    expect(issues.filter((i) => i.kind === 'wall').map((i) => i.furnitureIds[0])).toEqual(['F-WALL']);
    expect(issues[0]?.message).toBe('Giường chồng lên tủ áo');
  });
});

describe('lan can lô gia', () => {
  // Lô gia 0..3000 × 0..1500, tường bao y = 0 ra ngoài căn; tường y = 1500 giáp phòng khách.
  const loggia = room('R-LOG', 'loggia', square(0, 0, 3000, 1500));
  const living = room('R-LIV', 'livingRoom', square(0, 1500, 3000, 5000));
  const outer = wall('W-OUT', { x: 0, y: 0 }, { x: 3000, y: 0 });
  const inner = wall('W-IN', { x: 0, y: 1500 }, { x: 3000, y: 1500 });

  it('tường bao giáp lô gia và ngoài căn: lan can kính 1,4 m, tường gốc ẩn nhưng giữ số đo', () => {
    const graph = graphOf({ walls: [outer, inner], rooms: [loggia, living] });
    const { scene } = toPascalScene(graph);
    const outerNode = scene.nodes['wall_W-OUT' as keyof typeof scene.nodes] as PascalWallNode;
    expect(outerNode.visible).toBe(false);
    expect(outerNode.height).toBeCloseTo(2.8);
    const railing = scene.nodes['item_DRESS-railing-W-OUT' as keyof typeof scene.nodes] as PascalItemNode;
    expect(railing.asset.dimensions[1]).toBeCloseTo(LOGGIA_RAILING_MM / 1000);
    expect(railing.asset.dimensions[0]).toBeCloseTo(3);
    expect((scene.nodes['wall_W-IN' as keyof typeof scene.nodes] as PascalWallNode).visible).not.toBe(false);
    expect(scene.nodes['item_DRESS-railing-W-IN' as keyof typeof scene.nodes]).toBeUndefined();

    const back = toSpatialGraph(scene).graph;
    expect(back.walls.map((w) => w.heightMm)).toEqual([2800, 2800]);
    expect(back.furniture).toEqual([]);
  });
});
