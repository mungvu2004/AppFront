import { describe, expect, it } from 'vitest';

import type {
  Furniture,
  FurnitureKind,
  FurnitureVariant,
  Opening,
  Room,
  RoomUsage,
  SpatialGraph,
  Wall,
} from '@/domain/spatial/types';

import { doorSwingRects, rectInsidePolygon, rectOfFurniture, rectsOverlap } from '../placement';
import { dressingOf } from '../sceneDressingRules';
import { sceneStyleOf } from '../sceneStyles';

const META = { confidence: 1, source: 'human', reviewed: true } as const;
const LEVEL = 'L-1' as const;
const STYLE = sceneStyleOf(undefined);

const roomOf = (id: string, usage: RoomUsage, w: number, d: number, x0 = 0): Room => ({
  ...META,
  id: `R-${id}`,
  levelId: LEVEL,
  name: id,
  usage,
  outline: [
    { x: x0, y: 0 },
    { x: x0 + w, y: 0 },
    { x: x0 + w, y: d },
    { x: x0, y: d },
  ],
  areaM2: (w * d) / 1e6,
  wallIds: [],
});

const piece = (
  id: string,
  kind: FurnitureKind,
  roomId: string | undefined,
  [cx, cy]: readonly [number, number],
  [w, d]: readonly [number, number],
  extra: { variant?: FurnitureVariant; heightMm?: number; rotationDeg?: number } = {},
): Furniture => ({
  ...META,
  id: `F-${id}`,
  levelId: LEVEL,
  ...(roomId === undefined ? {} : { roomId: `R-${roomId}` as const }),
  kind,
  centre: { x: cx, y: cy },
  boundingBox: { min: { x: cx - w / 2, y: cy - d / 2 }, max: { x: cx + w / 2, y: cy + d / 2 } },
  rotationDeg: extra.rotationDeg ?? 0,
  ...(extra.variant === undefined ? {} : { variant: extra.variant }),
  ...(extra.heightMm === undefined ? {} : { heightMm: extra.heightMm }),
});

const graphOf = (rooms: Room[], furniture: Furniture[], walls: Wall[] = [], openings: Opening[] = []): SpatialGraph => ({
  building: { ...META, name: 'b', datumElevationMm: 0 },
  levels: [{ ...META, id: LEVEL, name: 'T1', order: 0, elevationMm: 0, heightMm: 3000 }],
  walls,
  openings,
  furniture,
  rooms,
  axes: [],
  dimensions: [],
  notes: [],
});

/** Mọi món sinh ra: trong phòng (lùi 100), ngoài vùng mở cửa, id DRESS-, nguồn ai chưa duyệt. */
const expectValid = (graph: SpatialGraph, items: readonly Furniture[]): void => {
  const swings = doorSwingRects(graph, LEVEL);
  for (const item of items) {
    const room = graph.rooms.find((r) => r.id === item.roomId);
    const rect = rectOfFurniture(item);
    expect(item.id).toMatch(/^DRESS-/);
    expect(item).toMatchObject({ source: 'ai', reviewed: false, confidence: 1, levelId: LEVEL, kind: 'other' });
    expect(room && rectInsidePolygon(rect, room.outline, 100), item.id).toBe(true);
    expect(swings.some((s) => rectsOverlap(rect, s)), item.id).toBe(false);
  }
};

describe('dressingOf — phòng ngủ', () => {
  const bedroom = roomOf('bed', 'bedroom', 4000, 5000);
  const bed = piece('bed', 'bed', 'bed', [2000, 1100], [1600, 2000], { variant: 'bed' });
  const left = piece('ns1', 'table', 'bed', [925, 320], [450, 400], { variant: 'nightstand' });
  const right = piece('ns2', 'table', 'bed', [3075, 320], [450, 400], { variant: 'nightstand', heightMm: 550 });

  it('một đèn mỗi tủ đầu giường (cao bằng tủ) + một thảm dưới 2/3 phía chân giường', () => {
    const graph = graphOf([bedroom], [bed, left, right]);
    const items = dressingOf(graph, STYLE);

    expect(items.map((i) => i.id)).toEqual(['DRESS-tableLamp-F-ns1', 'DRESS-tableLamp-F-ns2', 'DRESS-rug-F-bed']);
    expect(items[0]).toMatchObject({ variant: 'tableLamp', centre: left.centre, liftMm: 480 });
    expect(items[1]).toMatchObject({ variant: 'tableLamp', centre: right.centre, liftMm: 550 });
    const rug = rectOfFurniture(items[2]!);
    expect(items[2]?.variant).toBe('rug');
    expect(rug).toEqual({ cx: 2000, cy: 1467, w: 2200, d: 1400, rotationDeg: 0 });
    expectValid(graph, items);
  });

  it('giường xoay 90°, đầu tựa tường phải: thảm về phía chân (−x), vẫn trong phòng', () => {
    const turned = piece('bed', 'bed', 'bed', [2900, 2500], [1600, 2000], { rotationDeg: 90 });
    const graph = graphOf([bedroom], [turned]);
    const items = dressingOf(graph, STYLE);

    expect(items).toHaveLength(1);
    expect(rectOfFurniture(items[0]!)).toEqual({ cx: 2533, cy: 2500, w: 2200, d: 1400, rotationDeg: 90 });
    expectValid(graph, items);
  });

  it('phòng đã có thảm: không thêm thảm, đèn vẫn có; món ngoài phòng không được trang trí', () => {
    const rug = piece('rug', 'other', 'bed', [2000, 3500], [1000, 600], { heightMm: 20 });
    const orphan = piece('ns3', 'table', undefined, [500, 4500], [450, 400], { variant: 'nightstand' });
    const items = dressingOf(graphOf([bedroom], [bed, left, right, rug, orphan]), STYLE);

    expect(items.map((i) => i.variant)).toEqual(['tableLamp', 'tableLamp']);
  });
});

