/**
 * Hướng cho đồ đạc AI dò được. YOLO chỉ cho hộp thẳng trục, nên máy chủ đặt `rotationDeg = 0`
 * cho mọi món (AppBack `pipeline_build/rooms.py`) và mọi ghế quay cùng một phía.
 *
 * Luật: ghế quay vào bàn gần nhất (hoặc quầy bar `kitchenCabinet`) trong 900 mm; không có thì
 * lưng tựa tường gần nhất trong 600 mm. Giường, tủ áo, thiết bị vệ sinh, máy giặt, TV… lưng tựa
 * tường gần nhất trong 600 mm (giường: chỉ tường ở cạnh ngắn). Chỉ đụng món góc còn 0 — kể cả món đã duyệt
 * ở 2D, vì 2D không cho thấy mặt trước.
 *
 * Quy ước (K1, `domain/spatial/types.ts` — `boundingBox` là khung riêng chưa xoay): mặt trước là
 * +y riêng, `furnitureFacingDeg` (placement.ts) — cùng hàm `againstEdge`/ghế bàn ăn của
 * sceneFurnish dùng. Hộp AI là hộp THẾ GIỚI, nên khi quay 90°/270° thì đổi chỗ hai cạnh để
 * khung riêng xoay xong vẫn phủ đúng chỗ trên bản vẽ.
 *
 * `kitchenCabinet` FE không tự xoay (máy chủ có thể ghi góc): dãy chữ L, dãy tủ và tủ chủ của
 * mặt bếp/chậu đọc hộp thế giới qua `worldBoxOf`.
 */

import type { BoundingBox, Furniture, Point, Wall } from '@/domain/spatial/types';
import { degrees } from '@/domain/units/types';

import { furnitureFacingDeg } from './placement';

/** Khe tối đa từ ghế tới mép bàn/quầy, mm. */
const SEAT_TO_TABLE_MM = 900;
/** Khe tối đa từ lưng món tới mặt tường, mm. */
const BACK_TO_WALL_MM = 600;
/** Tường lệch trục quá chừng này (tan ≈ 10°) thì bỏ qua. */
const AXIS_TOLERANCE = 0.18;

const WALL_HUGGING_KINDS: ReadonlySet<Furniture['kind']> = new Set(['bed', 'wardrobe', 'sanitaryFixture', 'washingMachine']);
const WALL_HUGGING_VARIANTS: ReadonlySet<string> = new Set(['tv', 'fridge', 'shelves', 'cabinet']);

const gapBetween = (a: BoundingBox, b: BoundingBox): number => {
  const gx = Math.max(0, b.min.x - a.max.x, a.min.x - b.max.x);
  const gy = Math.max(0, b.min.y - a.max.y, a.min.y - b.max.y);
  return Math.hypot(gx, gy);
};

const midOf = (b: BoundingBox): Point => ({ x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2 });

/**
 * Hộp khung riêng ↔ hộp thế giới (thẳng trục) của món quay `rotationDeg`: quay 90°/270° thì hoán hai
 * cạnh quanh tâm hộp, 0°/180° giữ nguyên. Phép này tự nghịch đảo nên dùng được cả hai chiều.
 */
// ponytail: chỉ góc bội 90° (BE chỉ ghi các góc này); góc xiên lấy hộp bao của hình đã xoay nếu cần.
export const worldBoxOf = (box: BoundingBox, rotationDeg: number): BoundingBox => {
  const quarter = Math.round((((rotationDeg % 360) + 360) % 360) / 90) % 2;
  if (quarter === 0) return box;
  const m = midOf(box);
  const hw = (box.max.x - box.min.x) / 2;
  const hd = (box.max.y - box.min.y) / 2;
  return {
    min: { x: (m.x - hd) as BoundingBox['min']['x'], y: (m.y - hw) as BoundingBox['min']['y'] },
    max: { x: (m.x + hd) as BoundingBox['max']['x'], y: (m.y + hw) as BoundingBox['max']['y'] },
  };
};

/** Hướng (đơn vị, theo trục) từ ghế nhìn vào bàn: chọn cạnh bàn mà ghế đứng ngoài xa hơn. */
const towardTable = (seat: BoundingBox, table: BoundingBox): Point => {
  const s = midOf(seat);
  const t = midOf(table);
  const dx = s.x - t.x;
  const dy = s.y - t.y;
  const outX = Math.abs(dx) - (table.max.x - table.min.x) / 2;
  const outY = Math.abs(dy) - (table.max.y - table.min.y) / 2;
  return outX > outY ? { x: dx > 0 ? -1 : 1, y: 0 } : { x: 0, y: dy > 0 ? -1 : 1 };
};

const nearestTarget = (seat: Furniture, targets: readonly Furniture[]): Furniture | undefined => {
  let best: Furniture | undefined;
  let bestGap = SEAT_TO_TABLE_MM;
  for (const t of targets) {
    if (t.levelId !== seat.levelId) continue;
    const gap = gapBetween(seat.boundingBox, worldBoxOf(t.boundingBox, t.rotationDeg));
    if (gap <= bestGap) {
      best = t;
      bestGap = gap;
    }
  }
  return best;
};

