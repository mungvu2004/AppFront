import {
  ALIGNMENT_WARNING_THRESHOLD_MM,
  MIN_MATCHED_AXES,
  alignFloors,
  type FloorTransform,
} from '@/domain/axes/alignFloors';
import { detectAxes } from '@/domain/axes/detect';
import type { SpatialGraph } from '@/domain/spatial/types';
import { millimetres } from '@/domain/units/types';

/**
 * Phép biến đổi hiển thị mỗi tầng (báo cáo 2.8.2): chỉ tầng căn được — đủ trục
 * khớp và sai lệch trong ngưỡng — mới có mục; tầng gốc, tầng đã khớp sẵn hay
 * tầng không căn được thì vắng mặt, nghĩa là giữ nguyên toạ độ đã lưu.
 * Không đụng dữ liệu: kết quả chỉ để dựng cảnh 3D.
 */
export const floorDisplayTransformsOf = (graph: SpatialGraph): ReadonlyMap<string, FloorTransform> => {
  const report = alignFloors(
    graph.levels.map((level) => ({
      levelId: level.id,
      name: level.name,
      floorElevationMm: millimetres(level.elevationMm),
      clearHeightMm: millimetres(level.heightMm),
      axes: detectAxes(
        graph.walls
          .filter((wall) => wall.levelId === level.id)
          .map((wall) => ({
            id: wall.id,
            kind: 'loadBearing' as const, // detectAxes không đọc kind
            centreline: wall.centreline,
            thicknessMm: wall.thicknessMm,
            baseElevationMm: level.elevationMm,
            topElevationMm: millimetres(level.elevationMm + wall.heightMm),
          })),
      ),
    })),
  );
  const transforms = new Map<string, FloorTransform>();

  for (const floor of report.floors) {
    const { rotationDeg, translationMm } = floor.transform;
    const isIdentity = rotationDeg === 0 && translationMm.x === 0 && translationMm.y === 0;

    if (
      !floor.isBase &&
      !isIdentity &&
      floor.matchedAxisCount >= MIN_MATCHED_AXES &&
      floor.maxResidualMm <= ALIGNMENT_WARNING_THRESHOLD_MM
    ) {
      transforms.set(floor.levelId, floor.transform);
    }
  }

  return transforms;
};
