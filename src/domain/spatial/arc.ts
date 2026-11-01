/**
 * Tường cong: cung tròn tả bằng dây `start→end` và sagitta có dấu (quy ước `curveOffset` của Pascal).
 *
 * Gương của `packages/domain/spatial/arc.py` bên AppBack, cùng công thức: pháp tuyến dây
 * `n = (-dy, dx) / L`; đỉnh cung = trung điểm dây − sagitta · n; |sagitta| ≤ L/2 (cung ≤ 180°);
 * bán kính `L²/(8|s|) + |s|/2`; góc quét `4·atan(2|s|/L)`; tâm = trung điểm + n·(r − |s|)·dấu(s).
 * Sagitta vắng hoặc 0 = tường thẳng, mọi hàm rơi về đúng phép tính trên dây.
 *
 * Hàm thuần, không gắn đơn vị: dùng chung cho mm (domain) và px (canvas).
 */

import type { Wall } from './types';

/** Một điểm hay một hướng trên mặt bằng. */
export interface XY {
  readonly x: number;
  readonly y: number;
}

/** Mỗi dây lấy mẫu quét ≤ ngần này độ — cùng `ARC_STEP_DEG` của AppBack. */
export const ARC_STEP_DEG = 10;

/** Điểm trên tường cùng hướng đi `start→end` tại đó (vectơ đơn vị). */
export interface WallStation {
  readonly point: XY;
  readonly tangent: XY;
}

/** Điểm gần nhất trên tường: chính điểm, khoảng cách tới điểm dò, và quãng đường từ `start`. */
export interface NearestOnWall {
  readonly point: XY;
  readonly distance: number;
  readonly along: number;
}

interface Arc {
  readonly centre: XY;
  readonly radius: number;
  /** Góc của `start` nhìn từ tâm, radian. */
  readonly begin: number;
  /** Góc quét, luôn dương. */
  readonly sweep: number;
  /** +1: cung đi ngược kim đồng hồ (hệ toạ độ toán), −1: thuận. */
  readonly sign: 1 | -1;
}

function arcOf(start: XY, end: XY, sagitta: number | undefined): Arc | null {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (!sagitta || length === 0) return null;
  const depth = Math.min(Math.abs(sagitta), length / 2);
  const radius = (length * length) / (8 * depth) + depth / 2;
  const sign = sagitta > 0 ? 1 : -1;
  const nx = -(end.y - start.y) / length;
  const ny = (end.x - start.x) / length;
  const centre = {
    x: (start.x + end.x) / 2 + nx * (radius - depth) * sign,
    y: (start.y + end.y) / 2 + ny * (radius - depth) * sign,
  };
  return {
    centre,
    radius,
    begin: Math.atan2(start.y - centre.y, start.x - centre.x),
    sweep: 4 * Math.atan((2 * depth) / length),
    sign,
  };
}

/**
 * Các đỉnh đều nhau trên cung, kể cả hai đầu; số dây chẵn để đỉnh giữa là đỉnh cung. Tường thẳng → hai đầu.
 *
 * `leftOffset` ≠ 0 cho đường song song lệch sang trái hướng đi (mặt tường: ±dày/2) — cùng góc, bán kính
 * `r − dấu(s)·leftOffset`; tường thẳng thì tịnh tiến hai đầu theo `n`.
 */
export function arcPoints(
  start: XY,
  end: XY,
  sagitta: number | undefined,
  stepDeg: number = ARC_STEP_DEG,
  leftOffset = 0,
): XY[] {
  const arc = arcOf(start, end, sagitta);
  if (arc === null) {
    if (leftOffset === 0) return [start, end];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const nx = (-(end.y - start.y) / length) * leftOffset;
    const ny = ((end.x - start.x) / length) * leftOffset;
    return [
      { x: start.x + nx, y: start.y + ny },
      { x: end.x + nx, y: end.y + ny },
    ];
  }
  const { centre, begin, sweep, sign } = arc;
  const radius = arc.radius - sign * leftOffset;
  const count = 2 * Math.max(1, Math.ceil((sweep * 180) / Math.PI / (2 * stepDeg)));
  const points: XY[] = [];
  for (let k = 0; k <= count; k += 1) {
    if (leftOffset === 0 && (k === 0 || k === count)) {
      points.push(k === 0 ? start : end);
      continue;
    }
    const angle = begin + (sign * sweep * k) / count;
    points.push({ x: centre.x + radius * Math.cos(angle), y: centre.y + radius * Math.sin(angle) });
  }
  return points;
}

/**
 * Mỗi tường cong thành các tường thẳng theo từng dây cung (≤ 10°, cùng mã, bỏ độ cong); tường thẳng giữ
 * nguyên — cho các phép tính chỉ biết đoạn thẳng (đường đi, khe hở cạnh phòng).
 */
