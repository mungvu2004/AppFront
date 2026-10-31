/** Phép tính camera và đầu vào dựng hình của cảnh 3D trang chia sẻ (U17) — thuần, không React. */
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { toBuildFloorInput } from '@/domain/spatial/toBuildFloorInput';
import type { SpatialGraph } from '@/domain/spatial/types';
import { prefersReducedMotion } from '@/lib/motion/reducedMotion';
import type { BuildFloorInput } from '@/lib/three/build/floor';
import type { ViewerSceneFrame } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import { fitViewBox } from './sharedPlanGeometry';

const ROTATE_PER_PX = 0.008;
export const ZOOM_STEP = 1.25;
/** Góc chúc giữ trên mặt sàn và không lật qua đỉnh (0 = nhìn thẳng từ trên xuống). */
const MIN_POLAR = 0.2;
const MAX_POLAR = 1.45;
const DEFAULT_DISTANCE_M = 20;
const DISTANCE_MARGIN = 1.8;

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
    sectionPlane: null,
    selectedEntityIds: [],
    hoveredEntityId: null,
    isolatedEntityIds: null,
    hiddenEntityIds: [],
    reducedMotion: prefersReducedMotion(),
  };
}

export function buildInputs(graph: SpatialGraph): readonly BuildFloorInput[] {
  const spatial = normalizeSpatial(graph);
  return graph.levels.flatMap((level) => {
    const input = toBuildFloorInput(spatial, level.id);
    return input === null ? [] : [input];
  });
}
