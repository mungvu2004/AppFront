/**
 * AppFront → Pascal: đồ thị không gian thành cảnh `{ nodes, rootNodeIds }`.
 *
 * Chuyển **sáu** loại đối tượng — tầng, tường, cửa đi, cửa sổ, phòng, đồ đạc —
 * thành **bảy** loại node, cộng hai node tổng hợp là khu đất và công trình. Một
 * phòng ra hai node: `zone` là khối không gian, `slab` là mặt sàn thật nhìn
 * thấy được. Trục định vị, kích thước và ghi chú **không** có loại node tương
 * ứng bên Pascal, nên chúng vào danh sách bỏ qua kèm lý do đọc được, chứ không
 * biến mất im lặng.
 *
 * ## Ba luật của file này
 *
 * 1. **Không đối tượng nào rơi không dấu vết.** Mọi thứ không sang được đều có
 *    một dòng trong `skipped`. Phép đếm `skipped.length + số node đã viết` phải
 *    khớp với số đối tượng vào — đó là điều bài kiểm đối chiếu.
 * 2. **Không ném lỗi.** Dữ liệu hỏng (toạ độ vô hạn, tầng không tồn tại) là
 *    chuyện thường của một bản vẽ đang dò dở, nên nó thành một dòng bỏ qua.
 *    Các hàm đơn vị của `domain/units` ném `RangeError` trên số không hữu hạn,
 *    nên mọi giá trị đều qua `isUsable` **trước** khi đổi đơn vị.
 * 3. **Mọi quy đổi đơn vị đi qua `domain/units`** (R-44). Không có `/ 1000` nào
 *    viết tay trong file này.
 */

import { describeUsage } from '@/domain/rooms/classify';
import type {
  Axis,
  Building,
  Furniture,
  FurnitureKind,
  Level,
  Opening,
  Room,
  RoomUsage,
  SpatialGraph,
  Wall,
} from '@/domain/spatial/types';
import { degrees, degreesToRadians, millimetres, millimetresToMetres } from '@/domain/units/types';
import { FURNITURE_KIND_LABELS, WALL_KIND_LABELS } from '@/lib/commands/business/shared';

import { CATALOG_MODELS, VARIANT_MODEL, modelSrcOf, thumbnailOf } from './furnitureCatalog';
import { BUILDING_NODE_ID, SITE_NODE_ID, toPascalId } from './ids';
import { ceilingNodesOf, floorMaterialOf, itemSlotsOf, SCENE_MATERIALS, wallDressingOf } from './sceneDressing';
import type {
  AppFrontOrigin,
  PascalDoorNode,
  PascalItemNode,
  PascalLevelNode,
  PascalNode,
  PascalNodeId,
  PascalPoint2,
  PascalSiteNode,
  PascalSlabNode,
  PascalStructuralGridNode,
  PascalVec3,
  PascalWallNode,
  PascalWindowNode,
  PascalZoneNode,
  SkippedEntity,
  PascalSceneResult,
} from './types';

/** Số điểm tối thiểu để một đường bao là một đa giác. */
const MIN_OUTLINE_POINTS = 3;

/**
 * Khoảng lùi từ mép công trình ra mép khu đất, mét. 1 m để ngôi nhà lấp khung hình như
 * nhà 3D ở trang đăng nhập; khu đất vẫn bao trọn mọi hình học.
 */
const SITE_MARGIN_M = 1;

/** Nửa cạnh khu đất khi bản vẽ chưa có hình học nào, mét — bằng mặc định của lược đồ Pascal. */
const SITE_FALLBACK_HALF_SIZE_M = 15;

/**
 * Chiều cao DANH NGHĨA của từng loại đồ đạc, milimét.
 *
 * `Furniture` của AppFront chỉ lưu hộp bao mặt bằng, không lưu chiều cao. Bản
 * đầu vì thế đặt chiều cao 0 — và 0 không phải "chưa biết", nó là một hộp dày
 * 0 mm: `PreviewModel` (`nodes/item/renderer.tsx:521`) dựng
 * `boxGeometry [w, h, d]` nên đồ đạc ra một tờ giấy không nhìn thấy.
 *
 * Bảng này là **số danh nghĩa, không phải số đo**, và nó không bao giờ đi
 * ngược về đồ thị: lượt về dựng lại hộp bao từ `metadata.appfront.boundingBox`
 * và `boxAround` chỉ đọc `dimensions[0]` với `dimensions[2]`
 * (`toSpatial.ts:294-302`), nên chiều cao bịa ở đây không thể nhiễm vào dữ
 * liệu người dùng.
 *
 * `stair` không có trong bảng: một thang chiếm trọn chiều cao tầng, và chiều
 * cao tầng thì đồ thị CÓ lưu — nên nó lấy số thật thay vì số danh nghĩa.
 */
