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
  wallRects,
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
// Phòng khách nhà phố thường 8–10 m²: vẫn đủ một sofa 2 m (V5 D1).
const LIVING_MIN_M2 = 8;
const KITCHEN_DINING_MIN_M2 = 10;
/** Bếp 9–10 m² (hoặc bộ 4 ghế không vừa): bàn nhỏ 2 ghế. */
const KITCHEN_SMALL_TABLE_MIN_M2 = 9;
const LIVING_DINING_MIN_M2 = 18;
/** Phòng ngủ từ mức này có thêm tủ, bàn làm việc/ghế bành. */
const BEDROOM_EXTRAS_MIN_M2 = 12;
/** Phòng 'other' (trong nhà) từ mức này bày thành phòng đọc/ngồi. */
const OTHER_MIN_M2 = 8;
/** Mật độ: khoảng 1 món đứng trên sàn mỗi 2,5 m² (dày như bản render Blender); phòng có ít hơn coi là thưa. */
const M2_PER_PIECE = 2.5;
/** Đầu đoạn trống chừa thêm cho tường vuông góc dày (tường ngoài 300 mm). */
const END_CLEAR_MM = 160;
/** Bù mật độ: tối đa một cây mỗi phòng (cây lặp lại trông như kho cây). */
const MAX_FILL_PLANTS = 1;
/** Hành lang được bày từ mức này (m²) và bề rộng này (mm); luôn chừa lối đi 900 mm. */
const CORRIDOR_MIN_M2 = 8;
const CORRIDOR_MIN_WIDTH_MM = 1800;
const WALKWAY_MM = 900;
/** Phòng tắm có cạnh ngắn (hình chữ nhật trong lớn nhất) từ mức này thì thử thêm bồn tắm. */
const BATHTUB_MIN_SHORT_MM = 1700;
/** Ban công/lô-gia từ mức này có chậu cây dọc lan can; ghế nằm từ OTHER_MIN_M2. */
const OUTDOOR_MIN_M2 = 2;
/** Tường phủ dưới tỉ lệ chu vi này: đồ thị tường không mô tả phòng (mẫu mock, dò hỏng) → coi mọi cạnh có tường. */
const MIN_WALLED_FRACTION = 0.25;
/** Bếp mở từ mức này (m²) mà tầng không có phòng khách: bày thêm bộ sofa. */
const OPEN_KITCHEN_LIVING_MIN_M2 = 18;
/** Dãy tủ bếp dưới: dài tối đa, ngắn nhất đáng đặt. */
const BASE_RUN_MAX_MM = 3600;
const BASE_RUN_MIN_MM = 1200;
/** Dãy từ mức này có cả chậu lẫn bếp nấu; ngắn hơn chỉ chậu. */
const RUN_HOB_MIN_MM = 1600;
/** Lối đi giữa hai cửa (rộng) và chỗ kéo ghế quanh bàn ăn (mỗi phía). */
const DOOR_PATH_MM = 900;
const CHAIR_CLEAR_MM = 600;
/** Phòng tắm từ mức này có thêm khu tắm vòi sen. */
const SHOWER_MIN_M2 = 3;
/** Chậu dọc lan can: khe giữa hai chậu, tối đa số chậu mỗi phòng. */
const PLANTER_SPACING_MM = 400;
const MAX_PLANTERS = 6;
/** Phòng ngoài trời: lát decking hoặc tên ban công/sân hiên (vi, en, fi). */
const OUTDOOR_NAME = /ban công|sân thượng|hiên|terrace|balcon|patio|ulkotila|parveke|terassi/i;

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
const SMALL_TABLE: Piece = { role: 'smallTable', kind: 'table', w: 900, d: 700 };
// Chỉ dùng variant đã có mô hình (VARIANT_MODEL); cỡ gần mô hình catalog.
const WARDROBE: Piece = { role: 'wardrobe', kind: 'wardrobe', variant: 'wardrobe', w: 1800, d: 600 };
const DRESSER: Piece = { role: 'dresser', kind: 'other', variant: 'cabinet', w: 1200, d: 600 };
const BOOKSHELF: Piece = { role: 'bookshelf', kind: 'other', variant: 'shelves', w: 900, d: 350 };
// Không variant: bàn ≤ 0,8 × 1,6 m ở phòng ngủ/'other' → vai trò bàn làm việc (sceneVariety).
const DESK: Piece = { role: 'desk', kind: 'table', w: 1200, d: 600 };
const DESK_CHAIR: Piece = { role: 'deskChair', kind: 'chair', w: 500, d: 500 };
const FLOOR_LAMP: Piece = { role: 'floorLamp', kind: 'other', variant: 'floorLamp', w: 500, d: 500 };
const SIDE_TABLE: Piece = { role: 'sideTable', kind: 'table', variant: 'sideTable', w: 450, d: 450 };
const PLANT: Piece = { role: 'plant', kind: 'other', variant: 'plant', w: 600, d: 600 };
const LOUNGER: Piece = { role: 'lounger', kind: 'chair', variant: 'lounger', w: 860, d: 1900 };
// Luống dài sát lan can (mẫu bush / planter-long, cùng tỉ lệ dài ≈ 3:1).
const PLANTER: Piece = { role: 'planter', kind: 'other', variant: 'planter', w: 1200, d: 400 };
// Bếp: dãy tủ dưới (dài theo đoạn tường), tủ treo nông phía trên, tủ lạnh một đầu dãy; chậu và
// mặt bếp mỏng 20 mm nằm trên mặt đá (toPascal nâng lên counterTopMmOf, dãy có chậu dùng mẫu chậu).
const BASE_RUN: Piece = { role: 'baseRun', kind: 'kitchenCabinet', variant: 'baseRun', w: BASE_RUN_MAX_MM, d: 600 };
const UPPER_RUN: Piece = { role: 'upperRun', kind: 'kitchenCabinet', variant: 'upperRun', w: BASE_RUN_MAX_MM, d: 350 };
const FRIDGE: Piece = { role: 'fridge', kind: 'other', variant: 'fridge', w: 700, d: 700 };
const SINK: Piece = { role: 'sink', kind: 'sanitaryFixture', variant: 'sink', w: 800, d: 450, heightMm: 20 };
const HOB: Piece = { role: 'hob', kind: 'other', variant: 'hob', w: 600, d: 500, heightMm: 20 };
// Phòng tắm: nhận diện đồ đã tắt nên bản vẽ không còn cấp thiết bị vệ sinh (mẫu toilet / bathroom-sink / shower-square).
const WC: Piece = { role: 'wc', kind: 'sanitaryFixture', variant: 'wc', w: 400, d: 700 };
const BASIN: Piece = { role: 'basin', kind: 'sanitaryFixture', variant: 'basin', w: 600, d: 450 };
const SHOWER: Piece = { role: 'shower', kind: 'shower', variant: 'shower', w: 900, d: 900 };
// Không variant: thiết bị vệ sinh dài ≥ 1,4 m → vai trò bồn tắm (sceneVariety, mẫu `bathtub`).
const BATHTUB: Piece = { role: 'bathtub', kind: 'sanitaryFixture', w: 1700, d: 750 };
// Bù mật độ: tủ thấp làm tủ chén ở phòng khách; hành lang có bàn console nông + ghế băng.
const SIDEBOARD: Piece = { ...DRESSER, role: 'sideboard' };
const CONSOLE: Piece = { role: 'console', kind: 'other', variant: 'cabinet', w: 1000, d: 350 };
const BENCH: Piece = { role: 'bench', kind: 'chair', variant: 'bench', w: 1200, d: 400 };

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
  /** Thân tường cùng tầng (wallRects). */
  readonly walls: readonly Rect[];
  /** Đoạn trống khi cả cửa đi lẫn cửa sổ chặn — cho món cao (tủ áo, giá sách, TV). */
  readonly clearSpans: readonly RankedEdge[];
  /** Cạnh phòng có cả cửa sổ (cùng thứ tự outline). */
  readonly windowEdges: readonly RoomEdge[];
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

