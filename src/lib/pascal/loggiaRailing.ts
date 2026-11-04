/**
 * Đoạn mép lô gia cần lan can: máy chủ cố ý để hở mép ngoài lô gia nên nhiều ban công không có tường ở
 * đó. Đoạn nào của cạnh đa giác không có tường nằm dọc theo và phía ngoài không có phòng thì dựng lan
 * can. Chỉ ở tầng hiển thị (`toPascal`), dữ liệu đã lưu không đổi.
 */

import type { Point, Room, Wall } from '@/domain/spatial/types';

import { insideOutline } from './swingDirection';

/** Khe ngắn hơn mức này là góc gãy của đa giác, không phải mép ban công. */
const MIN_SPAN_MM = 300;
/** Đa giác phòng bám mặt tường hoặc tim tường: cho lệch thêm ngoài nửa bề dày. */
const ALONG_TOLERANCE_MM = 150;
/** sin ~6°: tường lệch hơn thì không còn "nằm dọc theo" cạnh. */
const PARALLEL_SIN = 0.1;
/** Dò phòng phía ngoài: vượt qua khe bề dày tường giữa hai đa giác. */
const OUTSIDE_PROBE_MM = 300;

export interface RailingSpan {
  /** Chỉ số cạnh + đoạn, ổn định khi đa giác không đổi: làm id lan can để xoá vẫn nhớ (`dressingOff`). */
  readonly key: string;
  readonly start: Point;
  readonly end: Point;
}

/** Khoảng `[từ, tới]` (mm dọc cạnh) mà một tường phủ; `null` nếu tường không nằm dọc theo cạnh. */
const coverOf = (wall: Wall, a: Point, ux: number, uy: number, length: number): readonly [number, number] | null => {
  const { start, end } = wall.centreline;
  const wallLength = Math.hypot(end.x - start.x, end.y - start.y);
  if (!(wallLength > 0)) return null;
  const cross = ((end.x - start.x) * uy - (end.y - start.y) * ux) / wallLength;
  if (Math.abs(cross) > PARALLEL_SIN) return null;
  const reach = wall.thicknessMm / 2 + ALONG_TOLERANCE_MM;
  const offLine = (p: Point): number => Math.abs((p.x - a.x) * uy - (p.y - a.y) * ux);
  if (offLine(start) > reach || offLine(end) > reach) return null;
  const along = (p: Point): number => (p.x - a.x) * ux + (p.y - a.y) * uy;
  const [from, to] = [Math.max(0, Math.min(along(start), along(end))), Math.min(length, Math.max(along(start), along(end)))];
  return to > from ? [from, to] : null;
};

/** Phần của `[0, length]` không khoảng phủ nào chạm tới, chỉ giữ đoạn đủ dài. */
const gapsOf = (covers: readonly (readonly [number, number])[], length: number): (readonly [number, number])[] => {
  const gaps: [number, number][] = [];
  let at = 0;
  for (const [from, to] of [...covers].sort((p, q) => p[0] - q[0])) {
    if (from - at >= MIN_SPAN_MM) gaps.push([at, from]);
    at = Math.max(at, to);
  }
  if (length - at >= MIN_SPAN_MM) gaps.push([at, length]);
  return gaps;
};

const signedArea = (outline: readonly Point[]): number =>
  outline.reduce((sum, p, i) => {
    const q = outline[(i + 1) % outline.length] as Point;
    return sum + p.x * q.y - q.x * p.y;
  }, 0);

/**
 * Các đoạn mép hở của một phòng lô gia. `walls` và `rooms` có thể gồm tầng khác; chỉ xét tầng của phòng.
 * Phía ngoài dò ở ba điểm dọc đoạn, trúng phòng nào (kể cả chính phòng này khi đa giác lõm) là bỏ.
 */
export const loggiaOpenSpansOf = (room: Room, walls: readonly Wall[], rooms: readonly Room[]): RailingSpan[] => {
  const { outline } = room;
  const levelWalls = walls.filter((wall) => wall.levelId === room.levelId);
  const levelRooms = rooms.filter((other) => other.levelId === room.levelId);
  const outward = signedArea(outline) > 0 ? 1 : -1;

  return outline.flatMap((a, index) => {
    const b = outline[(index + 1) % outline.length] as Point;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (!(length > 0)) return [];
    const [ux, uy] = [(b.x - a.x) / length, (b.y - a.y) / length];
    const at = (s: number, off = 0): Point =>
      ({ x: a.x + ux * s + uy * outward * off, y: a.y + uy * s - ux * outward * off }) as Point;
    const covers = levelWalls.map((wall) => coverOf(wall, a, ux, uy, length)).filter((cover) => cover !== null);

    return gapsOf(covers, length).flatMap(([from, to], gap) => {
      const facesRoom = [0.1, 0.5, 0.9].some((t) => {
        const probe = at(from + (to - from) * t, OUTSIDE_PROBE_MM);
        return levelRooms.some((other) => insideOutline(probe, other.outline));
      });
      return facesRoom ? [] : [{ key: `${index}-${gap}`, start: at(from), end: at(to) }];
    });
  });
};
