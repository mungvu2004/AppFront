/**
 * Bày đồ cho phòng trống (U12c): luật chung trên đồ thị tổng hợp — giường tránh cửa, phòng
 * nhỏ để trống, phòng đã có sofa thì không thêm, phòng chữ L mọi món nằm trong outline, và
 * cùng đồ thị (xáo thứ tự) luôn ra cùng kết quả.
 */

import { describe, expect, it } from 'vitest';

import type {
  Furniture,
  Opening,
  Point,
  Room,
  RoomUsage,
  SpatialGraph,
  Wall,
} from '@/domain/spatial/types';

import { SpatialGraphDocumentSchema } from '@/api/schemas/spatialGraph';

import { fixtureF1 } from '../__fixtures__';
import { doorSwingRects, rectCorners, rectInsidePolygon, rectOfFurniture, rectsOverlap, wallRects } from '../placement';
import { furnishEmptyRooms } from '../sceneFurnish';
import { sceneStyleOf } from '../sceneStyles';

const rectCornersOf = (f: Furniture): Point[] => rectCorners(rectOfFurniture(f));

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

const graphOf = (
  rooms: Room[],
  furniture: Furniture[] = [],
  openings: Opening[] = [],
): SpatialGraph =>
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

/** Món nằm chồng trên món khác (tủ treo, chậu, mặt bếp mỏng, TV trên kệ): không xét chồng/vùng mở. */
const STACKED = new Set(['upperRun', 'sink', 'hob', 'tv']);