// ponytail: chiều cao danh nghĩa theo loại. Ngày nào `Furniture` có `heightMm`
// thì bảng này biến mất và `heightOfFurniture` đọc thẳng trường ấy.
const FURNITURE_HEIGHT_MM: Readonly<Record<Exclude<FurnitureKind, 'stair'>, number>> = {
  table: 750,
  chair: 850,
  bed: 500,
  wardrobe: 2000,
  kitchenCabinet: 850,
  sanitaryFixture: 800,
  other: 800,
};

/** Bề dày tấm sàn, mét — mặc định của chính lược đồ Pascal. */
const SLAB_THICKNESS_M = 0.05;

/** Một độ dài hữu hạn — điều kiện để được đổi sang mét mà không ném lỗi. */
const isUsable = (...values: readonly number[]): boolean => values.every(Number.isFinite);

/** Milimét sang mét, qua đúng cửa của `domain/units`. */
const metresOf = (valueMm: number): number => millimetresToMetres(millimetres(valueMm));

/**
 * Góc mặt bằng của AppFront thành góc quanh trục `y` của Pascal.
 *
 * Đảo dấu: Pascal dựng tường bằng `setFromAxisAngle(yAxis, -atan2(dz, dx))`,
 * nên một góc mặt bằng θ ngược chiều kim đồng hồ là `-θ` trong hệ của nó.
 */
const yawOf = (valueDeg: number): number => -degreesToRadians(degrees(valueDeg));

/** Siêu dữ liệu gốc của một đối tượng, phần mọi loại đều có. */
const originOf = (
  entity: { confidence: number; source: Building['source']; reviewed: boolean },
  fields?: Readonly<Record<string, unknown>>,
): AppFrontOrigin => ({
  confidence: entity.confidence,
  source: entity.source,
  reviewed: entity.reviewed,
  ...(fields === undefined ? {} : { fields }),
});

const skip = (id: string, kind: string, reason: string): SkippedEntity => ({ id, kind, reason });

/* -------------------------------------------------------------------------- */
/* Tầng.                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Phần cộng thêm để tầng rơi đúng cao độ AppFront lưu.
 *
 * Pascal **không** lưu cao độ tuyệt đối. Nó xếp chồng theo số thứ tự tăng dần:
 * `baseY = (cao độ đáy của tầng dưới + chiều cao tầng dưới) + baseElevation`
 * (`services/storey.js:62-70`). Muốn `baseY` ra đúng `elevationMm` thì phần
 * cộng thêm phải là **hiệu** giữa cao độ muốn có và đỉnh của tầng ngay dưới —
 * tầng thấp nhất lấy nguyên cao độ của chính nó vì dưới nó không có gì.
 *
 * Viết cách khác cũng được, nhưng phải viết: bỏ trống `baseElevation` là ngầm
 * tuyên bố các tầng khít nhau, và một công trình có tum hay tầng lửng sẽ trôi.
 */
const baseElevationsOf = (ordered: readonly Level[]): readonly number[] => {
  const offsets: number[] = [];
  let topOfLevelBelow = 0;

  for (const level of ordered) {
    const elevation = metresOf(level.elevationMm);

    offsets.push(elevation - topOfLevelBelow);
    topOfLevelBelow = elevation + metresOf(level.heightMm);
  }

  return offsets;
};

const levelNodeOf = (
  level: Level,
  baseElevation: number,
  children: readonly PascalNodeId[],
): PascalLevelNode => ({
  object: 'node',
  id: toPascalId('level', level.id),
  type: 'level',
  name: level.name,
  parentId: BUILDING_NODE_ID,
  children,
  level: level.order,
  baseElevation,
  height: metresOf(level.heightMm),
  // Không chép `order` và `elevationMm` vào đây: `level` và `baseElevation`
  // của chính node đã mang đủ hai thứ ấy, và lượt về tính lại bằng đúng luật
  // xếp chồng của Pascal. Chép thêm một bản là dựng hai nguồn sự thật có thể
  // cãi nhau — cùng lý do `AppFrontOrigin` không có trường `id`.
  metadata: {
    appfront: originOf(level, {
      ...(level.areaM2 === undefined ? {} : { areaM2: level.areaM2 }),
      ...(level.scaleMillimetresPerPixel === undefined
        ? {}
        : { scaleMillimetresPerPixel: level.scaleMillimetresPerPixel }),
    }),
  },
});

