/**
 * Bày đồ cho phòng trống (J10, U12c). Bản vẽ CubiCasa và bản quét AI chỉ có đồ cố định (tủ,
 * WC, tủ áo) nên phòng ngủ/phòng khách lên cảnh trống trơn. Ở đây sinh thêm vài món theo LUẬT
 * chung — chỉ từ công năng, outline, cửa và đồ thật của phòng, không bao giờ theo id/kích thước
 * của một bản vẽ cụ thể — và không bao giờ lưu về đồ thị.
 *
 * Mỗi món sinh ra phải hợp lệ (placement.ts): nằm trong outline lùi 100 mm, cách mọi đồ thật
 * và đồ sinh trước ≥ 50 mm, không lấn vùng mở cửa. Món nào không hợp lệ thì thử cạnh kế, rồi
 * bỏ — không bao giờ xê dịch đồ thật. Thứ tự cố định (phòng theo id, luật theo thứ tự) nên
 * cùng đồ thị luôn ra cùng kết quả, không có sửa ảo khi so diff.
 */

import { computeArea, computeLargestInnerRectangle, outlineContains } from '@/domain/rooms/area';
import type {
  Furniture,
  FurnitureId,
  FurnitureKind,
  FurnitureVariant,
  Point,
  Room,
  SpatialGraph,
} from '@/domain/spatial/types';
import type { PointMm } from '@/domain/units/compare';
import { degrees, millimetres } from '@/domain/units/types';

import {
  doorSwingRects,
  furnitureFacingDeg,
  rectInsidePolygon,
  rectOfFurniture,
  rectsOverlap,
  roomEdges,
  type Rect,
  type RoomEdge,
} from './placement';
import type { SceneStyle } from './sceneStyles';
import { roleOf } from './sceneVariety';

/** Lùi khỏi outline phòng. */
const INSET_MM = 100;
/** Khe tối thiểu giữa hai món. */
const GAP_MM = 50;
/** Đặt cách mép lùi/khe thêm 1 mm để tâm làm tròn về mm nguyên vẫn hợp lệ. */
const SLACK_MM = 1;
/** Khoảng chừa hai bên mỗi khoảng cửa khi tính đoạn tường trống. */
const OPENING_MARGIN_MM = 100;
/** Chỗ trống mỗi bên giường (đủ cho tủ đầu giường). */
const BED_SIDE_MM = 450;
/** Bàn nước đặt trước sofa một lối đi. */
const COFFEE_TABLE_REACH_MM = 450;
/** Khoảng giữa bàn nước và ghế bành. */
const ARMCHAIR_REACH_MM = 300;
/** Lưới tâm thử cho bàn ăn. */
const GRID_MM = 200;

/** Ngưỡng diện tích (m²) và cạnh ngắn (mm) của từng luật. */
const BEDROOM_MIN_M2 = 6;
const DOUBLE_BED_MIN_M2 = 9;
const DOUBLE_BED_MIN_SHORT_MM = 2600;
const LIVING_MIN_M2 = 10;
const KITCHEN_DINING_MIN_M2 = 10;
const LIVING_DINING_MIN_M2 = 18;

interface Piece {
  readonly role: string;
  readonly kind: FurnitureKind;
  readonly variant?: FurnitureVariant;
  /** Rộng theo x riêng (dọc tường), sâu theo y riêng; mặt trước là +y riêng (K1). */
  readonly w: number;
  readonly d: number;
  readonly heightMm?: number;
}

const DOUBLE_BED: Piece = { role: 'bed', kind: 'bed', variant: 'bed', w: 1600, d: 2000 };
// Không variant → vai trò giường đơn theo hộp bao.
const SINGLE_BED: Piece = { role: 'bed', kind: 'bed', w: 900, d: 2000 };
const NIGHTSTAND: Piece = { role: 'nightstand', kind: 'table', variant: 'nightstand', w: 450, d: 400 };
const SOFA: Piece = { role: 'sofa', kind: 'other', variant: 'sofa', w: 2000, d: 900 };
// Không variant: bàn thấp trong phòng khách → vai trò bàn nước.
const COFFEE_TABLE: Piece = { role: 'coffeeTable', kind: 'table', w: 1100, d: 600, heightMm: 400 };
const TV: Piece = { role: 'tv', kind: 'other', variant: 'tv', w: 1600, d: 400 };
const ARMCHAIR: Piece = { role: 'armchair', kind: 'chair', variant: 'armchair', w: 650, d: 650 };
const DINING_TABLE: Piece = { role: 'diningTable', kind: 'table', variant: 'table', w: 1400, d: 800 };
const CHAIR: Piece = { role: 'chair', kind: 'chair', variant: 'chair', w: 450, d: 450 };

