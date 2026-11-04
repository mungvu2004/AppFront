/**
 * Cắt đa giác phòng đã lưu bằng một nét thẳng, không cần tường khép kín.
 *
 * Đường cắt là đoạn của đường thẳng qua nét nằm TRONG đa giác và chứa trung điểm nét. Hai đầu nét phải
 * chạm biên (sai trong `reachMm`: đầu nét nằm trên tim tường, biên phòng ở mặt tường hoặc lệch chút ít).
 * Nét cụt, nét đi lố sang phòng khác, hay phần cắt quá nhỏ thì trả `null` để nơi gọi dùng cách khác.
 *
 * Hai phần cộng lại đúng bằng đa giác gốc (sai số làm tròn mm), đỉnh là mm nguyên.
 */

import type { Point } from '@/domain/spatial/types';
import { millimetres } from '@/domain/units/types';

import { computeArea, outlineContains } from './area';
import type { PointMm } from '@/domain/units/compare';

/** Đầu nét cách biên phòng tối đa ngần này (mm): nửa bề dày tường dày nhất cộng độ lệch của biên đã lưu. */
export const CUT_REACH_MM = 400;
/** Phần cắt nhỏ hơn ngần này (m²) không phải một phòng: nét đang chạy sát tường. */
const MIN_PART_M2 = 0.5;

const toMm = (point: Point): PointMm => ({ x: millimetres(point.x), y: millimetres(point.y) });
const rounded = (x: number, y: number): Point => ({ x: millimetres(Math.round(x)), y: millimetres(Math.round(y)) });

/** Bỏ đỉnh liền nhau trùng toạ độ (đường cắt đi đúng qua một đỉnh của đa giác). */
const withoutRepeats = (ring: readonly Point[]): Point[] =>
  ring.filter((point, index) => {
    const previous = ring[(index + ring.length - 1) % ring.length];

    return previous === undefined || previous.x !== point.x || previous.y !== point.y;
  });

export function cutOutlineByStroke(
  outline: readonly Point[],
  start: Point,
  end: Point,
  reachMm: number = CUT_REACH_MM,
): readonly [readonly Point[], readonly Point[]] | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);

  if (length === 0 || outline.length < 3) {
    return null;
  }

  const middle = rounded((start.x + end.x) / 2, (start.y + end.y) / 2);

  if (!outlineContains(outline.map(toMm), toMm(middle))) {
    return null;
  }

  /* Giao của đường thẳng với từng cạnh; `t` tính theo mm dọc nét, 0 ở điểm đầu. */
  const hits = outline.flatMap((corner, edge) => {
    const next = outline[(edge + 1) % outline.length] ?? corner;
    const ex = next.x - corner.x;
    const ey = next.y - corner.y;
    const denominator = (dx / length) * ey - (dy / length) * ex;

    if (denominator === 0) {
      return [];
    }

    const t = ((corner.x - start.x) * ey - (corner.y - start.y) * ex) / denominator;
    const u = ((corner.x - start.x) * (dy / length) - (corner.y - start.y) * (dx / length)) / denominator;

    return u >= 0 && u <= 1 ? [{ t, edge, at: rounded(corner.x + u * ex, corner.y + u * ey) }] : [];
  });
  const half = length / 2;
  const before = hits.filter((hit) => hit.t < half).sort((a, b) => b.t - a.t)[0];
  const after = hits.filter((hit) => hit.t > half).sort((a, b) => a.t - b.t)[0];

  if (before === undefined || after === undefined || Math.abs(before.t) > reachMm || Math.abs(after.t - length) > reachMm) {
    return null;
  }

  const [low, high] = before.edge < after.edge ? [before, after] : [after, before];

  if (low.edge === high.edge) {
    return null;
  }

  const first = withoutRepeats([low.at, ...outline.slice(low.edge + 1, high.edge + 1), high.at]);
  const second = withoutRepeats([high.at, ...outline.slice(high.edge + 1), ...outline.slice(0, low.edge + 1), low.at]);

  if (first.length < 3 || second.length < 3) {
    return null;
  }

  return computeArea(first.map(toMm)) < MIN_PART_M2 || computeArea(second.map(toMm)) < MIN_PART_M2 ? null : [first, second];
}