export function chordWalls(walls: readonly Wall[]): Wall[] {
  return walls.flatMap((wall) => {
    if (!wall.curveOffsetMm) return [wall];
    const points = arcPoints(wall.centreline.start, wall.centreline.end, wall.curveOffsetMm);
    const chords: Wall[] = [];
    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1];
      const to = points[index];
      if (from !== undefined && to !== undefined) chords.push({ ...wall, centreline: { start: from, end: to }, curveOffsetMm: undefined });
    }
    return chords;
  });
}

/** Bán kính cung; tường thẳng → `Infinity`. */
export function arcRadius(start: XY, end: XY, sagitta: number | undefined): number {
  return arcOf(start, end, sagitta)?.radius ?? Number.POSITIVE_INFINITY;
}

/** Chiều dài tường đo dọc tim: độ dài cung, hay độ dài dây khi thẳng. */
export function wallLength(start: XY, end: XY, sagitta: number | undefined): number {
  const arc = arcOf(start, end, sagitta);
  return arc === null ? Math.hypot(end.x - start.x, end.y - start.y) : arc.radius * arc.sweep;
}

/**
 * Sagitta có dấu của một khúc cung dài `length` (đo dọc cung) trên cùng đường tròn: `dấu(s)·r·(1 − cos(φ/2))`
 * với `φ = length / r` — để tách một tường cong thành hai tường cong khớp đúng cung cũ. Thẳng → 0.
 */
export function subArcSagitta(start: XY, end: XY, sagitta: number | undefined, length: number): number {
  const arc = arcOf(start, end, sagitta);
  return arc === null ? 0 : arc.sign * arc.radius * (1 - Math.cos(length / (2 * arc.radius)));
}

/** Đỉnh cung (trung điểm dây − sagitta · n); tường thẳng → trung điểm dây. */
export function arcApex(start: XY, end: XY, sagitta: number | undefined): XY {
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (!sagitta || length === 0) return mid;
  return {
    x: mid.x + (sagitta * (end.y - start.y)) / length,
    y: mid.y - (sagitta * (end.x - start.x)) / length,
  };
}

/**
 * Điểm cách `start` một quãng `distance` đo dọc tường (dọc cung khi cong — cách AppBack đo `offsetMm`
 * của ô mở), kèm hướng đi tại đó. Không kẹp: quãng ngoài `[0, chiều dài]` đi tiếp trên đường tròn/đường thẳng.
 */
export function pointAtArcLength(
  start: XY,
  end: XY,
  sagitta: number | undefined,
  distance: number,
): WallStation {
  const arc = arcOf(start, end, sagitta);
  if (arc === null) {
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const tangent = length === 0 ? { x: 1, y: 0 } : { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
    return { point: { x: start.x + tangent.x * distance, y: start.y + tangent.y * distance }, tangent };
  }
  const angle = arc.begin + (arc.sign * distance) / arc.radius;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    point: { x: arc.centre.x + arc.radius * cos, y: arc.centre.y + arc.radius * sin },
    tangent: { x: -arc.sign * sin, y: arc.sign * cos },
  };
}

/**
 * Điểm gần `probe` nhất trên tim tường, kẹp trong nhịp tường: chân đường vuông góc trên dây khi thẳng
 * (đúng `distancePointToSegment`), điểm trên cung theo hướng tâm→probe khi cong, hay đầu tường gần hơn
 * khi hướng ấy rơi ngoài góc quét.
 */
export function nearestOnWall(start: XY, end: XY, sagitta: number | undefined, probe: XY): NearestOnWall {
  const arc = arcOf(start, end, sagitta);
  if (arc === null) {
    const runX = end.x - start.x;
    const runY = end.y - start.y;
    const lengthSquared = runX * runX + runY * runY;
    const fraction =
      lengthSquared === 0
        ? 0
        : Math.min(1, Math.max(0, ((probe.x - start.x) * runX + (probe.y - start.y) * runY) / lengthSquared));
    const point = { x: start.x + fraction * runX, y: start.y + fraction * runY };
    return {
      point,
      distance: Math.hypot(probe.x - point.x, probe.y - point.y),
      along: fraction * Math.sqrt(lengthSquared),
    };
  }
  const { centre, radius, begin, sweep, sign } = arc;
  const turn = 2 * Math.PI;
  const swept = (((sign * (Math.atan2(probe.y - centre.y, probe.x - centre.x) - begin)) % turn) + turn) % turn;
  if (swept <= sweep) {
    const angle = begin + sign * swept;
    const point = { x: centre.x + radius * Math.cos(angle), y: centre.y + radius * Math.sin(angle) };
    return { point, distance: Math.hypot(probe.x - point.x, probe.y - point.y), along: radius * swept };
  }
  const toStart = Math.hypot(probe.x - start.x, probe.y - start.y);
  const toEnd = Math.hypot(probe.x - end.x, probe.y - end.y);
  return toStart <= toEnd
    ? { point: start, distance: toStart, along: 0 }
    : { point: end, distance: toEnd, along: radius * sweep };
}