interface Span {
  readonly from: number;
  readonly to: number;
}

interface RankedEdge {
  readonly edge: RoomEdge;
  readonly span: Span;
}

interface Ctx {
  readonly room: Room;
  readonly swings: readonly Rect[];
  /** Đồ chiếm chỗ cùng tầng: đồ thật (trừ thảm) + đồ đã sinh; được nối thêm khi đặt. */
  readonly taken: Rect[];
  readonly out: Furniture[];
}

const lengthOf = (span: Span): number => span.to - span.from;

const toMm = (p: Point): PointMm => ({ x: millimetres(p.x), y: millimetres(p.y) });

/** Trục riêng x, y của một góc xoay trên mặt bằng. */
const axesOf = (rotationDeg: number): readonly [Point, Point] => {
  const t = (rotationDeg * Math.PI) / 180;
  return [
    { x: Math.cos(t), y: Math.sin(t) },
    { x: -Math.sin(t), y: Math.cos(t) },
  ];
};

const directionOf = (edge: RoomEdge): Point => ({
  x: (edge.b.x - edge.a.x) / edge.lengthMm,
  y: (edge.b.y - edge.a.y) / edge.lengthMm,
});

const turn = (rotationDeg: number, byDeg: number): number => (rotationDeg + byDeg) % 360;

/** Đoạn trống dài nhất của cạnh sau khi trừ các khoảng cửa (mỗi bên thêm 100 mm). */
const widestSpan = (edge: RoomEdge): Span => {
  let best: Span = { from: 0, to: 0 };
  let cursor = 0;
  for (const opening of edge.openings) {
    const stop = opening.fromMm - OPENING_MARGIN_MM;
    if (stop - cursor > lengthOf(best)) best = { from: cursor, to: stop };
    cursor = Math.max(cursor, opening.toMm + OPENING_MARGIN_MM);
  }
  return edge.lengthMm - cursor > lengthOf(best) ? { from: cursor, to: edge.lengthMm } : best;
};

/** Tâm và góc của món tựa lưng vào cạnh tại vị trí `t` dọc cạnh, mặt trước quay vào phòng. */
const againstEdge = (edge: RoomEdge, t: number, piece: Piece): { at: Point; rotationDeg: number } => {
  const e = directionOf(edge);
  const off = INSET_MM + SLACK_MM + piece.d / 2;
  return {
    at: { x: edge.a.x + e.x * t + edge.inwardNormal.x * off, y: edge.a.y + e.y * t + edge.inwardNormal.y * off },
    rotationDeg: furnitureFacingDeg(edge.inwardNormal),
  };
};

const furnitureOf = (ctx: Ctx, piece: Piece, at: Point, rotationDeg: number, n?: number): Furniture => {
  const cx = Math.round(at.x);
  const cy = Math.round(at.y);
  return {
    id: `DRESS-${piece.role}-${ctx.room.id}${n === undefined ? '' : `-${n}`}` as FurnitureId,
    levelId: ctx.room.levelId,
    roomId: ctx.room.id,
    kind: piece.kind,
    ...(piece.variant === undefined ? {} : { variant: piece.variant }),
    ...(piece.heightMm === undefined ? {} : { heightMm: millimetres(piece.heightMm) }),
    centre: { x: cx, y: cy },
    boundingBox: {
      min: { x: cx - piece.w / 2, y: cy - piece.d / 2 },
      max: { x: cx + piece.w / 2, y: cy + piece.d / 2 },
    },
    rotationDeg: degrees(rotationDeg),
    source: 'ai',
    reviewed: false,
    confidence: 1,
  };
};

/** Đặt món nếu hợp lệ; trả về món đã đặt hoặc null (bỏ qua). */
const place = (ctx: Ctx, piece: Piece, at: Point, rotationDeg: number, n?: number): Furniture | null => {
  const item = furnitureOf(ctx, piece, at, rotationDeg, n);
  const rect = rectOfFurniture(item);
  const valid =
    rectInsidePolygon(rect, ctx.room.outline, INSET_MM) &&
    !ctx.taken.some((other) => rectsOverlap(rect, other, GAP_MM)) &&
    !ctx.swings.some((swing) => rectsOverlap(rect, swing));
  if (!valid) return null;
  ctx.taken.push(rect);
  ctx.out.push(item);
  return item;
};

/** Cạnh phòng xếp theo đoạn trống giảm dần, rồi theo thứ tự cạnh. */
const rankedEdges = (room: Room, graph: SpatialGraph): RankedEdge[] =>
  roomEdges(room, graph)
    .map((edge, index) => ({ edge, span: widestSpan(edge), index }))
    .sort((p, q) => lengthOf(q.span) - lengthOf(p.span) || p.index - q.index);

