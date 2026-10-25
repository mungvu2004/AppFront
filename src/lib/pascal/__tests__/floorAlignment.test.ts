import { describe, expect, it } from 'vitest';

import { applyFloorTransform } from '@/domain/axes/alignFloors';
import type { SpatialGraph } from '@/domain/spatial/types';

import { floorDisplayTransformsOf } from '../floorAlignment';

type P = { x: number; y: number };
const XS = [0, 4000, 9000];
const YS = [0, 3000, 7000];

/** Lưới tường đầy đủ, mỗi trục chia đoạn tại điểm giao; `place` đưa điểm lưới gốc về toạ độ đã lưu. */
const gridWalls = (levelId: string, place: (p: P) => P) => {
  const segs: [P, P][] = [];
  for (const x of XS) for (let i = 0; i < YS.length - 1; i += 1) segs.push([{ x, y: YS[i]! }, { x, y: YS[i + 1]! }]);
  for (const y of YS) for (let i = 0; i < XS.length - 1; i += 1) segs.push([{ x: XS[i]!, y }, { x: XS[i + 1]!, y }]);
  return segs.map(([a, b], i) => ({
    id: `${levelId}-W${String(i)}`,
    levelId,
    centreline: { start: place(a), end: place(b) },
    thicknessMm: 200,
    heightMm: 3000,
    kind: 'loadBearing',
    openingIds: [],
  }));
};

const level = (id: string, order: number) => ({ id, name: id, order, elevationMm: order * 3200, heightMm: 3000 });

describe('floorDisplayTransformsOf', () => {
  it('tầng trên lệch tịnh tiến + xoay 90° được đưa về khớp lưới tầng gốc', () => {
    // Đã lưu P sao cho xoay 90° rồi dời (1000, 2000) ra đúng lưới gốc Q: P = R270(Q - t).
    const stored = (q: P): P => ({ x: q.y - 2000, y: -(q.x - 1000) });
    const graph = {
      levels: [level('L1', 0), level('L2', 1)],
      walls: [...gridWalls('L1', (p) => p), ...gridWalls('L2', stored)],
    } as unknown as SpatialGraph;

    const transforms = floorDisplayTransformsOf(graph);
    const t = transforms.get('L2');

    expect(transforms.has('L1')).toBe(false);
    expect(t).toMatchObject({ rotationDeg: 90, translationMm: { x: 1000, y: 2000 } });
    const upper = graph.walls.filter((w) => w.levelId === 'L2');
    const lower = graph.walls.filter((w) => w.levelId === 'L1');
    upper.forEach((wall, i) => {
      expect(applyFloorTransform(wall.centreline.start, t!)).toEqual(lower[i]!.centreline.start);
      expect(applyFloorTransform(wall.centreline.end, t!)).toEqual(lower[i]!.centreline.end);
    });
  });

  it('tầng không có lưới trục thì giữ nguyên (không có mục)', () => {
    const graph = {
      levels: [level('L1', 0), level('L2', 1)],
      walls: gridWalls('L1', (p) => p),
    } as unknown as SpatialGraph;

    expect(floorDisplayTransformsOf(graph).size).toBe(0);
  });
});
