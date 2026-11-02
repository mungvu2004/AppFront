/**
 * Cắt thấp cho chế độ "Tường: cắt" (thẻ S1): mọi thứ trên một tầng (tường, kể cả vách giữa hai
 * phòng, cửa, cửa sổ, đồ cao, trần) bị cắt ở 1,0 m trên sàn tầng để nhìn từ trên xuống thấy phòng.
 * Mặt cắt của khối tường kín (mặt sau + mặt hướng lên lộ trong lòng tường) → tô phẳng màu nắp sáng.
 * Logic thuần, phần chạy ở `cutSync.ts`.
 */
import { SCENE_PALETTE } from '@/lib/pascal/scenePalette';

/** Độ cao mặt cắt tính từ sàn tầng (m). */
export const CUT_HEIGHT_M = 1.0;
/** Màu nắp cắt tối của bản xem nướng sáng (`bakedPreview`). */
export const CUT_FACE_COLOR = SCENE_PALETTE.cutFace;
/** Màu nắp cắt của cảnh thường: phẳng, sáng (như poché trắng của bản vẽ), không nhận bóng. */
export const CUT_CAP_COLOR = SCENE_PALETTE.cutCap;
/** Chế độ tường dùng cắt thấp (nhãn "Tường: cắt" trên thanh công cụ). */
export const CUT_WALL_MODE = 'cutaway';
/** Tên lưới gộp tường của vendor (`wall-batch-system.tsx`). */
export const WALL_BATCH_MESH_NAME = 'wall-batch';

export function lowCutActive(wallMode: string): boolean {
  return wallMode === CUT_WALL_MODE;
}

/** Độ cao thế giới của mặt cắt cho một tầng có sàn ở `levelWorldY`. */
export function cutPlaneY(levelWorldY: number): number {
  return levelWorldY + CUT_HEIGHT_M;
}

/**
 * Lưới nào cần tô mặt sau gần đen: tường lẻ (id nằm trong tập tường) hoặc lưới gộp tường.
 * Cửa, cửa sổ, đồ, trần vẫn bị cắt (theo nhóm tầng) nhưng giữ vật liệu gốc.
 */
export function isCutFaceMesh(id: string | undefined, name: string, wallIds: ReadonlySet<string>): boolean {
  return name === WALL_BATCH_MESH_NAME || (id !== undefined && wallIds.has(id));
}