const furnishBedroom = (ctx: Ctx, edges: readonly RankedEdge[], areaM2: number): void => {
  const inner = computeLargestInnerRectangle(ctx.room.outline.map(toMm));
  const short = inner === null ? 0 : Math.min(inner.widthMm, inner.heightMm);
  const big = short >= DOUBLE_BED_MIN_SHORT_MM && areaM2 >= DOUBLE_BED_MIN_M2;
  // Giường đôi không vừa chỗ nào thì vẫn thử giường đơn.
  for (const bed of big ? [DOUBLE_BED, SINGLE_BED] : [SINGLE_BED]) {
    for (const { edge, span } of edges) {
      if (lengthOf(span) < bed.w + 2 * BED_SIDE_MM) continue;
      const t = (span.from + span.to) / 2;
      const spot = againstEdge(edge, t, bed);
      if (place(ctx, bed, spot.at, spot.rotationDeg) === null) continue;
      [-1, 1].forEach((side, i) => {
        const s = againstEdge(edge, t + side * (bed.w / 2 + GAP_MM + SLACK_MM + NIGHTSTAND.w / 2), NIGHTSTAND);
        place(ctx, NIGHTSTAND, s.at, s.rotationDeg, i + 1);
      });
      return;
    }
  }
};

const furnishLiving = (ctx: Ctx, edges: readonly RankedEdge[]): void => {
  for (const { edge, span } of edges) {
    if (lengthOf(span) < SOFA.w) continue;
    const spot = againstEdge(edge, (span.from + span.to) / 2, SOFA);
    const sofa = place(ctx, SOFA, spot.at, spot.rotationDeg);
    if (sofa === null) continue;

    const n = edge.inwardNormal;
    const e = directionOf(edge);
    const reach = SOFA.d / 2 + COFFEE_TABLE_REACH_MM + COFFEE_TABLE.d / 2;
    const coffee = place(
      ctx,
      COFFEE_TABLE,
      { x: sofa.centre.x + n.x * reach, y: sofa.centre.y + n.y * reach },
      spot.rotationDeg,
    );

    // Kệ TV trên cạnh đối diện gần nhất phía trước sofa, ngang tâm sofa.
    const facing = edges
      .map(({ edge: other }) => other)
      .filter((other) => other.inwardNormal.x * n.x + other.inwardNormal.y * n.y < -0.99)
      .map((other) => ({ other, ahead: (other.a.x - sofa.centre.x) * n.x + (other.a.y - sofa.centre.y) * n.y }))
      .filter(({ ahead }) => ahead > 0)
      .sort((p, q) => p.ahead - q.ahead)[0]?.other;
    if (facing !== undefined && facing.lengthMm >= TV.w) {
      const f = directionOf(facing);
      const t = (sofa.centre.x - facing.a.x) * f.x + (sofa.centre.y - facing.a.y) * f.y;
      const tv = againstEdge(facing, Math.min(Math.max(t, TV.w / 2), facing.lengthMm - TV.w / 2), TV);
      place(ctx, TV, tv.at, tv.rotationDeg);
    }

    // Ghế bành cạnh bàn nước, quay mặt vào bàn; thử phía +cạnh rồi −cạnh.
    if (coffee !== null) {
      const side = COFFEE_TABLE.w / 2 + ARMCHAIR_REACH_MM + ARMCHAIR.w / 2;
      for (const sign of [1, -1]) {
        const at = { x: coffee.centre.x + e.x * side * sign, y: coffee.centre.y + e.y * side * sign };
        if (place(ctx, ARMCHAIR, at, furnitureFacingDeg({ x: -e.x * sign, y: -e.y * sign })) !== null) break;
      }
    }
    return;
  }
};

const segmentDistance = (p: Point, a: Point, b: Point): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
};

const rectDistance = (p: Point, r: Rect): number => {
  const [ex, ey] = axesOf(r.rotationDeg);
  const v = { x: p.x - r.cx, y: p.y - r.cy };
  const lx = Math.max(0, Math.abs(v.x * ex.x + v.y * ex.y) - r.w / 2);
  const ly = Math.max(0, Math.abs(v.x * ey.x + v.y * ey.y) - r.d / 2);
  return Math.hypot(lx, ly);
};

/**
 * Bàn ăn ở chỗ thoáng nhất: quét lưới 200 mm các tâm trong phòng, chọn tâm xa tường/đồ nhất
 * (hoà thì x nhỏ rồi y nhỏ), cạnh dài song song cạnh dài nhất của phòng; tối đa 4 ghế quanh bàn.
 */
