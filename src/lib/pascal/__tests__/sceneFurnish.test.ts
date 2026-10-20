/**
 * Bày đồ cho phòng trống (U12c): luật chung trên đồ thị tổng hợp — giường tránh cửa, phòng
 * nhỏ để trống, phòng đã có sofa thì không thêm, phòng chữ L mọi món nằm trong outline, và
 * cùng đồ thị (xáo thứ tự) luôn ra cùng kết quả.
 */

import { describe, expect, it } from 'vitest';

import type { Furniture, Opening, Point, Room, RoomUsage, SpatialGraph, Wall } from '@/domain/spatial/types';

import { doorSwingRects, rectInsidePolygon, rectOfFurniture, rectsOverlap } from '../placement';
import { furnishEmptyRooms } from '../sceneFurnish';
import { sceneStyleOf } from '../sceneStyles';

const META = { source: 'human', reviewed: true, confidence: 1 } as const;
const style = sceneStyleOf(undefined);

const room = (id: string, usage: RoomUsage, outline: Point[]): Room =>
  ({ ...META, id, levelId: 'L-1', name: id, usage, outline, areaM2: 0, wallIds: [] }) as Room;

/** Tường tâm nằm trên từng cạnh outline. */
const wallsOf = (r: Room): Wall[] =>
  r.outline.map(
    (start, i) =>
      ({
        ...META,
        id: `W-${r.id}-${i}`,
        levelId: 'L-1',
        centreline: { start, end: r.outline[(i + 1) % r.outline.length] as Point },
        thicknessMm: 200,
        heightMm: 2700,
        kind: 'partition',
        openingIds: [],
      }) as Wall,
  );

const graphOf = (rooms: Room[], furniture: Furniture[] = [], openings: Opening[] = []): SpatialGraph =>
  ({
    building: { ...META, name: 'b', datumElevationMm: 0 },
    levels: [{ ...META, id: 'L-1', name: 'T1', order: 0, elevationMm: 0, heightMm: 3000 }],
    walls: rooms.flatMap(wallsOf),
    openings,
    furniture,
    rooms,
    axes: [],
    dimensions: [],
    notes: [],
  }) as SpatialGraph;

const realSofa = (roomId: string, cx: number, cy: number): Furniture =>
  ({
    ...META,
    id: `F-${roomId}-sofa`,
    levelId: 'L-1',
    roomId,
    kind: 'other',
    variant: 'sofa',
    centre: { x: cx, y: cy },
    boundingBox: { min: { x: cx - 850, y: cy - 350 }, max: { x: cx + 850, y: cy + 350 } },
    rotationDeg: 0,
  }) as Furniture;

/** Mọi món sinh ra: trong outline lùi 100, cách nhau ≥ 50, không lấn vùng mở cửa. */
const expectValid = (graph: SpatialGraph, items: readonly Furniture[]): void => {
  const swings = doorSwingRects(graph, 'L-1');
  const all = [...graph.furniture, ...items];
  for (const item of items) {
    const host = graph.rooms.find((r) => r.id === item.roomId) as Room;
    const rect = rectOfFurniture(item);
    expect(rectInsidePolygon(rect, host.outline, 100), item.id).toBe(true);
    expect(swings.some((s) => rectsOverlap(rect, s)), item.id).toBe(false);
    for (const other of all) {
      if (other !== item) expect(rectsOverlap(rect, rectOfFurniture(other), 50), `${item.id}/${other.id}`).toBe(false);
    }
    expect(item.id.startsWith('DRESS-')).toBe(true);
    expect(item).toMatchObject({ source: 'ai', reviewed: false, confidence: 1, levelId: 'L-1' });
  }
};

