/**
 * Bench-3d đợt 3 (BENCH3D-17): bếp mở trong phòng khách (P1), kệ TV + TV trên kệ, cạnh TV theo trục
 * sofa (P3), vùng chừa trước cửa và lối giữa các cửa cho mọi món (P4), ghế bành theo bộ sofa (P7).
 */

import { describe, expect, it } from 'vitest';

import type { Furniture, Opening, Point, Room, RoomUsage, SpatialGraph, Wall } from '@/domain/spatial/types';

import { rectInsidePolygon, rectOfFurniture, rectsOverlap, wallRects, type Rect } from '../placement';
import { furnishEmptyRooms } from '../sceneFurnish';
import { sceneStyleOf } from '../sceneStyles';

const META = { source: 'human', reviewed: true, confidence: 1 } as const;
const style = sceneStyleOf(undefined);

const room = (id: string, usage: RoomUsage, outline: Point[]): Room =>
  ({ ...META, id, levelId: 'L-1', name: id, usage, outline, areaM2: 0, wallIds: [] }) as Room;
const square = (id: string, usage: RoomUsage, x0: number, w: number, d: number): Room =>
  room(id, usage, [
    { x: x0, y: 0 },
    { x: x0 + w, y: 0 },
    { x: x0 + w, y: d },
    { x: x0, y: d },
  ]);

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

const graphOf = (rooms: Room[], openings: Opening[] = []): SpatialGraph =>
  ({
    building: { ...META, name: 'b', datumElevationMm: 0 },
    levels: [{ ...META, id: 'L-1', name: 'T1', order: 0, elevationMm: 0, heightMm: 3000 }],
    walls: rooms.flatMap(wallsOf),
    openings,
    furniture: [],
    rooms,
    axes: [],
    dimensions: [],
    notes: [],
  }) as SpatialGraph;

const door = (wallId: string, offsetMm: number, widthMm = 900, swing: Opening['swing'] = 'left'): Opening =>
  ({
    ...META,
    id: `D-${wallId}-${offsetMm}`,
    wallId,
    kind: 'door',
    offsetMm,
    widthMm,
    heightMm: 2100,
    sillHeightMm: 0,
    swing,
  }) as Opening;

/** Món chồng trên món khác: không xét chồng. */
const STACKED = new Set(['upperRun', 'sink', 'hob', 'tv']);
const floorItems = (items: readonly Furniture[]): Furniture[] => items.filter((f) => !STACKED.has(f.variant ?? ''));

const expectValid = (graph: SpatialGraph, items: readonly Furniture[]): void => {
  const solid = floorItems(items);
  for (const item of solid) {
    const host = graph.rooms.find((r) => r.id === item.roomId) as Room;
    const rect = rectOfFurniture(item);
    expect(rectInsidePolygon(rect, host.outline, 100), item.id).toBe(true);
    for (const wall of wallRects(graph, 'L-1')) expect(rectsOverlap(rect, wall), `${item.id}/wall`).toBe(false);
    for (const other of solid) {
      if (other !== item) expect(rectsOverlap(rect, rectOfFurniture(other), 50), `${item.id}/${other.id}`).toBe(false);
    }
  }
};

const byRole = (items: readonly Furniture[], role: string): Furniture[] =>
  items.filter((f) => f.id.startsWith(`DRESS-${role}-`));