/**
 * Các đoạn trống của cạnh sau khi trừ các khoảng cửa (mỗi bên thêm 100 mm) và — trừ khi `open` —
 * mọi đoạn không có tường thật phía sau (phòng thông nhau, khe giữa hai tường): lưng sofa/TV/giường
 * không được quay ra chỗ trống. Theo thứ tự dọc cạnh.
 */
const freeSpans = (edge: RoomEdge, open = false): Span[] => {
  const blocked: Span[] = edge.openings.map((o) => ({ from: o.fromMm - OPENING_MARGIN_MM, to: o.toMm + OPENING_MARGIN_MM }));
  if (!open) {
    let wallEnd = 0;
    for (const w of edge.walled) {
      if (w.fromMm > wallEnd) blocked.push({ from: wallEnd, to: w.fromMm });
      wallEnd = w.toMm;
    }
    if (edge.lengthMm > wallEnd) blocked.push({ from: wallEnd, to: edge.lengthMm });
  }
  blocked.sort((p, q) => p.from - q.from || p.to - q.to);
  const spans: Span[] = [];
  let cursor = 0;
  for (const b of blocked) {
    if (b.from > cursor) spans.push({ from: cursor, to: b.from });
    cursor = Math.max(cursor, b.to);
  }
  if (edge.lengthMm > cursor) spans.push({ from: cursor, to: edge.lengthMm });
  return spans;
};

/** Đoạn trống dài nhất (hoà: đoạn đầu). */
const widestSpan = (edge: RoomEdge): Span =>
  freeSpans(edge).reduce((best, s) => (lengthOf(s) > lengthOf(best) ? s : best), { from: 0, to: 0 });

/** Tâm và góc của món tựa lưng vào cạnh tại vị trí `t` dọc cạnh, mặt trước quay vào phòng. */
const againstEdge = (edge: RoomEdge, t: number, piece: Piece): { at: Point; rotationDeg: number } => {
  const e = directionOf(edge);
  // Tường ngoài dày 300 mm: nửa dày (150) vượt mức lùi 100, lưng món phải tránh thân tường.
  const off = Math.max(INSET_MM, edge.wallHalfMm) + SLACK_MM + piece.d / 2;
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
    !ctx.swings.some((swing) => rectsOverlap(rect, swing)) &&
    // Kể cả tường ngăn không nằm trên outline (bàn bếp F1 từng xuyên tường đông).
    !ctx.walls.some((wall) => rectsOverlap(rect, wall));
  if (!valid) return null;
  ctx.taken.push(rect);
  ctx.out.push(item);
  return item;
};

