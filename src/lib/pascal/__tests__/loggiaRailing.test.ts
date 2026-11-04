/** Chọn đoạn mép lô gia cần lan can: chỉ đoạn không có tường dọc theo và phía ngoài không có phòng. */

import { describe, expect, it } from 'vitest';

import type { Room, Wall } from '@/domain/spatial/types';

import { loggiaOpenSpansOf } from '../loggiaRailing';

type Xy = readonly [number, number];

const room = (usage: Room['usage'], ...points: Xy[]): Room =>
  ({ id: `R-${usage}`, levelId: 'L-1', usage, outline: points.map(([x, y]) => ({ x, y })) }) as unknown as Room;
const wall = (from: Xy, to: Xy, levelId = 'L-1'): Wall =>
  ({
    id: `W-${from.join()}-${to.join()}`,
    levelId,
    thicknessMm: 220,
    centreline: { start: { x: from[0], y: from[1] }, end: { x: to[0], y: to[1] } },
  }) as unknown as Wall;
const box = (usage: Room['usage'], x0: number, y0: number, x1: number, y1: number): Room =>
  room(usage, [x0, y0], [x1, y0], [x1, y1], [x0, y1]);
const spans = (target: Room, walls: Wall[], others: Room[] = []) =>
  loggiaOpenSpansOf(target, walls, [target, ...others]).map(({ start, end }) => [start.x, start.y, end.x, end.y]);

const LOGGIA = box('loggia', 0, 0, 3000, 1500);
const LIVING = box('livingRoom', 0, 1720, 3000, 5000);
const SIDES = [wall([0, 0], [0, 1500]), wall([3000, 0], [3000, 1500])];
const INNER = wall([0, 1610], [3000, 1610]);

describe('loggiaOpenSpansOf', () => {
  it('mép ngoài không tường, không phòng: một đoạn đúng bằng cạnh', () => {
    expect(spans(LOGGIA, [...SIDES, INNER], [LIVING])).toEqual([[0, 0, 3000, 0]]);
  });

  it('cạnh đã có tường dọc theo (bám tim hoặc mặt tường): không dựng', () => {
    expect(spans(LOGGIA, [...SIDES, INNER, wall([0, -110], [3000, -110])], [LIVING])).toEqual([]);
  });

  it('cạnh giáp phòng khác mà không có tường giữa: không dựng', () => {
    const below = box('bedroom', 0, -3000, 3000, 0);
    expect(spans(LOGGIA, [...SIDES, INNER], [LIVING, below])).toEqual([]);
  });

  it('tường chỉ phủ một phần: chỉ dựng phần còn hở, bỏ khe dưới 300 mm', () => {
    expect(spans(LOGGIA, [...SIDES, INNER, wall([0, 0], [1000, 0])], [LIVING])).toEqual([[1000, 0, 3000, 0]]);
    expect(spans(LOGGIA, [...SIDES, INNER, wall([0, 0], [2800, 0])], [LIVING])).toEqual([]);
  });

  it('tường và phòng ở tầng khác không tính; tường vuông góc không che cạnh', () => {
    expect(spans(LOGGIA, [...SIDES, INNER, wall([0, 0], [3000, 0], 'L-2')], [LIVING])).toEqual([[0, 0, 3000, 0]]);
    expect(spans(LOGGIA, [...SIDES, INNER, wall([1500, 0], [1500, 900])], [LIVING])).toEqual([[0, 0, 3000, 0]]);
  });

  it('đa giác chiều ngược vẫn dò đúng phía ngoài', () => {
    const reversed = room('loggia', [0, 0], [0, 1500], [3000, 1500], [3000, 0]);
    expect(spans(reversed, [...SIDES, INNER], [LIVING])).toEqual([[3000, 0, 0, 0]]);
  });

  it('đa giác chữ L: hai cạnh của phần khuyết vẫn là mép ngoài', () => {
    const ell = room('loggia', [0, 0], [3000, 0], [3000, 1000], [1000, 1000], [1000, 3000], [0, 3000]);
    const walls = [
      wall([0, 0], [3000, 0]),
      wall([3000, 0], [3000, 1000]),
      wall([1000, 3000], [0, 3000]),
      wall([0, 3000], [0, 0]),
    ];
    expect(spans(ell, walls)).toEqual([
      [3000, 1000, 1000, 1000],
      [1000, 1000, 1000, 3000],
    ]);
  });
});
