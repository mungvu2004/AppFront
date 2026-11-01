/** @vitest-environment node */
import { describe, expect, it } from 'vitest';

import type { Furniture, FurnitureId, LevelId, RoomId, Wall, WallId } from '@/domain/spatial/types';
import { degrees, millimetres } from '@/domain/units/types';

import { expandKitchenRuns, isKitchenRunHost, KITCHEN_RUN_ID_PREFIX } from '../kitchenRuns';
import { isGeneratedNodeId } from '../sceneDressing';
import { toPascalId } from '../ids';

const LEVEL = 'L-1' as LevelId;
const mm = millimetres;

const cabinet = (id: string, minX: number, minY: number, maxX: number, maxY: number): Furniture => ({
  id: id as FurnitureId,
  levelId: LEVEL,
  roomId: 'R-kitchen' as RoomId,
  kind: 'kitchenCabinet',
  centre: { x: mm((minX + maxX) / 2), y: mm((minY + maxY) / 2) },
  boundingBox: { min: { x: mm(minX), y: mm(minY) }, max: { x: mm(maxX), y: mm(maxY) } },
  rotationDeg: degrees(0),
  source: 'ai',
  reviewed: false,
  confidence: 0.9,
});

const wall = (id: string, x1: number, y1: number, x2: number, y2: number, t: number): Wall => ({
  id: id as WallId,
  levelId: LEVEL,
  centreline: { start: { x: mm(x1), y: mm(y1) }, end: { x: mm(x2), y: mm(y2) } },
  thicknessMm: mm(t),
  heightMm: mm(3000),
  kind: 'envelope',
  openingIds: [],
  source: 'ai',
  reviewed: false,
  confidence: 1,
});

// ui-review/open-plan-20261101/spatial.json — bếp mở.
const WALLS: readonly Wall[] = [
  wall('W-left', 960, 2362, 960, 6247, 150),
  wall('W-top', 960, 2362, 6615, 2362, 150),
  wall('W-mid', 960, 5052, 1600, 5052, 100),
  wall('W-bottom', 960, 6247, 2978, 6247, 150),
];
const L_TOP_LEFT = cabinet('F-A', 1051, 2450, 4164, 4212); // 3113 × 1762
const L_BOTTOM_LEFT = cabinet('F-B', 1049, 4166, 3858, 6129); // 2809 × 1963
const SLIM = cabinet('F-C', 1047, 2455, 1786, 4208); // 739 × 1753

const size = (f: Furniture) => [f.boundingBox.max.x - f.boundingBox.min.x, f.boundingBox.max.y - f.boundingBox.min.y];

describe('expandKitchenRuns', () => {
  it('hộp 3113 × 1762 tựa tường trên + trái → chữ L: dãy trên trọn góc, dãy trái phần còn lại, sâu 600', () => {
    const out = expandKitchenRuns([L_TOP_LEFT], WALLS);
    expect(out[0]).toBe(L_TOP_LEFT);
    const runs = out.slice(1);
    expect(runs.map((r) => r.id)).toEqual([`${KITCHEN_RUN_ID_PREFIX}F-A-top`, `${KITCHEN_RUN_ID_PREFIX}F-A-left`]);
    const [top, left] = runs as [Furniture, Furniture];
    expect(size(top)).toEqual([3113, 600]);
    expect(top.centre).toEqual({ x: 2607.5, y: 2750 });
    expect(top.rotationDeg).toBe(0);
    expect(size(left)).toEqual([1162, 600]);
    expect(left.centre).toEqual({ x: 1351, y: 3631 });
    expect(left.rotationDeg).toBe(270);
  });

  it('hộp 2809 × 1963 tựa tường trái + dưới → dãy dưới + dãy trái; tường ngăn giữa hộp không tính', () => {
    const runs = expandKitchenRuns([L_BOTTOM_LEFT], WALLS).slice(1);
    expect(runs.map((r) => r.id.slice(KITCHEN_RUN_ID_PREFIX.length))).toEqual(['F-B-bottom', 'F-B-left']);
    expect(size(runs[0] as Furniture)).toEqual([2809, 600]);
    expect((runs[0] as Furniture).rotationDeg).toBe(180);
    expect(size(runs[1] as Furniture)).toEqual([1363, 600]);
  });

  it('không mép nào tựa tường → một đảo bếp sâu 900 giữa hộp', () => {
    const runs = expandKitchenRuns([L_TOP_LEFT], []).slice(1);
    expect(runs).toHaveLength(1);
    expect(size(runs[0] as Furniture)).toEqual([3113, 900]);
    expect((runs[0] as Furniture).centre).toEqual(L_TOP_LEFT.centre);
  });

  it('tủ mảnh 739 × 1753, dãy baseRun và tủ người đã đổi mẫu giữ nguyên', () => {
    const run = { ...L_TOP_LEFT, id: 'F-R' as FurnitureId, variant: 'baseRun' as const };
    const swapped = { ...L_TOP_LEFT, id: 'F-S' as FurnitureId, model: { id: 'x', src: 'y' } };
    for (const f of [SLIM, run, swapped]) expect(isKitchenRunHost(f)).toBe(false);
    expect(expandKitchenRuns([SLIM, run, swapped], WALLS)).toEqual([SLIM, run, swapped]);
  });

  it('lượt về an toàn: món gốc giữ nguyên, dãy là đồ sinh ra không phòng (không bao giờ lưu)', () => {
    const out = expandKitchenRuns([L_TOP_LEFT, L_BOTTOM_LEFT], WALLS);
    expect(out.filter((f) => !isGeneratedNodeId(toPascalId('item', f.id)))).toEqual([L_TOP_LEFT, L_BOTTOM_LEFT]);
    for (const f of out.filter((x) => isGeneratedNodeId(toPascalId('item', x.id)))) expect(f.roomId).toBeUndefined();
  });
});
