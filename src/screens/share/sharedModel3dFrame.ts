/** Phép tính camera và đầu vào dựng hình của cảnh 3D trang chia sẻ (U17) — thuần, không React. */
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { toBuildFloorInput } from '@/domain/spatial/toBuildFloorInput';
import type { Furniture, FurnitureKind, RoomUsage, SpatialGraph } from '@/domain/spatial/types';
import { millimetres } from '@/domain/units/types';
import type { ColorTokenName } from '@/lib/coloring/scales';
import { formatArea } from '@/lib/format/measure';
import { prefersReducedMotion } from '@/lib/motion/reducedMotion';
import type { BuildableFurniture, BuildFloorInput } from '@/lib/three/build/floor';
import type { BuildPartKind } from '@/lib/three/build/scene';
import type { ViewerSceneFrame, ViewerSectionPlaneValue } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import { fitViewBox, roomDisplayName, roomLabelAnchor } from './sharedPlanGeometry';

const ROTATE_PER_PX = 0.008;
export const ZOOM_STEP = 1.25;
/** Góc chúc giữ trên mặt sàn và không lật qua đỉnh (0 = nhìn thẳng từ trên xuống). */
const MIN_POLAR = 0.2;
const MAX_POLAR = 1.45;
const DEFAULT_DISTANCE_M = 20;
const DISTANCE_MARGIN = 1.8;
/** Cắt ngay dưới mặt trần (m): bỏ tấm trần để nhìn thấy sàn và cửa từng phòng, tường gần đủ cao (UX-11). */
const CUT_BELOW_CEILING_M = 0.05;

/** Màu theo loại bộ phận: sàn và ô cửa khác màu tường, người nhận phân biệt được phòng và cửa (UX-11). */
const PART_TOKENS: Readonly<Record<BuildPartKind, ColorTokenName>> = {
  level: '--wall-idle',
  wall: '--wall-idle',
  floorSlab: '--wall-220',
  ceiling: '--wall-idle',
  opening: '--wall-330',
  furniture: '--wall-110',
};

export function tokenOfSharedPart(kind: BuildPartKind): ColorTokenName {
  return PART_TOKENS[kind];
}

/** Màu sàn theo công năng phòng (UX-11): ngủ, khách, bếp, WC, ban công nhìn là phân biệt được. */
const ROOM_USAGE_TOKENS: Readonly<Record<RoomUsage, ColorTokenName | null>> = {
  livingRoom: '--scene-wood',
  bedroom: '--scene-textile',
  kitchen: '--scene-tile',
  bathroom: '--scene-mosaic',
  corridor: '--scene-clay',
  stairwell: '--scene-clay',
  utility: '--scene-tile-grout',
  loggia: '--scene-decking',
  other: null,
};

/** Token sàn theo công năng của từng phòng; phòng không rõ công năng dùng màu sàn chung. */
export function tokenOfSharedEntity(graph: SpatialGraph): (entityId: string, kind: BuildPartKind) => ColorTokenName | null {
  const byRoom = new Map(graph.rooms.map((room) => [room.id as string, ROOM_USAGE_TOKENS[room.usage]]));
  return (entityId, kind) => (kind === 'floorSlab' ? (byRoom.get(entityId) ?? null) : null);
}

/** Diện tích nhỏ hơn mức này là mảnh vụn, không ghi số (giống mặt bằng 2D). */
const MIN_SHOWN_AREA_M2 = 1;
/** Nhãn nổi trên sàn một chút để không chìm vào mặt sàn khi chiếu. */
const LABEL_LIFT_M = 0.1;

export interface SharedRoomLabel {
  readonly id: string;
  readonly name: string;
  /** Diện tích đã định dạng; `null` khi phòng quá nhỏ. Kèm " (tạm)" khi tầng chưa đặt tỷ lệ (UX-23). */
  readonly area: string | null;
  /** Điểm đặt nhãn trong cảnh (mét, Y hướng lên). */
  readonly at: { readonly x: number; readonly y: number; readonly z: number };
}

/** Nhãn tên + diện tích từng phòng của tầng đang xem, đặt ở tâm hộp rỗng lớn nhất của phòng. */
export function roomLabels(graph: SpatialGraph, levelId: string, provisionalArea: boolean): readonly SharedRoomLabel[] {
  const level = graph.levels.find((candidate) => candidate.id === levelId);
  if (level === undefined) return [];
  const floorM = level.elevationMm / 1000 + LABEL_LIFT_M;
  return graph.rooms
    .filter((room) => room.levelId === levelId && room.outline.length >= 3)
    .map((room) => {
      const anchor = roomLabelAnchor(room);
      const area = room.areaM2 >= MIN_SHOWN_AREA_M2 ? formatArea(room.areaM2) : null;
      return {
        id: room.id,
        name: roomDisplayName(room.name, room.usage),
        area: area === null ? null : provisionalArea ? `${area} (tạm)` : area,
        at: { x: anchor.x / 1000, y: floorM, z: anchor.y / 1000 },
      };
    });
}