/* -------------------------------------------------------------------------- */
/* Tường và ô mở.                                                              */
/* -------------------------------------------------------------------------- */

/** Tên node tường trên cây Pascal — thiếu `name` thì Pascal tự điền "Wall" (A6). */
// Mã tường là khoá nội bộ (vd. W-000101FIXTURE0), không hiển thị: tên là loại + số thứ tự trong tầng.
const wallNodeNameOf = (wall: Wall, ordinal: number): string => {
  const kindLabel = WALL_KIND_LABELS[wall.kind];
  return `${kindLabel.charAt(0).toUpperCase()}${kindLabel.slice(1)} ${ordinal}`;
};

const wallNodeOf = (
  wall: Wall,
  ordinal: number,
  levelNodeId: PascalNodeId,
  children: readonly PascalNodeId[],
): PascalWallNode => ({
  object: 'node',
  id: toPascalId('wall', wall.id),
  type: 'wall',
  name: wallNodeNameOf(wall, ordinal),
  parentId: levelNodeId,
  children,
  start: [metresOf(wall.centreline.start.x), metresOf(wall.centreline.start.y)],
  end: [metresOf(wall.centreline.end.x), metresOf(wall.centreline.end.y)],
  thickness: metresOf(wall.thicknessMm),
  height: metresOf(wall.heightMm),
  ...wallDressingOf(wall),
  metadata: { appfront: originOf(wall, { kind: wall.kind }) },
});

/**
 * Vị trí ô mở trong hệ toạ độ của tường.
 *
 * AppFront đo mép **trái** và mép **dưới**; Pascal đọc **tâm** ở cả hai trục.
 * Một nửa kích thước là toàn bộ chỗ khác nhau, và nó chỉ được cộng ở đây.
 */
const openingPositionOf = (opening: Opening): PascalVec3 => [
  metresOf(opening.offsetMm + opening.widthMm / 2),
  metresOf(opening.sillHeightMm + opening.heightMm / 2),
  0,
];

/** Góc hé cánh bản lề (~70°) để cửa đọc ra là cửa, không phải mảng tường. */
const DOOR_SWING_ANGLE = 1.22;

/**
 * Cách mở cánh của AppFront, diễn sang các trường rời của Pascal. Mọi trường
 * khai đích danh vì `setScene` không áp mặc định của lược đồ. Cửa bản lề hé
 * bằng `swingAngle`; `operationState` chỉ cửa trượt đọc (R1-5c). Swing
 * `'fixed'` trên cửa đi là ô trống bộ chuyển đổi để lại → `openingKind:'opening'`.
 */
const doorLeafOf = (
  opening: Opening,
): Pick<
  PascalDoorNode,
  'doorType' | 'hingesSide' | 'leafCount' | 'openingKind' | 'swingAngle' | 'swingDirection' | 'operationState'
> => {
  const hinged = {
    doorType: 'hinged',
    leafCount: 1,
    hingesSide: 'left',
    openingKind: 'door',
    swingAngle: DOOR_SWING_ANGLE,
    swingDirection: 'inward',
    operationState: 0,
  } as const;
  switch (opening.swing) {
    case 'double':
      return { ...hinged, leafCount: 2 };
    case 'sliding':
      return { ...hinged, doorType: 'sliding', swingAngle: 0, operationState: 0.5 };
    case 'right':
      return { ...hinged, hingesSide: 'right' };
    case 'fixed':
      return { ...hinged, openingKind: 'opening', swingAngle: 0 };
    default:
      return hinged;
  }
};

/** Cách mở cánh cửa sổ: trượt, cánh đơn theo bên bản lề, hai cánh kiểu Pháp, hoặc kính cố định. */
const windowStyleOf = (
  opening: Opening,
): Pick<PascalWindowNode, 'openingKind' | 'windowType' | 'casementStyle' | 'hingesSide'> => {
  const fixed = { openingKind: 'window', windowType: 'fixed', casementStyle: 'single', hingesSide: 'left' } as const;
  switch (opening.swing) {
    case 'sliding':
      return { ...fixed, windowType: 'sliding' };
    case 'left':
    case 'right':
      return { ...fixed, windowType: 'casement', hingesSide: opening.swing };
    case 'double':
      return { ...fixed, windowType: 'casement', casementStyle: 'french' };
    default:
      return fixed;
  }
};

