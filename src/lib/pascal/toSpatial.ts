/**
 * Pascal → AppFront: cảnh `{ nodes, rootNodeIds }` thành đồ thị không gian.
 *
 * Đây là lượt về của `toPascal.ts`, và nó **không** phải một phép đảo máy móc.
 * Ba chỗ nó cố ý không đối xứng:
 *
 * 1. **Dấu xác minh không đi ngược chiều tự do (A5).** Chỉ node nào dịch được
 *    id về một id AppFront hợp lệ — tức node do chính AppFront viết ra — mới
 *    được mang `reviewed` của mình về. Node Pascal tự đẻ mang id nanoid,
 *    không qua được phép kiểm, và luôn về `reviewed: false`. Người duyệt đặt
 *    dấu ấy, không phải công cụ vẽ.
 * 2. **Cao độ tầng tính lại bằng chính luật của Pascal**, không đọc lại từ
 *    siêu dữ liệu. Tầng người dùng vừa chèn trong Pascal nhờ thế cũng rơi đúng
 *    chỗ, và một lỗi trong phép tính `baseElevation` của lượt đi sẽ hiện ra ở
 *    bài kiểm vòng tròn chứ không bị siêu dữ liệu che.
 * 3. **Chỉ đi theo cây từ gốc.** Node không với tới được từ `rootNodeIds`
 *    không vào đồ thị; nó vào danh sách bỏ qua. Một node mồ côi trong cảnh là
 *    thứ người dùng không thấy, và đưa nó vào bản vẽ là thêm dữ liệu từ hư
 *    không.
 *
 * Mọi số đo về đều **làm tròn tới milimét** (`roundMeasurement`). Không có
 * dòng này thì `4,251 m × 1000` ra `4251,0000000000005 mm`, và bài kiểm 100
 * vòng đổi qua đổi lại sẽ trôi dần.
 */

import { computeArea } from '@/domain/rooms/area';
import { millimetresPerPixel } from '@/domain/units/scale';
import { createId, isIdOfKind, type EntityKind, type IdByKind } from '@/domain/spatial/ids';
import type {
  Axis,
  AxisDirection,
  BoundingBox,
  Building,
  Furniture,
  FurnitureKind,
  Level,
  LevelId,
  Opening,
  OpeningId,
  Point,
  ReviewMetadata,
  MaterialRef,
  Room,
  RoomFinish,
  RoomId,
  RoomUsage,
  SpatialGraph,
  SwingDirection,
  Wall,
  WallId,
  WallKind,
  WallPaint,
} from '@/domain/spatial/types';
import {
  degrees as asDegrees,
  metres,
  metresToMillimetres,
  millimetres,
  normaliseDegrees,
  radians,
  radiansToDegrees,
  roundMeasurement,
} from '@/domain/units/types';
import { AUTHORED_BY_HAND, toPointMm } from '@/lib/commands/business/shared';

import { appFrontIdOf, BUILDING_NODE_ID } from './ids';
import { isGeneratedLightId, isGeneratedNodeId, SCENE_MATERIALS } from './sceneDressing';
import { SCENE_STYLE_MATERIALS, SCENE_STYLES, sceneStyleOf } from './sceneStyles';
import type {
  PascalLevelNode,
  PascalNode,
  PascalNodeId,
  PascalNodeType,
  PascalScene,
  PascalVec3,
  PascalWallNode,
  SkippedEntity,
} from './types';

/** Kết quả một lượt đổi Pascal → AppFront. */
export interface SpatialGraphResult {
  readonly graph: SpatialGraph;
  /** Node không đưa vào đồ thị được; `id` ở đây là id **phía Pascal**. */
  readonly skipped: readonly SkippedEntity[];
}

/**
 * Sổ id của một phiên gắn Pascal: id node Pascal → id AppFront đã cấp cho nó.
 *
 * Node do người dùng vẽ trong Pascal chưa có id AppFront, nên lượt đổi đầu
 * tiên cấp cho nó một cái. Không nhớ lại thì lượt đổi **sau** cấp một id khác
 * nữa, và một bức tường hoá thành hai. Sổ này là chỗ nhớ; nó sống đúng bằng
 * một lượt gắn Pascal và người gọi giữ nó.
 */
export type PascalIdBook = Map<PascalNodeId, string>;

/** Dòng bỏ qua cho đồ Pascal gắn dưới trần; `fromPascal` đọc `kind` này để từ chối lượt sửa. */
export const CEILING_FIXTURE_KIND = 'đồ gắn trần';
export const CEILING_FIXTURE_REASON = 'Đồ gắn trần chưa lưu được vào bản vẽ.';

