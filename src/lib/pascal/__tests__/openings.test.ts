/**
 * Cửa đi, cửa sổ, ô trống sang Pascal (T11): mỗi swing của AppFront ra đúng bộ
 * trường Pascal đọc để dựng cánh — khai đủ, không dựa vào mặc định lược đồ.
 */

import { describe, expect, it } from 'vitest';

import { SpatialGraphDocumentSchema } from '@/api/schemas/spatialGraph';
import { outlineContains } from '@/domain/rooms/area';
import type { Opening, Room, SwingDirection, Wall } from '@/domain/spatial/types';
import { toPointMm } from '@/lib/commands/business/shared';

import { fixtureF2 } from '../__fixtures__';
import { toPascalId } from '../ids';
import { swingDirectionOf, toPascalScene } from '../toPascal';

const graph = SpatialGraphDocumentSchema.parse(fixtureF2().doc).graph;
const { nodes } = toPascalScene(graph).scene;

const pick = (node: unknown, keys: readonly string[]) =>
  Object.fromEntries(keys.map((key) => [key, (node as Record<string, unknown>)[key]]));

// `swingDirection` theo hình học phòng hai bên — xem khối "chiều mở cánh" bên dưới.
const DOOR_KEYS = ['openingKind', 'doorType', 'leafCount', 'hingesSide', 'swingAngle', 'operationState'];
const WINDOW_KEYS = ['openingKind', 'windowType', 'casementStyle', 'hingesSide'];

const hinged = { openingKind: 'door', doorType: 'hinged', leafCount: 1, hingesSide: 'left', swingAngle: 1.22, operationState: 0 };
const DOOR: Record<SwingDirection, object> = {
  left: hinged,
  right: { ...hinged, hingesSide: 'right' },
  double: { ...hinged, leafCount: 2 },
  sliding: { ...hinged, doorType: 'sliding', swingAngle: 0, operationState: 0.5 },
  fixed: { ...hinged, openingKind: 'opening', swingAngle: 0 },
};
const fixedWindow = { openingKind: 'window', windowType: 'fixed', casementStyle: 'single', hingesSide: 'left' };
const WINDOW: Record<SwingDirection, object> = {
  left: { ...fixedWindow, windowType: 'casement' },
  right: { ...fixedWindow, windowType: 'casement', hingesSide: 'right' },
  double: { ...fixedWindow, windowType: 'casement', casementStyle: 'french' },
  sliding: { ...fixedWindow, windowType: 'sliding' },
  fixed: fixedWindow,
};

describe('ô mở → Pascal (T11)', () => {
  it('F2 phủ đủ 5 swing cho cả cửa đi và cửa sổ', () => {
    for (const kind of ['door', 'window'] as const) {
      const swings = new Set(graph.openings.filter((o) => o.kind === kind).map((o) => o.swing));
      expect(swings, kind).toEqual(new Set(['left', 'right', 'double', 'sliding', 'fixed']));
    }
  });

  it.each(graph.openings.map((o) => [o.kind, o.swing, o] as const))('%s %s → đúng bộ trường', (kind, swing, opening) => {
    const node = nodes[toPascalId(kind, opening.id)];
    expect(node?.type).toBe(kind);
    expect(pick(node, kind === 'door' ? DOOR_KEYS : WINDOW_KEYS)).toEqual(kind === 'door' ? DOOR[swing] : WINDOW[swing]);
    if (kind === 'window') expect((node as { slots?: unknown }).slots).toEqual({ frame: 'library:preset-white', glass: 'scene:mat_appfront_glass' });
  });
});

