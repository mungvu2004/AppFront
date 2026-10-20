/**
 * "Trang phục" của cảnh Pascal: vật liệu sàn, mặt tường, len chân tường và phào trần.
 *
 * Bản đầu để Pascal tự chọn mặc định, và cảnh ra xám trơn — kém hẳn nhà 3D ở trang
 * đăng nhập. File này là quy tắc gán vật liệu theo phòng, theo loại tường, theo khe
 * mô hình; vật liệu cụ thể lấy từ phong cách đang chọn (`sceneStyles.ts`, J8).
 *
 * Tham chiếu vật liệu theo mô hình khe của Pascal (`viewer/src/lib/materials.ts`):
 * `scene:<id>` trỏ vào `PascalScene.materials`, `library:<id>` trỏ vào thư viện dựng
 * sẵn — chỉ dùng những cái có đủ tệp (`.ktx2` của repo hoặc `.webp` tự dựng, J2).
 */

import type { Room, RoomFinish, RoomUsage, Wall } from '@/domain/spatial/types';
import { millimetres, millimetresToMetres } from '@/domain/units/types';

import { CATALOG_MODELS, modelSrcOf, thumbnailOf } from './furnitureCatalog';
import { bodyOfPascalId, toPascalId } from './ids';
import { SCENE_PALETTE } from './scenePalette';
import { sceneStyleOf, type SceneStyle, type SlotFamily } from './sceneStyles';
import type {
  PascalCeilingNode,
  PascalItemNode,
  PascalNodeId,
  PascalPoint2,
  PascalSceneMaterial,
  PascalVec3,
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

/**
 * Vật liệu phẳng không theo phong cách, đúng hình `SceneMaterial`
 * (`core/src/schema/scene-material.ts`). Sàn/tường/đồ gỗ nay lấy từ phong cách.
 */
export const SCENE_MATERIALS: readonly PascalSceneMaterial[] = [
  flat('mat_appfront_plaster', 'Trần vữa', SCENE_PALETTE.plaster, 0.9),
  flat('mat_appfront_bark', 'Thân cây', SCENE_PALETTE.bark, 0.9),
];

const GLASS = 'library:preset-glass';
const PLASTER = 'scene:mat_appfront_plaster';
const BARK = 'scene:mat_appfront_bark';

/** Phong cách mặc định — tham số mặc định của mọi hàm dưới đây (J8). */
const DEFAULT_STYLE = sceneStyleOf(undefined);

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
export const floorMaterialOf = (room: Pick<Room, 'usage' | 'finish'>, style: SceneStyle = DEFAULT_STYLE): string =>
  style.floor[room.finish ?? USAGE_FINISH[room.usage]];

/** Tường thấp hơn mức này là lan can/vách kính, không phải tường phòng. */
const LOW_WALL_MAX_MM = 1200;

/**
 * Khe mặt tường + len chân + phào. Mọi trường viết đủ: `setScene` không áp mặc định
 * zod (xem `types.ts`). Mặt `exterior` của tường bao/chịu lực theo sơn ngoài của phong
 * cách; vách ngăn sơn trong cả hai mặt. Tường thấp là kính, không len không phào.
 */
export const wallDressingOf = (
  wall: Pick<Wall, 'kind' | 'heightMm'>,
  style: SceneStyle = DEFAULT_STYLE,
): Pick<PascalWallNode, 'slots' | 'skirting' | 'crown'> => {
  if (wall.heightMm <= LOW_WALL_MAX_MM) return { slots: { interior: GLASS, exterior: GLASS } };
  const { interior, exterior } = style.wall;
  return {
    slots: { interior, exterior: wall.kind === 'partition' ? interior : exterior },
    skirting: { enabled: true, sides: 'interior', height: 0.1, proud: 0.015, profile: 'flat' },
    crown: { enabled: true, sides: 'interior', height: 0.05, proud: 0.02, profile: 'flat' },
  };
};

/**
 * Khe `slot_*` của mô hình đồ đạc (tên khe như GLB, `extras.pascal_material`) → họ vật
 * liệu của phong cách. Phủ mọi khe GLB trỏ vào gỗ/gạch (`wood-*`, `flooring-*`) để đồ gỗ
 * đổi theo phong cách, cộng vải/kim loại/tủ/mặt đá/sứ/thảm/chậu cho phong cách khác hẳn.
 * Thân cây (`bark`) không theo phong cách: vân sàn gỗ làm thân cây trông như tấm ván.
 * Chỉ các thư mục `furnitureCatalog.ts` dùng; bài kiểm quét GLB thật để bắt thư mục mới.
 */
const SLOT_FAMILY: Readonly<Record<string, Readonly<Record<string, SlotFamily | 'bark'>>>> = {
  bathtub: { tub: 'ceramic' },
  'bedside-table': { cabinet: 'wood', handle: 'metal' },
  bookshelf: { body: 'wood', shelf: 'wood' },
  // Thân tủ áo vân gỗ: màu sơn tủ phẳng làm tủ cao thành khối be trơn (V5 D2).
  closet: { body: 'wood' },
  'coffee-table': { top: 'wood' },
  'dining-chair': { legs: 'wood', seat: 'fabric', headrest: 'fabric' },
  'dining-table': { top: 'wood' },
  dresser: { body: 'wood', drawers: 'wood', handle: 'metal' },
  'fir-tree': { trunk: 'bark' },
  'indoor-plant': { trunk: 'bark', pot: 'pot' },
  'kitchen-cabinet': { cabinet: 'cabinetry', countertop: 'countertop', handle: 'metal' },
  'kitchen-counter': { cabinet: 'cabinetry', countertop: 'countertop' },
  'kitchen-shelf': { cabinet: 'cabinetry', handle: 'metal' },
  'livingroom-chair': { pillow: 'fabric', cushion: 'fabric' },
  'office-table': { cabinet: 'wood', handle: 'metal' },
  palm: { trunk: 'bark' },
  // Tranh: vải dệt treo tường — sứ/đá phẳng làm tranh thành tấm trắng trơn.
  picture: { picture: 'rug' },
  'rectangular-carpet': { a: 'rug' },
  'round-carpet': { a: 'rug' },
  'single-bed': { frame: 'wood' },
  'small-indoor-plant': { pot: 'pot' },
  sofa: { pillow: 'fabric', cushion: 'fabric' },
  toilet: { toilet: 'ceramic' },
};

/** Khe đè cho mô hình ở `/items/<folder>/` theo phong cách; `undefined` = để nguyên vật liệu của GLB. */
export const itemSlotsOf = (
  folder: string,
  style: SceneStyle = DEFAULT_STYLE,
): Readonly<Record<string, string>> | undefined => {
  const families = SLOT_FAMILY[folder];
  if (families === undefined) return undefined;
  return Object.fromEntries(
    Object.entries(families).map(([slot, family]) => [slot, family === 'bark' ? BARK : style.families[family]]),
  );
};

/** Thân id của đèn trần sinh ra: `item_LIGHT-<id phòng>`. Không phải id AppFront hợp lệ. */
const GENERATED_LIGHT_PREFIX = 'LIGHT-';

/** Node này (còn hay đã xoá) là đèn trần AppFront tự sinh — không bao giờ thành đồ đạc. */
export const isGeneratedLightId = (nodeId: PascalNodeId): boolean =>
  bodyOfPascalId(nodeId).startsWith(GENERATED_LIGHT_PREFIX);

/** Thân id của đồ đạc sinh ra (J10): `item_DRESS-<vai trò>-<id neo>[-<n>]`. */
export const GENERATED_DRESS_PREFIX = 'DRESS-';

/** Node AppFront tự sinh (đèn trần hoặc đồ bày biện) — không bao giờ thành dữ liệu của bản vẽ. */
export const isGeneratedNodeId = (nodeId: PascalNodeId): boolean => {
  const body = bodyOfPascalId(nodeId);
  return body.startsWith(GENERATED_LIGHT_PREFIX) || body.startsWith(GENERATED_DRESS_PREFIX);
};

const metresOf = (valueMm: number): number => millimetresToMetres(millimetres(valueMm));

/**
 * Đèn âm trần: màu và cường độ theo phong cách (`lampColour`/`lampIntensity`; mặc định ấm
 * như `--scene-lamp` của trang đăng nhập, 6 cd). Pascal dựng nó thành đèn điểm
 * (`use-item-light-pool.ts`): mặc định trắng, 2 cd, không giới hạn tầm — trên nền `night`
 * gần như không thấy. 6 cd ở trần 2,4 m cho sàn ≈ 1,1 — ngang đèn chính của chủ đề (1,2),
 * đủ thành vũng sáng mà không cháy; tầm 6 m như đèn trần trang đăng nhập.
 */
export const LIGHT_DISTANCE_M = 6;

/**
 * Thu nhỏ vỏ đèn còn 1% (mức nhỏ nhất bảng thuộc tính Pascal cho): nhìn từ trên xuống, trần
 * không vẽ nên vòng đèn 23 cm hiện thành cung trắng ở mọi phòng (V5 D6). Ẩn (`visible: false`)
 * thì tắt luôn đèn (item-light-system.tsx `isRendered`); còn thu nhỏ thì không đổi gì ánh sáng —
 * vị trí đèn = vị trí thế giới của vật + `offset` không nhân tỉ lệ (glb-interactive.tsx), độ
 * sáng/tầm đặt trên đèn của bể chung, không phải con của vật.
 */
export const LIGHT_NODE_SCALE: PascalVec3 = [0.01, 0.01, 0.01];

/** Bật sẵn đèn: khối `interactive` chép sâu, công tắc `default: true`, ánh sáng theo phong cách. */
const lightInteractiveOf = (interactive: unknown, style: SceneStyle): unknown => {
  const copy = structuredClone(interactive) as {
    controls?: { kind: string; default?: unknown }[];
    effects?: { kind: string; color?: string; intensityRange?: [number, number]; distance?: number }[];
  };

  for (const control of copy.controls ?? []) {
    if (control.kind === 'toggle') control.default = true;
  }

  for (const effect of copy.effects ?? []) {
    if (effect.kind !== 'light') continue;
    effect.color = style.lampColour;
    effect.intensityRange = [0, style.lampIntensity];
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
  style: SceneStyle = DEFAULT_STYLE,
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
      scale: LIGHT_NODE_SCALE,
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
        interactive: lightInteractiveOf(model.interactive, style),
      },
    },
  ];
};