describe('furnishEmptyRooms', () => {
  // Phòng ngủ 4 × 3,4 m, cửa 900 trên tường y = 0.
  const bedroom = room('R-BED', 'bedroom', [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 3400 },
    { x: 0, y: 3400 },
  ]);
  const door = {
    ...META,
    id: 'D-1',
    wallId: 'W-R-BED-0',
    kind: 'door',
    offsetMm: 300,
    widthMm: 900,
    heightMm: 2100,
    sillHeightMm: 0,
    swing: 'left',
  } as Opening;

  it('phòng ngủ 3,4 × 4 m có cửa → giường đôi tựa tường xa cửa, 2 tủ đầu giường', () => {
    const graph = graphOf([bedroom], [], [door]);
    const items = furnishEmptyRooms(graph, style);
    const bed = items.find((f) => f.kind === 'bed');

    expect(bed).toMatchObject({ variant: 'bed', rotationDeg: 180 });
    expect(bed?.boundingBox.max.x).toBe((bed?.boundingBox.min.x ?? 0) + 1600);
    expect(bed?.centre.y).toBeGreaterThan(1700); // nửa phòng phía không có cửa
    expect(items.filter((f) => f.variant === 'nightstand')).toHaveLength(2);
    expectValid(graph, items);
  });

  it('phòng ngủ nhỏ 2 × 2,5 m → không thêm gì', () => {
    const tiny = room('R-TINY', 'bedroom', [
      { x: 0, y: 0 },
      { x: 2000, y: 0 },
      { x: 2000, y: 2500 },
      { x: 0, y: 2500 },
    ]);
    expect(furnishEmptyRooms(graphOf([tiny]), style)).toEqual([]);
  });

  it('phòng khách đã có sofa thật → không thêm gì', () => {
    const living = room('R-LIV', 'livingRoom', [
      { x: 0, y: 0 },
      { x: 4500, y: 0 },
      { x: 4500, y: 3600 },
      { x: 0, y: 3600 },
    ]);
    expect(furnishEmptyRooms(graphOf([living], [realSofa('R-LIV', 2250, 600)]), style)).toEqual([]);
  });

  it('phòng khách chữ L → bộ sofa + bàn ăn, mọi món nằm trong chữ L', () => {
    const living = room('R-L', 'livingRoom', [
      { x: 0, y: 0 },
      { x: 6000, y: 0 },
      { x: 6000, y: 3000 },
      { x: 3000, y: 3000 },
      { x: 3000, y: 6000 },
      { x: 0, y: 6000 },
    ]);
    const graph = graphOf([living]);
    const items = furnishEmptyRooms(graph, style);
    const variants = items.map((f) => f.variant ?? f.kind);

    expect(variants).toEqual(expect.arrayContaining(['sofa', 'table', 'chair']));
    expect(items.some((f) => f.heightMm === 400)).toBe(true); // bàn nước
    expectValid(graph, items);
  });

  it('tất định: xáo thứ tự phòng và đồ vẫn ra cùng kết quả', () => {
    const kitchen = room('R-KIT', 'kitchen', [
      { x: 5000, y: 0 },
      { x: 8500, y: 0 },
      { x: 8500, y: 3400 },
      { x: 5000, y: 3400 },
    ]);
    const living = room('R-LIV', 'livingRoom', [
      { x: 0, y: 4000 },
      { x: 6000, y: 4000 },
      { x: 6000, y: 8000 },
      { x: 0, y: 8000 },
    ]);
    const wardrobe = {
      ...realSofa('R-BED', 2000, 400),
      id: 'F-W',
      kind: 'wardrobe',
      variant: 'wardrobe',
    } as Furniture;
    const rooms = [bedroom, kitchen, living];
    const furniture = [wardrobe, { ...realSofa('R-KIT', 6750, 3000), id: 'F-K', variant: 'baseRun', kind: 'kitchenCabinet' } as Furniture];
    const a = graphOf(rooms, furniture, [door]);
    const b = { ...a, rooms: [...rooms].reverse(), furniture: [...furniture].reverse(), walls: [...a.walls].reverse() };

    const first = furnishEmptyRooms(a, style);
    expect(first.length).toBeGreaterThan(0);
    expect(furnishEmptyRooms(b, style)).toEqual(first);
    expectValid(a, first);
  });
});
