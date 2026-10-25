import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import type { LevelId } from '@/domain/spatial/types';
import { entitiesOfKind } from '@/lib/commands/business/shared';

/**
 * Ba điều kiện của cổng "Kiểm tra tầng" (Tường · Cửa · Phòng) đọc từ CÙNG đồ thị mà
 * các màn duyệt lớp ghi cờ `reviewed` (NGUYEN-TAC-BO-CUC §1: một nguồn trạng thái).
 * Lớp trống: tường/phòng chưa xong (chưa có gì để sang bước sau), cửa xong (tầng có thể không có cửa).
 */
export interface LayerGate {
  readonly walls: boolean;
  readonly objects: boolean;
  readonly rooms: boolean;
}

const allReviewed = (items: readonly { readonly reviewed: boolean }[]): boolean => items.every((item) => item.reviewed);

export function layerGateOf(graph: NormalizedSpatial | null, levelId: LevelId | null): LayerGate {
  if (graph === null || levelId === null) {
    return { walls: false, objects: false, rooms: false };
  }

  const walls = entitiesOfKind(graph, 'wall').filter((wall) => wall.levelId === levelId);
  const wallIds = new Set<string>(walls.map((wall) => wall.id));
  const openings = entitiesOfKind(graph, 'opening').filter((opening) => wallIds.has(opening.wallId));
  const furniture = entitiesOfKind(graph, 'furniture').filter((item) => item.levelId === levelId);
  const rooms = entitiesOfKind(graph, 'room').filter((room) => room.levelId === levelId);

  return {
    walls: walls.length > 0 && allReviewed(walls),
    objects: allReviewed(openings) && allReviewed(furniture),
    rooms: rooms.length > 0 && allReviewed(rooms),
  };
}
