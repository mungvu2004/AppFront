/**
 * Hình học đặt đồ đạc sinh ra (J10): hình chữ nhật xoay, nằm trong phòng, chồng nhau (SAT),
 * vùng mở cửa và các cạnh phòng kèm khoảng cửa. Thuần, đơn vị mm.
 *
 * Quy ước (K1, rotationConvention.test.ts): khung riêng `w × d` (w theo trục x riêng, d theo
 * y riêng), xoay `rotationDeg` quanh tâm — trên mặt bằng là phép quay chuẩn
 * (x, y) → (x cos − y sin, x sin + y cos). Mặt trước món đồ là +y riêng (= +z của GLB).
 */

import { outlineContains, signedAreaMm2 } from '@/domain/rooms/area';
import type { Furniture, LevelId, Point, Room, SpatialGraph } from '@/domain/spatial/types';
import { isFinitePoint, toPointMm } from '@/lib/commands/business/shared';

export interface Rect {
  readonly cx: number;
  readonly cy: number;
  readonly w: number;
  readonly d: number;
  readonly rotationDeg: number;
}

export interface RoomEdge {
  readonly a: Point;
  readonly b: Point;
  readonly lengthMm: number;
  readonly inwardNormal: Point;
  readonly openings: readonly { readonly fromMm: number; readonly toMm: number }[];
}

const EPS = 1e-6;
/** Vùng mở của cửa trượt/cố định: sâu 600 mm mỗi bên tường. */
const SLIDING_SWING_DEPTH_MM = 600;
/** Tường được coi là nằm trên cạnh phòng khi tâm tường cách cạnh ≤ nửa dày + 50 mm. */
const EDGE_WALL_SLACK_MM = 50;

const radiansOf = (deg: number): number => (deg * Math.PI) / 180;
const axesOf = (r: Rect): readonly [Point, Point] => {
  const t = radiansOf(r.rotationDeg);
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [
    { x: c, y: s },
    { x: -s, y: c },
  ];
};
const dot = (p: Point, q: Point): number => p.x * q.x + p.y * q.y;
const cross = (o: Point, p: Point, q: Point): number => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);

export const rectOfFurniture = (f: Pick<Furniture, 'centre' | 'boundingBox' | 'rotationDeg'>): Rect => ({
  cx: f.centre.x,
  cy: f.centre.y,
  w: f.boundingBox.max.x - f.boundingBox.min.x,
  d: f.boundingBox.max.y - f.boundingBox.min.y,
  rotationDeg: f.rotationDeg,
});

/** 4 góc theo thứ tự quanh hình: (−,−), (+,−), (+,+), (−,+) trong khung riêng. */
export const rectCorners = (r: Rect): Point[] => {
  const [ex, ey] = axesOf(r);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx = 0, sy = 0]) => ({
    x: r.cx + ex.x * (sx * r.w) / 2 + ey.x * (sy * r.d) / 2,
    y: r.cy + ex.y * (sx * r.w) / 2 + ey.y * (sy * r.d) / 2,
  }));
};

const properlyCross = (p1: Point, p2: Point, q1: Point, q2: Point): boolean => {
  const d1 = cross(q1, q2, p1);
  const d2 = cross(q1, q2, p2);
  const d3 = cross(p1, p2, q1);
  const d4 = cross(p1, p2, q2);
  return d1 * d2 < -EPS && d3 * d4 < -EPS;
};

/**
 * Hình (nở thêm `insetMm` mỗi phía) nằm trọn trong outline: 4 góc trong, không đỉnh nào của
 * outline lọt vào hình, không cạnh nào cắt ngang (bắt được góc lõm của phòng chữ L).
 */
export const rectInsidePolygon = (r: Rect, outline: readonly Point[], insetMm: number): boolean => {
  // Toạ độ hỏng: trả `false` chứ không ném (hàm đo của domain ném với số không hữu hạn).
  if (outline.length < 3 || !outline.every(isFinitePoint)) return false;
  if (![r.cx, r.cy, r.w, r.d, r.rotationDeg, insetMm].every(Number.isFinite)) return false;
  // Nhỏ hơn 0,01 mm để hình chạm đúng mép lùi không bị tia quét xử ngẫu nhiên.
  const grown: Rect = { ...r, w: r.w + 2 * insetMm - 0.02, d: r.d + 2 * insetMm - 0.02 };
  const corners = rectCorners(grown);
  const outlineMm = outline.map(toPointMm);
  if (!corners.every((corner) => outlineContains(outlineMm, toPointMm(corner)))) return false;
  const [ex, ey] = axesOf(grown);
  const strictlyInside = (p: Point): boolean => {
    const v = { x: p.x - grown.cx, y: p.y - grown.cy };
    return Math.abs(dot(v, ex)) < grown.w / 2 - EPS && Math.abs(dot(v, ey)) < grown.d / 2 - EPS;
  };
  if (outline.some(strictlyInside)) return false;
  return outline.every((p, i) => {
    const q = outline[(i + 1) % outline.length] as Point;
    return corners.every((c, j) => !properlyCross(p, q, c, corners[(j + 1) % 4] as Point));
  });
};