/** Gỡ món vừa đặt cuối cùng (bộ bàn + ghế: ghế không vừa thì bỏ cả bàn). */
const unplaceLast = (ctx: Ctx): void => {
  ctx.taken.pop();
  ctx.out.pop();
};

/**
 * Cạnh phòng (roomEdges); tường phủ dưới 25 % chu vi thì đồ thị tường không mô tả phòng này (mẫu
 * mock chỉ có mẩu tường 1 m, phòng dò thiếu tường) → coi mọi cạnh có tường như trước bench-3d.
 */
const edgesOf = (room: Room, graph: SpatialGraph): RoomEdge[] => {
  const edges = roomEdges(room, graph);
  const total = edges.reduce((sum, e) => sum + e.lengthMm, 0);
  const walled = edges.reduce((sum, e) => sum + e.walled.reduce((t, w) => t + w.toMm - w.fromMm, 0), 0);
  if (walled >= MIN_WALLED_FRACTION * total) return edges;
  return edges.map((e) => ({ ...e, walled: [{ fromMm: 0, toMm: e.lengthMm }] }));
};

/**
 * Cạnh phòng xếp theo đoạn trống giảm dần, rồi theo thứ tự cạnh. Chỉ CỬA ĐI chặn đoạn trống:
 * đầu giường/lưng sofa tựa dưới cửa sổ là bình thường, còn để cửa sổ chặn thì phòng nhỏ không
 * còn cạnh nào đủ dài (nguyên nhân chính của phòng trống, V5 D1).
 */
const rankedEdges = (room: Room, graph: SpatialGraph): RankedEdge[] =>
  edgesOf(room, { ...graph, openings: graph.openings.filter((o) => o.kind === 'door') })
    .map((edge, index) => ({ edge, span: widestSpan(edge), index }))
    .sort((p, q) => lengthOf(q.span) - lengthOf(p.span) || p.index - q.index);

/** MỌI đoạn trống của mọi cạnh (dài trước, rồi thứ tự cạnh, rồi dọc cạnh); `open` = kể cả đoạn không tường. */
const allSpans = (edges: readonly RoomEdge[], open = false): RankedEdge[] =>
  edges
    .flatMap((edge, index) => freeSpans(edge, open).map((span) => ({ edge, span, index })))
    .sort((p, q) => lengthOf(q.span) - lengthOf(p.span) || p.index - q.index || p.span.from - q.span.from);

/**
 * Vị trí thử dọc đoạn trống: giữa đoạn, rồi sát hai đầu (nửa món + lùi đủ tường vuông góc).
 * Đồ thật như tủ áo hay chiếm giữa tường; trượt về một đầu thường còn chỗ (V5 D1).
 */
const endsOf = (span: Span, half: number): [number, number] => {
  const end = half + END_CLEAR_MM + SLACK_MM;
  return [span.from + end, span.to - end];
};
const slotsOf = (span: Span, half: number): number[] => [
  ...new Set([(span.from + span.to) / 2, ...endsOf(span, half)]),
];

/** Món tựa tường ở chỗ hợp lệ đầu tiên: đoạn dài trước; `ends` = chỉ sát hai đầu (góc phòng). */
const alongWall = (
  ctx: Ctx,
  spans: readonly RankedEdge[],
  piece: Piece,
  n?: number,
  ends = false,
): { item: Furniture; edge: RoomEdge; t: number } | null => {
  for (const { edge, span } of spans) {
    if (lengthOf(span) < piece.w) continue;
    for (const t of ends ? endsOf(span, piece.w / 2) : slotsOf(span, piece.w / 2)) {
      const spot = againstEdge(edge, t, piece);
      const item = place(ctx, piece, spot.at, spot.rotationDeg, n);
      if (item !== null) return { item, edge, t };
    }
  }
  return null;
};

/** Hai món nhỏ sát hai đầu một món tựa cạnh (đèn cây / bàn phụ cạnh sofa, ghế bành). */
const flank = (ctx: Ctx, edge: RoomEdge, t: number, hostW: number, pieces: readonly Piece[]): void => {
  const sides = [-1, 1];
  for (const piece of pieces) {
    for (const side of [...sides]) {
      const spot = againstEdge(edge, t + side * (hostW / 2 + GAP_MM + SLACK_MM + piece.w / 2), piece);
      if (place(ctx, piece, spot.at, spot.rotationDeg) !== null) {
        sides.splice(sides.indexOf(side), 1);
        break;
      }
    }
  }
};

/** Bàn + ghế quay vào bàn; ghế không vừa thì gỡ bàn. */
const deskSet = (ctx: Ctx, spans: readonly RankedEdge[]): boolean => {
  for (const { edge, span } of spans) {
    if (lengthOf(span) < DESK.w) continue;
    for (const t of slotsOf(span, DESK.w / 2)) {
      const spot = againstEdge(edge, t, DESK);
      const desk = place(ctx, DESK, spot.at, spot.rotationDeg);
      if (desk === null) continue;
      const n = edge.inwardNormal;
      const reach = DESK.d / 2 + GAP_MM + SLACK_MM + DESK_CHAIR.d / 2;
      const at = { x: desk.centre.x + n.x * reach, y: desk.centre.y + n.y * reach };
      if (place(ctx, DESK_CHAIR, at, furnitureFacingDeg({ x: -n.x, y: -n.y })) !== null) return true;
      unplaceLast(ctx);
    }
  }
  return false;
};