/**
 * Pháp tuyến hướng vào phòng của tường thẳng trục gần lưng món nhất trong 600 mm, hoặc `null`.
 * `endsOnly` (giường): chỉ tường chạy dọc cạnh NGẮN — đầu giường không bao giờ nằm ở cạnh dài, kể cả khi
 * giường kê sát góc và tường bên hông gần hơn.
 */
// ponytail: chỉ tường gần thẳng trục, tường xiên/cong bị bỏ qua; cần thì chiếu lên pháp tuyến thật.
const intoRoomFromWall = (item: Furniture, walls: readonly Wall[], endsOnly = false): Point | null => {
  const b = item.boundingBox;
  const m = midOf(b);
  const longAlongY = b.max.y - b.min.y > b.max.x - b.min.x;
  let best: Point | null = null;
  let bestGap = BACK_TO_WALL_MM;
  for (const w of walls) {
    if (w.levelId !== item.levelId) continue;
    const { start, end } = w.centreline;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const half = w.thicknessMm / 2;
    const horizontal = Math.abs(dy) <= Math.abs(dx) * AXIS_TOLERANCE;
    const vertical = Math.abs(dx) <= Math.abs(dy) * AXIS_TOLERANCE;
    if (!horizontal && !vertical) continue;
    if (endsOnly && (longAlongY ? !horizontal : !vertical)) continue;
    // Trục dọc tường (u) và trục vuông góc (v) của hộp.
    const [uMin, uMax, vMin, vMax, vMid] = horizontal
      ? [b.min.x, b.max.x, b.min.y, b.max.y, m.y]
      : [b.min.y, b.max.y, b.min.x, b.max.x, m.x];
    const [a0, a1, at] = horizontal
      ? [Math.min(start.x, end.x), Math.max(start.x, end.x), (start.y + end.y) / 2]
      : [Math.min(start.y, end.y), Math.max(start.y, end.y), (start.x + end.x) / 2];
    if (Math.min(uMax, a1) - Math.max(uMin, a0) <= 0) continue;
    const after = at > vMid; // tường nằm phía +v của món
    const gap = after ? at - half - vMax : vMin - (at + half);
    if (gap > bestGap || gap < -(vMax - vMin) / 2) continue;
    bestGap = gap;
    const sign = after ? -1 : 1;
    best = horizontal ? { x: 0, y: sign } : { x: sign, y: 0 };
  }
  return best;
};

/**
 * Món vừa được quay ở đây (góc gốc 0): toPascal ghi `autoFacing` để lượt về trả lại góc 0 + hộp gốc khi
 * người dùng chưa xoay — hướng đoán chỉ để hiển thị, không thành "đã sửa" (không mất dấu duyệt).
 */
const autoFaced = new WeakSet<Furniture>();
export const isAutoFaced = (item: Furniture): boolean => autoFaced.has(item);

const turned = (item: Furniture, facing: Point): Furniture => {
  const rotationDeg = furnitureFacingDeg(facing);
  if (rotationDeg === 0) return item;
  const b = item.boundingBox;
  const m = midOf(b);
  const boundingBox =
    rotationDeg === 90 || rotationDeg === 270
      ? {
          min: { x: m.x - (b.max.y - b.min.y) / 2, y: m.y - (b.max.x - b.min.x) / 2 },
          max: { x: m.x + (b.max.y - b.min.y) / 2, y: m.y + (b.max.x - b.min.x) / 2 },
        }
      : b;
  const out = { ...item, rotationDeg: degrees(rotationDeg), boundingBox };
  autoFaced.add(out);
  return out;
};

/** Cùng danh sách, cùng thứ tự, cùng id; chỉ `rotationDeg` (và hộp riêng khi quay 90°/270°) đổi. */
export const orientDetectedFurniture = (
  furniture: readonly Furniture[],
  walls: readonly Wall[],
): readonly Furniture[] => {
  const tables = furniture.filter((f) => f.kind === 'table');
  const bars = furniture.filter((f) => f.kind === 'kitchenCabinet');

  return furniture.map((item) => {
    // Cả món đã duyệt/người vẽ: duyệt 2D đổi `source` sang 'human' (A5) mà 2D không có mặt trước, nên góc 0
    // không phải lựa chọn của ai — để nguyên thì giường đã duyệt quay chân vào tường (đánh giá 02/11).
    if (item.rotationDeg !== 0) return item;
    if (item.kind === 'chair') {
      const target = nearestTarget(item, tables) ?? nearestTarget(item, bars);
      const facing = target === undefined ? intoRoomFromWall(item, walls) : towardTable(item.boundingBox, worldBoxOf(target.boundingBox, target.rotationDeg));
      return facing === null ? item : turned(item, facing);
    }
    if (WALL_HUGGING_KINDS.has(item.kind) || (item.variant !== undefined && WALL_HUGGING_VARIANTS.has(item.variant))) {
      if (item.kind === 'kitchenCabinet') return item;
      const facing = intoRoomFromWall(item, walls, item.kind === 'bed');
      return facing === null ? item : turned(item, facing);
    }
    return item;
  });
};