const openingNodeOf = (
  opening: Opening,
  wallNodeId: PascalNodeId,
): PascalDoorNode | PascalWindowNode => {
  const shared = {
    object: 'node',
    id: toPascalId(opening.kind, opening.id),
    parentId: wallNodeId,
    wallId: wallNodeId,
    position: openingPositionOf(opening),
    rotation: [0, 0, 0],
    width: metresOf(opening.widthMm),
    height: metresOf(opening.heightMm),
    metadata: { appfront: originOf(opening, { swing: opening.swing }) },
  } as const;

  return opening.kind === 'door'
    ? { ...shared, type: 'door', ...doorLeafOf(opening) }
    : { ...shared, type: 'window', ...windowStyleOf(opening) };
};

/* -------------------------------------------------------------------------- */
/* Phòng và đồ đạc.                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Tấm sàn của một phòng, dựng từ đúng đường bao mà `zone` dùng.
 *
 * Hai node cho một phòng không phải trùng lặp: `zone` là khối không gian —
 * Pascal đọc nó để đếm phòng, gán công năng, tính thể tích — còn `slab` là vật
 * thể có mặt để nhìn và để đặt đồ lên. Bỏ `slab` thì bản vẽ có phòng mà không
 * có nền.
 */
const slabNodeOf = (room: Room, levelNodeId: PascalNodeId): PascalSlabNode => ({
  object: 'node',
  id: toPascalId('slab', room.id),
  type: 'slab',
  parentId: levelNodeId,
  polygon: room.outline.map((point): PascalPoint2 => [metresOf(point.x), metresOf(point.y)]),
  holes: [],
  holeMetadata: [],
  elevation: 0,
  thickness: SLAB_THICKNESS_M,
  recessed: false,
  autoFromWalls: false,
  // Khai đích danh — xem `PascalSlabNode.slots`; quy tắc chọn ở `sceneDressing.ts`.
  slots: { surface: floorMaterialOf(room) },
  metadata: {
    appfront: originOf(room, { usage: room.usage }),
  },
});

/**
 * Phòng thành `zone`. `occupancy`/`ceilingHeight` phải ghi tay: vắng thì lược đồ
 * Pascal điền `''`/2,7 m, và bảng "Diện tích phòng" gom mọi phòng vào "Chưa đặt
 * công năng" với chiều cao sai (23R-A-014/020). `Room` không có số phòng nên
 * `roomNumber` để mặc định.
 */
const zoneNodeOf = (room: Room, levelNodeId: PascalNodeId, levelHeightMm: number): PascalZoneNode => ({
  object: 'node',
  id: toPascalId('zone', room.id),
  type: 'zone',
  name: room.name,
  parentId: levelNodeId,
  polygon: room.outline.map((point): PascalPoint2 => [metresOf(point.x), metresOf(point.y)]),
  spaceRole: 'room',
  boundaryWallIds: room.wallIds.map((wallId) => toPascalId('wall', wallId)),
  occupancy: describeUsage(room.usage),
  ceilingHeight: metresOf(levelHeightMm),
  metadata: {
    appfront: originOf(room, { usage: room.usage, areaM2: room.areaM2 }),
  },
});

/** Độ dài tối đa của nhãn trục trong lược đồ Pascal (`structural-grid.ts`). */
const GRID_LABEL_MAX = 12;

const gridNodeOf = (axis: Axis, levelNodeId: PascalNodeId): PascalStructuralGridNode => ({
  object: 'node',
  id: toPascalId('structural-grid', axis.id),
  type: 'structural-grid',
  parentId: levelNodeId,
  start: [metresOf(axis.line.start.x), metresOf(axis.line.start.y)],
  end: [metresOf(axis.line.end.x), metresOf(axis.line.end.y)],
  label: axis.label.trim().slice(0, GRID_LABEL_MAX) || '?',
  showStartBubble: true,
  showEndBubble: true,
  metadata: { appfront: originOf(axis, { direction: axis.direction, label: axis.label }) },
});

/** Chiều cao dựng hình của một món đồ, mét: thang lấy chiều cao tầng, còn lại lấy bảng. */
const heightOfFurniture = (furniture: Furniture, levelHeightMm: number): number =>
  furniture.kind === 'stair'
    ? metresOf(levelHeightMm)
    : metresOf(furniture.heightMm ?? FURNITURE_HEIGHT_MM[furniture.kind]);