const furnishBedroom = (ctx: Ctx, edges: readonly RankedEdge[], areaM2: number): void => {
  const inner = computeLargestInnerRectangle(ctx.room.outline.map(toMm));
  const short = inner === null ? 0 : Math.min(inner.widthMm, inner.heightMm);
  const big = short >= DOUBLE_BED_MIN_SHORT_MM && areaM2 >= DOUBLE_BED_MIN_M2;
  // Giường đôi không vừa chỗ nào thì vẫn thử giường đơn.
  for (const bed of big ? [DOUBLE_BED, SINGLE_BED] : [SINGLE_BED]) {
    for (const { edge, span } of edges) {
      if (lengthOf(span) < bed.w + 2 * BED_SIDE_MM) continue;
      for (const t of slotsOf(span, bed.w / 2 + BED_SIDE_MM)) {
        const spot = againstEdge(edge, t, bed);
        if (place(ctx, bed, spot.at, spot.rotationDeg) === null) continue;
        [-1, 1].forEach((side, i) => {
          const s = againstEdge(edge, t + side * (bed.w / 2 + GAP_MM + SLACK_MM + NIGHTSTAND.w / 2), NIGHTSTAND);
          place(ctx, NIGHTSTAND, s.at, s.rotationDeg, i + 1);
        });
        return;
      }
    }
  }
};

