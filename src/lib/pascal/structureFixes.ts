/**
 * Sửa hình dựng lúc đổi sang Pascal (FE3D-FIX-004 C3) — chỉ cho HIỂN THỊ, không bao giờ ghi ngược
 * về đồ thị. Thuần, đơn vị mm.
 *
 * - V5 `isPlausibleStair`: ký hiệu bị dò nhầm thành thang (0,25 × 0,84 m) không dựng cột thang.
 * - V2 `furnishingUsageOf`: phòng `other` đoán công năng theo tên (OH, MH, K, PHÒNG NGỦ…) để bày đồ.
 * - V6 `weldWallEnds`: đầu tường gần nhau (tường cong dò thành chuỗi đoạn ngắn) dồn về một điểm
 *   để vendor nối góc (nó chỉ nối đầu trùng nhau trên lưới 1 mm).
 * - V1 `lShapedRunArms`: dãy tủ bếp chữ L mà bản dò cho một hộp bao → hai nhánh dọc hai tường.
 */

import type { Furniture, FurnitureId, Room, RoomUsage, SpatialGraph, Wall } from '@/domain/spatial/types';

import { furnitureFacingDeg, roomEdges } from './placement';
import { GENERATED_DRESS_PREFIX } from './sceneDressing';

/* V5 ----------------------------------------------------------------------- */

/** Thang thật hẹp nhất / ngắn nhất, mm: nhỏ hơn là ký hiệu dò nhầm. */
const STAIR_MIN_SHORT_MM = 600;
const STAIR_MIN_LONG_MM = 1500;

export const isPlausibleStair = (f: Pick<Furniture, 'boundingBox'>): boolean => {
  const w = f.boundingBox.max.x - f.boundingBox.min.x;
  const d = f.boundingBox.max.y - f.boundingBox.min.y;
  return Math.min(w, d) >= STAIR_MIN_SHORT_MM && Math.max(w, d) >= STAIR_MIN_LONG_MM;
};

/* V2 ----------------------------------------------------------------------- */

// Viết tắt Phần Lan (OH olohuone, RT/RP ruokailu, MH makuuhuone, K/KK keittiö/keittokomero),
// tiếng Việt (PN phòng ngủ) và tiếng Anh. Ăn uống → phòng khách (bộ sofa + bàn).
// ponytail: không đoán `TK` (takkahuone / tekninen tila mơ hồ); thêm khi có bản vẽ cần.
const LIVING_TOKENS = new Set(['OH', 'OLOHUONE', 'SALI', 'SALONKI', 'TUPA', 'LIVING', 'KHÁCH', 'RT', 'RP', 'RUOKAILU', 'DINING']);
const KITCHEN_TOKENS = new Set(['K', 'KK', 'KEITTIÖ', 'KITCHEN', 'BẾP']);
const BEDROOM_TOKENS = new Set(['MH', 'MAKUUHUONE', 'BEDROOM', 'NGỦ', 'PN']);
/** `H` (huone) chỉ là phòng ngủ khi đủ chỗ một giường, m². */
const BARE_ROOM_MIN_M2 = 7;

/**
 * Công năng dùng để BÀY ĐỒ cho một phòng: `usage` đã lưu, trừ `other` thì đoán theo tên.
 * Không bao giờ ghi ngược: zone/slab/metadata vẫn mang `room.usage` gốc.
 */
export const furnishingUsageOf = (room: Pick<Room, 'usage' | 'name' | 'areaM2'>): RoomUsage => {
  if (room.usage !== 'other') return room.usage;
  const tokens = room.name.normalize('NFC').toUpperCase().split(/[^\p{L}]+/u).filter(Boolean);
  const has = (set: ReadonlySet<string>): boolean => tokens.some((t) => set.has(t));
  if (has(LIVING_TOKENS)) return 'livingRoom';
  if (has(KITCHEN_TOKENS)) return 'kitchen';
  if (has(BEDROOM_TOKENS) || (tokens.includes('H') && room.areaM2 >= BARE_ROOM_MIN_M2)) return 'bedroom';
  return 'other';
};

/* V6 ----------------------------------------------------------------------- */

