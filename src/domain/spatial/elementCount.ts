/**
 * Đếm "đối tượng" bản vẽ — MỘT định nghĩa cho mọi màn (R-1, S-3, S-3b).
 *
 * Đối tượng = tường + ô mở + đồ đạc + phòng. Tầng, trục và kích thước là khung
 * tham chiếu, không phải thứ AI nhận dạng ra, nên không tính.
 */

import type { EntityKind } from './ids';
import type { NormalizedSpatial } from './normalize';

/** Các loại được gọi là "đối tượng" trên màn hình. */
export const ELEMENT_KINDS = ['wall', 'opening', 'furniture', 'room'] as const satisfies readonly EntityKind[];

/** Số đối tượng của cả toà nhà; `null` (chưa có mô hình) là 0. */
export const countElements = (graph: NormalizedSpatial | null): number => {
  if (graph === null) return 0;
  const { byKind } = graph;
  return ELEMENT_KINDS.reduce((sum, kind) => sum + byKind[kind].length, 0);
};

/** Dự án chưa có gì để kiểm: không được báo "Đạt" hay "sẵn sàng xuất" (S-3, S-3b). */
export const hasElements = (graph: NormalizedSpatial | null): boolean => countElements(graph) > 0;
