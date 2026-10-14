import type { NormalizedSpatial } from '@/domain/spatial/normalize';

/**
 * Tầng của tấm trượt: tầng đang mở ở vỏ, rồi tầng của vi phạm, rồi tầng đầu tiên của
 * mô hình (28-A-021: hàng toàn nhà không tầng, vỏ chưa mở tầng — vẫn phải mở tấm).
 * Chỉ khi mô hình không có tầng nào mới là `null` (không mở).
 */
export function sheetFloorId(
  activeFloorId: string | null,
  rowLevelId: string | null,
  graph: NormalizedSpatial | null,
): string | null {
  return activeFloorId ?? rowLevelId ?? graph?.byKind.level[0] ?? null;
}