/** Hai đầu tường cách nhau tối đa chừng này (và ≤ nửa bề dày mỏng hơn) thì dồn một điểm, mm. */
const WELD_MAX_MM = 50;

/**
 * Tường đã dồn đầu (chỉ những bức thật sự đổi), theo id. Mỗi cụm đầu tường gần nhau (cùng tầng,
 * khác tường) lấy điểm trung bình; cụm chứa cả hai đầu của một bức thì bỏ (tường ngắn hơn ngưỡng).
 * Lượt về đọc toạ độ node, nhưng `createPascalEditCommand` chỉ so node Pascal báo đã đổi —
 * tường không ai chạm không sinh lệnh nào.
 */
// ponytail: O(n²) đầu tường mỗi tầng; chuyển sang lưới băm nếu một tầng có hàng nghìn tường.
export const weldWallEnds = (walls: readonly Wall[]): ReadonlyMap<string, Wall> => {
  const ends = walls.flatMap((wall) => (['start', 'end'] as const).map((side) => ({ wall, side, p: wall.centreline[side] })));
  const parent = ends.map((_e, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));

  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      const a = ends[i]!;
      const b = ends[j]!;
      if (a.wall === b.wall || a.wall.levelId !== b.wall.levelId) continue;
      const limit = Math.min(WELD_MAX_MM, a.wall.thicknessMm / 2, b.wall.thicknessMm / 2);
      if (Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y) <= limit) parent[find(i)] = find(j);
    }
  }

  const clusters = new Map<number, number[]>();
  ends.forEach((_e, i) => clusters.set(find(i), [...(clusters.get(find(i)) ?? []), i]));

  const welded = new Map<string, Wall>();
  for (const members of clusters.values()) {
    if (members.length < 2) continue;
    const owners = members.map((i) => ends[i]!.wall.id);
    if (new Set(owners).size !== owners.length) continue;
    const x = members.reduce((sum, i) => sum + ends[i]!.p.x, 0) / members.length;
    const y = members.reduce((sum, i) => sum + ends[i]!.p.y, 0) / members.length;
    if (members.every((i) => ends[i]!.p.x === x && ends[i]!.p.y === y)) continue;
    for (const i of members) {
      const { wall, side } = ends[i]!;
      const current = welded.get(wall.id) ?? wall;
      welded.set(wall.id, { ...current, centreline: { ...current.centreline, [side]: { x, y } } });
    }
  }
  return welded;
};

/* V1 ----------------------------------------------------------------------- */

/** Dãy tủ có cạnh ngắn hơn chừng này là thẳng; dài hơn là chữ L, mm. */
const L_RUN_MIN_SHORT_MM = 1000;
/** Mép hộp cách cạnh phòng tối đa (nửa dày tường +) chừng này thì coi là tựa tường, mm. */
const L_RUN_TOUCH_MM = 250;
const RUN_DEPTH_MM = { baseRun: 600, upperRun: 350 } as const;

interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

const asFurnitureBox = (b: Box): Pick<Furniture, 'centre' | 'boundingBox'> => ({
  centre: { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 },
  boundingBox: { min: { x: b.minX, y: b.minY }, max: { x: b.maxX, y: b.maxY } },
});

/**
 * Hai nhánh của một dãy tủ bếp chữ L cho bằng một hộp bao: `long` = nhánh trọn cạnh dài (món đồ
 * thật dựng theo nó, tâm node giữ nguyên), `leg` = nhánh còn lại, đồ sinh ra `DRESS-runLeg-<id>`
 * (không `roomId` → không bao giờ được nhận nuôi hay lưu). `null` khi không phải chữ L tựa hai tường.
 */