/**
 * Thư mục mô hình Pascal cho một món đồ (P1 §3): có `variant` thì tra
 * `VARIANT_MODEL`, không thì đoán theo loại + công năng phòng + hộp bao (mét).
 * `stair` không có mô hình — trả `null`.
 */
export const furnitureModelOf = (
  furniture: Furniture,
  usage: RoomUsage | undefined,
): { readonly folder: string; readonly liftMm?: number } | null => {
  const byVariant = furniture.variant === undefined ? null : VARIANT_MODEL[furniture.variant];

  if (byVariant) {
    return byVariant;
  }

  const w = metresOf(furniture.boundingBox.max.x - furniture.boundingBox.min.x);
  const d = metresOf(furniture.boundingBox.max.y - furniture.boundingBox.min.y);
  const short = Math.min(w, d);
  const long = Math.max(w, d);
  const h = furniture.heightMm === undefined ? undefined : metresOf(furniture.heightMm);
  const pick = (folder: string) => ({ folder });

  switch (furniture.kind) {
    case 'stair':
      return null;
    case 'bed':
      return pick(w < 1.2 ? 'single-bed' : 'double-bed');
    case 'wardrobe':
      return pick('closet');
    case 'chair':
      return pick('dining-chair');
    case 'table':
      if (long < 0.6) return pick('bedside-table');
      return pick(usage === 'livingRoom' && h !== undefined && h < 0.5 ? 'coffee-table' : 'dining-table');
    case 'kitchenCabinet':
      return pick(short >= 0.6 && long <= 0.8 ? 'fridge' : 'kitchen-counter');
    case 'sanitaryFixture':
      if (short < 0.5 && long < 0.8) return pick('toilet');
      if (long > 1.5) return pick('bathtub');
      if (short >= 0.75 && long - short < 0.1) return pick('shower-square');
      return pick('bathroom-sink');
    case 'other':
      if (usage === 'livingRoom' && long > 1.5) return pick('sofa');
      if (h !== undefined && h < 0.05) return pick('rectangular-carpet');
      return pick(w * d < 0.25 ? 'small-indoor-plant' : 'indoor-plant');
  }
};

const itemNodeOf = (
  furniture: Furniture,
  levelNodeId: PascalNodeId,
  levelHeightMm: number,
  usage?: RoomUsage,
): PascalItemNode => {
  const label = FURNITURE_KIND_LABELS[furniture.kind];
  const widthM = metresOf(furniture.boundingBox.max.x - furniture.boundingBox.min.x);
  const depthM = metresOf(furniture.boundingBox.max.y - furniture.boundingBox.min.y);
  const model = furniture.model === undefined ? furnitureModelOf(furniture, usage) : null;
  const catalog = model === null ? undefined : CATALOG_MODELS[model.folder];

  // Khớp mô hình vào hộp bao CỤC BỘ bằng `asset.scale` — `node.scale` phải giữ
  // [1, 1, 1] vì lượt về đọc lệch khỏi 1 là "người dùng vừa kéo" (toSpatial `isUnscaled`).
  // `asset.id` cũng giữ nguyên `appfront-<kind>`: đổi nó là lượt về sinh `model` (R1-3b).
  const fit = (() => {
    if (model === null || catalog === undefined) {
      return null;
    }

    const [cw, ch, cd] = catalog.dimensions;
    const fixedH = furniture.heightMm === undefined ? undefined : metresOf(furniture.heightMm);
    const s = Math.min(widthM / cw, depthM / cd, fixedH === undefined ? Infinity : fixedH / ch);
    // Đồ treo tường: mô hình mỏng hơn hộp bao thì áp lưng nó vào mép sau (−z cục
    // bộ, phía tường) thay vì treo lơ lửng giữa hộp. Dời bằng `asset.offset` chứ
    // không dời `position`: tâm món đồ phải giữ đúng `centre` để lượt về không trôi.
    // `attachTo` không ghi ra — Pascal sẽ đòi một bức tường cha mà node này không có.
    const backShift = catalog.attachTo === 'wall-side' ? -(depthM - cd * s) / 2 : 0;
    const [ox, oy, oz] = catalog.offset;

    return {
      folder: model.folder,
      heightM: fixedH ?? ch * s,
      scale: [s, s, s] as PascalVec3,
      offset: [ox * s, oy * s, oz * s + backShift] as PascalVec3,
      rotation: [...catalog.rotation] as PascalVec3,
    };
  })();
  const heightM = fit?.heightM ?? heightOfFurniture(furniture, levelHeightMm);
  const liftM = metresOf(furniture.liftMm ?? model?.liftMm ?? 0);
  const slots = fit === null ? undefined : itemSlotsOf(fit.folder);

  return {
    object: 'node',
    id: toPascalId('item', furniture.id),
    type: 'item',
    name: label,
    parentId: levelNodeId,
    ...(slots === undefined ? {} : { slots }),
    // Đồ trần (pendant) tạm đặt dưới tầng ở độ cao `lift`; T16 lo trần.
    position: [metresOf(furniture.centre.x), liftM, metresOf(furniture.centre.y)],
    rotation: [0, yawOf(furniture.rotationDeg), 0],
    scale: [1, 1, 1],
    asset: {
      id: furniture.model?.id ?? `appfront-${furniture.kind}`,
      category: furniture.kind,
      name: label,
      thumbnail: fit === null ? '' : thumbnailOf(fit.folder),
      // `asset://…` là dạng nội bộ mà `AssetUrl` nhận (`schema/asset-url.js`);
      // chỉ còn `stair` dùng nó làm chỗ giữ chỗ — chưa có mô hình thang (ngoài C2).
      src: furniture.model?.src ?? (fit === null ? `asset://appfront/${furniture.kind}` : modelSrcOf(fit.folder)),
      dimensions: [widthM, heightM, depthM],
      ...(fit === null ? {} : { offset: fit.offset, rotation: fit.rotation, scale: fit.scale }),
    },
    metadata: {
      appfront: originOf(furniture, {
        kind: furniture.kind,
        boundingBox: furniture.boundingBox,
        ...(furniture.roomId === undefined ? {} : { roomId: furniture.roomId }),
      }),
    },
  };
};

