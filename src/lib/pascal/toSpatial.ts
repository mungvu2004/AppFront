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
  Room,
  RoomId,
  RoomUsage,
  SpatialGraph,
  SwingDirection,
  Wall,
  WallId,
  WallKind,
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
  /** Id tường phía Pascal → id tường phía AppFront, để phòng nối lại được. */
  readonly wallIdOfNode: Map<PascalNodeId, WallId>;
  /** Id phòng → id tường **phía Pascal** của nó, giải ở lượt cuối. */
  readonly boundaryNodeIdsOf: Map<RoomId, readonly PascalNodeId[]>;
  /** Cấp id cho node Pascal chưa có id AppFront. */
  readonly mint: Minter;
}

const positionIsUsable = (position: PascalVec3): boolean => isUsable(...position);

/** Hộp bao dựng quanh tâm, cho đồ đạc mà Pascal vừa đặt và AppFront chưa biết. */
const boxAround = (centre: Point, dimensions: PascalVec3): BoundingBox => {
  const halfWidth = millimetresOf(dimensions[0]) / 2;
  const halfDepth = millimetresOf(dimensions[2]) / 2;

  return {
    min: { x: centre.x - halfWidth, y: centre.y - halfDepth },
    max: { x: centre.x + halfWidth, y: centre.y + halfDepth },
  };
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
        `Loại node "${child.type}" gắn trên tường chưa có đối tượng tương ứng trong bản vẽ AppFront.`,
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
        });
        break;
      }

      case 'item': {
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

        collector.furniture.push({
          ...reviewOf(child, knownId !== null),
          id: knownId ?? collector.mint('furniture', child.id),
          levelId,
          kind: readOneOf(fields, 'kind', FURNITURE_KINDS) ?? 'other',
          centre,
          boundingBox:
            min !== null && max !== null ? { min, max } : boxAround(centre, child.asset.dimensions),
          rotationDeg: planDegreesOf(child.rotation[1]),
          ...(roomId !== null && isIdOfKind('room', roomId) ? { roomId } : {}),
        });
        break;
      }

      default:
        collector.skip(
          child.id,
          child.type,
          `Loại node "${child.type}" chưa có đối tượng tương ứng trong bản vẽ AppFront.`,
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
export const toSpatialGraph = (scene: PascalScene, idBook?: PascalIdBook): SpatialGraphResult => {
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
    wallIdOfNode: new Map(),
    boundaryNodeIdsOf: new Map(),
    mint,
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
      axes: [],
      dimensions: [],
      notes: [],
    },
    skipped,
  };
};
