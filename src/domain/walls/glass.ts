/**
 * Tường kính: kính là VẬT LIỆU của tường, không phải loại (`Wall.kind`). Người dùng chọn ở màn Duyệt
 * tường; lưu ở `Wall.paint` như mọi lần sơn tường nên hợp đồng dữ liệu không đổi.
 */

import type { MaterialRef, Wall, WallPaint } from '@/domain/spatial/types';

export const GLASS_MATERIAL_REF: MaterialRef = 'library:preset-glass';

export const GLASS_WALL_PAINT: WallPaint = { interior: GLASS_MATERIAL_REF, exterior: GLASS_MATERIAL_REF };

/** Cả hai mặt là kính. Sơn kính một mặt trong trình dựng 3D vẫn là tường thường. */
export const isGlassWall = (wall: Pick<Wall, 'paint'>): boolean =>
  wall.paint?.interior === GLASS_MATERIAL_REF && wall.paint.exterior === GLASS_MATERIAL_REF;