/* -------------------------------------------------------------------------- */
/* Lượt đổi.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Đổi cả đồ thị sang một cảnh Pascal.
 *
 * Không đọc store, không chạm mạng, không ném lỗi: cùng một đồ thị vào thì
 * cùng một cảnh ra, kể cả khi đồ thị có tham chiếu gãy.
 */
/**
 * Đường bao khu đất, tính từ chính hình học đã dựng.
 *
 * Bắt buộc phải có: `setScene` không parse qua zod nên mặc định `.default()`
 * của lược đồ không bao giờ được áp, và bộ vẽ khu đất trả `null` — **bỏ luôn
 * cả cây con, im lặng** — khi không dựng được đường bao
 * (`nodes/dist/site/renderer.js:293`). Mặc định của lược đồ là ô vuông 30×30
 * quanh gốc, nhỏ hơn nhiều công trình thật, nên không mượn được.
 */
const sitePolygonOf = (nodes: Record<PascalNodeId, PascalNode>): PascalSiteNode['polygon'] => {
  const xs: number[] = [];
  const zs: number[] = [];

  for (const node of Object.values(nodes)) {
    if (node.type === 'wall') {
      xs.push(node.start[0], node.end[0]);
      zs.push(node.start[1], node.end[1]);
    } else if (node.type === 'zone') {
      for (const [x, z] of node.polygon) {
        xs.push(x);
        zs.push(z);
      }
    }
  }

  if (xs.length === 0 || zs.length === 0) {
    const half = SITE_FALLBACK_HALF_SIZE_M;
    return {
      type: 'polygon',
      points: [
        [-half, -half],
        [half, -half],
        [half, half],
        [-half, half],
      ],
    };
  }

  const minX = Math.min(...xs) - SITE_MARGIN_M;
  const maxX = Math.max(...xs) + SITE_MARGIN_M;
  const minZ = Math.min(...zs) - SITE_MARGIN_M;
  const maxZ = Math.max(...zs) + SITE_MARGIN_M;

  return {
    type: 'polygon',
    points: [
      [minX, minZ],
      [maxX, minZ],
      [maxX, maxZ],
      [minX, maxZ],
    ],
  };
};