const furnishLiving = (ctx: Ctx, edges: readonly RankedEdge[]): void => {
  for (const { edge, span } of edges) {
    if (lengthOf(span) < SOFA.w) continue;
    let spot = againstEdge(edge, span.from, SOFA);
    let sofa: Furniture | null = null;
    let sofaT = 0;
    for (const t of slotsOf(span, SOFA.w / 2)) {
      spot = againstEdge(edge, t, SOFA);
      sofa = place(ctx, SOFA, spot.at, spot.rotationDeg);
      sofaT = t;
      if (sofa !== null) break;
    }
    if (sofa === null) continue;

    const n = edge.inwardNormal;
    const e = directionOf(edge);
    const reach = SOFA.d / 2 + COFFEE_TABLE_REACH_MM + COFFEE_TABLE.d / 2;
    const coffee = place(
      ctx,
      // Bếp mở: roleOf không đoán bàn thấp trong bếp là bàn trà (C2) → nói rõ bằng variant `table` thấp.
      ctx.room.usage === 'livingRoom' ? COFFEE_TABLE : { ...COFFEE_TABLE, variant: 'table' },
      { x: sofa.centre.x + n.x * reach, y: sofa.centre.y + n.y * reach },
      spot.rotationDeg,
    );

    // Kệ TV trên cạnh đối diện gần nhất phía trước sofa, ngang tâm sofa — trong một đoạn trống
    // không có cửa đi lẫn cửa sổ (TV không chắn cửa sổ), đoạn gần tâm sofa nhất.
    const facing = ctx.windowEdges
      .filter((other) => other.inwardNormal.x * n.x + other.inwardNormal.y * n.y < -0.99)
      .map((other) => ({ other, ahead: (other.a.x - sofa.centre.x) * n.x + (other.a.y - sofa.centre.y) * n.y }))
      .filter(({ ahead }) => ahead > 0)
      .sort((p, q) => p.ahead - q.ahead)[0]?.other;
    if (facing !== undefined) {
      const f = directionOf(facing);
      const want = (sofa.centre.x - facing.a.x) * f.x + (sofa.centre.y - facing.a.y) * f.y;
      const half = TV.w / 2 + OPENING_MARGIN_MM;
      const best = freeSpans(facing)
        .filter((s) => lengthOf(s) >= 2 * half)
        .map((s) => Math.min(Math.max(want, s.from + half), s.to - half))
        .sort((p, q) => Math.abs(p - want) - Math.abs(q - want))[0];
      if (best !== undefined) {
        const tv = againstEdge(facing, best, TV);
        place(ctx, TV, tv.at, tv.rotationDeg);
      }
    }

    // Đèn cây một đầu sofa, bàn phụ đầu kia.
    flank(ctx, edge, sofaT, SOFA.w, [FLOOR_LAMP, SIDE_TABLE]);

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
const furnishDining = (ctx: Ctx, edges: readonly RankedEdge[], small = false): boolean => {
  const tablePiece = small ? SMALL_TABLE : DINING_TABLE;
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
      if (score > tablePiece.d / 2) candidates.push({ at, score });
    }
  }
  candidates.sort((p, q) => q.score - p.score || p.at.x - q.at.x || p.at.y - q.at.y);

  // Lối đi 900 mm nối tâm từng cặp cửa đi của phòng: bàn + chỗ kéo ghế không được chắn.
  const doors = edges.flatMap(({ edge }) => {
    const e = directionOf(edge);
    return edge.openings.map((o) => {
      const t = (o.fromMm + o.toMm) / 2;
      return { x: edge.a.x + e.x * t, y: edge.a.y + e.y * t };
    });
  });
  const paths: Rect[] = doors.flatMap((p, i) =>
    doors.slice(i + 1).map((q) => ({
      cx: (p.x + q.x) / 2,
      cy: (p.y + q.y) / 2,
      w: Math.hypot(q.x - p.x, q.y - p.y),
      d: DOOR_PATH_MM,
      rotationDeg: (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI,
    })),
  );
  const blocksPath = (at: Point, rotationDeg: number): boolean => {
    const w = tablePiece.w + 2 * CHAIR_CLEAR_MM;
    const d = tablePiece.d + 2 * CHAIR_CLEAR_MM;
    return paths.some((path) => rectsOverlap({ cx: at.x, cy: at.y, w, d, rotationDeg }, path));
  };

  const longest = [...edges].sort((p, q) => q.edge.lengthMm - p.edge.lengthMm)[0]?.edge;
  if (longest === undefined) return false;
  const along = furnitureFacingDeg(longest.inwardNormal);
  // Bàn nhỏ: 2 ghế đối diện giữa hai cạnh dài.
  const seats = small
    ? ([
        [0, -1],
        [0, 1],
      ] as const)
    : ([
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const);

  for (const { at } of candidates) {
    for (const rotationDeg of [along, turn(along, 90)]) {
      if (blocksPath(at, rotationDeg)) continue;
      const table = place(ctx, tablePiece, at, rotationDeg);
      if (table === null) continue;
      const [ex, ey] = axesOf(rotationDeg);
      const ly = tablePiece.d / 2 + GAP_MM + SLACK_MM + CHAIR.d / 2;
      seats.forEach(([sx, sy], i) => {
        const lx = (sx * tablePiece.w) / 4;
        const seat = { x: table.centre.x + ex.x * lx + ey.x * sy * ly, y: table.centre.y + ex.y * lx + ey.y * sy * ly };
        // Ghế phía −y quay +y vào bàn; phía +y quay ngược lại.
        place(ctx, CHAIR, seat, sy < 0 ? rotationDeg : turn(rotationDeg, 180), i + 1);
      });
      return true;
    }
  }
  return false;
};

/** Phòng ngủ ≥ 12 m²: tủ áo (hoặc tủ thấp) nếu chưa có, rồi góc bàn làm việc hoặc ghế bành. */
const furnishBedroomExtras = (ctx: Ctx, edges: readonly RankedEdge[], present: ReadonlySet<string>): void => {
  const doorSpans = allSpans(edges.map(({ edge }) => edge));
  if (!['closet', 'dresser', 'bookshelf'].some((role) => present.has(role))) {
    // Tủ áo cao không che cửa sổ; tủ thấp thì được.
    if (alongWall(ctx, ctx.clearSpans, WARDROBE) === null) alongWall(ctx, doorSpans, DRESSER);
  }
  if (!present.has('desk') && !present.has('armchair') && !deskSet(ctx, doorSpans)) {
    alongWall(ctx, doorSpans, ARMCHAIR, undefined, true);
  }
};

/** Phòng 'other' trong nhà: phòng đọc (bàn + ghế + giá sách + đèn cây) hoặc góc ngồi. */
const furnishStudy = (ctx: Ctx, edges: readonly RankedEdge[]): void => {
  const doorSpans = allSpans(edges.map(({ edge }) => edge));
  if (deskSet(ctx, doorSpans)) {
    alongWall(ctx, ctx.clearSpans, BOOKSHELF);
    alongWall(ctx, doorSpans, FLOOR_LAMP, undefined, true);
    return;
  }
  const first = alongWall(ctx, doorSpans, ARMCHAIR, 1);
  if (first === null) return;
  // Ghế bành thứ hai cạnh ghế đầu, bàn phụ ở giữa.
  const step = ARMCHAIR.w / 2 + GAP_MM + SLACK_MM + SIDE_TABLE.w;
  for (const side of [1, -1]) {
    const tableSpot = againstEdge(first.edge, first.t + side * (ARMCHAIR.w / 2 + GAP_MM + SLACK_MM + SIDE_TABLE.w / 2), SIDE_TABLE);
    if (place(ctx, SIDE_TABLE, tableSpot.at, tableSpot.rotationDeg) === null) continue;
    const chairSpot = againstEdge(first.edge, first.t + side * (step + GAP_MM + SLACK_MM + ARMCHAIR.w / 2), ARMCHAIR);
    place(ctx, ARMCHAIR, chairSpot.at, chairSpot.rotationDeg, 2);
    return;
  }
};

/**
 * Ngoài trời: ghế nằm (phòng đủ rộng) rồi hàng chậu cây dọc mọi đoạn tường/lan can trống, cách
 * nhau PLANTER_SPACING_MM, tối đa MAX_PLANTERS — như bản render Blender. Chỉ mô hình đã đăng ký.
 */
const furnishOutdoor = (ctx: Ctx, edges: readonly RankedEdge[], areaM2: number): void => {
  // Lan can hở (không có tường trong đồ thị) vẫn bày chậu được.
  const spans = allSpans(
    edges.map(({ edge }) => edge),
    true,
  );
  if (areaM2 >= OTHER_MIN_M2) alongWall(ctx, spans, LOUNGER);
  let n = 1;
  for (const { edge, span } of spans) {
    const [first, last] = endsOf(span, PLANTER.w / 2);
    for (let t = first; t <= last && n <= MAX_PLANTERS; t += PLANTER.w + PLANTER_SPACING_MM) {
      const spot = againstEdge(edge, t, PLANTER);
      if (place(ctx, PLANTER, spot.at, spot.rotationDeg, n) !== null) n += 1;
    }
  }
};

/** Món chồng lên/treo trên món đã đặt (tủ treo, chậu, mặt bếp): không xét chồng, không chiếm chỗ thêm. */
const stack = (ctx: Ctx, piece: Piece, edge: RoomEdge, t: number): void => {
  const spot = againstEdge(edge, t, piece);
  ctx.out.push(furnitureOf(ctx, piece, spot.at, spot.rotationDeg));
};

/** Cùng một cạnh (mỗi lần gọi roomEdges cho đối tượng mới). */
const sameEdge = (p: RoomEdge, q: RoomEdge): boolean =>
  p.a.x === q.a.x && p.a.y === q.a.y && p.b.x === q.b.x && p.b.y === q.b.y;

/**
 * Bếp chưa có tủ thật: dãy tủ dưới (≤ 3,6 m) dọc đoạn có tường, không cửa đi, dài nhất; tủ lạnh ở
 * đầu dãy nếu đủ chỗ; chậu (+ bếp nấu khi dãy ≥ 1,6 m) trên mặt đá; tủ treo phía trên khi đoạn đó
 * không có cửa sổ.
 */
const furnishKitchenRun = (ctx: Ctx, edges: readonly RankedEdge[]): void => {
  const end = END_CLEAR_MM + SLACK_MM;
  for (const { edge, span } of allSpans(edges.map((r) => r.edge))) {
    const usable = lengthOf(span) - 2 * end;
    if (usable < BASE_RUN_MIN_MM) continue;
    const withFridge = usable >= BASE_RUN_MIN_MM + GAP_MM + SLACK_MM + FRIDGE.w;
    const runW = Math.min(BASE_RUN_MAX_MM, withFridge ? usable - GAP_MM - SLACK_MM - FRIDGE.w : usable);
    const runT = span.from + end + runW / 2;
    const run = { ...BASE_RUN, w: runW };
    const spot = againstEdge(edge, runT, run);
    if (place(ctx, run, spot.at, spot.rotationDeg) === null) continue;
    if (withFridge) {
      const f = againstEdge(edge, runT + runW / 2 + GAP_MM + SLACK_MM + FRIDGE.w / 2, FRIDGE);
      place(ctx, FRIDGE, f.at, f.rotationDeg);
    }
    if (runW >= RUN_HOB_MIN_MM) {
      stack(ctx, SINK, edge, runT + runW / 4);
      stack(ctx, HOB, edge, runT - runW / 4);
    } else stack(ctx, SINK, edge, runT);
    const clear = ctx.clearSpans.some(
      (c) => sameEdge(c.edge, edge) && c.span.from <= runT - runW / 2 && c.span.to >= runT + runW / 2,
    );
    if (clear) stack(ctx, { ...UPPER_RUN, w: runW }, edge, runT);
    return;
  }
};

/**
 * Phòng tắm chưa có thiết bị thật: bồn cầu sát góc, lavabo ở đoạn tường còn trống, rồi (≥ 3 m²)
 * khu tắm vòi sen ở góc còn trống xa cửa nhất — thiết bị chính trước để khu tắm không chiếm chỗ của
 * chúng ở phòng nhỏ. Mọi món tựa tường thật, ngoài vùng mở cửa.
 */
const furnishBathroom = (ctx: Ctx, edges: readonly RankedEdge[], areaM2: number): void => {
  const spans = allSpans(edges.map(({ edge }) => edge));
  alongWall(ctx, spans, WC, undefined, true);
  alongWall(ctx, spans, BASIN);
  if (areaM2 < SHOWER_MIN_M2) return;
  const corners = spans
    .flatMap(({ edge, span }) =>
      lengthOf(span) < SHOWER.w ? [] : endsOf(span, SHOWER.w / 2).map((t) => againstEdge(edge, t, SHOWER)),
    )
    .map((spot) => ({ spot, far: Math.min(Infinity, ...ctx.swings.map((r) => rectDistance(spot.at, r))) }))
    // Sắp ổn định: hoà khoảng cách thì giữ thứ tự đoạn.
    .sort((p, q) => q.far - p.far);
  corners.some(({ spot }) => place(ctx, SHOWER, spot.at, spot.rotationDeg) !== null);
};

/** Bồn tắm dọc đoạn tường còn trống khi cạnh ngắn của phòng ≥ 1,7 m (sau thiết bị chính). */
const furnishBathtub = (ctx: Ctx, edges: readonly RankedEdge[]): void => {
  const inner = computeLargestInnerRectangle(ctx.room.outline.map(toMm));
  if (inner === null || Math.min(inner.widthMm, inner.heightMm) < BATHTUB_MIN_SHORT_MM) return;
  alongWall(ctx, allSpans(edges.map(({ edge }) => edge)), BATHTUB, undefined, true);
};

interface FillEntry {
  readonly piece: Piece;
  /** Tối đa bấy nhiêu món cùng variant trong phòng (kể cả đồ thật/đồ bộ chính). */
  readonly max: number;
  /** Món cao: không che cửa sổ (clearSpans). */
  readonly tall?: boolean;
  /** Bỏ qua khi phòng đã có món mang một trong các vai này (tủ áo thật → không thêm tủ thấp). */
  readonly unless?: readonly string[];
}

/** Danh sách bù theo công năng, thử theo thứ tự tới khi đủ mật độ; cuối cùng tối đa một cây. */
const FILL_LISTS: Partial<Record<Room['usage'], readonly FillEntry[]>> = {
  // Đôi ghế bành thứ hai, giá sách, tủ chén, đèn cây thứ hai.
  livingRoom: [
    { piece: ARMCHAIR, max: 3 },
    { piece: BOOKSHELF, max: 1, tall: true },
    { piece: SIDEBOARD, max: 1 },
    { piece: FLOOR_LAMP, max: 2 },
  ],
  bedroom: [
    { piece: DRESSER, max: 1, unless: ['closet', 'dresser', 'bookshelf'] },
    { piece: ARMCHAIR, max: 1 },
  ],
  corridor: [
    { piece: CONSOLE, max: 1 },
    { piece: BENCH, max: 1 },
  ],
  other: [
    { piece: BOOKSHELF, max: 1, tall: true },
    { piece: ARMCHAIR, max: 2 },
    { piece: FLOOR_LAMP, max: 1 },
  ],
};

/**
 * Bù mật độ tới ~1 món đứng / 2,5 m²: danh sách theo công năng rồi một cây ở góc. Hành lang chỉ
 * bày dọc MỘT cạnh dài và món đủ nông để còn lối đi 900 mm.
 */
const fillRoom = (ctx: Ctx, edges: readonly RankedEdge[], mine: () => readonly Furniture[], target: number): void => {
  let doorSpans = allSpans(edges.map(({ edge }) => edge));
  let tallSpans = ctx.clearSpans;
  let maxDepth = Infinity;
  if (ctx.room.usage === 'corridor') {
    const inner = computeLargestInnerRectangle(ctx.room.outline.map(toMm));
    const width = inner === null ? 0 : Math.min(inner.widthMm, inner.heightMm);
    const along = [...edges].sort((p, q) => q.edge.lengthMm - p.edge.lengthMm)[0]?.edge;
    if (along === undefined || width < CORRIDOR_MIN_WIDTH_MM) return;
    doorSpans = doorSpans.filter((s) => s.edge === along);
    tallSpans = [];
    maxDepth = width - 2 * INSET_MM - SLACK_MM - WALKWAY_MM;
  }
  const count = (): number => mine().filter(standsOnFloor).length;
  for (const { piece, max, tall, unless = [] } of FILL_LISTS[ctx.room.usage] ?? []) {
    if (piece.d > maxDepth || mine().some((f) => unless.includes(roleOf(f, ctx.room.usage)))) continue;
    const spans = tall === true ? tallSpans : doorSpans;
    for (let n = 1; count() < target && mine().filter((f) => f.variant === piece.variant).length < max; n += 1) {
      // Vai `…Fill`: id riêng, không trùng món cùng loại của bộ chính (DRESS-armchair-R-2 của phòng đọc).
      if (alongWall(ctx, spans, { ...piece, role: `${piece.role}Fill` }, n) === null) break;
    }
  }
  for (let n = 1; count() < target && n <= MAX_FILL_PLANTS && PLANT.d <= maxDepth; n += 1) {
    if (alongWall(ctx, doorSpans, PLANT, n, true) === null) return;
  }
};

/** Bù mật độ chỉ cho các công năng này, từ cùng ngưỡng với luật chính. */
const FILL_MIN_M2: Partial<Record<Room['usage'], number>> = {
  bedroom: BEDROOM_MIN_M2,
  livingRoom: LIVING_MIN_M2,
  other: OTHER_MIN_M2,
  kitchen: KITCHEN_SMALL_TABLE_MIN_M2,
  corridor: CORRIDOR_MIN_M2,
};

const DINING_USAGES: ReadonlySet<Room['usage'] | undefined> = new Set([undefined, 'kitchen', 'livingRoom']);

const isRug = (f: Furniture): boolean => {
  const role = roleOf(f);
  return role === 'rug' || role === 'roundRug';
};

/** Ngoài trời: lát decking hoặc tên ban công/sân hiên — không bày đồ trong nhà. */
const isOutdoor = (room: Room): boolean => room.finish === 'decking' || OUTDOOR_NAME.test(room.name);

/** Món đứng trên sàn được tính vào mật độ: không thảm, không treo/đặt trên món khác. */
const standsOnFloor = (f: Furniture): boolean => !isRug(f) && (f.liftMm ?? 0) <= 0;

// Chữ ký J10 nhận phong cách; luật bày đồ hiện chưa phụ thuộc nó (mô hình chọn theo phong cách ở toPascal).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const furnishEmptyRooms = (graph: SpatialGraph, _style: SceneStyle): readonly Furniture[] => {
  const out: Furniture[] = [];
  const rooms = [...graph.rooms].sort((p, q) => (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));
  const outlinesMm = new Map(rooms.map((r) => [r.id, r.outline.map(toMm)]));
  const inRoom = (f: Furniture, room: Room): boolean =>
    f.roomId === room.id ||
    (f.roomId === undefined &&
      f.levelId === room.levelId &&
      outlineContains(outlinesMm.get(room.id) ?? [], toMm(f.centre)));
  /** Công năng phòng của món (theo roomId, không có thì phòng chứa tâm món). */
  const usageOfItem = (f: Furniture): Room['usage'] | undefined => rooms.find((r) => inRoom(f, r))?.usage;
  const isDiningTable = (f: Furniture): boolean =>
    f.kind === 'table' && !['nightstand', 'coffeeTable', 'desk'].includes(roleOf(f, usageOfItem(f)));
  // Thảm nằm dưới đồ nên không chiếm chỗ.
  const solid = graph.furniture.filter((f) => !isRug(f));

  // Lượt 0: giường, sofa, bàn ăn trong bếp, phòng 'other'; lượt 1: bàn ăn phòng khách rồi bù
  // mật độ — để bàn của bếp (bất kể thứ tự id phòng) chặn được bàn thứ hai cùng tầng (V5 D10).
  for (const pass of [0, 1]) for (const room of rooms) {
    const real = graph.furniture.filter((f) => inRoom(f, room));
    const areaM2 = computeArea(outlinesMm.get(room.id) ?? []);
    const outdoor = isOutdoor(room);
    // Mỗi tầng một bộ bàn ăn: bàn (thật hoặc đã sinh) ở BẤT KỲ phòng nào cùng tầng — kể cả bếp mở
    // thông phòng khách — chặn bộ thứ hai, theo cả hai chiều bếp ↔ phòng khách (V5 D10, F1).
    // Bàn ở phòng ngủ/phòng làm việc là bàn làm việc, không tính.
    const levelHasDining = [...graph.furniture, ...out].some(
      (f) => f.levelId === room.levelId && DINING_USAGES.has(usageOfItem(f)) && isDiningTable(f),
    );
    const needsBed =
      pass === 0 && room.usage === 'bedroom' && areaM2 >= BEDROOM_MIN_M2 && !real.some((f) => f.kind === 'bed');
    // Bếp mở rộng mà tầng không có phòng khách: bếp kiêm phòng khách, bày cả bộ sofa.
    const openKitchen =
      room.usage === 'kitchen' &&
      areaM2 >= OPEN_KITCHEN_LIVING_MIN_M2 &&
      !rooms.some((r) => r.levelId === room.levelId && r.usage === 'livingRoom');
    const needsSofa =
      pass === 0 &&
      ((room.usage === 'livingRoom' &&
        areaM2 >= LIVING_MIN_M2 &&
        !real.some((f) => f.kind === 'chair' || roleOf(f, room.usage) === 'sofa')) ||
        (openKitchen && !real.some((f) => roleOf(f, 'livingRoom') === 'sofa')));
    const needsKitchenRun =
      pass === 0 && room.usage === 'kitchen' && !real.some((f) => f.kind === 'kitchenCabinet');
    const needsTable =
      ((pass === 0 && room.usage === 'kitchen' && areaM2 >= KITCHEN_SMALL_TABLE_MIN_M2) ||
        (pass === 1 && room.usage === 'livingRoom' && areaM2 >= LIVING_DINING_MIN_M2)) &&
      !levelHasDining;
    const target = Math.floor(areaM2 / M2_PER_PIECE);
    const sparse = real.filter(standsOnFloor).length < target;
    const needsOther = pass === 0 && room.usage === 'other' && !outdoor && areaM2 >= OTHER_MIN_M2 && sparse;
    // Ban công/lô-gia: luôn có chậu dọc lan can (đồ thật như máy giặt vẫn được tránh).
    const needsOutdoor =
      pass === 0 && (room.usage === 'loggia' || (room.usage === 'other' && outdoor)) && areaM2 >= OUTDOOR_MIN_M2;
    const needsBath =
      pass === 0 &&
      room.usage === 'bathroom' &&
      !real.some((f) => f.kind === 'sanitaryFixture' || f.kind === 'shower');
    const needsFill = pass === 1 && sparse && !outdoor && areaM2 >= (FILL_MIN_M2[room.usage] ?? Infinity);
    if (!needsBed && !needsSofa && !needsTable && !needsOther && !needsOutdoor && !needsBath && !needsFill && !needsKitchenRun) continue;

    const ctx: Ctx = {
      room,
      swings: doorSwingRects(graph, room.levelId),
      walls: wallRects(graph, room.levelId),
      clearSpans: allSpans(edgesOf(room, graph)),
      windowEdges: edgesOf(room, graph),
      taken: [...solid, ...out].filter((f) => f.levelId === room.levelId).map(rectOfFurniture),
      out,
    };
    const edges = rankedEdges(room, graph);
    if (needsKitchenRun) furnishKitchenRun(ctx, edges);
    if (needsBed) furnishBedroom(ctx, edges, areaM2);
    if (needsSofa) furnishLiving(ctx, edges);
    if (needsTable) {
      const small = room.usage === 'kitchen' && areaM2 < KITCHEN_DINING_MIN_M2;
      // Bộ 4 ghế không vừa bếp thì thử bàn nhỏ 2 ghế.
      if (!furnishDining(ctx, edges, small) && room.usage === 'kitchen' && !small) furnishDining(ctx, edges, true);
    }
    if (needsOther) furnishStudy(ctx, edges);
    if (needsOutdoor) furnishOutdoor(ctx, edges, areaM2);
    if (needsBath) {
      furnishBathroom(ctx, edges, areaM2);
      furnishBathtub(ctx, edges);
    }
    if (needsFill) {
      const mine = (): Furniture[] => [...real, ...out.filter((f) => f.roomId === room.id)];
      if (room.usage === 'bedroom' && areaM2 >= BEDROOM_EXTRAS_MIN_M2) {
        furnishBedroomExtras(ctx, edges, new Set(mine().map((f) => roleOf(f, room.usage))));
      }
      fillRoom(ctx, edges, mine, target);
    }
  }
  return out;
};