/** Chiều cao hộp nội thất theo loại (mm) khi đồ không ghi chiều cao riêng (UX-11). */
const FURNITURE_HEIGHT_MM: Readonly<Record<FurnitureKind, number>> = {
  table: 750,
  chair: 450,
  bed: 500,
  wardrobe: 2000,
  kitchenCabinet: 900,
  sanitaryFixture: 450,
  washingMachine: 850,
  shower: 100,
  stair: 0,
  other: 600,
};

/** Hộp nội thất của một tầng: khung đáy xoay theo `rotationDeg`, cao theo loại; bỏ đồ máy gợi ý chưa duyệt và cầu thang. */
export function furnitureBoxes(graph: SpatialGraph, levelId: string): readonly BuildableFurniture[] {
  // Gói chia sẻ cũ có thể thiếu mảng nội thất: coi như không có đồ.
  const pieces = (graph.furniture as readonly Furniture[] | undefined) ?? [];
  return pieces.flatMap((piece) => {
    if (piece.levelId !== levelId || piece.suggested === true) return [];
    const heightMm = piece.heightMm ?? FURNITURE_HEIGHT_MM[piece.kind];
    const halfW = (piece.boundingBox.max.x - piece.boundingBox.min.x) / 2;
    const halfD = (piece.boundingBox.max.y - piece.boundingBox.min.y) / 2;
    if (heightMm <= 0 || halfW <= 0 || halfD <= 0) return [];
    const rad = (piece.rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const corner = (dx: number, dy: number) => ({
      x: millimetres(piece.centre.x + dx * cos - dy * sin),
      y: millimetres(piece.centre.y + dx * sin + dy * cos),
    });
    return [
      {
        id: piece.id,
        outline: [corner(-halfW, -halfD), corner(halfW, -halfD), corner(halfW, halfD), corner(-halfW, halfD)],
        baseMm: piece.liftMm ?? 0,
        heightMm,
      },
    ];
  });
}

/** Mặt cắt ngang dưới trần tầng đang xem; `null` khi không tìm thấy tầng. */
export function ceilingCut(graph: SpatialGraph, levelId: string): ViewerSectionPlaneValue | null {
  const level = graph.levels.find((candidate) => candidate.id === levelId);
  if (level === undefined) return null;
  const cutM = (level.elevationMm + level.heightMm) / 1000 - CUT_BELOW_CEILING_M;
  // Pháp tuyến hướng lên: điểm cao hơn mặt cắt bị bỏ (`isClipped` của viewerSectionPlane).
  return { normalX: 0, normalY: 1, normalZ: 0, constant: -cutM };
}

/** Một bước xoay theo độ dời con trỏ; góc chúc bị kẹp, khoảng cách giữ nguyên. */
export function orbitFrame(frame: ViewerSceneFrame, dx: number, dy: number): ViewerSceneFrame {
  const polarRad = Math.min(MAX_POLAR, Math.max(MIN_POLAR, frame.polarRad - dy * ROTATE_PER_PX));
  return { ...frame, azimuthRad: frame.azimuthRad - dx * ROTATE_PER_PX, polarRad };
}

/** Phóng/thu: `factor` > 1 là lại gần; kẹp trong [0,2 ; 5] lần khoảng cách đầu. */
export function zoomFrame(frame: ViewerSceneFrame, factor: number, homeDistanceM: number): ViewerSceneFrame {
  const distanceM = Math.min(homeDistanceM * 5, Math.max(homeDistanceM * 0.2, frame.distanceM / factor));
  return { ...frame, distanceM };
}

export function homeFrame(graph: SpatialGraph, levelId: string): ViewerSceneFrame {
  const box = fitViewBox(
    graph.walls.filter((wall) => wall.levelId === levelId),
    graph.rooms.filter((room) => room.levelId === levelId),
  );
  const sizeM = box === null ? 0 : Math.max(box.w, box.h) / 1000;
  return {
    azimuthRad: Math.PI / 4,
    polarRad: 0.95,
    distanceM: sizeM > 0 ? sizeM * DISTANCE_MARGIN : DEFAULT_DISTANCE_M,
    isOrthographic: false,
    visibleStoreyIds: [levelId],
    separation: 0,
    sectionPlane: ceilingCut(graph, levelId),
    selectedEntityIds: [],
    hoveredEntityId: null,
    isolatedEntityIds: null,
    hiddenEntityIds: [],
    reducedMotion: prefersReducedMotion(),
  };
}

export function buildInputs(graph: SpatialGraph): readonly BuildFloorInput[] {
  const spatial = normalizeSpatial(graph);
  // Giữ phòng để có sàn (UX-11); tấm trần bị mặt cắt `ceilingCut` bỏ đi nên không che lòng nhà.
  return graph.levels.flatMap((level) => {
    const input = toBuildFloorInput(spatial, level.id);
    if (input === null) return [];
    const furniture = furnitureBoxes(graph, level.id);
    return [furniture.length === 0 ? input : { ...input, furniture }];
  });
}