describe('chiều mở cánh theo phòng hai bên (V5 D7)', () => {
  // Tường ngang y = 0 từ (0,0) tới (4000,0): pháp tuyến trái (+z cục bộ Pascal) là +y.
  const wall = { id: 'W', levelId: 'L', thicknessMm: 200, centreline: { start: { x: 0, y: 0 }, end: { x: 4000, y: 0 } } } as unknown as Wall;
  const door = { offsetMm: 1500, widthMm: 900 } as unknown as Opening;
  const box = (id: string, y0: number, y1: number, usage: string, areaM2: number) =>
    ({ id, levelId: 'L', usage, areaM2, outline: [{ x: 0, y: y0 }, { x: 4000, y: y0 }, { x: 4000, y: y1 }, { x: 0, y: y1 }] }) as unknown as Room;
  const north = (usage: string, area: number) => box('N', 0, 4000, usage, area); // +y
  const south = (usage: string, area: number) => box('S', -4000, 0, usage, area); // −y

  it('tường bao: mở vào nhà, bên nào có phòng thì bên ấy', () => {
    expect(swingDirectionOf(door, wall, [north('bedroom', 16)])).toBe('inward');
    expect(swingDirectionOf(door, wall, [south('bedroom', 16)])).toBe('outward');
  });

  it('cửa trong: mở vào phòng không phải hành lang', () => {
    expect(swingDirectionOf(door, wall, [north('corridor', 8), south('bedroom', 16)])).toBe('outward');
    expect(swingDirectionOf(door, wall, [north('bedroom', 16), south('corridor', 8)])).toBe('inward');
  });

  it('cửa trong giữa hai phòng thường: mở vào phòng nhỏ hơn', () => {
    expect(swingDirectionOf(door, wall, [north('bedroom', 16), south('bathroom', 4)])).toBe('outward');
    expect(swingDirectionOf(door, wall, [north('bathroom', 4), south('bedroom', 16)])).toBe('inward');
  });

  it('sân decking tính là ngoài nhà: cửa mở vào phòng trong', () => {
    const deck = (r: Room) => ({ ...r, finish: 'decking' }) as Room;
    expect(swingDirectionOf(door, wall, [north('bedroom', 16), deck(south('other', 4))])).toBe('inward');
    expect(swingDirectionOf(door, wall, [deck(north('other', 4)), south('bedroom', 16)])).toBe('outward');
  });

  it('phòng tầng khác hoặc không có phòng → giữ inward', () => {
    expect(swingDirectionOf(door, wall, [])).toBe('inward');
    expect(swingDirectionOf(door, wall, [{ ...south('bedroom', 16), levelId: 'L-2' } as unknown as Room])).toBe('inward');
  });
});

describe('mặt trong/ngoài của tường (cutaway + sơn ngoài đúng mặt)', () => {
  // Đối chiếu bằng hàm chứa-điểm của domain, độc lập với `insideOutline` của toPascal.
  const insideRoom = (wall: Wall, sign: number): boolean => {
    const { start, end } = wall.centreline;
    const len = Math.hypot(end.x - start.x, end.y - start.y);
    const reach = (wall.thicknessMm / 2 + 80) * sign;
    const p = {
      x: (start.x + end.x) / 2 - ((end.y - start.y) / len) * reach,
      y: (start.y + end.y) / 2 + ((end.x - start.x) / len) * reach,
    };
    return graph.rooms.some(
      (r) => r.levelId === wall.levelId && r.finish !== 'decking' && outlineContains(r.outline.map(toPointMm), toPointMm(p)),
    );
  };

  it('tường bao: phía có phòng là interior, phía kia exterior; vách giữa hai phòng để trống', () => {
    let sided = 0;
    for (const wall of graph.walls) {
      const node = nodes[toPascalId('wall', wall.id)] as { frontSide?: string; backSide?: string } | undefined;
      if (node === undefined) continue;
      const front = insideRoom(wall, 1);
      const back = insideRoom(wall, -1);
      if (front === back) {
        expect(node.frontSide, wall.id).toBeUndefined();
        expect(node.backSide, wall.id).toBeUndefined();
        continue;
      }
      sided++;
      expect([node.frontSide, node.backSide], wall.id).toEqual(front ? ['interior', 'exterior'] : ['exterior', 'interior']);
    }
    expect(sided).toBeGreaterThan(0);
  });
});