/** Số chữ số thập phân giữ lại của một góc, đủ để `độ → radian → độ` khép lại. */
const ANGLE_PRECISION = 1e6;

/** Số điểm tối thiểu để một đường bao là một đa giác. */
const MIN_OUTLINE_POINTS = 3;

const isUsable = (...values: readonly number[]): boolean => values.every(Number.isFinite);

/** Mét sang milimét, đã làm tròn về lưới một milimét. */
const millimetresOf = (valueM: number): number =>
  roundMeasurement(metresToMillimetres(metres(valueM)));

/** Góc quanh trục `y` của Pascal trở lại góc mặt bằng của AppFront. */
const planDegreesOf = (yaw: number): number => {
  const raw = radiansToDegrees(radians(-yaw));

  return normaliseDegrees(asDegrees(Math.round(raw * ANGLE_PRECISION) / ANGLE_PRECISION));
};

/** Cấp id AppFront cho một node Pascal, nhớ lại nếu phiên này đã cấp rồi. */
const minterFor =
  (book: PascalIdBook | undefined) =>
  <K extends EntityKind>(kind: K, nodeId: PascalNodeId): IdByKind[K] => {
    const remembered = book?.get(nodeId);

    if (remembered !== undefined && isIdOfKind(kind, remembered)) {
      return remembered;
    }

    const created = createId(kind);

    book?.set(nodeId, created);

    return created;
  };

/** Cấp id như trên, dùng chung một sổ trong suốt một lượt đổi. */
type Minter = ReturnType<typeof minterFor>;

/** Lọc node theo loại, kèm thu hẹp kiểu — `filter` trần không thu hẹp được. */
const ofType =
  <T extends PascalNodeType>(type: T) =>
  (node: PascalNode): node is Extract<PascalNode, { type: T }> =>
    node.type === type;

/* -------------------------------------------------------------------------- */
/* Đọc siêu dữ liệu — dữ liệu từ bên kia tường, nên đọc là phải kiểm.          */
/* -------------------------------------------------------------------------- */

type Fields = Readonly<Record<string, unknown>>;

const fieldsOf = (node: PascalNode): Fields => node.metadata?.appfront?.fields ?? {};

