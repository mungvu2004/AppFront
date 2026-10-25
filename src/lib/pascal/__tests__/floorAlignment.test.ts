import { describe, expect, it } from 'vitest';

import { applyFloorTransform } from '@/domain/axes/alignFloors';
import type { SpatialGraph } from '@/domain/spatial/types';
import type { PointMm } from '@/domain/units/compare';

import { createSampleBuilding, sampleLevelId, sampleWallId } from '@/domain/spatial/__fixtures__/sampleBuilding';

import { floorDisplayTransformsOf } from '../floorAlignment';
import { toPascalId } from '../ids';
import { toPascalScene } from '../toPascal';
import { toSpatialGraph } from '../toSpatial';
import type { PascalWallNode } from '../types';

interface P { x: number; y: number }
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
    reviewed: false,
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
    const upper = graph.walls.filter((w) => (w.levelId as string) === 'L2');
    const lower = graph.walls.filter((w) => (w.levelId as string) === 'L1');
    upper.forEach((wall, i) => {
      expect(applyFloorTransform(wall.centreline.start as PointMm, t!)).toEqual(lower[i]!.centreline.start);
      expect(applyFloorTransform(wall.centreline.end as PointMm, t!)).toEqual(lower[i]!.centreline.end);
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

describe('toPascalScene + toSpatialGraph với tầng căn', () => {
  const stored = (q: P): P => ({ x: q.y - 2000, y: -(q.x - 1000) });
  const base = createSampleBuilding();
  const [l0, l1] = [sampleLevelId(0), sampleLevelId(1)];
  const walls = [...gridWalls(l0, (p) => p), ...gridWalls(l1, stored)].map((wall, i) => ({
    ...wall,
    id: sampleWallId(i),
  }));
  const graph = {
    ...base,
    levels: base.levels.slice(0, 2),
    walls,
    openings: [],
    furniture: [],
    rooms: [],
    axes: [],
    roofs: [],
  } as unknown as SpatialGraph;
  const scene = toPascalScene(graph).scene;
  const wallNodes = Object.values(scene.nodes).filter((n): n is PascalWallNode => n.type === 'wall');
  const ends = (levelNodeId: string) =>
    wallNodes
      .filter((n) => n.parentId === levelNodeId)
      .flatMap((n) => [n.start, n.end].map(([x, z]) => `${String(Math.round(x * 1000))},${String(Math.round(z * 1000))}`))
      .sort();

  it('cảnh 3D: tầng trên chồng khớp lưới tầng dưới', () => {
    expect(ends(toPascalId('level', l1))).toEqual(ends(toPascalId('level', l0)));
  });

  it('nạp rồi đọc ngược: toạ độ tường giữ nguyên bản đã lưu', () => {
    const back = toSpatialGraph(scene).graph;
    for (const wall of walls) {
      expect(back.walls.find((w) => w.id === wall.id)?.centreline).toEqual(wall.centreline);
    }
  });

  it('sửa một tường ở tầng đã căn: đọc về mang toạ độ gốc', () => {
    const target = wallNodes.find((n) => n.parentId === toPascalId('level', l1))!;
    // Dời 0,5 m theo x của cảnh (toạ độ đã căn) -> toạ độ gốc dời theo R270: (0, -500) mm.
    const moved = { ...target, start: [target.start[0] + 0.5, target.start[1]] as const };
    const back = toSpatialGraph({ ...scene, nodes: { ...scene.nodes, [target.id]: moved } }).graph;
    const original = walls.find((w) => toPascalId('wall', w.id) === target.id)!;
    const wall = back.walls.find((w) => w.id === original.id)!;
    expect(wall.centreline.start.x).toBeCloseTo(original.centreline.start.x, 6);
    expect(wall.centreline.start.y).toBeCloseTo(original.centreline.start.y - 500, 6);
    expect(wall.centreline.end).toEqual(original.centreline.end);
  });
});
