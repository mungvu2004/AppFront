/**
 * "Trang phục" của cảnh Pascal: vật liệu sàn, mặt tường, len chân tường và phào trần.
 *
 * Bản đầu để Pascal tự chọn mặc định, và cảnh ra xám trơn — kém hẳn nhà 3D ở trang
 * đăng nhập. File này khai một bộ vật liệu **màu phẳng, không texture** (không có
 * tệp `.ktx2` nào để thiếu) và quy tắc gán chúng theo phòng, theo loại tường.
 *
 * Tham chiếu vật liệu theo mô hình khe của Pascal (`viewer/src/lib/materials.ts`):
 * `scene:<id>` trỏ vào `PascalScene.materials`, `library:<id>` trỏ vào thư viện dựng
 * sẵn — chỉ dùng những cái repo Pascal có đủ tệp (`concrete-polished`, `preset-glass`).
 */

import type { Room, RoomFinish, RoomUsage, Wall } from '@/domain/spatial/types';

import type { PascalSceneMaterial, PascalWallNode } from './types';

const flat = (id: PascalSceneMaterial['id'], name: string, color: string, roughness: number): PascalSceneMaterial => ({
  id,
  name,
  material: {
    preset: 'custom',
    properties: { color, roughness, metalness: 0, opacity: 1, transparent: false, side: 'front' },
  },
});

/** Bộ vật liệu của AppFront, đúng hình `SceneMaterial` (`core/src/schema/scene-material.ts`). */
export const SCENE_MATERIALS: readonly PascalSceneMaterial[] = [
  flat('mat_appfront_wood', 'Sàn gỗ', '#b9874d', 0.4),
  flat('mat_appfront_tile', 'Gạch men', '#e9e5dd', 0.22),
  flat('mat_appfront_mosaic', 'Gạch mosaic', '#6f7377', 0.3),
  flat('mat_appfront_decking', 'Sàn gỗ ngoài trời', '#6a4a2d', 0.85),
  flat('mat_appfront_plaster', 'Tường vữa', '#ffffff', 0.9),
  flat('mat_appfront_exterior', 'Tường ngoài', '#8c8a86', 0.9),
];

const CONCRETE = 'library:concrete-polished';
const GLASS = 'library:preset-glass';
const PLASTER = 'scene:mat_appfront_plaster';
const EXTERIOR = 'scene:mat_appfront_exterior';

const FINISH_MATERIAL: Readonly<Record<RoomFinish, string>> = {
  wood: 'scene:mat_appfront_wood',
  tile: 'scene:mat_appfront_tile',
  mosaic: 'scene:mat_appfront_mosaic',
  decking: 'scene:mat_appfront_decking',
  concrete: CONCRETE,
};

/** Phòng chưa khai `finish`: đoán theo công năng, như nhà mẫu ở trang đăng nhập. */
const USAGE_FINISH: Readonly<Record<RoomUsage, RoomFinish>> = {
  livingRoom: 'wood',
  bedroom: 'wood',
  corridor: 'wood',
  other: 'wood',
  kitchen: 'tile',
  utility: 'tile',
  bathroom: 'mosaic',
  stairwell: 'concrete',
};

/** Tham chiếu vật liệu mặt sàn của một phòng: `finish` trước, công năng sau. */
export const floorMaterialOf = (room: Pick<Room, 'usage' | 'finish'>): string =>
  FINISH_MATERIAL[room.finish ?? USAGE_FINISH[room.usage]];

/** Tường thấp hơn mức này là lan can/vách kính, không phải tường phòng. */
const LOW_WALL_MAX_MM = 1200;

/**
 * Khe mặt tường + len chân + phào. Mọi trường viết đủ: `setScene` không áp mặc định
 * zod (xem `types.ts`). Mặt `exterior` của tường bao/chịu lực xám như mặt ngoài nhà mẫu;
 * vách ngăn trắng cả hai mặt. Tường thấp là kính, không len không phào.
 */
export const wallDressingOf = (
  wall: Pick<Wall, 'kind' | 'heightMm'>,
): Pick<PascalWallNode, 'slots' | 'skirting' | 'crown'> => {
  if (wall.heightMm <= LOW_WALL_MAX_MM) return { slots: { interior: GLASS, exterior: GLASS } };
  return {
    slots: { interior: PLASTER, exterior: wall.kind === 'partition' ? PLASTER : EXTERIOR },
    skirting: { enabled: true, sides: 'interior', height: 0.1, proud: 0.015, profile: 'flat' },
    crown: { enabled: true, sides: 'interior', height: 0.05, proud: 0.02, profile: 'flat' },
  };
};