export const toPascalScene = (graph: SpatialGraph): PascalSceneResult => {
  const nodes: Record<PascalNodeId, PascalNode> = {};
  const skipped: SkippedEntity[] = [];
  const childrenOf = new Map<PascalNodeId, PascalNodeId[]>();

  /**
   * Mảng con của một node, **dùng chung**: node giữ đúng mảng này, nên một
   * đứa con thêm vào sau khi node đã dựng vẫn có mặt. Nhờ vậy không cần lượt
   * quét thứ hai để vá lại `children`.
   */
  const childrenFor = (nodeId: PascalNodeId): PascalNodeId[] => {
    const existing = childrenOf.get(nodeId);

    if (existing !== undefined) {
      return existing;
    }

    const created: PascalNodeId[] = [];

    childrenOf.set(nodeId, created);

    return created;
  };

  const adopt = (parentId: PascalNodeId, childId: PascalNodeId): void => {
    childrenFor(parentId).push(childId);
  };

  const orderedLevels = [...graph.levels].sort((left, right) => left.order - right.order);
  const baseElevations = baseElevationsOf(
    orderedLevels.filter((level) => isUsable(level.elevationMm, level.heightMm)),
  );
  const levelNodeIdOf = new Map<string, PascalNodeId>();
  /* Chiều cao tầng: cái thang dựng cao trọn tầng, và trần của phòng. */
  const levelHeightMmOf = new Map<string, number>();
  let elevationIndex = 0;

  for (const level of orderedLevels) {
    if (!isUsable(level.elevationMm, level.heightMm)) {
      skipped.push(skip(level.id, 'tầng', 'Cao độ hoặc chiều cao tầng không phải một số đo được.'));
      continue;
    }

    const node = levelNodeOf(
      level,
      baseElevations[elevationIndex] ?? 0,
      childrenFor(toPascalId('level', level.id)),
    );

    elevationIndex += 1;
    nodes[node.id] = node;
    levelNodeIdOf.set(level.id, node.id);
    levelHeightMmOf.set(level.id, level.heightMm);
    adopt(BUILDING_NODE_ID, node.id);
  }

  const wallNodeIdOf = new Map<string, PascalNodeId>();
  const wallCountOfLevel = new Map<string, number>();

  for (const wall of graph.walls) {
    const levelNodeId = levelNodeIdOf.get(wall.levelId);

    if (levelNodeId === undefined) {
      skipped.push(skip(wall.id, 'tường', `Tường thuộc tầng ${wall.levelId} mà tầng ấy không có trong bản vẽ.`));
      continue;
    }

    if (
      !isUsable(
        wall.centreline.start.x,
        wall.centreline.start.y,
        wall.centreline.end.x,
        wall.centreline.end.y,
        wall.thicknessMm,
        wall.heightMm,
      )
    ) {
      skipped.push(skip(wall.id, 'tường', 'Trục tường hoặc kích thước tường không phải một số đo được.'));
      continue;
    }

    const ordinal = (wallCountOfLevel.get(wall.levelId) ?? 0) + 1;
    wallCountOfLevel.set(wall.levelId, ordinal);
    const node = wallNodeOf(wall, ordinal, levelNodeId, childrenFor(toPascalId('wall', wall.id)));

    nodes[node.id] = node;
    wallNodeIdOf.set(wall.id, node.id);
    adopt(levelNodeId, node.id);
  }

  for (const opening of graph.openings) {
    const wallNodeId = wallNodeIdOf.get(opening.wallId);

    if (wallNodeId === undefined) {
      skipped.push(
        skip(opening.id, 'ô mở', `Ô mở nằm trên tường ${opening.wallId} mà tường ấy không sang được.`),
      );
      continue;
    }

    if (!isUsable(opening.offsetMm, opening.widthMm, opening.heightMm, opening.sillHeightMm)) {
      skipped.push(skip(opening.id, 'ô mở', 'Vị trí hoặc kích thước ô mở không phải một số đo được.'));
      continue;
    }

    const node = openingNodeOf(opening, wallNodeId);

    nodes[node.id] = node;
    adopt(wallNodeId, node.id);
  }

  for (const room of graph.rooms) {
    const levelNodeId = levelNodeIdOf.get(room.levelId);
    const levelHeightMm = levelHeightMmOf.get(room.levelId);

    if (levelNodeId === undefined || levelHeightMm === undefined) {
      skipped.push(skip(room.id, 'phòng', `Phòng thuộc tầng ${room.levelId} mà tầng ấy không có trong bản vẽ.`));
      continue;
    }

    if (room.outline.length < MIN_OUTLINE_POINTS) {
      skipped.push(skip(room.id, 'phòng', 'Đường bao phòng có ít hơn ba điểm nên không thành đa giác.'));
      continue;
    }

    if (!room.outline.every((point) => isUsable(point.x, point.y))) {
      skipped.push(skip(room.id, 'phòng', 'Đường bao phòng có điểm không phải một toạ độ đo được.'));
      continue;
    }

    for (const node of [zoneNodeOf(room, levelNodeId, levelHeightMm), slabNodeOf(room, levelNodeId)]) {
      nodes[node.id] = node;
      adopt(levelNodeId, node.id);
    }

    /* Trần + đèn sinh từ phòng; đèn là con của trần (trần tự giữ `children`). */
    const [ceiling, light] = ceilingNodesOf(room, levelNodeId);

    nodes[ceiling.id] = ceiling;
    nodes[light.id] = light;
    adopt(levelNodeId, ceiling.id);
  }

  for (const furniture of graph.furniture) {
    const levelNodeId = levelNodeIdOf.get(furniture.levelId);
    /* Hai bảng luôn được đặt cùng lúc, nên `undefined` ở đây nghĩa là tầng đã bị
       bỏ qua — cùng một lý do, không phải hai. */
    const levelHeightMm = levelHeightMmOf.get(furniture.levelId);

    if (levelNodeId === undefined || levelHeightMm === undefined) {
      skipped.push(
        skip(furniture.id, 'đồ đạc', `Đồ đạc thuộc tầng ${furniture.levelId} mà tầng ấy không có trong bản vẽ.`),
      );
      continue;
    }

    if (
      !isUsable(
        furniture.centre.x,
        furniture.centre.y,
        furniture.rotationDeg,
        furniture.boundingBox.min.x,
        furniture.boundingBox.min.y,
        furniture.boundingBox.max.x,
        furniture.boundingBox.max.y,
      )
    ) {
      skipped.push(skip(furniture.id, 'đồ đạc', 'Vị trí, góc quay hoặc hộp bao không phải một số đo được.'));
      continue;
    }

    const usage = graph.rooms.find((room) => room.id === furniture.roomId)?.usage;
    const node = itemNodeOf(furniture, levelNodeId, levelHeightMm, usage);

    nodes[node.id] = node;
    adopt(levelNodeId, node.id);
  }

  for (const axis of graph.axes) {
    const levelNodeId = levelNodeIdOf.get(axis.levelId);

    if (levelNodeId === undefined) {
      skipped.push(skip(axis.id, 'trục định vị', `Trục thuộc tầng ${axis.levelId} mà tầng ấy không có trong bản vẽ.`));
      continue;
    }

    const { start, end } = axis.line;

    if (!isUsable(start.x, start.y, end.x, end.y)) {
      skipped.push(skip(axis.id, 'trục định vị', 'Toạ độ hai đầu trục không phải một số đo được.'));
      continue;
    }

    const node = gridNodeOf(axis, levelNodeId);

    nodes[node.id] = node;
    adopt(levelNodeId, node.id);
  }

  for (const dimension of graph.dimensions) {
    skipped.push(skip(dimension.id, 'kích thước', 'Kích thước của bản vẽ chưa được chuyển sang Pascal ở bản đầu.'));
  }

  for (const note of graph.notes) {
    skipped.push(skip(note.id, 'ghi chú', 'Ghi chú gắn với đối tượng chưa được chuyển sang Pascal ở bản đầu.'));
  }

  nodes[BUILDING_NODE_ID] = {
    object: 'node',
    id: BUILDING_NODE_ID,
    type: 'building',
    name: graph.building.name,
    parentId: SITE_NODE_ID,
    children: childrenFor(BUILDING_NODE_ID),
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    metadata: {
      appfront: originOf(graph.building, {
        name: graph.building.name,
        datumElevationMm: graph.building.datumElevationMm,
        ...(graph.building.address === undefined ? {} : { address: graph.building.address }),
        ...(graph.building.grossFloorAreaM2 === undefined
          ? {}
          : { grossFloorAreaM2: graph.building.grossFloorAreaM2 }),
      }),
    },
  };

  nodes[SITE_NODE_ID] = {
    object: 'node',
    id: SITE_NODE_ID,
    type: 'site',
    name: 'khu đất',
    parentId: null,
    children: [BUILDING_NODE_ID],
    polygon: sitePolygonOf(nodes),
  };


  const materials = Object.fromEntries(SCENE_MATERIALS.map((material) => [material.id, material]));
  return { scene: { nodes, rootNodeIds: [SITE_NODE_ID], materials }, skipped };
};
