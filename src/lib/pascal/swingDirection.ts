/**
 * Luật phía mở của cánh cửa bản lề (V5 D7), tách khỏi `toPascal.ts` để màn duyệt 2D dùng chung
 * mà không kéo cả bộ chuyển cảnh 3D vào gói của màn.
 */
import type { Opening, Point, Room, Wall } from '@/domain/spatial/types';

/** Điểm nằm trong đa giác (tia ngang, chẵn-lẻ). */
export const insideOutline = (p: Point, outline: readonly Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i]!;
    const b = outline[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};

/** Khoảng dò hai bên mặt tường để tìm phòng, mm. */
const SWING_PROBE_MM = 300;

/**
 * Cánh cửa mở về phía nào của tường, theo luật (V5 D7):
 * - cửa trên tường bao (một bên là phòng, bên kia là ngoài nhà) mở VÀO nhà;
 * - cửa trong mở vào phòng nó phục vụ: phòng không phải hành lang; nếu cả hai
 *   (hoặc không bên nào) là hành lang → phòng nhỏ hơn.
 * Pascal: `inward` = cánh quét sang +z cục bộ của tường (`door-system.tsx:2372,2650`),
 * tường quay −atan2(cuối − đầu) nên +z cục bộ là pháp tuyến TRÁI của trục
 * (−dy, dx) trên mặt bằng. Không phòng nào cả hai bên → giữ `inward`.
 */
export const swingDirectionOf = (opening: Opening, wall: Wall | undefined, rooms: readonly Room[]): 'inward' | 'outward' => {
  if (wall === undefined) return 'inward';
  const { start, end } = wall.centreline;
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (!(length > 0)) return 'inward';
  const dir = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
  const along = opening.offsetMm + opening.widthMm / 2;
  const reach = wall.thicknessMm / 2 + SWING_PROBE_MM;
  const roomAt = (sign: number): Room | undefined => {
    const p = { x: start.x + dir.x * along - dir.y * reach * sign, y: start.y + dir.y * along + dir.x * reach * sign };
    // Sàn decking = sân/hiên ngoài trời → coi như ngoài nhà, cửa mở vào phòng trong.
    return rooms.find((r) => r.levelId === wall.levelId && r.finish !== 'decking' && insideOutline(p, r.outline));
  };
  const left = roomAt(1);
  const right = roomAt(-1);
  if (left === undefined || right === undefined) return right !== undefined ? 'outward' : 'inward';
  const corridor = (r: Room): boolean => r.usage === 'corridor';
  if (corridor(left) !== corridor(right)) return corridor(left) ? 'outward' : 'inward';
  return right.areaM2 < left.areaM2 ? 'outward' : 'inward';
};
