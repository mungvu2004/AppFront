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
import { millimetres, millimetresToMetres } from '@/domain/units/types';

import { CATALOG_MODELS, modelSrcOf, thumbnailOf } from './furnitureCatalog';
import { bodyOfPascalId, toPascalId } from './ids';
import type {
  PascalCeilingNode,
  PascalItemNode,
  PascalNodeId,
  PascalPoint2,
  PascalSceneMaterial,
  PascalWallNode,
} from './types';

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
  // Màu trung bình ảnh vân của ba loại gỗ Pascal (`core/src/procedural-items/library-colors.ts`).
  flat('mat_appfront_oak', 'Gỗ sáng', '#a77440', 0.5),
  flat('mat_appfront_walnut', 'Gỗ tối', '#663020', 0.5),
  flat('mat_appfront_bark', 'Thân cây', '#88654c', 0.9),
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

const OAK = 'scene:mat_appfront_oak';
const WALNUT = 'scene:mat_appfront_walnut';
const BARK = 'scene:mat_appfront_bark';

/**
 * Khe `slot_*` của mô hình đồ đạc mà GLB trỏ (`extras.pascal_material`) vào vật liệu
 * gỗ/gạch có vân — repo Pascal không commit `.ktx2` của chúng (`copy-pascal-assets.mjs`
 * in số thiếu), tự host là 404 im lặng và mặt ra không vân. Đè bằng màu phẳng.
 * Chỉ các thư mục `furnitureCatalog.ts` dùng; bài kiểm quét GLB thật để bắt thư mục mới.
 */
const ITEM_SLOTS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'bedside-table': { cabinet: WALNUT },
  bookshelf: { body: OAK, shelf: OAK },
  'coffee-table': { top: OAK },
  'dining-chair': { legs: OAK },
  'dining-table': { top: OAK },
  dresser: { body: WALNUT, drawers: WALNUT },
  'indoor-plant': { trunk: BARK },
  'office-table': { cabinet: WALNUT },
  palm: { trunk: BARK },
  picture: { picture: 'scene:mat_appfront_mosaic' },
  'single-bed': { frame: OAK },
};

/** Khe đè cho mô hình ở `/items/<folder>/`; `undefined` = để nguyên vật liệu của GLB. */
export const itemSlotsOf = (folder: string): Readonly<Record<string, string>> | undefined => ITEM_SLOTS[folder];

/** Thân id của đèn trần sinh ra: `item_LIGHT-<id phòng>`. Không phải id AppFront hợp lệ. */
const GENERATED_LIGHT_PREFIX = 'LIGHT-';

/** Node này (còn hay đã xoá) là đèn trần AppFront tự sinh — không bao giờ thành đồ đạc. */
export const isGeneratedLightId = (nodeId: PascalNodeId): boolean =>
  bodyOfPascalId(nodeId).startsWith(GENERATED_LIGHT_PREFIX);

const metresOf = (valueMm: number): number => millimetresToMetres(millimetres(valueMm));

/** Bật sẵn đèn: khối `interactive` chép sâu, công tắc `default: true`. */
const lightInteractiveOf = (interactive: unknown): unknown => {
  const copy = structuredClone(interactive) as { controls?: { kind: string; default?: unknown }[] };

  for (const control of copy.controls ?? []) {
    if (control.kind === 'toggle') control.default = true;
  }

  return copy;
};

/**
 * Trần + một đèn âm trần cho mỗi phòng, như nhà mẫu ở trang đăng nhập có trần và đèn ấm.
 * Trần là con của tầng, cao theo đỉnh tầng (không khai `height`); đèn là con của trần,
 * `y = 0` trong khung trần, `x/z` theo toạ độ tầng (`placement-strategies.ts:740-757`).
 * Cả hai sinh ra từ phòng nên lượt về bỏ qua chúng (`toSpatial` chỉ đọc con của tầng,
 * `fromPascal` coi chúng là kết cấu). Chưa có công năng ban công nên phòng nào cũng có đèn.
 */
export const ceilingNodesOf = (
  room: Pick<Room, 'id' | 'outline'>,
  levelNodeId: PascalNodeId,
): readonly [PascalCeilingNode, PascalItemNode] => {
  const ceilingId = toPascalId('ceiling', room.id);
  const lightId = toPascalId('item', `${GENERATED_LIGHT_PREFIX}${room.id}`);
  const polygon = room.outline.map((point): PascalPoint2 => [metresOf(point.x), metresOf(point.y)]);
  // ponytail: trung bình đỉnh, không phải trọng tâm diện tích — phòng chữ L đèn lệch chút.
  const centre = (axis: 0 | 1): number => polygon.reduce((sum, point) => sum + point[axis], 0) / polygon.length;
  const model = CATALOG_MODELS['recessed-light'];

  if (model === undefined) throw new Error('bảng mô hình thiếu recessed-light');

  return [
    {
      object: 'node',
      id: ceilingId,
      type: 'ceiling',
      parentId: levelNodeId,
      children: [lightId],
      polygon,
      holes: [],
      holeMetadata: [],
      autoFromWalls: false,
      slots: { surface: PLASTER },
    },
    {
      object: 'node',
      id: lightId,
      type: 'item',
      parentId: ceilingId,
      metadata: { generated: 'light' },
      position: [centre(0), 0, centre(1)],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      asset: {
        id: model.folder,
        category: 'lighting',
        name: 'Đèn âm trần',
        thumbnail: thumbnailOf(model.folder),
        src: modelSrcOf(model.folder),
        dimensions: model.dimensions,
        offset: model.offset,
        rotation: model.rotation,
        scale: [1, 1, 1],
        attachTo: 'ceiling',
        recessed: true,
        interactive: lightInteractiveOf(model.interactive),
      },
    },
  ];
};