describe('dressingOf — phòng khách', () => {
  const living = roomOf('liv', 'livingRoom', 5000, 4000);
  const sofa = piece('sofa', 'chair', 'liv', [2500, 550], [2000, 900], { variant: 'sofa' });
  const coffee = piece('coffee', 'table', 'liv', [2500, 1750], [1100, 600], { heightMm: 400 });

  it('một thảm dưới nhóm sofa, được chồng sofa + bàn trà', () => {
    const graph = graphOf([living], [sofa, coffee]);
    const items = dressingOf(graph, STYLE);

    expect(items.map((i) => i.id)).toEqual(['DRESS-rug-R-liv']);
    expect(rectOfFurniture(items[0]!)).toEqual({ cx: 2500, cy: 1400, w: 2000, d: 1400, rotationDeg: 0 });
    expectValid(graph, items);
  });

  it('vướng tủ sát mép: thảm lùi về 80%; đã có thảm: không thêm', () => {
    const shelf = piece('shelf', 'wardrobe', 'liv', [3760, 1450], [480, 500], { heightMm: 1800 });
    const shrunk = dressingOf(graphOf([living], [sofa, coffee, shelf]), STYLE);
    expect(shrunk.map((i) => rectOfFurniture(i).w)).toEqual([1600]);

    const rug = piece('rug', 'other', 'liv', [1000, 3000], [1200, 800], { variant: 'rug' });
    expect(dressingOf(graphOf([living], [sofa, coffee, rug]), STYLE)).toEqual([]);
  });
});

describe('dressingOf — phòng tắm', () => {
  const bath = roomOf('wc', 'bathroom', 2000, 2000);
  const shower = piece('shower', 'sanitaryFixture', 'wc', [550, 550], [900, 900], { variant: 'shower' });
  const wall: Wall = {
    ...META,
    id: 'W-left',
    levelId: LEVEL,
    centreline: { start: { x: 0, y: 0 }, end: { x: 0, y: 2000 } },
    thicknessMm: 100,
    heightMm: 3000,
    kind: 'partition',
    openingIds: ['D-1'],
  };
  const door: Opening = {
    ...META,
    id: 'D-1',
    wallId: 'W-left',
    kind: 'door',
    offsetMm: 900,
    widthMm: 800,
    heightMm: 2100,
    sillHeightMm: 0,
    swing: 'left',
  };

  it('thảm chân trước mặt +y của vòi sen; cửa mở vướng thì sang mặt +x', () => {
    const open = graphOf([bath], [shower]);
    const front = dressingOf(open, STYLE);
    expect(front.map((i) => i.id)).toEqual(['DRESS-bathMat-F-shower']);
    expect(rectOfFurniture(front[0]!)).toEqual({ cx: 550, cy: 1225, w: 700, d: 450, rotationDeg: 0 });

    const withDoor = graphOf([bath], [shower], [wall], [door]);
    const side = dressingOf(withDoor, STYLE);
    expect(rectOfFurniture(side[0]!)).toEqual({ cx: 1225, cy: 550, w: 700, d: 450, rotationDeg: 90 });
    expectValid(withDoor, side);
  });

  it('vòi sen không thuộc phòng nào: bỏ', () => {
    const loose = piece('shower', 'sanitaryFixture', undefined, [550, 550], [900, 900], { variant: 'shower' });
    expect(dressingOf(graphOf([bath], [loose]), STYLE)).toEqual([]);
  });
});

describe('dressingOf — tất định', () => {
  it('đảo thứ tự phòng/đồ đạc: cùng kết quả', () => {
    const rooms = [roomOf('bed', 'bedroom', 4000, 5000), roomOf('wc', 'bathroom', 2000, 2000, 6000)];
    const furniture = [
      piece('bed', 'bed', 'bed', [2000, 1100], [1600, 2000], { variant: 'bed' }),
      piece('ns1', 'table', 'bed', [925, 320], [450, 400], { variant: 'nightstand' }),
      piece('ns2', 'table', 'bed', [3075, 320], [450, 400], { variant: 'nightstand' }),
      piece('shower', 'sanitaryFixture', 'wc', [6550, 550], [900, 900], { variant: 'shower' }),
    ];
    const once = dressingOf(graphOf(rooms, furniture), STYLE);

    expect(once).toHaveLength(4);
    expect(dressingOf(graphOf([...rooms].reverse(), [...furniture].reverse()), STYLE)).toEqual(once);
  });
});
