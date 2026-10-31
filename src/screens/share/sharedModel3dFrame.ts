/** Phép tính camera và đầu vào dựng hình của cảnh 3D trang chia sẻ (U17) — thuần, không React. */
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { toBuildFloorInput } from '@/domain/spatial/toBuildFloorInput';
import type { SpatialGraph } from '@/domain/spatial/types';
import type { ColorTokenName } from '@/lib/coloring/scales';
import { prefersReducedMotion } from '@/lib/motion/reducedMotion';
import type { BuildFloorInput } from '@/lib/three/build/floor';
import type { BuildPartKind } from '@/lib/three/build/scene';
import type { ViewerSceneFrame, ViewerSectionPlaneValue } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import { fitViewBox } from './sharedPlanGeometry';

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
    return input === null ? [] : [input];
  });
}