describe('furnishEmptyRooms — phòng khách (bench-3d đợt 3)', () => {
  it('P1: tầng không có phòng bếp → phòng khách 30 m² kiêm bếp: dãy tủ + bộ sofa + bàn ăn, hợp lệ', () => {
    const graph = graphOf([square('R-LV', 'livingRoom', 0, 6000, 5000)], [door('W-R-LV-0', 300)]);
    const items = furnishEmptyRooms(graph, style);
    const variants = items.map((f) => f.variant);
    expect(variants).toEqual(expect.arrayContaining(['baseRun', 'sink', 'sofa', 'tv']));
    expect(items.some((f) => f.id.startsWith('DRESS-diningTable-') || f.id.startsWith('DRESS-smallTable-'))).toBe(true);
    // Dãy bếp không đứng giữa sofa và TV.
    const sofa = items.find((f) => f.variant === 'sofa') as Furniture;
    const tv = items.find((f) => f.variant === 'tv') as Furniture;
    const view: Rect = {
      cx: (sofa.centre.x + tv.centre.x) / 2,
      cy: (sofa.centre.y + tv.centre.y) / 2,
      w: 2000,
      d: Math.hypot(tv.centre.x - sofa.centre.x, tv.centre.y - sofa.centre.y),
      rotationDeg: sofa.rotationDeg,
    };
    for (const run of byRole(items, 'baseRun')) expect(rectsOverlap(rectOfFurniture(run), view)).toBe(false);
    expectValid(graph, items);
  });

  it('P1: tầng có phòng bếp riêng → phòng khách không có dãy tủ; chỉ phòng khách lớn nhất (≥ 18 m²) kiêm bếp', () => {
    const withKitchen = graphOf([square('R-LV', 'livingRoom', 0, 6000, 5000), square('R-K', 'kitchen', 7000, 2500, 3000)]);
    const a = furnishEmptyRooms(withKitchen, style);
    expect(a.some((f) => f.roomId === 'R-LV' && f.kind === 'kitchenCabinet')).toBe(false);
    expect(a.some((f) => f.roomId === 'R-K' && f.variant === 'baseRun')).toBe(true);

    const two = graphOf([square('R-A', 'livingRoom', 0, 6000, 5000), square('R-B', 'livingRoom', 7000, 5000, 4000)]);
    const b = furnishEmptyRooms(two, style);
    expect(b.filter((f) => f.variant === 'baseRun').map((f) => f.roomId)).toEqual(['R-A']);

    // Dưới 18 m²: không kiêm bếp.
    const small = furnishEmptyRooms(graphOf([square('R-S', 'livingRoom', 0, 4000, 4000)]), style);
    expect(small.some((f) => f.kind === 'kitchenCabinet')).toBe(false);
  });

  it('P3: phòng khách 6 × 4 m → kệ TV tựa tường đối diện sofa, TV đặt trên kệ (liftMm = cao kệ)', () => {
    const graph = graphOf([square('R-TV', 'livingRoom', 0, 6000, 4000), square('R-K', 'kitchen', 7000, 2500, 3000)]);
    const items = furnishEmptyRooms(graph, style).filter((f) => f.roomId === 'R-TV');
    const [stand] = byRole(items, 'tvStand');
    const tv = items.find((f) => f.variant === 'tv');
    const sofa = items.find((f) => f.variant === 'sofa') as Furniture;
    expect(stand).toBeDefined();
    expect(stand?.model?.src).toMatch(/\/items\/tv-stand(-gen)?\/model\.glb$/);
    expect(stand?.variant).toBe('cabinet');
    expect(tv?.liftMm).toBe(stand?.heightMm);
    // TV nằm trọn trên mặt kệ, quay cùng hướng.
    expect(tv?.rotationDeg).toBe(stand?.rotationDeg);
    const r = rectOfFurniture(stand as Furniture);
    expect(Math.abs((tv as Furniture).centre.x - r.cx) + Math.abs((tv as Furniture).centre.y - r.cy)).toBeLessThanOrEqual(r.d / 2);
    // Đối diện sofa: quay ngược chiều.
    expect(Math.abs(((stand as Furniture).rotationDeg - sofa.rotationDeg + 360) % 360)).toBe(180);
    expectValid(graph, items);
  });

  it('P3: phòng chữ L → TV ở cạnh mà trục sofa cắt qua, không ở cạnh lồi lệch khỏi tầm nhìn', () => {
    // Sofa giữa cạnh dài y = 0 (x ≈ 3500) nhìn +y. Cạnh lõm y = 3000 chỉ phủ x ∈ [0, 2500] (gần hơn
    // nhưng lệch trục); cạnh y = 5000 phủ x ∈ [2500, 7000] chứa trục sofa.
    const living = room('R-L', 'livingRoom', [
      { x: 0, y: 0 },
      { x: 7000, y: 0 },
      { x: 7000, y: 5000 },
      { x: 2500, y: 5000 },
      { x: 2500, y: 3000 },
      { x: 0, y: 3000 },
    ]);
    const graph = graphOf([living, square('R-K', 'kitchen', 8000, 2500, 3000)]);
    const items = furnishEmptyRooms(graph, style).filter((f) => f.roomId === 'R-L');
    const sofa = items.find((f) => f.variant === 'sofa') as Furniture;
    const [stand] = byRole(items, 'tvStand');
    expect(sofa.centre.y).toBeLessThan(1000);
    expect(stand).toBeDefined();
    // Kệ tựa cạnh y = 5000 (tâm cách cạnh 100 + 1 + 200 + 1… < 500), không phải cạnh y = 3000.
    expect((stand as Furniture).centre.y).toBeGreaterThan(4500);
    expect((stand as Furniture).centre.x).toBeGreaterThanOrEqual(2500);
    expectValid(graph, items);
  });

  it('P4: phòng khách hai cửa đối diện → không món đứng nào chiếm chỗ đứng trước cửa hay lối 900 mm giữa hai cửa', () => {
    // Cửa tâm x = 1000 trên tường y = 0 (đi 0 → 6000) và x = 5000 trên tường y = 5000 (đi 6000 → 0).
    const graph = graphOf(
      [square('R-LD', 'livingRoom', 0, 6000, 5000), square('R-K', 'kitchen', 7000, 2500, 3000)],
      [door('W-R-LD-0', 550), door('W-R-LD-2', 550)],
    );
    const items = floorItems(furnishEmptyRooms(graph, style).filter((f) => f.roomId === 'R-LD'));
    expect(items.some((f) => f.variant === 'sofa')).toBe(true);
    const zones: Rect[] = [
      // Chỗ đứng: rộng cửa + 2 × 100, sâu 900 từ mặt tường (nửa dày 100).
      { cx: 1000, cy: 100 + 450, w: 1100, d: 900, rotationDeg: 0 },
      { cx: 5000, cy: 5000 - 100 - 450, w: 1100, d: 900, rotationDeg: 0 },
      // Lối nối tâm hai cửa.
      {
        cx: 3000,
        cy: 2500,
        w: Math.hypot(4000, 5000),
        d: 900,
        rotationDeg: (Math.atan2(5000, 4000) * 180) / Math.PI,
      },
    ];
    for (const item of items) {
      for (const zone of zones) expect(rectsOverlap(rectOfFurniture(item), zone), item.id).toBe(false);
    }
  });

  it('P4: phòng ngủ nhỏ ba cửa (lối đi phủ kín) → vẫn có giường, nới vùng chừa từng bậc', () => {
    const graph = graphOf(
      [square('R-BD', 'bedroom', 0, 3000, 3400)],
      [door('W-R-BD-0', 1000), door('W-R-BD-1', 1200), door('W-R-BD-3', 1200)],
    );
    const items = furnishEmptyRooms(graph, style);
    expect(items.filter((f) => f.kind === 'bed')).toHaveLength(1);
    expectValid(graph, items);
  });

  it('P7: phòng khách 40 m² → ghế bành chỉ cạnh bàn nước (không rải dọc tường)', () => {
    const graph = graphOf([square('R-LV40', 'livingRoom', 0, 8000, 5000), square('R-K', 'kitchen', 9000, 2500, 3000)]);
    const items = furnishEmptyRooms(graph, style).filter((f) => f.roomId === 'R-LV40');
    const coffee = byRole(items, 'coffeeTable')[0] as Furniture;
    const chairs = items.filter((f) => f.variant === 'armchair');
    expect(chairs.length).toBeGreaterThanOrEqual(1);
    expect(byRole(items, 'armchairFill')).toEqual([]);
    for (const chair of chairs) {
      expect(Math.hypot(chair.centre.x - coffee.centre.x, chair.centre.y - coffee.centre.y), chair.id).toBeLessThan(1500);
    }
    expectValid(graph, items);
  });

  it('P1: phòng khách 18 m² — bộ sofa chiếm phần lớn tường → vẫn có dãy bếp ngắn (thử dãy ngắn dần, trượt dọc đoạn)', () => {
    for (const doors of [[], [door('W-R-LV18-0', 300)]]) {
      const graph = graphOf([square('R-LV18', 'livingRoom', 0, 4000, 4500)], doors);
      const items = furnishEmptyRooms(graph, style);
      expect(items.some((f) => f.variant === 'sofa')).toBe(true);
      const [run] = byRole(items, 'baseRun');
      expect(run, `cửa ${doors.length}`).toBeDefined();
      expect(rectOfFurniture(run as Furniture).w).toBeGreaterThanOrEqual(1200);
      expectValid(graph, items);
    }
  });

  it('P4: sofa phải nới vùng chừa cửa → đồ phụ (bàn nước, đèn, ghế) vẫn tránh chỗ đứng trước mọi cửa', () => {
    const graph = graphOf(
      [square('R-KL', 'kitchen', 0, 4200, 4800)],
      [door('W-R-KL-0', 1038, 900, 'sliding'), door('W-R-KL-2', 1371, 900, 'sliding'), door('W-R-KL-3', 1214)],
    );
    const items = furnishEmptyRooms(graph, style);
    expect(items.some((f) => f.variant === 'sofa')).toBe(true);
    // Chỗ đứng trước cửa: rộng 900 + 2 × 100, sâu 900 từ mặt tường (nửa dày 100).
    const zones: Rect[] = [
      { cx: 1488, cy: 550, w: 1100, d: 900, rotationDeg: 0 },
      { cx: 4200 - 1371 - 450, cy: 4800 - 550, w: 1100, d: 900, rotationDeg: 0 },
      { cx: 550, cy: 4800 - 1214 - 450, w: 900, d: 1100, rotationDeg: 0 },
    ];
    const extras = ['coffeeTable', 'floorLamp', 'sideTable', 'armchair'].flatMap((r) => byRole(items, r));
    for (const item of extras) {
      for (const zone of zones) expect(rectsOverlap(rectOfFurniture(item), zone), item.id).toBe(false);
    }
    expectValid(graph, items);
  });
});