const furnishDining = (ctx: Ctx, edges: readonly RankedEdge[]): void => {
  const outline = ctx.room.outline;
  const outlineMm = outline.map(toMm);
  const xs = outline.map((p) => p.x);
  const ys = outline.map((p) => p.y);
  const candidates: { at: Point; score: number }[] = [];
  for (let x = Math.ceil(Math.min(...xs) / GRID_MM) * GRID_MM; x <= Math.max(...xs); x += GRID_MM) {
    for (let y = Math.ceil(Math.min(...ys) / GRID_MM) * GRID_MM; y <= Math.max(...ys); y += GRID_MM) {
      const at = { x, y };
      if (!outlineContains(outlineMm, toMm(at))) continue;
      const walls = outline.map((a, i) => segmentDistance(at, a, outline[(i + 1) % outline.length] as Point));
      const score = Math.min(...walls, ...ctx.taken.map((r) => rectDistance(at, r)));
      if (score > DINING_TABLE.d / 2) candidates.push({ at, score });
    }
  }
  candidates.sort((p, q) => q.score - p.score || p.at.x - q.at.x || p.at.y - q.at.y);

  const longest = [...edges].sort((p, q) => q.edge.lengthMm - p.edge.lengthMm)[0]?.edge;
  if (longest === undefined) return;
  const along = furnitureFacingDeg(longest.inwardNormal);
  const seats = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const;

  for (const { at } of candidates) {
    for (const rotationDeg of [along, turn(along, 90)]) {
      const table = place(ctx, DINING_TABLE, at, rotationDeg);
      if (table === null) continue;
      const [ex, ey] = axesOf(rotationDeg);
      const ly = DINING_TABLE.d / 2 + GAP_MM + SLACK_MM + CHAIR.d / 2;
      seats.forEach(([sx, sy], i) => {
        const lx = (sx * DINING_TABLE.w) / 4;
        const seat = { x: table.centre.x + ex.x * lx + ey.x * sy * ly, y: table.centre.y + ex.y * lx + ey.y * sy * ly };
        // Ghế phía −y quay +y vào bàn; phía +y quay ngược lại.
        place(ctx, CHAIR, seat, sy < 0 ? rotationDeg : turn(rotationDeg, 180), i + 1);
      });
      return;
    }
  }
};

const isRug = (f: Furniture): boolean => {
  const role = roleOf(f);
  return role === 'rug' || role === 'roundRug';
};

// Chữ ký J10 nhận phong cách; luật bày đồ hiện chưa phụ thuộc nó (mô hình chọn theo phong cách ở toPascal).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const furnishEmptyRooms = (graph: SpatialGraph, _style: SceneStyle): readonly Furniture[] => {
  const out: Furniture[] = [];
  const rooms = [...graph.rooms].sort((p, q) => (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));
  // Thảm nằm dưới đồ nên không chiếm chỗ.
  const solid = graph.furniture.filter((f) => !isRug(f));

  for (const room of rooms) {
    const outlineMm = room.outline.map(toMm);
    const real = graph.furniture.filter(
      (f) =>
        f.roomId === room.id ||
        (f.roomId === undefined && f.levelId === room.levelId && outlineContains(outlineMm, toMm(f.centre))),
    );
    const areaM2 = computeArea(outlineMm);
    const needsBed = room.usage === 'bedroom' && areaM2 >= BEDROOM_MIN_M2 && !real.some((f) => f.kind === 'bed');
    const needsSofa =
      room.usage === 'livingRoom' &&
      areaM2 >= LIVING_MIN_M2 &&
      !real.some((f) => f.kind === 'chair' || roleOf(f, room.usage) === 'sofa');
    const needsTable =
      ((room.usage === 'kitchen' && areaM2 >= KITCHEN_DINING_MIN_M2) ||
        (room.usage === 'livingRoom' && areaM2 >= LIVING_DINING_MIN_M2)) &&
      !real.some((f) => f.kind === 'table' && !['nightstand', 'coffeeTable'].includes(roleOf(f, room.usage)));
    if (!needsBed && !needsSofa && !needsTable) continue;

    const ctx: Ctx = {
      room,
      swings: doorSwingRects(graph, room.levelId),
      taken: [...solid, ...out].filter((f) => f.levelId === room.levelId).map(rectOfFurniture),
      out,
    };
    const edges = rankedEdges(room, graph);
    if (needsBed) furnishBedroom(ctx, edges, areaM2);
    if (needsSofa) furnishLiving(ctx, edges);
    if (needsTable) furnishDining(ctx, edges);
  }
  return out;
};