const readNumber = (fields: Fields, key: string): number | null => {
  const value = fields[key];

  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const readString = (fields: Fields, key: string): string | null => {
  const value = fields[key];

  return typeof value === 'string' ? value : null;
};

const readOneOf = <T extends string>(fields: Fields, key: string, allowed: readonly T[]): T | null => {
  const value = fields[key];

  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
};

/* -------------------------------------------------------------------------- */
/* W3a — sơn sàn/tường.                                                        */
/* -------------------------------------------------------------------------- */

const MATERIAL_REF = /^(library|scene):[a-z0-9_-]{1,64}$/;

/**
 * Vật liệu ghi được: vật liệu phẳng của AppFront + mọi tham chiếu mà các phong cách
 * dùng. Màu tự pha (`scene.materials` người dùng thêm) chưa lưu được — thông báo V3 nói ra.
 * ponytail: thư viện = các ref phong cách dùng, không phải cả MATERIAL_CATALOG của vendor;
 * nới khi danh sách thư viện có đủ tệp được xuất ra lúc chạy.
 */
const SAVEABLE_REFS: ReadonlySet<string> = new Set([
  ...[...SCENE_MATERIALS, ...SCENE_STYLE_MATERIALS].map((material) => `scene:${material.id}`),
  ...Object.values(SCENE_STYLES).flatMap((style) => [
    ...Object.values(style.floor),
    style.wall.interior,
    style.wall.exterior,
    ...Object.values(style.families),
  ]),
  'library:preset-glass',
]);

const saveableRef = (ref: string | undefined): ref is MaterialRef =>
  ref !== undefined && MATERIAL_REF.test(ref) && SAVEABLE_REFS.has(ref);

/**
 * Mặt sàn `slab_<phòng>` → trường của phòng. Bằng mặt phong cách cho: không ghi gì.
 * Trùng sàn của một `finish` trong phong cách đang dùng: ghi `finish` (đổi phong cách
 * thì sàn đổi theo). Khác nữa: ghi `floorMaterial`.
 */
const floorFieldsOf = (
  scene: PascalScene,
  roomId: RoomId,
): { finish?: RoomFinish; floorMaterial?: MaterialRef } => {
  const slab = scene.nodes[`slab_${roomId}`];
  const surface = slab?.type === 'slab' ? slab.slots['surface'] : undefined;
  const fields = slab === undefined ? {} : fieldsOf(slab);

  if (surface === readString(fields, 'styleSurface') || !saveableRef(surface)) return {};

  const style = sceneStyleOf(fields['style']);
  const finish = (Object.keys(style.floor) as RoomFinish[]).find((key) => style.floor[key] === surface);

  return finish === undefined ? { floorMaterial: surface } : { finish };
};

/** Khe mặt tường → `Wall.paint`, chỉ những mặt khác khe phong cách cho. */
const paintOf = (wall: PascalWallNode): WallPaint | null => {
  const styleSlots = fieldsOf(wall)['styleSlots'];
  const base = (typeof styleSlots === 'object' && styleSlots !== null ? styleSlots : {}) as Fields;
  const paint: { interior?: MaterialRef; exterior?: MaterialRef } = {};

  for (const side of ['interior', 'exterior'] as const) {
    const ref = wall.slots?.[side];

    if (ref !== readString(base, side) && saveableRef(ref)) paint[side] = ref;
  }

  return Object.keys(paint).length === 0 ? null : paint;
};

const readCorner = (fields: Fields, corner: 'min' | 'max'): Point | null => {
  const box = fields['boundingBox'];

  if (typeof box !== 'object' || box === null) {
    return null;
  }

  const value = (box as Record<string, unknown>)[corner];

  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const { x, y } = value as { x?: unknown; y?: unknown };

  return typeof x === 'number' && typeof y === 'number' && isUsable(x, y) ? { x, y } : null;
};

const AXIS_DIRECTIONS: readonly AxisDirection[] = ['horizontal', 'vertical'];
const WALL_KINDS: readonly WallKind[] = ['loadBearing', 'partition', 'envelope'];
const ROOM_USAGES: readonly RoomUsage[] = [
  'livingRoom',
  'bedroom',
  'kitchen',
  'bathroom',
  'corridor',
  'stairwell',
  'utility',
  'other',
];
const FURNITURE_KINDS: readonly FurnitureKind[] = [
  'table',
  'chair',
  'bed',
  'wardrobe',
  'kitchenCabinet',
  'sanitaryFixture',
  'stair',
  'other',
];
const SWING_DIRECTIONS: readonly SwingDirection[] = ['left', 'right', 'double', 'sliding', 'fixed'];

/**
 * Siêu dữ liệu duyệt của một node.
 *
 * `trusted` là câu trả lời cho "node này có phải do AppFront viết ra không".
 * Sai thì mọi thứ trong `metadata.appfront` bị bỏ, kể cả `confidence`: một đối
 * tượng vừa được vẽ trong Pascal là tác phẩm của người dùng, chưa ai duyệt, và
 * đó đúng là `AUTHORED_BY_HAND`.
 */
const reviewOf = (node: PascalNode, trusted: boolean): ReviewMetadata => {
  // Chỉ `metadata.appfront`: Pascal gốc không có trường `review` hạng nhất (zod bỏ khoá lạ).
  const origin = node.metadata?.appfront;

  if (!trusted || origin === undefined) {
    return { ...AUTHORED_BY_HAND };
  }

  const confidence =
    typeof origin.confidence === 'number' && Number.isFinite(origin.confidence)
      ? Math.min(1, Math.max(0, origin.confidence))
      : 1;

  return {
    confidence,
    source: origin.source === 'ai' ? 'ai' : 'human',
    reviewed: origin.reviewed === true,
  };
};

/* -------------------------------------------------------------------------- */
/* Đi theo cây.                                                                */
/* -------------------------------------------------------------------------- */

const childIdsOf = (node: PascalNode): readonly PascalNodeId[] =>
  'children' in node ? node.children : [];

const childrenOf = (scene: PascalScene, node: PascalNode): readonly PascalNode[] => {
  const found: PascalNode[] = [];

  for (const childId of childIdsOf(node)) {
    const child = scene.nodes[childId];

    if (child !== undefined) {
      found.push(child);
    }
  }

  return found;
};

/**
 * Cao độ đáy của từng tầng, theo đúng luật xếp chồng của Pascal.
 *
 * `services/storey.js:62-70`: duyệt theo số thứ tự tăng dần, cao độ đáy là
 * đỉnh của tầng dưới cộng `baseElevation` của chính nó.
 */
const stackedElevationsOf = (levels: readonly PascalLevelNode[]): readonly number[] => {
  const elevations: number[] = [];
  let topOfLevelBelow = 0;

  for (const level of levels) {
    const baseY = topOfLevelBelow + level.baseElevation;

    elevations.push(baseY);
    topOfLevelBelow = baseY + level.height;
  }

  return elevations;
};

/* -------------------------------------------------------------------------- */
/* Gom con của một tầng, rồi con của một tường.                                */
/* -------------------------------------------------------------------------- */

/** Mọi thứ hai hàm gom ghi vào, gom một chỗ để không phải truyền bảy tham số. */
interface Collector {
  readonly skip: (id: string, kind: string, reason: string) => void;
  readonly walls: Wall[];
  readonly openings: Opening[];
  readonly rooms: Room[];
  readonly furniture: Furniture[];
  readonly axes: Axis[];
  /** Id tường phía Pascal → id tường phía AppFront, để phòng nối lại được. */
  readonly wallIdOfNode: Map<PascalNodeId, WallId>;
  /** Id phòng → id tường **phía Pascal** của nó, giải ở lượt cuối. */
  readonly boundaryNodeIdsOf: Map<RoomId, readonly PascalNodeId[]>;
  /** Cấp id cho node Pascal chưa có id AppFront. */
  readonly mint: Minter;
  /** Phòng có đồ bày biện sinh ra được "nhận nuôi" trong lượt này (V4). */
  readonly adoptRoomIds: ReadonlySet<string>;
}

const positionIsUsable = (position: PascalVec3): boolean => isUsable(...position);

/** Hộp bao dựng quanh tâm, cho đồ đạc mà Pascal vừa đặt và AppFront chưa biết. */
const boxAround = (centre: Point, dimensions: PascalVec3, scale: PascalVec3): BoundingBox => {
  const halfWidth = (millimetresOf(dimensions[0]) * scale[0]) / 2;
  const halfDepth = (millimetresOf(dimensions[2]) * scale[2]) / 2;

  return {
    min: { x: centre.x - halfWidth, y: centre.y - halfDepth },
    max: { x: centre.x + halfWidth, y: centre.y + halfDepth },
  };
};

/**
 * Một tỉ lệ coi như "chưa ai kéo". Pascal ghi `[1, 1, 1]` cho mọi món đồ lượt
 * đi gắn, nên lệch khỏi 1 nghĩa là người dùng vừa kéo tay cầm.
 *
 * Dung sai `1e-9` là để chống sai số dấu phẩy động của chính Pascal, không
 * phải để bỏ qua một lần kéo thật: tay cầm nhỏ nhất của nó đổi tỉ lệ ở bậc
 * phần nghìn, lớn hơn ngưỡng này sáu bậc.
 */
const SCALE_EPSILON = 1e-9;

const isUnscaled = (scale: PascalVec3): boolean =>
  Math.abs(scale[0] - 1) < SCALE_EPSILON && Math.abs(scale[2] - 1) < SCALE_EPSILON;

/**
 * Hộp bao của một món đồ Pascal, mm — **có tính `scale`**.
 *
 * Người dùng đổi bề rộng một món đồ trong Pascal bằng cách kéo `scale`, chứ
 * không phải bằng cách nhập mm: `dimensions` của `asset` là số danh nghĩa của
 * mẫu và không đổi. Nên bề rộng thật là `dimensions × scale`, và lượt về phải
 * nhân vào — đọc thẳng `metadata.appfront.boundingBox` là đọc lại cái hộp
 * AppFront gắn ở lượt ĐI, tức **mất trắng** lần kéo vừa rồi, im lặng.
 *
 * Khi tỉ lệ còn là 1 thì hộp đã lưu được dùng nguyên văn: nó giữ đúng số mm
 * gốc (kể cả hộp không cân quanh tâm), không qua mét rồi về mm nên không có
 * sai số làm mọi món đồ chưa ai chạm tới lệch đi một phần nghìn mỗi vòng.
 */
const itemBoxOf = (
  centre: Point,
  stored: { readonly min: Point; readonly max: Point } | null,
  dimensions: PascalVec3,
  scale: PascalVec3,
): BoundingBox => {
  if (stored === null) {
    return boxAround(centre, dimensions, scale);
  }

  if (isUnscaled(scale)) {
    return stored;
  }

  // Kéo quanh tâm món đồ: giãn khoảng cách từ tâm tới từng cạnh, nên một hộp
  // không cân vẫn giữ được độ không cân của nó sau khi kéo.
  return {
    min: {
      x: centre.x + (stored.min.x - centre.x) * scale[0],
      y: centre.y + (stored.min.y - centre.y) * scale[2],
    },
    max: {
      x: centre.x + (stored.max.x - centre.x) * scale[0],
      y: centre.y + (stored.max.y - centre.y) * scale[2],
    },
  };
};

/**
 * V4 — phòng của một món đồ bày biện sinh ra (`item_DRESS-…`) mà người dùng
 * nhận nuôi được, hoặc `null`. Đèn trần không bao giờ được nhận nuôi.
 */
export const adoptableRoomOf = (node: PascalNode | undefined): string | null => {
  if (node?.type !== 'item' || !isGeneratedNodeId(node.id) || isGeneratedLightId(node.id)) return null;

  const roomId = node.metadata?.appfront?.fields?.['roomId'];

  return typeof roomId === 'string' && isIdOfKind('room', roomId) ? roomId : null;
};

/**
 * V4 — món bày biện sinh ra đã bị người dùng dời / kéo / xoay chưa, so với
 * chính siêu dữ liệu lượt đi: tâm khác tâm hộp bao quá 1 mm, tỉ lệ khác 1, hoặc
 * góc khác `fields.rotationDeg` (chỉ khi lượt đi có ghi trường này).
 * Lượt nạp đầu khai mọi node là "đã đổi" nên không được nhận nuôi gì ở đó.
 */
export const isEditedGenerated = (node: PascalNode | undefined): boolean => {
  if (node?.type !== 'item' || adoptableRoomOf(node) === null) return false;

  const fields = fieldsOf(node);
  const min = readCorner(fields, 'min');
  const max = readCorner(fields, 'max');
  const rotationDeg = readNumber(fields, 'rotationDeg');
  const moved =
    min === null ||
    max === null ||
    Math.abs(millimetresOf(node.position[0]) - (min.x + max.x) / 2) > 1 ||
    Math.abs(millimetresOf(node.position[2]) - (min.y + max.y) / 2) > 1;

  return (
    moved ||
    !isUnscaled(node.scale) ||
    (rotationDeg !== null && planDegreesOf(node.rotation[1]) !== normaliseDegrees(asDegrees(rotationDeg)))
  );
};

const collectWallChildren = (
  scene: PascalScene,
  wallNode: PascalWallNode,
  wallId: WallId,
  openingIds: OpeningId[],
  collector: Collector,
): void => {
  for (const child of childrenOf(scene, wallNode)) {
    if (child.type !== 'door' && child.type !== 'window') {
      collector.skip(
        child.id,
        child.type,
        `Loại node "${child.type}" gắn trên tường chưa có đối tượng tương ứng trong bản vẽ.`,
      );
      continue;
    }

    if (!positionIsUsable(child.position) || !isUsable(child.width, child.height)) {
      collector.skip(child.id, 'ô mở', 'Vị trí hoặc kích thước ô mở không phải một số đo được.');
      continue;
    }

    const knownId = appFrontIdOf('opening', child.id);
    const openingId = knownId ?? collector.mint('opening', child.id);
    const widthMm = millimetresOf(child.width);
    const heightMm = millimetresOf(child.height);

    openingIds.push(openingId);
    collector.openings.push({
      ...reviewOf(child, knownId !== null),
      id: openingId,
      wallId,
      kind: child.type,
      // Pascal đọc tâm ở cả hai trục; AppFront lưu mép trái và mép dưới.
      offsetMm: roundMeasurement(millimetres(millimetresOf(child.position[0]) - widthMm / 2)),
      widthMm,
      heightMm,
      sillHeightMm: roundMeasurement(millimetres(millimetresOf(child.position[1]) - heightMm / 2)),
      swing: readOneOf(fieldsOf(child), 'swing', SWING_DIRECTIONS) ?? 'left',
    });
  }
};

const collectLevelChildren = (
  scene: PascalScene,
  levelNode: PascalLevelNode,
  levelId: LevelId,
  collector: Collector,
): void => {
  for (const child of childrenOf(scene, levelNode)) {
    switch (child.type) {
      case 'wall': {
        if (!isUsable(...child.start, ...child.end, child.thickness, child.height)) {
          collector.skip(child.id, 'tường', 'Trục tường hoặc kích thước tường không phải một số đo được.');
          break;
        }

        const knownId = appFrontIdOf('wall', child.id);
        const wallId = knownId ?? collector.mint('wall', child.id);
        const openingIds: OpeningId[] = [];

        const paint = paintOf(child);

        collector.wallIdOfNode.set(child.id, wallId);
        collector.walls.push({
          ...reviewOf(child, knownId !== null),
          id: wallId,
          levelId,
          centreline: {
            start: { x: millimetresOf(child.start[0]), y: millimetresOf(child.start[1]) },
            end: { x: millimetresOf(child.end[0]), y: millimetresOf(child.end[1]) },
          },
          thicknessMm: millimetresOf(child.thickness),
          heightMm: millimetresOf(child.height),
          kind: readOneOf(fieldsOf(child), 'kind', WALL_KINDS) ?? 'partition',
          openingIds,
          ...(paint === null ? {} : { paint }),
        });

        collectWallChildren(scene, child, wallId, openingIds, collector);
        break;
      }

      case 'zone': {
        if (!child.polygon.every((point) => isUsable(...point))) {
          collector.skip(child.id, 'phòng', 'Đường bao phòng có điểm không phải một toạ độ đo được.');
          break;
        }

        if (child.polygon.length < MIN_OUTLINE_POINTS) {
          collector.skip(child.id, 'phòng', 'Đường bao phòng có ít hơn ba điểm nên không thành đa giác.');
          break;
        }

        const fields = fieldsOf(child);
        const knownId = appFrontIdOf('room', child.id);
        const roomId = knownId ?? collector.mint('room', child.id);
        const outline = child.polygon.map(
          (point): Point => ({ x: millimetresOf(point[0]), y: millimetresOf(point[1]) }),
        );

        collector.boundaryNodeIdsOf.set(roomId, child.boundaryWallIds);
        collector.rooms.push({
          ...reviewOf(child, knownId !== null),
          id: roomId,
          levelId,
          name: child.name,
          usage: readOneOf(fields, 'usage', ROOM_USAGES) ?? 'other',
          outline,
          areaM2: readNumber(fields, 'areaM2') ?? computeArea(outline.map(toPointMm)),
          wallIds: [],
          ...(knownId === null ? {} : floorFieldsOf(scene, knownId)),
        });
        break;
      }

      case 'item': {
        // Đồ bày biện / đèn AppFront tự sinh (J10): dựng lại mỗi lần mở, không bao giờ thành đồ đạc —
        // trừ khi người dùng vừa sửa một món của phòng ấy: cả bộ của phòng thành đồ thật, id `F-` mới (V4).
        if (isGeneratedNodeId(child.id) && !collector.adoptRoomIds.has(adoptableRoomOf(child) ?? '')) break;

        if (!positionIsUsable(child.position) || !positionIsUsable(child.rotation)) {
          collector.skip(child.id, 'đồ đạc', 'Vị trí hoặc góc quay của đồ đạc không phải một số đo được.');
          break;
        }

        const fields = fieldsOf(child);
        const knownId = appFrontIdOf('furniture', child.id);
        const centre: Point = {
          x: millimetresOf(child.position[0]),
          y: millimetresOf(child.position[2]),
        };
        const min = readCorner(fields, 'min');
        const max = readCorner(fields, 'max');
        const roomId = readString(fields, 'roomId');

        const kind = readOneOf(fields, 'kind', FURNITURE_KINDS) ?? 'other';

        collector.furniture.push({
          ...reviewOf(child, knownId !== null),
          id: knownId ?? collector.mint('furniture', child.id),
          levelId,
          kind,
          centre,
          boundingBox: itemBoxOf(
            centre,
            min !== null && max !== null ? { min, max } : null,
            child.asset.dimensions,
            child.scale,
          ),
          rotationDeg: planDegreesOf(child.rotation[1]),
          ...(roomId !== null && isIdOfKind('room', roomId) ? { roomId } : {}),
          ...(child.asset.id !== `appfront-${kind}` ? { model: { id: child.asset.id, src: child.asset.src } } : {}),
        });
        break;
      }

      case 'stair': {
        // Thang thật (toPascal `stairNodesOf`): đoạn con không bao giờ thành đối tượng riêng.
        const segment = childrenOf(scene, child).find((node) => node.type === 'stair-segment');
        const length = segment?.type === 'stair-segment' ? segment.length : null;

        if (length === null || !positionIsUsable(child.position) || !isUsable(child.rotation, child.width, length)) {
          collector.skip(child.id, 'đồ đạc', 'Vị trí, góc quay hoặc kích thước thang không phải một số đo được.');
          break;
        }

        const fields = fieldsOf(child);
        const knownId = appFrontIdOf('furniture', child.id);
        const min = readCorner(fields, 'min');
        const max = readCorner(fields, 'max');
        const roomId = readString(fields, 'roomId');
        // Thân thang chạy theo +z cục bộ từ `position` (chân thang) → tâm ở giữa thân.
        const centre: Point = {
          x: millimetresOf(child.position[0] + (Math.sin(child.rotation) * length) / 2),
          y: millimetresOf(child.position[2] + (Math.cos(child.rotation) * length) / 2),
        };
        // Hướng hộp bao giữ như lượt đi: cạnh dài theo x cục bộ thì yaw đã cộng π/2.
        const runAlongX = min !== null && max !== null && max.x - min.x > max.y - min.y;
        const sizeX = millimetresOf(runAlongX ? length : child.width);
        const sizeY = millimetresOf(runAlongX ? child.width : length);
        const stored =
          min !== null &&
          max !== null &&
          Math.abs(max.x - min.x - sizeX) <= 1 &&
          Math.abs(max.y - min.y - sizeY) <= 1 &&
          Math.abs((min.x + max.x) / 2 - centre.x) <= 1 &&
          Math.abs((min.y + max.y) / 2 - centre.y) <= 1;

        collector.furniture.push({
          ...reviewOf(child, knownId !== null),
          id: knownId ?? collector.mint('furniture', child.id),
          levelId,
          kind: 'stair',
          centre,
          boundingBox: stored
            ? { min, max }
            : {
                min: { x: centre.x - sizeX / 2, y: centre.y - sizeY / 2 },
                max: { x: centre.x + sizeX / 2, y: centre.y + sizeY / 2 },
              },
          // Viết −(bù − yaw) chứ không phải yaw − bù: yaw 0 phải ra 0° chứ không phải −0° (diff so giá trị).
          rotationDeg: planDegreesOf(-((runAlongX ? Math.PI / 2 : 0) - child.rotation)),
          ...(roomId !== null && isIdOfKind('room', roomId) ? { roomId } : {}),
        });
        break;
      }

      case 'structural-grid': {
        if (!isUsable(...child.start, ...child.end)) {
          collector.skip(child.id, 'trục định vị', 'Toạ độ hai đầu trục không phải một số đo được.');
          break;
        }

        const fields = fieldsOf(child);
        const knownId = appFrontIdOf('axis', child.id);
        const start: Point = { x: millimetresOf(child.start[0]), y: millimetresOf(child.start[1]) };
        const end: Point = { x: millimetresOf(child.end[0]), y: millimetresOf(child.end[1]) };

        collector.axes.push({
          ...reviewOf(child, knownId !== null),
          id: knownId ?? collector.mint('axis', child.id),
          levelId,
          label: readString(fields, 'label') ?? child.label,
          direction:
            readOneOf(fields, 'direction', AXIS_DIRECTIONS) ??
            (Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? 'horizontal' : 'vertical'),
          line: { start, end },
        });
        break;
      }

      case 'slab': {
        /*
         * Sàn dựng RA từ đường bao phòng ở lượt đi, nên lượt về không mang gì
         * mới: `zone` cùng phòng đã chở đủ đường bao, công năng và dấu xác
         * minh. Bỏ qua trong im lặng là đúng — báo "bỏ qua" cho một tấm sàn mà
         * chính AppFront vừa sinh ra thì mỗi vòng lại thêm một dòng nhiễu.
         *
         * Tấm sàn NGƯỜI DÙNG vẽ trong Pascal thì khác: id của nó là nanoid nên
         * `appFrontIdOf` trả `null`, và nó được nói ra.
         */
        if (appFrontIdOf('room', child.id) === null) {
          collector.skip(
            child.id,
            'sàn',
            'Tấm sàn vẽ trong Pascal chưa có đối tượng tương ứng trong bản vẽ.',
          );
        }
        break;
      }

      /*
       * Trần (và đèn con của nó) sinh ra từ phòng như sàn; lượt về không mang gì
       * mới. Nhưng Pascal gắn đồ `attachTo: 'ceiling'` (đèn, quạt, đầu báo khói…)
       * làm con của chính trần ấy, và bản vẽ chưa có chỗ chứa chúng: phải nói ra,
       * không được rơi im lặng (R3-F2). Trần người dùng vẽ cũng nói ra, như sàn.
       */
      case 'ceiling': {
        if (appFrontIdOf('room', child.id) === null) {
          collector.skip(child.id, 'trần', 'Trần vẽ trong Pascal chưa có đối tượng tương ứng trong bản vẽ.');
        }

        for (const fixture of childrenOf(scene, child)) {
          if (!isGeneratedNodeId(fixture.id)) {
            collector.skip(fixture.id, CEILING_FIXTURE_KIND, CEILING_FIXTURE_REASON);
          }
        }
        break;
      }

      default:
        collector.skip(
          child.id,
          child.type,
          `Loại node "${child.type}" chưa có đối tượng tương ứng trong bản vẽ.`,
        );
    }
  }
};

/* -------------------------------------------------------------------------- */
/* Lượt đổi.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Đổi một cảnh Pascal thành đồ thị không gian.
 *
 * Không đọc store, không chạm mạng, không ném lỗi. Trục định vị, kích thước và
 * ghi chú về rỗng: lượt đi không mang chúng sang nên lượt về không có gì để
 * dựng lại — người gọi giữ bản cũ của ba danh sách ấy nếu cần.
 */
export const toSpatialGraph = (
  scene: PascalScene,
  idBook?: PascalIdBook,
  adoptRoomIds: ReadonlySet<string> = new Set(),
): SpatialGraphResult => {
  const mint = minterFor(idBook);
  const skipped: SkippedEntity[] = [];
  const skip = (id: string, kind: string, reason: string): void => {
    skipped.push({ id, kind, reason });
  };

  const roots = scene.rootNodeIds
    .map((id) => scene.nodes[id])
    .filter((node): node is PascalNode => node !== undefined);

  const buildings = roots.flatMap((root) =>
    root.type === 'building' ? [root] : childrenOf(scene, root).filter(ofType('building')),
  );

  const [buildingNode, ...extraBuildings] = buildings;

  for (const extra of extraBuildings) {
    skip(extra.id, 'công trình', 'Bản đầu chỉ dựng lại một công trình; công trình này bị bỏ qua.');
  }

  const buildingFields = buildingNode === undefined ? {} : fieldsOf(buildingNode);
  const address = readString(buildingFields, 'address');
  const grossFloorAreaM2 = readNumber(buildingFields, 'grossFloorAreaM2');

  const building: Building = {
    ...(buildingNode === undefined
      ? { ...AUTHORED_BY_HAND }
      : reviewOf(buildingNode, buildingNode.id === BUILDING_NODE_ID)),
    name: buildingNode?.name ?? readString(buildingFields, 'name') ?? 'Công trình',
    datumElevationMm: readNumber(buildingFields, 'datumElevationMm') ?? 0,
    ...(address === null ? {} : { address }),
    ...(grossFloorAreaM2 === null ? {} : { grossFloorAreaM2 }),
  };

  const levelNodes =
    buildingNode === undefined
      ? []
      : [...childrenOf(scene, buildingNode).filter(ofType('level'))].sort(
          (left, right) => left.level - right.level,
        );

  const usableLevels = levelNodes.filter((node) => {
    if (isUsable(node.level, node.baseElevation, node.height)) {
      return true;
    }

    skip(node.id, 'tầng', 'Số thứ tự, cao độ hoặc chiều cao tầng không phải một số đo được.');

    return false;
  });

  const elevations = stackedElevationsOf(usableLevels);
  const levels: Level[] = [];
  const collector: Collector = {
    skip,
    walls: [],
    openings: [],
    rooms: [],
    furniture: [],
    axes: [],
    wallIdOfNode: new Map(),
    boundaryNodeIdsOf: new Map(),
    mint,
    adoptRoomIds,
  };

  usableLevels.forEach((node, index) => {
    const fields = fieldsOf(node);
    const knownId = appFrontIdOf('level', node.id);
    const levelId = knownId ?? mint('level', node.id);
    const areaM2 = readNumber(fields, 'areaM2');
    const scale = readNumber(fields, 'scaleMillimetresPerPixel');

    levels.push({
      ...reviewOf(node, knownId !== null),
      id: levelId,
      name: node.name ?? `Tầng ${String(node.level)}`,
      order: node.level,
      elevationMm: millimetresOf(elevations[index] ?? 0),
      heightMm: millimetresOf(node.height),
      ...(areaM2 === null ? {} : { areaM2 }),
      ...(scale === null ? {} : { scaleMillimetresPerPixel: millimetresPerPixel(scale) }),
    });

    collectLevelChildren(scene, node, levelId, collector);
  });

  const rooms = collector.rooms.map((room) => ({
    ...room,
    wallIds: (collector.boundaryNodeIdsOf.get(room.id) ?? [])
      .map((nodeId) => collector.wallIdOfNode.get(nodeId))
      .filter((wallId): wallId is WallId => wallId !== undefined),
  }));

  return {
    graph: {
      building,
      levels,
      walls: collector.walls,
      openings: collector.openings,
      furniture: collector.furniture,
      rooms,
      axes: collector.axes,
      dimensions: [],
      notes: [],
    },
    skipped,
  };
};