/** Hai hình xoay chồng nhau (SAT); cách nhau đúng `gapMm` thì không tính là chồng. */
export const rectsOverlap = (a: Rect, b: Rect, gapMm = 0): boolean => {
  const [ax, ay] = axesOf(a);
  const [bx, by] = axesOf(b);
  const between = { x: b.cx - a.cx, y: b.cy - a.cy };
  const half = (r: Rect, ex: Point, ey: Point, u: Point): number =>
    Math.abs(dot(ex, u)) * (r.w / 2) + Math.abs(dot(ey, u)) * (r.d / 2);
  return [ax, ay, bx, by].every(
    (u) => Math.abs(dot(between, u)) < half(a, ax, ay, u) + half(b, bx, by, u) + gapMm - EPS,
  );
};

/** Vùng mở của mọi cửa đi trên tầng: rộng × rộng cả hai bên tường; trượt/cố định: rộng × 600. */
export const doorSwingRects = (graph: SpatialGraph, levelId: LevelId): Rect[] => {
  const walls = new Map(graph.walls.filter((w) => w.levelId === levelId).map((w) => [w.id, w]));
  return graph.openings.flatMap((o) => {
    const wall = walls.get(o.wallId);
    if (o.kind !== 'door' || wall === undefined) return [];
    const { start, end } = wall.centreline;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length < EPS) return [];
    const dir = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
    const along = o.offsetMm + o.widthMm / 2;
    const depth = o.swing === 'sliding' || o.swing === 'fixed' ? SLIDING_SWING_DEPTH_MM : o.widthMm;
    const reach = wall.thicknessMm / 2 + depth / 2;
    const rotationDeg = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
    return [1, -1].map((side) => ({
      cx: start.x + dir.x * along - dir.y * reach * side,
      cy: start.y + dir.y * along + dir.x * reach * side,
      w: o.widthMm,
      d: depth,
      rotationDeg,
    }));
  });
};

/**
 * Các cạnh outline của phòng, pháp tuyến hướng vào trong và khoảng cửa (đi + sổ) dọc cạnh:
 * lấy từ tường cùng tầng có cả hai đầu tâm tường cách đường cạnh ≤ dày/2 + 50 mm.
 */
export const roomEdges = (room: Pick<Room, 'levelId' | 'outline'>, graph: SpatialGraph): RoomEdge[] => {
  const outline = room.outline;
  if (outline.length < 3 || !outline.every(isFinitePoint)) return [];
  const sign = signedAreaMm2(outline.map(toPointMm)) >= 0 ? 1 : -1;
  const walls = graph.walls.filter((w) => w.levelId === room.levelId);
  const openingsByWall = new Map<string, typeof graph.openings>();
  for (const o of graph.openings) openingsByWall.set(o.wallId, [...(openingsByWall.get(o.wallId) ?? []), o]);

  return outline.flatMap((a, i) => {
    const b = outline[(i + 1) % outline.length] as Point;
    const lengthMm = Math.hypot(b.x - a.x, b.y - a.y);
    if (lengthMm < EPS) return [];
    const e = { x: (b.x - a.x) / lengthMm, y: (b.y - a.y) / lengthMm };
    const inwardNormal = { x: -e.y * sign, y: e.x * sign };
    const offLine = (p: Point): number => Math.abs((p.x - a.x) * e.y - (p.y - a.y) * e.x);
    const along = (p: Point): number => (p.x - a.x) * e.x + (p.y - a.y) * e.y;

    const openings = walls
      .filter((w) => {
        const tol = w.thicknessMm / 2 + EDGE_WALL_SLACK_MM;
        return offLine(w.centreline.start) <= tol && offLine(w.centreline.end) <= tol;
      })
      .flatMap((w) => {
        const { start, end } = w.centreline;
        const len = Math.hypot(end.x - start.x, end.y - start.y);
        if (len < EPS) return [];
        const at = (t: number): Point => ({
          x: start.x + ((end.x - start.x) * t) / len,
          y: start.y + ((end.y - start.y) * t) / len,
        });
        return (openingsByWall.get(w.id) ?? []).flatMap((o) => {
          const p = along(at(o.offsetMm));
          const q = along(at(o.offsetMm + o.widthMm));
          const fromMm = Math.max(0, Math.min(p, q));
          const toMm = Math.min(lengthMm, Math.max(p, q));
          return toMm - fromMm > EPS ? [{ fromMm, toMm }] : [];
        });
      })
      .sort((x, y) => x.fromMm - y.fromMm || x.toMm - y.toMm);

    return [{ a, b, lengthMm, inwardNormal, openings }];
  });
};

/** rotationDeg ∈ [0, 360) để mặt trước (+y riêng) quay theo `inwardNormal` (vào phòng). */
export const furnitureFacingDeg = (inwardNormal: Point): number => {
  const deg = Math.round(((Math.atan2(-inwardNormal.x, inwardNormal.y) * 180) / Math.PI) * 100) / 100;
  const wrapped = ((deg % 360) + 360) % 360;
  return wrapped === 360 || Object.is(wrapped, -0) ? 0 : wrapped;
};
