import { describe, expect, it } from 'vitest';

import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Point, Wall, WallId } from '@/domain/spatial/types';
import { createId } from '@/domain/spatial/ids';
import type { Command } from '@/lib/commands/types';

import { snapDrawPoint, wallDrawSnapTargets, type WallDrawSnap } from './wallDrawSnap';
import { planConnectedDraw, WALL_DRAW_ALONG_TEXT, WALL_DRAW_MUST_CONNECT_TEXT } from './wallDrawConnect';
import { commandContextOf } from './wallLayerReviewGateway';
import {
  WALL_LAYER_FIXTURE_BUILDING,
  WALL_LAYER_FIXTURE_LEVEL,
  WALL_LAYER_FIXTURE_WALLS,
} from './wallLayerReviewFixture';

const W006 = WALL_LAYER_FIXTURE_WALLS[5] as Wall; // (0,2200) → (2500,2200)

/** Bộ mẫu + một tường xiên (0,0) → (3001,1999) để thử điểm cắt lẻ. */
const SLANTED = { ...W006, id: createId('wall'), centreline: { start: { x: 20000, y: 0 }, end: { x: 23001, y: 1999 } } } as Wall;

const graph = normalizeSpatial({
  building: WALL_LAYER_FIXTURE_BUILDING,
  levels: [WALL_LAYER_FIXTURE_LEVEL],
  walls: [...WALL_LAYER_FIXTURE_WALLS, SLANTED],
  openings: [],
  furniture: [],
  rooms: [],
  axes: [],
  dimensions: [],
  notes: [],
});
const context = commandContextOf(graph, 'tester');
const targets = wallDrawSnapTargets([...WALL_LAYER_FIXTURE_WALLS, SLANTED]);
const snap = (point: Point): WallDrawSnap => snapDrawPoint(point, targets, 50);

const plan = (start: Point, end: Point, snaps = { start: snap(start), end: snap(end) }) =>
  planConnectedDraw(
    {
      id: createId('wall'),
      levelId: WALL_LAYER_FIXTURE_LEVEL.id,
      centreline: { start: snaps.start.point, end: snaps.end.point },
      thicknessMm: 110,
      heightMm: 2800,
      kind: 'partition',
    },
    snaps,
    context,
    () => createId('wall'),
  );

const wallsAfter = (commands: readonly Command[]): Wall[] =>
  commands.flatMap((command) =>
    command.changes.flatMap((change) => (change.kind === 'wall' && change.after !== null ? [change.after] : [])),
  );

describe('planConnectedDraw', () => {
  it('thân tường được bắt (chân vuông góc), đầu tường được bắt (đỉnh)', () => {
    expect(snap({ x: 1250, y: 2210 })).toMatchObject({ kind: 'perpendicular', wallId: W006.id, point: { x: 1250, y: 2200 } });
    expect(snap({ x: 2495, y: 2203 }).kind).toBe('wallVertex');
  });

  it('đầu bắt vào giữa tường → cắt tường đó tại đúng điểm, tường mới dùng chung điểm cắt', () => {
    const result = plan({ x: 1250, y: 2210 }, { x: 2500, y: 4400 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.commands.map((command) => command.type)).toEqual(['wall.split', 'wall.draw']);

    const walls = wallsAfter(result.commands);
    const first = walls.find((wall) => wall.id === W006.id) as Wall;
    const second = walls.find((wall) => wall.id !== W006.id && wall.centreline.end.y === 2200) as Wall;
    const drawn = walls[walls.length - 1] as Wall;

    expect(first.centreline).toEqual({ start: { x: 0, y: 2200 }, end: { x: 1250, y: 2200 } });
    expect(second.centreline).toEqual({ start: { x: 1250, y: 2200 }, end: { x: 2500, y: 2200 } });
    expect(drawn.centreline).toEqual({ start: { x: 1250, y: 2200 }, end: { x: 2500, y: 4400 } });
  });

  it('đỉnh với đỉnh → chỉ một lệnh vẽ, không cắt gì', () => {
    const result = plan({ x: 5000, y: 2200 }, { x: 5000, y: 4400 });

    expect(result.ok && result.commands.map((command) => command.type)).toEqual(['wall.draw']);
  });

  it('tường xiên: điểm cắt làm tròn mm nguyên, hai mảnh và tường mới trùng đúng một điểm', () => {
    const result = plan({ x: 21500, y: 1000 }, { x: 12500, y: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const walls = wallsAfter(result.commands);
    const points = walls.flatMap((wall) => [wall.centreline.start, wall.centreline.end]);

    expect(points.every((point) => Number.isInteger(point.x) && Number.isInteger(point.y))).toBe(true);
    const cut = (walls.find((wall) => wall.id === SLANTED.id) as Wall).centreline.end;
    const drawn = walls[walls.length - 1] as Wall;
    expect(drawn.centreline.start).toEqual(cut);
    expect(walls.some((wall) => wall.id !== SLANTED.id && wall.id !== drawn.id && wall.centreline.start.x === cut.x && wall.centreline.start.y === cut.y)).toBe(true);
  });

  it('#9: không đầu nào chạm tường → từ chối, có câu tiếng Việt', () => {
    expect(plan({ x: 40000, y: 40000 }, { x: 42000, y: 40000 })).toEqual({ ok: false, reason: WALL_DRAW_MUST_CONNECT_TEXT });
  });

  it('hai đầu cùng một tường → từ chối (tường mới nằm đè)', () => {
    expect(plan({ x: 600, y: 2205 }, { x: 1900, y: 2195 })).toEqual({ ok: false, reason: WALL_DRAW_ALONG_TEXT });
  });

  it('sát đầu tường hơn đoạn tối thiểu → không cắt, dùng chung đầu gần nhất', () => {
    const start: WallDrawSnap = { kind: 'perpendicular', wallId: W006.id as WallId, point: { x: 10, y: 2200 } };
    const end = snap({ x: 2500, y: 4400 });
    const result = plan(start.point, end.point, { start, end });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.commands.map((command) => command.type)).toEqual(['wall.draw']);
    expect((wallsAfter(result.commands)[0] as Wall).centreline.start).toEqual({ x: 0, y: 2200 });
  });
});
