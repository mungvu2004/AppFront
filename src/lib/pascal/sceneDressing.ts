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
import { SCENE_PALETTE } from './scenePalette';
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
  flat('mat_appfront_wood', 'Sàn gỗ', SCENE_PALETTE.wood, 0.4),
  flat('mat_appfront_tile', 'Gạch men', SCENE_PALETTE.tile, 0.22),
  flat('mat_appfront_mosaic', 'Gạch mosaic', SCENE_PALETTE.mosaic, 0.3),
  flat('mat_appfront_decking', 'Sàn gỗ ngoài trời', SCENE_PALETTE.decking, 0.85),
  flat('mat_appfront_plaster', 'Tường vữa', SCENE_PALETTE.plaster, 0.9),
  flat('mat_appfront_exterior', 'Tường ngoài', SCENE_PALETTE.exterior, 0.9),
  flat('mat_appfront_oak', 'Gỗ sáng', SCENE_PALETTE.oak, 0.5),
  flat('mat_appfront_walnut', 'Gỗ tối', SCENE_PALETTE.walnut, 0.5),
  flat('mat_appfront_bark', 'Thân cây', SCENE_PALETTE.bark, 0.9),
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
  'fir-tree': { trunk: BARK },
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

/**
 * Đèn âm trần ấm như `--scene-lamp` của trang đăng nhập. Pascal dựng nó thành đèn điểm
 * (`use-item-light-pool.ts`): mặc định trắng, 2 cd, không giới hạn tầm — trên nền `night`
 * gần như không thấy. 6 cd ở trần 2,4 m cho sàn ≈ 1,1 — ngang đèn chính của chủ đề (1,2),
 * đủ thành vũng sáng mà không cháy; tầm 6 m như đèn trần trang đăng nhập.
 */
export const LIGHT_COLOR = SCENE_PALETTE.lamp;
export const LIGHT_INTENSITY_MAX = 6;
export const LIGHT_DISTANCE_M = 6;

/** Bật sẵn đèn: khối `interactive` chép sâu, công tắc `default: true`, ánh sáng ấm. */
const lightInteractiveOf = (interactive: unknown): unknown => {
  const copy = structuredClone(interactive) as {
    controls?: { kind: string; default?: unknown }[];
    effects?: { kind: string; color?: string; intensityRange?: [number, number]; distance?: number }[];
  };

  for (const control of copy.controls ?? []) {
    if (control.kind === 'toggle') control.default = true;
  }

  for (const effect of copy.effects ?? []) {
    if (effect.kind !== 'light') continue;
    effect.color = LIGHT_COLOR;
    effect.intensityRange = [0, LIGHT_INTENSITY_MAX];
    effect.distance = LIGHT_DISTANCE_M;
  }

  return copy;
};

/** Các x nơi cạnh đa giác cắt đường ngang `y`, tăng dần (quy tắc nửa mở: đỉnh không đếm hai lần). */
const crossingsAt = (polygon: readonly PascalPoint2[], y: number): number[] =>
  polygon
    .flatMap(([x1, y1], i) => {
      const [x2, y2] = polygon[(i + 1) % polygon.length]!;
      return y1 <= y === y2 <= y ? [] : [x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)];
    })
    .sort((a, b) => a - b);

/**
 * Một điểm chắc chắn nằm trong đa giác: trọng tâm diện tích nếu nó ở trong, không thì
 * giữa đoạn trong dài nhất của đường ngang qua trọng tâm (phòng chữ L/chữ U).
 */
export const interiorPointOf = (polygon: readonly PascalPoint2[]): PascalPoint2 => {
  let area = 0;
  let cx = 0;
  let cy = 0;

  polygon.forEach(([x1, y1], i) => {
    const [x2, y2] = polygon[(i + 1) % polygon.length]!;
    const cross = x1 * y2 - x2 * y1;
    area += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  });

  if (area === 0) return polygon[0]!;
  cx /= 3 * area;
  cy /= 3 * area;

  const xs = crossingsAt(polygon, cy);
  let best: PascalPoint2 = [cx, cy];
  let bestWidth = 0;

  // Chẵn-lẻ: cặp (xs[0], xs[1]), (xs[2], xs[3])… là các đoạn nằm trong đa giác.
  for (let i = 0; i + 1 < xs.length; i += 2) {
    const [left, right] = [xs[i]!, xs[i + 1]!];
    if (cx > left && cx < right) return [cx, cy];
    if (right - left > bestWidth) [best, bestWidth] = [[(left + right) / 2, cy], right - left];
  }

  return best;
};

/**
 * Trần + một đèn âm trần cho mỗi phòng, như nhà mẫu ở trang đăng nhập có trần và đèn ấm.
 * Trần là con của tầng, cao theo đỉnh tầng (không khai `height`); đèn là con của trần,
 * `y = 0` trong khung trần, `x/z` theo toạ độ tầng (`placement-strategies.ts:740-757`).
 * Cả hai sinh ra từ phòng nên lượt về bỏ qua chúng (`toSpatial` chỉ đọc con của tầng,
 * `fromPascal` coi chúng là kết cấu). Phòng sàn `decking` là sân ngoài trời: không trần,
 * không đèn — trần che nắng làm sân tối đen. Chưa khai `finish` thì không biết phòng nào
 * ngoài trời (`RoomUsage` không có ban công) nên phòng nào cũng có trần.
 */
export const ceilingNodesOf = (
  room: Pick<Room, 'id' | 'outline' | 'finish'>,
  levelNodeId: PascalNodeId,
): readonly [PascalCeilingNode, PascalItemNode] | undefined => {
  if (room.finish === 'decking') return undefined;

  const ceilingId = toPascalId('ceiling', room.id);
  const lightId = toPascalId('item', `${GENERATED_LIGHT_PREFIX}${room.id}`);
  const polygon = room.outline.map((point): PascalPoint2 => [metresOf(point.x), metresOf(point.y)]);
  const [lightX, lightZ] = interiorPointOf(polygon);
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
      position: [lightX, 0, lightZ],
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
