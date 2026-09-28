/**
 * AppFront → Pascal: đồ thị không gian thành cảnh `{ nodes, rootNodeIds }`.
 *
 * Bản đầu chuyển **sáu** loại đối tượng — tầng, tường, cửa đi, cửa sổ, phòng,
 * đồ đạc — cộng hai node tổng hợp là khu đất và công trình. Trục định vị, kích
 * thước và ghi chú **không** có loại node tương ứng bên Pascal, nên chúng vào
 * danh sách bỏ qua kèm lý do đọc được, chứ không biến mất im lặng.
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

import type {
  Building,
  Furniture,
  Level,
  Opening,
  Room,
  SpatialGraph,
  Wall,
} from '@/domain/spatial/types';
import { degrees, degreesToRadians, millimetres, millimetresToMetres } from '@/domain/units/types';
import { FURNITURE_KIND_LABELS } from '@/lib/commands/business/shared';

import { BUILDING_NODE_ID, SITE_NODE_ID, toPascalId } from './ids';
import type {
  AppFrontOrigin,
  PascalDoorNode,
  PascalItemNode,
  PascalLevelNode,
  PascalNode,
  PascalNodeId,
  PascalPoint2,
  PascalSiteNode,
  PascalVec3,
  PascalWallNode,
  PascalWindowNode,
  PascalZoneNode,
  SkippedEntity,
  PascalSceneResult,
} from './types';

/** Số điểm tối thiểu để một đường bao là một đa giác. */
const MIN_OUTLINE_POINTS = 3;

/** Khoảng lùi từ mép công trình ra mép khu đất, mét. */
const SITE_MARGIN_M = 5;

/** Nửa cạnh khu đất khi bản vẽ chưa có hình học nào, mét — bằng mặc định của lược đồ Pascal. */
const SITE_FALLBACK_HALF_SIZE_M = 15;

/** Đồ đạc của AppFront chỉ có kích thước mặt bằng; chiều cao chưa được lưu. */
// ponytail: đồ đạc cao 0 m vì đồ thị không lưu chiều cao. Ngày nào
// `Furniture` có `heightMm`, sửa đúng dòng dựng `dimensions` bên dưới.
const FURNITURE_HEIGHT_M = 0;

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

const wallNodeOf = (
  wall: Wall,
  levelNodeId: PascalNodeId,
  children: readonly PascalNodeId[],
): PascalWallNode => ({
  object: 'node',
  id: toPascalId('wall', wall.id),
  type: 'wall',
  parentId: levelNodeId,
  children,
  start: [metresOf(wall.centreline.start.x), metresOf(wall.centreline.start.y)],
  end: [metresOf(wall.centreline.end.x), metresOf(wall.centreline.end.y)],
  thickness: metresOf(wall.thicknessMm),
  height: metresOf(wall.heightMm),
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

/** Cách mở cánh của AppFront, diễn sang ba trường rời của Pascal. */
const doorLeafOf = (
  opening: Opening,
): Pick<PascalDoorNode, 'doorType' | 'hingesSide' | 'leafCount'> => {
  switch (opening.swing) {
    case 'double':
      return { doorType: 'hinged', leafCount: 2, hingesSide: 'left' };
    case 'sliding':
      return { doorType: 'sliding', leafCount: 1, hingesSide: 'left' };
    case 'right':
      return { doorType: 'hinged', leafCount: 1, hingesSide: 'right' };
    default:
      return { doorType: 'hinged', leafCount: 1, hingesSide: 'left' };
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
    : { ...shared, type: 'window' };
};

/* -------------------------------------------------------------------------- */
/* Phòng và đồ đạc.                                                            */
/* -------------------------------------------------------------------------- */

const zoneNodeOf = (room: Room, levelNodeId: PascalNodeId): PascalZoneNode => ({
  object: 'node',
  id: toPascalId('zone', room.id),
  type: 'zone',
  name: room.name,
  parentId: levelNodeId,
  polygon: room.outline.map((point): PascalPoint2 => [metresOf(point.x), metresOf(point.y)]),
  spaceRole: 'room',
  boundaryWallIds: room.wallIds.map((wallId) => toPascalId('wall', wallId)),
  metadata: {
    appfront: originOf(room, { usage: room.usage, areaM2: room.areaM2 }),
  },
});

const itemNodeOf = (furniture: Furniture, levelNodeId: PascalNodeId): PascalItemNode => {
  const label = FURNITURE_KIND_LABELS[furniture.kind];
  const widthM = metresOf(furniture.boundingBox.max.x - furniture.boundingBox.min.x);
  const depthM = metresOf(furniture.boundingBox.max.y - furniture.boundingBox.min.y);

  return {
    object: 'node',
    id: toPascalId('item', furniture.id),
    type: 'item',
    name: label,
    parentId: levelNodeId,
    position: [metresOf(furniture.centre.x), 0, metresOf(furniture.centre.y)],
    rotation: [0, yawOf(furniture.rotationDeg), 0],
    asset: {
      id: `appfront-${furniture.kind}`,
      category: furniture.kind,
      name: label,
      thumbnail: '',
      // `asset://…` là dạng nội bộ mà `AssetUrl` nhận (`schema/asset-url.js`);
      // AppFront chưa có mô hình GLB cho đồ đạc nên đây là chỗ giữ chỗ hợp lệ.
      src: `asset://appfront/${furniture.kind}`,
      dimensions: [widthM, FURNITURE_HEIGHT_M, depthM],
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
    adopt(BUILDING_NODE_ID, node.id);
  }

  const wallNodeIdOf = new Map<string, PascalNodeId>();

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

    const node = wallNodeOf(wall, levelNodeId, childrenFor(toPascalId('wall', wall.id)));

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

    if (levelNodeId === undefined) {
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

    const node = zoneNodeOf(room, levelNodeId);

    nodes[node.id] = node;
    adopt(levelNodeId, node.id);
  }

  for (const furniture of graph.furniture) {
    const levelNodeId = levelNodeIdOf.get(furniture.levelId);

    if (levelNodeId === undefined) {
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

    const node = itemNodeOf(furniture, levelNodeId);

    nodes[node.id] = node;
    adopt(levelNodeId, node.id);
  }

  for (const axis of graph.axes) {
    skipped.push(skip(axis.id, 'trục định vị', 'Pascal chưa có loại node nào cho trục định vị.'));
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

  return { scene: { nodes, rootNodeIds: [SITE_NODE_ID] }, skipped };
};