/** Mọi món sinh ra: trong outline lùi 100, cách nhau ≥ 50, không lấn vùng mở cửa. */
const expectValid = (graph: SpatialGraph, all_: readonly Furniture[]): void => {
  const items = all_.filter((f) => !STACKED.has(f.variant ?? ''));
  const swings = doorSwingRects(graph, 'L-1');
  const all = [...graph.furniture, ...items];
  for (const item of items) {
    const host = graph.rooms.find((r) => r.id === item.roomId) as Room;
    const rect = rectOfFurniture(item);
    expect(rectInsidePolygon(rect, host.outline, 100), item.id).toBe(true);
    expect(
      swings.some((s) => rectsOverlap(rect, s)),
      item.id,
    ).toBe(false);
    // Không cắt thân tường nào cùng tầng (C2).
    for (const wall of wallRects(graph, 'L-1')) expect(rectsOverlap(rect, wall), `${item.id}/wall`).toBe(false);
    for (const other of all) {
      if (other !== item)
        expect(rectsOverlap(rect, rectOfFurniture(other), 50), `${item.id}/${other.id}`).toBe(
          false,
        );
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

  it('phòng khách đã có sofa thật → không thêm bộ sofa; phòng thưa chỉ được bù theo danh sách + tối đa 1 cây', () => {
    // C2: trước đây mong đợi [] — nay luật mật độ bù cho phòng 16 m² chỉ có 1 món.
    const living = room('R-LIV', 'livingRoom', [
      { x: 0, y: 0 },
      { x: 4500, y: 0 },
      { x: 4500, y: 3600 },
      { x: 0, y: 3600 },
    ]);
    const graph = graphOf([living], [realSofa('R-LIV', 2250, 600)]);
    const items = furnishEmptyRooms(graph, style);
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((f) => ['sofa', 'tv'].includes(f.variant ?? '') || f.heightMm === 400)).toBe(false);
    expect(items.filter((f) => f.variant === 'plant').length).toBeLessThanOrEqual(1);
    expectValid(graph, items);
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

  const square = (id: string, usage: RoomUsage, x0: number, w: number, d: number): Room =>
    room(id, usage, [
      { x: x0, y: 0 },
      { x: x0 + w, y: 0 },
      { x: x0 + w, y: d },
      { x: x0, y: d },
    ]);

  it('cửa sổ không chặn đầu giường: phòng 3 × 3 m có cửa sổ giữa cả 4 tường vẫn có giường', () => {
    const r = square('R-WIN', 'bedroom', 0, 3000, 3000);
    const windows = [0, 1, 2, 3].map(
      (i) =>
        ({
          ...META,
          id: `D-W${i}`,
          wallId: `W-R-WIN-${i}`,
          kind: 'window',
          offsetMm: 900,
          widthMm: 1200,
          heightMm: 1200,
          sillHeightMm: 900,
          swing: 'fixed',
        }) as Opening,
    );
    const graph = graphOf([r], [], windows);
    const items = furnishEmptyRooms(graph, style);
    expect(items.filter((f) => f.kind === 'bed')).toHaveLength(1);
    expectValid(graph, items);
  });

  it('phòng khách nhỏ 3 × 2,9 m (8,7 m²) vẫn có sofa', () => {
    const graph = graphOf([square('R-SMALL', 'livingRoom', 0, 3000, 2900)]);
    const items = furnishEmptyRooms(graph, style);
    expect(items.some((f) => f.variant === 'sofa')).toBe(true);
    expectValid(graph, items);
  });

  it('D10: bếp cùng tầng có bàn ăn → phòng khách không thêm bàn thứ hai (bất kể thứ tự id); TV chỉ đi với sofa', () => {
    // id phòng khách xếp TRƯỚC bếp: luật vẫn phải để bàn của bếp thắng.
    const graph = graphOf([
      square('R-A', 'livingRoom', 0, 6000, 4000),
      square('R-Z', 'kitchen', 7000, 4000, 3000),
    ]);
    const items = furnishEmptyRooms(graph, style);
    const tables = items.filter((f) => f.variant === 'table');
    expect(tables.map((f) => f.roomId)).toEqual(['R-Z']);
    for (const tv of items.filter((f) => f.variant === 'tv')) {
      expect(items.some((f) => f.variant === 'sofa' && f.roomId === tv.roomId)).toBe(true);
    }
    expectValid(graph, items);
  });

  it('tủ áo thật chiếm giữa mọi tường → sofa trượt về một đầu đoạn trống', () => {
    const box = (id: string, x0: number, y0: number, x1: number, y1: number): Furniture =>
      ({
        ...realSofa('R-SLIDE', 0, 0),
        id,
        kind: 'wardrobe',
        variant: 'wardrobe',
        centre: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 },
        boundingBox: { min: { x: x0, y: y0 }, max: { x: x1, y: y1 } },
      }) as Furniture;
    const wardrobes = [
      box('F-A', 2400, 100, 3600, 700),
      box('F-B', 2400, 1900, 3600, 2500),
      box('F-C', 100, 1300, 700, 2000),
      box('F-D', 5300, 1300, 5900, 2000),
    ];
    const graph = graphOf([square('R-SLIDE', 'livingRoom', 0, 6000, 2600)], wardrobes);
    const items = furnishEmptyRooms(graph, style);
    const sofa = items.find((f) => f.variant === 'sofa');
    expect(sofa).toBeDefined();
    expect(Math.abs((sofa?.centre.x ?? 3000) - 3000)).toBeGreaterThan(1000);
    expectValid(graph, items);
  });

  it('D10: bàn ăn thật trong bếp cùng tầng chặn bàn sinh ở phòng khách', () => {
    const realTable = {
      ...realSofa('R-Z', 9000, 1500),
      id: 'F-T',
      kind: 'table',
      variant: 'table',
      boundingBox: { min: { x: 8300, y: 1100 }, max: { x: 9700, y: 1900 } },
    } as Furniture;
    const graph = graphOf(
      [square('R-A', 'livingRoom', 0, 6000, 4000), square('R-Z', 'kitchen', 7000, 4000, 3000)],
      [realTable],
    );
    expect(furnishEmptyRooms(graph, style).filter((f) => f.variant === 'table')).toEqual([]);
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
    const furniture = [
      wardrobe,
      {
        ...realSofa('R-KIT', 6750, 3000),
        id: 'F-K',
        variant: 'baseRun',
        kind: 'kitchenCabinet',
      } as Furniture,
    ];
    const a = graphOf(rooms, furniture, [door]);
    const b = {
      ...a,
      rooms: [...rooms].reverse(),
      furniture: [...furniture].reverse(),
      walls: [...a.walls].reverse(),
    };

    const first = furnishEmptyRooms(a, style);
    expect(first.length).toBeGreaterThan(0);
    expect(furnishEmptyRooms(b, style)).toEqual(first);
    expectValid(a, first);
  });

  // ——— C2: luật bày đồ mới ———

  const win = (id: string, wallId: string, offsetMm: number, widthMm: number): Opening =>
    ({ ...META, id, wallId, kind: 'window', offsetMm, widthMm, heightMm: 1200, sillHeightMm: 900, swing: 'fixed' }) as Opening;
  const realOf = (id: string, roomId: string, kind: Furniture['kind'], variant: Furniture['variant'], x0: number, y0: number, x1: number, y1: number): Furniture =>
    ({
      ...realSofa(roomId, 0, 0),
      id,
      kind,
      variant,
      centre: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 },
      boundingBox: { min: { x: x0, y: y0 }, max: { x: x1, y: y1 } },
    }) as Furniture;

  it('D10 hai chiều: bàn ăn thật ở phòng khách → bếp mở cùng tầng không thêm bộ bàn ăn thứ hai', () => {
    const graph = graphOf(
      [square('R-A', 'livingRoom', 0, 6000, 4000), square('R-Z', 'kitchen', 7000, 4000, 3000)],
      [realOf('F-T', 'R-A', 'table', 'table', 2300, 1600, 3700, 2400)],
    );
    const items = furnishEmptyRooms(graph, style);
    expect(items.filter((f) => f.kind === 'table' && f.roomId === 'R-Z')).toEqual([]);
    expect(items.filter((f) => f.variant === 'chair')).toEqual([]);
  });

  it('F1: bếp mở thông phòng khách đã có bàn ăn thật → không sinh bộ bàn thứ hai (trước C2: bàn + 3 ghế)', () => {
    const graph = SpatialGraphDocumentSchema.parse(fixtureF1({ ext: true }).doc).graph;
    const items = furnishEmptyRooms(graph, style);
    expect(items.filter((f) => f.kind === 'table' || f.kind === 'chair')).toEqual([]);
    for (const item of items) {
      for (const wall of wallRects(graph, item.levelId)) expect(rectsOverlap(rectOfFurniture(item), wall), item.id).toBe(false);
    }
  });

  it('bếp 9–10 m² không có bàn → bàn nhỏ + 2 ghế; cùng tầng đã có bàn ăn → không', () => {
    const kitchen = square('R-K', 'kitchen', 0, 3000, 3100);
    const graph = graphOf([kitchen]);
    const items = furnishEmptyRooms(graph, style);
    const table = items.find((f) => f.kind === 'table');
    expect(table).toBeDefined();
    expect(rectOfFurniture(table as Furniture)).toMatchObject({ w: 900, d: 700 });
    expect(items.filter((f) => f.variant === 'chair')).toHaveLength(2);
    expectValid(graph, items);

    const withLiving = graphOf(
      [kitchen, square('R-L', 'livingRoom', 4000, 5000, 4000)],
      [realOf('F-T', 'R-L', 'table', 'table', 5800, 1600, 7200, 2400)],
    );
    // Bếp vẫn có dãy tủ (mọi cỡ), nhưng không bộ bàn ăn thứ hai.
    expect(furnishEmptyRooms(withLiving, style).filter((f) => f.roomId === 'R-K' && (f.kind === 'table' || f.kind === 'chair'))).toEqual([]);
  });

  it('phòng ngủ ≥ 12 m² trống → giường + tủ áo/tủ thấp + góc bàn làm việc hoặc ghế bành, tất cả hợp lệ', () => {
    const r = square('R-BIG', 'bedroom', 0, 4000, 4000);
    const graph = graphOf([r]);
    const items = furnishEmptyRooms(graph, style);
    const variants = items.map((f) => f.variant ?? f.kind);
    expect(variants).toContain('bed');
    expect(variants.some((v) => v === 'wardrobe' || v === 'cabinet')).toBe(true);
    expect(items.some((f) => f.id.startsWith('DRESS-desk-') || f.variant === 'armchair')).toBe(true);
    expectValid(graph, items);
  });

  it('phòng ngủ < 12 m² chỉ có giường + tủ đầu giường (không tủ áo/bàn)', () => {
    const graph = graphOf([square('R-MID', 'bedroom', 0, 3300, 3300)]);
    const items = furnishEmptyRooms(graph, style);
    expect(items.some((f) => f.variant === 'wardrobe' || f.id.startsWith('DRESS-desk-'))).toBe(false);
  });

  it('phòng ngủ đã có tủ áo thật → không thêm tủ áo', () => {
    const graph = graphOf(
      [square('R-BIG', 'bedroom', 0, 4000, 4000)],
      [realOf('F-W', 'R-BIG', 'wardrobe', 'wardrobe', 1000, 3300, 3000, 3900)],
    );
    const items = furnishEmptyRooms(graph, style);
    expect(items.some((f) => f.variant === 'wardrobe' || f.variant === 'cabinet')).toBe(false);
    expectValid(graph, items);
  });

  it('phòng khách trống (tầng có bếp riêng) → sofa + bàn nước + đèn cây + bàn phụ cạnh sofa; đủ ~1 món / 4 m²', () => {
    const r = square('R-LV', 'livingRoom', 0, 5000, 4000);
    const graph = graphOf([r, square('R-KX', 'kitchen', 6000, 3000, 3000)]);
    const items = furnishEmptyRooms(graph, style).filter((f) => f.roomId === 'R-LV');
    const variants = items.map((f) => f.variant);
    expect(variants).toEqual(expect.arrayContaining(['sofa', 'floorLamp', 'sideTable']));
    expect(items.filter((f) => (f.liftMm ?? 0) === 0).length).toBeGreaterThanOrEqual(5);
    expectValid(graph, items);
  });

  it("TV không đặt trước cửa sổ: cửa sổ giữa tường đối diện sofa → TV trượt sang đoạn tường trống", () => {
    const r = square('R-TV', 'livingRoom', 0, 6000, 4000);
    // Sofa tựa tường y = 0 (cạnh 0, dài nhất); tường đối diện y = 4000 (cạnh 2) có cửa sổ 1800 ở giữa.
    const graph = graphOf([r], [], [win('O-W', 'W-R-TV-2', 2100, 1800)]);
    const items = furnishEmptyRooms(graph, style);
    const tv = items.find((f) => f.variant === 'tv');
    expect(tv).toBeDefined();
    // Cửa sổ chiếm x ∈ [2100, 3900] trên tường y = 4000 (tường đi từ x = 6000 về 0).
    const { min, max } = (tv as Furniture).boundingBox;
    expect(max.x <= 2100 - 100 || min.x >= 3900 + 100).toBe(true);
    expectValid(graph, items);
  });

  it("phòng 'other' ≥ 8 m² → phòng đọc (bàn + ghế + giá sách); < 8 m² → không", () => {
    const study = square('R-ST', 'other', 0, 3000, 3000);
    const graph = graphOf([study]);
    const items = furnishEmptyRooms(graph, style);
    expect(items.some((f) => f.id.startsWith('DRESS-desk-'))).toBe(true);
    expect(items.some((f) => f.id.startsWith('DRESS-deskChair-'))).toBe(true);
    expectValid(graph, items);
    expect(furnishEmptyRooms(graphOf([square('R-SM', 'other', 0, 2500, 3000)]), style)).toEqual([]);
  });

  it("ban công/terassi ('other', decking hoặc tên ngoài trời) → chỉ ghế nằm + chậu cây", () => {
    for (const outdoor of [
      { ...square('R-BAL', 'other', 0, 4000, 3000), finish: 'decking' } as Room,
      { ...square('R-BAL', 'other', 0, 4000, 3000), name: 'Terassi' } as Room,
    ]) {
      const graph = graphOf([outdoor]);
      const items = furnishEmptyRooms(graph, style);
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((f) => f.variant === 'lounger' || f.variant === 'planter')).toBe(true);
      expectValid(graph, items);
    }
  });

  it('S7: lô-gia hẹp 1,4 × 4 m → hàng luống cây dọc lan can (không ghế nằm), tối đa 6, tất định', () => {
    const loggia = square('R-LG', 'loggia', 0, 1400, 4000);
    const graph = graphOf([loggia]);
    const items = furnishEmptyRooms(graph, style);
    expect(items.every((f) => f.variant === 'planter')).toBe(true);
    // Luống 1200 cách 400: 2 luống mỗi cạnh dài 4 m, cạnh ngắn không đủ chỗ.
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.length).toBeLessThanOrEqual(6);
    expectValid(graph, items);
    expect(furnishEmptyRooms(graphOf([square('R-LG', 'loggia', 0, 1400, 4000)]), style)).toEqual(items);
  });

  it('S7: phòng khách rộng 6 × 5 m → dày đồ (~1 món / 2,5 m²) nhưng tối đa 4 cây bù', () => {
    const graph = graphOf([square('R-BIGLV', 'livingRoom', 0, 6000, 5000)]);
    const items = furnishEmptyRooms(graph, style);
    expect(items.filter((f) => f.variant === 'plant').length).toBeLessThanOrEqual(4);
    expect(items.filter((f) => (f.liftMm ?? 0) === 0).length).toBeGreaterThanOrEqual(6);
    expectValid(graph, items);
  });

  it('tủ áo (món cao) không che cửa sổ', () => {
    const r = square('R-WW', 'bedroom', 0, 4000, 4000);
    const windows = [0, 1, 2, 3].map((i) => win(`O-${i}`, `W-R-WW-${i}`, 1400, 1200));
    const graph = graphOf([r], [], windows);
    const items = furnishEmptyRooms(graph, style);
    const wardrobe = items.find((f) => f.variant === 'wardrobe');
    if (wardrobe !== undefined) {
      // Mỗi cửa sổ chiếm [1400, 2600] dọc cạnh của nó; tủ áo 1800 không vừa đoạn trống 1300 → không có.
      throw new Error(`wardrobe placed at ${wardrobe.centre.x},${wardrobe.centre.y}`);
    }
    expectValid(graph, items);
  });

  it('tường ngăn vắt qua phòng (không nằm trên outline) và tường ngoài dày 300: không món nào cắt tường', () => {
    const r = square('R-X', 'livingRoom', 0, 6000, 5000);
    const base = graphOf([r]);
    const thick = base.walls.map((w) => ({ ...w, thicknessMm: 300 }));
    const stub = {
      ...(base.walls[0] as Wall),
      id: 'W-STUB',
      centreline: { start: { x: 3000, y: 2500 }, end: { x: 3000, y: 5000 } },
      thicknessMm: 120,
    } as Wall;
    const graph = { ...base, walls: [...thick, stub] };
    const items = furnishEmptyRooms(graph, style);
    expect(items.some((f) => f.variant === 'sofa')).toBe(true);
    expectValid(graph, items);
  });

  it('phòng khách chữ L thông một phía (cạnh y = 0 không tường) → sofa/TV không tựa cạnh hở', () => {
    const living = room('R-OPEN', 'livingRoom', [
      { x: 0, y: 0 },
      { x: 6000, y: 0 },
      { x: 6000, y: 3000 },
      { x: 3000, y: 3000 },
      { x: 3000, y: 6000 },
      { x: 0, y: 6000 },
    ]);
    const base = graphOf([living]);
    const graph = { ...base, walls: base.walls.filter((w) => w.id !== 'W-R-OPEN-0') };
    const items = furnishEmptyRooms(graph, style);
    const backed = items.filter((f) => f.variant === 'sofa' || f.variant === 'tv');
    expect(backed.some((f) => f.variant === 'sofa')).toBe(true);
    // Tựa cạnh hở thì tâm cách y = 0 đúng 100 + 1 + d/2 ≤ 551 mm.
    for (const f of backed) expect(f.centre.y, f.id).toBeGreaterThan(600);
    expectValid(graph, items);
  });

  const bathDoor = (wallId: string): Opening =>
    ({ ...door, id: `D-${wallId}`, wallId, offsetMm: 200, widthMm: 700 }) as Opening;

  it('phòng tắm 1,6 × 2 m có cửa, chưa có thiết bị → bồn cầu + lavabo, hợp lệ', () => {
    const graph = graphOf([square('R-B1', 'bathroom', 0, 1600, 2000)], [], [bathDoor('W-R-B1-0')]);
    const items = furnishEmptyRooms(graph, style);
    expect(items.filter((f) => f.variant === 'wc')).toHaveLength(1);
    expect(items.filter((f) => f.variant === 'basin')).toHaveLength(1);
    expect(items.every((f) => f.kind === 'sanitaryFixture' || f.kind === 'shower')).toBe(true);
    expectValid(graph, items);
  });

  it('phòng tắm 2 × 2,5 m → thêm khu tắm vòi sen ở góc xa cửa', () => {
    const graph = graphOf([square('R-B2', 'bathroom', 0, 2000, 2500)], [], [bathDoor('W-R-B2-0')]);
    const items = furnishEmptyRooms(graph, style);
    expect(items.map((f) => f.variant).sort()).toEqual(['basin', 'shower', 'wc']);
    const shower = items.find((f) => f.variant === 'shower') as Furniture;
    expect(shower.kind).toBe('shower');
    // Cửa ở tường y = 0, x ∈ [200, 900]: khu tắm ở nửa xa (y lớn).
    expect(shower.centre.y).toBeGreaterThan(1250);
    expectValid(graph, items);
  });

  it('phòng tắm đã có bồn cầu thật → không thêm gì', () => {
    const bath = square('R-B3', 'bathroom', 0, 2000, 2500);
    const wc = {
      ...META,
      id: 'F-WC',
      levelId: 'L-1',
      roomId: 'R-B3',
      kind: 'sanitaryFixture',
      centre: { x: 400, y: 2000 },
      boundingBox: { min: { x: 200, y: 1650 }, max: { x: 600, y: 2350 } },
      rotationDeg: 0,
    } as Furniture;
    expect(furnishEmptyRooms(graphOf([bath], [wc], [bathDoor('W-R-B3-0')]), style)).toEqual([]);
  });

  it('bếp 2,2 × 2,5 m có cửa → dãy tủ dưới + chậu + tủ treo, không bàn ăn', () => {
    const graph = graphOf([square('R-K1', 'kitchen', 0, 2200, 2500)], [], [bathDoor('W-R-K1-0')]);
    const items = furnishEmptyRooms(graph, style);
    const run = items.find((f) => f.variant === 'baseRun');
    expect(run?.kind).toBe('kitchenCabinet');
    expect(items.some((f) => f.variant === 'sink')).toBe(true);
    expect(items.some((f) => f.variant === 'upperRun')).toBe(true);
    expect(items.some((f) => f.kind === 'table')).toBe(false);
    expectValid(graph, items);
  });

  it('bếp mở 43 m² một mình trên tầng → dãy tủ + bộ sofa + bàn ăn', () => {
    const graph = graphOf([square('R-K2', 'kitchen', 0, 8600, 5000)], [], [bathDoor('W-R-K2-0')]);
    const items = furnishEmptyRooms(graph, style);
    const variants = items.map((f) => f.variant);
    expect(variants).toEqual(expect.arrayContaining(['baseRun', 'fridge', 'sink', 'hob', 'sofa', 'chair']));
    // Bàn ăn (cao) và bàn nước (variant `table` thấp 400 → mẫu bàn trà).
    expect(items.some((f) => f.variant === 'table' && f.heightMm === undefined)).toBe(true);
    expect(items.some((f) => f.variant === 'table' && f.heightMm === 400)).toBe(true);
    expectValid(graph, items);
    // Tầng đã có phòng khách → bếp không thêm sofa.
    const withLiving = graphOf([square('R-K2', 'kitchen', 0, 8600, 5000), square('R-LV', 'livingRoom', 9000, 4000, 4000)]);
    expect(furnishEmptyRooms(withLiving, style).filter((f) => f.roomId === 'R-K2').some((f) => f.variant === 'sofa')).toBe(false);
  });

  it('phòng khách cửa ở hai tường đối diện → bàn ăn + chỗ ghế không chắn lối đi giữa hai cửa', () => {
    // Cửa tâm x = 3000 trên tường y = 0 (đi 0→6000) và tường y = 5000 (đi 6000→0).
    const doors = [bathDoor('W-R-LD-0'), bathDoor('W-R-LD-2')].map((d) => ({ ...d, offsetMm: 2550, widthMm: 900 }) as Opening);
    const graph = graphOf([square('R-LD', 'livingRoom', 0, 6000, 5000)], [], doors);
    const items = furnishEmptyRooms(graph, style);
    const table = items.find((f) => f.variant === 'table');
    expect(table).toBeDefined();
    const r = rectOfFurniture(table as Furniture);
    const path = { cx: 3000, cy: 2500, w: 5000, d: 900, rotationDeg: 90 };
    expect(rectsOverlap({ ...r, w: r.w + 1200, d: r.d + 1200 }, path)).toBe(false);
    expectValid(graph, items);
  });

  it('tường phủ < 25 % chu vi (mẫu mock) → vẫn bày như mọi cạnh có tường; ≥ 25 % thì theo tường thật', () => {
    const lv = square('R-MK', 'livingRoom', 0, 4000, 3000); // chu vi 14 m, ngưỡng 3,5 m
    const base = graphOf([lv]);
    const stub = (id: string, x0: number, x1: number, y: number): Wall =>
      ({ ...(base.walls[0] as Wall), id, centreline: { start: { x: x0, y }, end: { x: x1, y } } }) as Wall;
    // 1,8 + 1,5 = 3,3 m (23,6 %): đồ thị tường không mô tả phòng → có sofa.
    const sparse = { ...base, walls: [stub('W-A', 0, 1800, 0), stub('W-B', 0, 1500, 3000)] };
    expect(furnishEmptyRooms(sparse, style).some((f) => f.variant === 'sofa')).toBe(true);
    // 1,8 + 1,8 = 3,6 m (25,7 %): tin tường; không đoạn có tường nào đủ 2 m → không sofa.
    const walled = { ...base, walls: [stub('W-A', 0, 1800, 0), stub('W-B', 0, 1800, 3000)] };
    expect(furnishEmptyRooms(walled, style).some((f) => f.variant === 'sofa')).toBe(false);
  });

  it('phòng khách trống 40 m² → đạt ≥ 70 % mật độ (1 món / 2,5 m²), tối đa 1 cây', () => {
    const graph = graphOf([square('R-LV40', 'livingRoom', 0, 8000, 5000)]);
    const items = furnishEmptyRooms(graph, style);
    const standing = items.filter((f) => (f.liftMm ?? 0) === 0 && f.heightMm !== 20);
    expect(standing.length).toBeGreaterThanOrEqual(Math.ceil(0.7 * Math.floor(40 / 2.5)));
    expect(items.filter((f) => f.variant === 'plant').length).toBeLessThanOrEqual(1);
    expect(new Set(items.map((f) => f.id)).size).toBe(items.length);
    expectValid(graph, items);
  });

  it('hành lang 27 m² rộng 2 m → có đồ dọc một tường, còn lối đi ≥ 900 mm', () => {
    const corridor = square('R-COR', 'corridor', 0, 13500, 2000);
    const end = { ...bathDoor('W-R-COR-1'), offsetMm: 550, widthMm: 900 } as Opening;
    const graph = graphOf([corridor], [], [end]);
    const items = furnishEmptyRooms(graph, style);
    expect(items.length).toBeGreaterThan(0);
    const ys = items.flatMap((f) => rectCornersOf(f).map((p) => p.y));
    const walkway = Math.max(Math.min(...ys), 2000 - Math.max(...ys));
    expect(walkway).toBeGreaterThanOrEqual(900);
    expectValid(graph, items);
    // Hẹp hơn 1,8 m: không bày.
    expect(furnishEmptyRooms(graphOf([square('R-COR', 'corridor', 0, 13500, 1500)]), style)).toEqual([]);
  });

  it('phòng tắm cạnh ngắn ≥ 1,7 m (2,4 × 3 m) → thêm bồn tắm, bồn cầu + lavabo vẫn hợp lệ', () => {
    const graph = graphOf([square('R-B4', 'bathroom', 0, 2400, 3000)], [], [bathDoor('W-R-B4-0')]);
    const items = furnishEmptyRooms(graph, style);
    expect(items.some((f) => f.id.startsWith('DRESS-bathtub-'))).toBe(true);
    expect(items.filter((f) => f.variant === 'wc')).toHaveLength(1);
    expect(items.filter((f) => f.variant === 'basin')).toHaveLength(1);
    expectValid(graph, items);
  });

  it('phòng tắm 2,9 × 1,6 m cửa ở tường ngắn → đủ bồn cầu, lavabo và khu sen (góc kín thì giữa tường)', () => {
    // Cửa trên tường x = 2900 (cạnh 1, đi y 0 → 1600): hai góc phía cửa vướng vùng mở.
    const bath = square('R-B5', 'bathroom', 0, 2900, 1600);
    const graph = graphOf([bath], [], [{ ...bathDoor('W-R-B5-1'), offsetMm: 650, widthMm: 680 } as Opening]);
    const items = furnishEmptyRooms(graph, style);
    expect(items.filter((f) => f.variant === 'wc')).toHaveLength(1);
    expect(items.filter((f) => f.variant === 'basin')).toHaveLength(1);
    expect(items.filter((f) => f.kind === 'shower')).toHaveLength(1);
    expectValid(graph, items);
  });

  it("phòng 'other' / hành lang rộng ≥ 25 m² → bày như phòng khách (sofa + khu ăn), bàn nước giữ variant bàn thấp", () => {
    for (const usage of ['other', 'corridor'] as const) {
      const graph = graphOf([square('R-OPEN', usage, 0, 6500, 5000)]);
      const items = furnishEmptyRooms(graph, style);
      expect(items.some((f) => f.variant === 'sofa'), usage).toBe(true);
      expect(items.some((f) => f.id.startsWith('DRESS-diningTable-')), usage).toBe(true);
      expect(items.some((f) => f.id.startsWith('DRESS-desk-')), usage).toBe(false);
      // Công năng lưu vẫn là 'other'/'corridor': bàn nước phải tự nói mình là bàn thấp.
      expect(items.find((f) => f.id.startsWith('DRESS-coffeeTable-'))?.variant, usage).toBe('table');
      expectValid(graph, items);
    }
    // 'other' 24 m² vẫn là phòng đọc.
    expect(furnishEmptyRooms(graphOf([square('R-OPEN', 'other', 0, 6000, 4000)]), style).some((f) => f.variant === 'sofa')).toBe(false);
  });

  it('bàn ăn gần tường, đủ 4 ghế, không đứng giữa sofa và TV', () => {
    const graph = graphOf([square('R-LV8', 'livingRoom', 0, 8000, 6000)]);
    const items = furnishEmptyRooms(graph, style);
    const table = items.find((f) => f.id.startsWith('DRESS-diningTable-')) as Furniture;
    expect(table).toBeDefined();
    expect(items.filter((f) => f.variant === 'chair')).toHaveLength(4);
    const { x, y } = table.centre;
    // Nửa sâu bàn + khe + ghế + lùi tường + một ô lưới.
    expect(Math.min(x, 8000 - x, y, 6000 - y)).toBeLessThanOrEqual(1300);
    const sofa = items.find((f) => f.variant === 'sofa') as Furniture;
    const tv = items.find((f) => f.variant === 'tv') as Furniture;
    const between = {
      cx: (sofa.centre.x + tv.centre.x) / 2,
      cy: (sofa.centre.y + tv.centre.y) / 2,
      w: 2000,
      d: Math.hypot(tv.centre.x - sofa.centre.x, tv.centre.y - sofa.centre.y),
      rotationDeg: sofa.rotationDeg,
    };
    expect(rectsOverlap(rectOfFurniture(table), between)).toBe(false);
    expectValid(graph, items);
  });

  it('outline phòng chồng nhau → không bày đồ của phòng lớn vào phòng nhỏ', () => {
    const big = square('R-A-LV', 'livingRoom', 0, 7000, 5000);
    const nested = room('R-B-OT', 'other', [
      { x: 4500, y: 0 },
      { x: 7000, y: 0 },
      { x: 7000, y: 2400 },
      { x: 4500, y: 2400 },
    ]);
    const items = furnishEmptyRooms(graphOf([big, nested]), style).filter((f) => f.roomId === 'R-A-LV');
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((f) => f.centre.x > 4500 && f.centre.y < 2400)).toBe(false);
  });
});