// ponytail: chỉ hộp không xoay (`rotationDeg` 0) và cạnh phòng song song trục; nhánh dài giữ
// hướng mặt của món đồ thật. Mở rộng khi có bản dò cho dãy tủ xoay.
export const lShapedRunArms = (
  furniture: Furniture,
  room: Room | undefined,
  graph: SpatialGraph,
): { readonly long: Pick<Furniture, 'centre' | 'boundingBox'>; readonly leg: Furniture } | null => {
  if (furniture.kind !== 'kitchenCabinet' || room === undefined || ((furniture.rotationDeg % 360) + 360) % 360 !== 0) return null;
  if (furniture.variant !== 'baseRun' && furniture.variant !== 'upperRun') return null;
  const { min, max } = furniture.boundingBox;
  const w = max.x - min.x;
  const d = max.y - min.y;
  if (!(Math.min(w, d) > L_RUN_MIN_SHORT_MM)) return null;

  // Cạnh phòng gần nhất của mỗi trục mà hộp tựa vào: `sideY` = mép y (min/max) tựa cạnh nằm ngang.
  let sideY: { at: 'min' | 'max'; gap: number } | null = null;
  let sideX: { at: 'min' | 'max'; gap: number } | null = null;
  for (const edge of roomEdges(room, graph)) {
    const reach = edge.wallHalfMm + L_RUN_TOUCH_MM;
    if (Math.abs(edge.a.y - edge.b.y) < 1) {
      const overlaps = Math.min(Math.max(edge.a.x, edge.b.x), max.x) - Math.max(Math.min(edge.a.x, edge.b.x), min.x) > 0;
      for (const at of ['min', 'max'] as const) {
        const gap = Math.abs((at === 'min' ? min.y : max.y) - edge.a.y);
        if (overlaps && gap <= reach && (sideY === null || gap < sideY.gap)) sideY = { at, gap };
      }
    } else if (Math.abs(edge.a.x - edge.b.x) < 1) {
      const overlaps = Math.min(Math.max(edge.a.y, edge.b.y), max.y) - Math.max(Math.min(edge.a.y, edge.b.y), min.y) > 0;
      for (const at of ['min', 'max'] as const) {
        const gap = Math.abs((at === 'min' ? min.x : max.x) - edge.a.x);
        if (overlaps && gap <= reach && (sideX === null || gap < sideX.gap)) sideX = { at, gap };
      }
    }
  }
  if (sideX === null || sideY === null) return null;

  const depth = Math.min(RUN_DEPTH_MM[furniture.variant], Math.min(w, d) / 2);
  // Nhánh dọc tường ngang (theo x) và nhánh dọc tường đứng (theo y); nhánh dài lấy trọn góc.
  const yBand = sideY.at === 'min' ? { minY: min.y, maxY: min.y + depth } : { minY: max.y - depth, maxY: max.y };
  const xBand = sideX.at === 'min' ? { minX: min.x, maxX: min.x + depth } : { minX: max.x - depth, maxX: max.x };
  const alongX = w >= d;
  const longBox: Box = alongX
    ? { minX: min.x, maxX: max.x, ...yBand }
    : { ...xBand, minY: min.y, maxY: max.y };
  const legBox: Box = alongX
    ? { ...xBand, ...(sideY.at === 'min' ? { minY: yBand.maxY, maxY: max.y } : { minY: min.y, maxY: yBand.minY }) }
    : { ...yBand, ...(sideX.at === 'min' ? { minX: xBand.maxX, maxX: max.x } : { minX: min.x, maxX: xBand.minX }) };

  // Nhánh phụ trong khung riêng: dài theo x riêng, sâu theo y riêng, mặt trước quay vào phòng.
  const leg = asFurnitureBox(legBox);
  const legLength = alongX ? legBox.maxY - legBox.minY : legBox.maxX - legBox.minX;
  const inward = alongX ? { x: sideX.at === 'min' ? 1 : -1, y: 0 } : { x: 0, y: sideY.at === 'min' ? 1 : -1 };
  const withoutRoom = Object.fromEntries(Object.entries(furniture).filter(([key]) => key !== 'roomId')) as Omit<typeof furniture, 'roomId'>;
  return {
    long: asFurnitureBox(longBox),
    leg: {
      ...withoutRoom,
      id: `${GENERATED_DRESS_PREFIX}runLeg-${furniture.id}` as FurnitureId,
      centre: leg.centre,
      boundingBox: {
        min: { x: leg.centre.x - legLength / 2, y: leg.centre.y - depth / 2 },
        max: { x: leg.centre.x + legLength / 2, y: leg.centre.y + depth / 2 },
      },
      rotationDeg: furnitureFacingDeg(inward),
    },
  };
};
