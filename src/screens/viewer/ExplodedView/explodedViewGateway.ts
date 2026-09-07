/**
 * Cổng dữ liệu riêng của màn `ExplodedView` — hai thứ vỏ chung KHÔNG có.
 *
 * Cùng khuôn `viewerShellGateway.ts`: một bản kê khả năng còn thiếu, một
 * `interface` khai ở hợp đồng (`explodedViewTypes.ts`), một factory dựng cổng
 * thật và một factory dựng cổng có dữ liệu cho story và bài kiểm (R-73). Khuôn
 * được CHÉP LẠI chứ không nhập chéo từ thư mục màn khác (R-68).
 *
 * ## Vỏ đã có gì, và vì sao vẫn cần cổng này
 *
 * `ViewerShellData` mang tầng, cao độ, chiều cao, số phòng và diện tích TỔNG của
 * cả toà nhà. Nó KHÔNG mang hai thứ màn này sống bằng:
 *
 * 1. **Diện tích TỪNG tầng.** `ViewerStorey` không có trường diện tích và
 *    `Level.areaM2` là tuỳ chọn mà bộ mẫu để trống, nên {@link floorAreasOf} gom
 *    `Room.outline` theo `levelId` rồi gọi `totalArea()` của
 *    `@/domain/rooms/area` — ĐÚNG hàm `shellDataOf` gọi cho tổng cả toà. Không
 *    tự tính đa giác lần thứ hai (R-61), và cộng milimét vuông rồi làm tròn MỘT
 *    lần ở cuối chứ không cộng những `areaM2` đã làm tròn sẵn.
 * 2. **Báo cáo thẳng hàng.** {@link alignmentOf} dựng `FloorPlan[]` rồi gọi
 *    `alignFloors()` của `@/domain/axes/alignFloors`.
 *
 * ## `SpatialGraph.axes` KHÔNG dùng được cho `alignFloors`
 *
 * `alignFloors` cần `DetectedAxis[]` — trục dò tự động theo toạ độ, mang
 * `coordinateMm`/`startMm`/`endMm`/`spreadMm`/`wallIds`. `SpatialGraph.axes` là
 * `Axis[]`: trục ĐÃ GẮN NHÃN người (`id`, `label`, `line`, `ReviewMetadata`).
 * Hai kiểu không gán thẳng cho nhau và không có cầu nối nào trong `src/domain`.
 * Nên đường đúng — và đường duy nhất — là lọc `walls` theo `levelId` rồi gọi
 * `detectAxes(...)`, đúng như ghi chú khảo sát hình học mục (c) Q1 nói.
 *
 * Hai họ trục vì thế có hai việc khác nhau ở màn này, và không họ nào làm được
 * việc của họ kia:
 *
 * - `DetectedAxis` (qua `detectAxes`) trả lời "hai tầng có thẳng nhau không" —
 *   đầu vào của `alignFloors`, và nguồn của `FloorIssue`.
 * - `Axis` (đọc thẳng từ đồ thị, qua {@link axisProbesOf}) trả lời "đường này
 *   TÊN gì và đứng ở đâu trên khung nhìn" — `ExplodedAlignmentPath.id` là mã
 *   trục người đọc được (`A-…`), thứ mà một `DetectedAxis` không mang.
 *
 * ## Một lệch ĐỀU tuyệt đối không sinh cảnh báo, và đó là đúng
 *
 * `alignFloors` được phép tịnh tiến tự do, nên một tầng bị dời cả khối sẽ được
 * kéo về đúng chỗ và phần dư bằng 0. Cái nó bắt là lệch TƯƠNG ĐỐI: một trục xê
 * dịch so với các trục còn lại của chính tầng đó. Cổng này không sửa hành vi ấy
 * và không bù thêm một phép so sánh thứ hai.
 */

import {
  alignFloors,
  type FloorAlignmentReport,
  type FloorPlan,
} from '@/domain/axes/alignFloors';
import { detectAxes } from '@/domain/axes/detect';
import {
  findVerticalCores,
  type CoreLevel,
  type CoreRoom,
} from '@/domain/axes/verticalCores';
import { totalArea } from '@/domain/rooms/area';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Axis, Level, Point, Room, Wall as GraphWall } from '@/domain/spatial/types';
import type { Wall as SolidWall } from '@/domain/walls/types';
import type { PointMm } from '@/domain/units/compare';
import { millimetres } from '@/domain/units/types';
import { toSolidWall } from '@/lib/commands/business/shared';
import { footprintOf, storeysOf, VIEWER_FIXTURE_SPATIAL } from '@/screens/viewer/ViewerShell';
// `ViewerFootprintMm` không được `ViewerShell/index.ts` tái xuất, nên nó nhập
// thẳng từ file con — cùng ngoại lệ mà hợp đồng đã ghi cho `MIN_SEPARATION`.
import type { ViewerFootprintMm } from '@/screens/viewer/ViewerShell/viewerShellGateway';

import type {
  AlignmentReportLike,
  ExplodedCoreProbe,
  ExplodedFloorProbe,
  ExplodedViewGateway,
} from './explodedViewTypes';

/* -------------------------------------------------------------------------- */
/* Bản kê khả năng còn thiếu.                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Những việc màn CẦN mà tầng dữ liệu chưa có đường.
 *
 * Ghi ra để người đọc sau không phải dò lại, và để không ai lấp bằng một hàm tự
 * chế (R-69). Mỗi dòng là một tên hàm còn thiếu cộng lý do.
 */
export const EXPLODED_MISSING_CAPABILITIES: readonly string[] = Object.freeze([
  'readVerticalContinuity — không có trường nào trong src/domain nối một phần tử (lõi thang, hộp kỹ thuật) xuyên tầng; Room/Wall/Furniture đều mang levelId riêng. Thứ duy nhất so được giữa hai tầng là TRỤC, nên chỉ báo thẳng hàng của màn chạy trên trục và caption nói rõ nó đang nói về trục nào.',
  'readDetectedAxisLabels — không có cầu nối Axis (đã gắn nhãn người) ↔ DetectedAxis (thô, để so khớp hình học); màn phải đọc hai họ trục từ hai chỗ, xem docblock đầu file.',
]);

/* -------------------------------------------------------------------------- */
/* Trục của đồ thị, đã đặt lên khung nhìn.                                     */
/* -------------------------------------------------------------------------- */

/**
 * Một trục của đồ thị, rút gọn về đúng những gì một đường dẫn dọc cần.
 *
 * `xFraction` là vị trí NGANG trong khung nhìn, không phải toạ độ bản vẽ: view
 * chỉ biết một khung hình rộng 100%, nên hook phải quy toạ độ milimét về tỉ lệ
 * trước khi đưa xuống (A15).
 */
export interface ExplodedAxisProbe {
  /** Mã trục của đồ thị, ví dụ `A-03`. */
  readonly id: string;
  /** Tầng trục thuộc về — cùng khoá mà `FloorIssue.levelId` dùng. */
  readonly levelId: string;
  /** Vị trí ngang trong khung nhìn, tỉ lệ [0, 1] từ trái sang. */
  readonly xFraction: number;
}

/** Không có trục nào. */
const NO_AXES: readonly ExplodedAxisProbe[] = Object.freeze([]);

/** Không có lõi nào. */
const NO_CORES: readonly ExplodedCoreProbe[] = Object.freeze([]);

/** Không có tầng nào. */
const NO_PROBES: readonly ExplodedFloorProbe[] = Object.freeze([]);

/** Giữa khung nhìn — chỗ một đường dẫn đứng khi mặt bằng chưa có bề rộng nào. */
const CENTRE_FRACTION = 0.5;

/**
 * Toạ độ bản vẽ thành `PointMm` có nhãn.
 *
 * `Point` của `spatial/types.ts` và `PointMm` của `units/compare.ts` tồn tại
 * song song trong repo; `viewerShellFixture.ts` bắc cầu bằng đúng hàm này. Chép
 * lại cầu ấy thay vì nhập chéo (R-68), và KHÔNG ép kiểu bằng `as`:
 * `millimetres()` là hàm gắn nhãn chính thức của `src/domain/units`.
 */
function toPointMm(corner: Point): PointMm {
  return { x: millimetres(corner.x), y: millimetres(corner.y) };
}

/** Vị trí của `value` trong đoạn `[min, max]`, kẹp về [0, 1]. */
function fractionWithin(value: number, min: number, max: number): number {
  const span = max - min;

  if (!Number.isFinite(span) || span <= 0) {
    return CENTRE_FRACTION;
  }

  return Math.min(1, Math.max(0, (value - min) / span));
}

/**
 * Trục đứng ở đâu trên khung nhìn.
 *
 * Một trục nằm trên MỘT toạ độ và trải dài theo toạ độ còn lại, nên vị trí của
 * nó là toạ độ cố định ấy: trục dọc đứng ở `x`, trục ngang đứng ở `y`. Cả hai
 * được quy về tỉ lệ trong hộp bao mặt bằng theo đúng chiều của chính nó, nên hai
 * trục khác nhau không bao giờ rơi vào cùng một chỗ chỉ vì chúng cùng phương.
 */
function axisFractionOf(axis: Axis, footprint: ViewerFootprintMm): number {
  if (axis.direction === 'vertical') {
    return fractionWithin(axis.line.start.x, footprint.minXMm, footprint.maxXMm);
  }

  return fractionWithin(axis.line.start.y, footprint.minYMm, footprint.maxYMm);
}

/**
 * Mọi lõi thẳng đứng của đồ thị, đã đặt lên khung nhìn.
 *
 * Đọc phòng và tầng ra dạng thuần rồi giao cho `findVerticalCores` —
 * `src/domain/axes/verticalCores.ts` giữ toàn bộ luật (công năng nào liên tục
 * được, chồng mặt bằng thế nào là cùng một lõi, lệch bao nhiêu thì cảnh báo), và
 * ngưỡng nó dùng là `ALIGNMENT_WARNING_THRESHOLD_MM` của `alignFloors`, không
 * phải một ngưỡng thứ hai. Cổng này chỉ đổi toạ độ mặt bằng thành tỉ lệ khung
 * nhìn; nó không quyết định gì về nghiệp vụ (R-61).
 */
export function coreProbesOf(spatial: NormalizedSpatial | null): readonly ExplodedCoreProbe[] {
  if (spatial === null) {
    return NO_CORES;
  }

  const rooms: CoreRoom[] = [];
  for (const id of spatial.byKind.room) {
    const entity = spatial.byId[id];
    if (entity === undefined || !('outline' in entity) || !('usage' in entity)) {
      continue;
    }
    const room = entity as Room;
    rooms.push({
      id: room.id,
      levelId: room.levelId,
      name: room.name,
      usage: room.usage,
      outline: room.outline,
    });
  }

  const levels: CoreLevel[] = [];
  for (const id of spatial.byKind.level) {
    const entity = spatial.byId[id];
    if (entity === undefined || !('order' in entity) || !('elevationMm' in entity)) {
      continue;
    }
    const level = entity as Level;
    levels.push({ levelId: level.id, name: level.name, order: level.order });
  }

  if (rooms.length === 0 || levels.length === 0) {
    return NO_CORES;
  }

  const footprint = footprintOf(spatial);

  return findVerticalCores(rooms, levels).cores.map((core): ExplodedCoreProbe => {
    // Câu của lõi lệch nhất trong chuỗi: một đường dẫn chỉ vẽ được MỘT caption,
    // và cặp tầng lệch nhất là cặp người soát phải nhìn trước.
    const worst = core.issues.reduce<(typeof core.issues)[number] | null>(
      (worstSoFar, issue) =>
        worstSoFar === null || issue.amountMm > worstSoFar.amountMm ? issue : worstSoFar,
      null,
    );

    return {
      id: core.id,
      xFraction: fractionWithin(core.centroid.x, footprint.minXMm, footprint.maxXMm),
      maxOffsetMm: core.maxOffsetMm,
      caption: worst?.message ?? null,
    };
  });
}

/** Mọi trục của đồ thị, đã đặt lên khung nhìn. */
export function axisProbesOf(spatial: NormalizedSpatial | null): readonly ExplodedAxisProbe[] {
  if (spatial === null) {
    return NO_AXES;
  }

  const footprint = footprintOf(spatial);
  const probes: ExplodedAxisProbe[] = [];

  for (const id of spatial.byKind.axis) {
    const entity = spatial.byId[id];

    // Đọc theo HÌNH DẠNG, không qua `isEntityOfKind`: mã của bộ mẫu (`A-01`) có
    // thân ngắn hơn mười ký tự nên `isValidId` từ chối nó, và một danh sách trục
    // rỗng là thứ người dùng nhìn thấy. `storeysOf` của vỏ đọc theo cùng cách vì
    // cùng lý do.
    if (entity === undefined || !('line' in entity) || !('direction' in entity)) {
      continue;
    }

    const axis = entity as Axis;

    probes.push({
      id: axis.id,
      levelId: axis.levelId,
      xFraction: axisFractionOf(axis, footprint),
    });
  }

  return probes;
}

/* -------------------------------------------------------------------------- */
/* Tầng, kèm cờ đã duyệt.                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Những tầng của đồ thị, đã sắp từ dưới lên, kèm cờ người duyệt.
 *
 * `storeysOf` của vỏ đã trả `id`/`name`/`order`/`elevationMm`/`heightMm`; thứ nó
 * bỏ lại là `reviewed`, và A5 buộc màn phải phân biệt "AI đoán" với "người đã
 * xác nhận" nên cờ ấy không được suy ra từ cái gì khác.
 */
export function floorProbesOf(spatial: NormalizedSpatial | null): readonly ExplodedFloorProbe[] {
  if (spatial === null) {
    return NO_PROBES;
  }

  return storeysOf(spatial).map((storey): ExplodedFloorProbe => {
    const entity = spatial.byId[storey.id];
    const reviewed = entity !== undefined && 'reviewed' in entity && (entity as Level).reviewed;

    return {
      id: storey.id,
      name: storey.name,
      order: storey.order,
      elevationMm: storey.elevationMm,
      heightMm: storey.heightMm,
      reviewed,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Diện tích từng tầng.                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Diện tích từng tầng, m², khoá theo `levelId`.
 *
 * Tầng không có phòng nào KHÔNG có mục trong bảng — đó là cách hook phân biệt
 * "tầng chưa có phòng" (thẻ hiện `—`) với "tầng có phòng nhưng diện tích bằng 0",
 * và một `0` mặc định sẽ xoá mất phân biệt ấy.
 */
export function floorAreasOf(spatial: NormalizedSpatial | null): ReadonlyMap<string, number> {
  const areas = new Map<string, number>();

  if (spatial === null) {
    return areas;
  }

  const outlinesByLevel = new Map<string, (readonly PointMm[])[]>();

  for (const id of spatial.byKind.room) {
    const entity = spatial.byId[id];

    if (entity === undefined || !('outline' in entity) || !('levelId' in entity)) {
      continue;
    }

    const room = entity as Room;
    const bucket = outlinesByLevel.get(room.levelId);
    const outline = room.outline.map(toPointMm);

    if (bucket === undefined) {
      outlinesByLevel.set(room.levelId, [outline]);
    } else {
      bucket.push(outline);
    }
  }

  for (const [levelId, outlines] of outlinesByLevel) {
    // Một lượt `totalArea` cho mỗi tầng: nó cộng milimét vuông rồi làm tròn MỘT
    // lần, nên tổng của bốn tầng không lệch khỏi tổng cả toà mà vỏ in ra.
    areas.set(levelId, totalArea(outlines));
  }

  return areas;
}

/* -------------------------------------------------------------------------- */
/* Báo cáo thẳng hàng.                                                         */
/* -------------------------------------------------------------------------- */

/** Ít hơn số này thì không có gì để so — một tầng không lệch với chính nó. */
const MIN_COMPARABLE_FLOORS = 2;

/**
 * Tường hình học của một tầng, đúng vựng mà `detectAxes` đọc.
 *
 * `Wall` của `spatial/types.ts` và `Wall` của `walls/types.ts` là hai kiểu khác
 * nhau — bản hình học mang `baseElevationMm`/`topElevationMm` tuyệt đối thay vì
 * `heightMm` so với sàn tầng. `toSolidWall` là cầu nối ĐÃ CÓ, cùng hàm mà tầng
 * lệnh S-07 và màn quản trị trục dùng; dựng bản thứ hai của phép đổi ấy là dựng
 * một chỗ để hai bản lệch nhau (R-61).
 */
function solidWallsOnLevel(spatial: NormalizedSpatial, level: Level): readonly SolidWall[] {
  const walls: SolidWall[] = [];

  for (const id of spatial.byKind.wall) {
    const entity = spatial.byId[id];

    if (entity === undefined || !('centreline' in entity) || !('levelId' in entity)) {
      continue;
    }

    const wall = entity as GraphWall;

    if (wall.levelId === level.id) {
      walls.push(toSolidWall(wall, level));
    }
  }

  return walls;
}

/** Tầng của đồ thị dưới dạng thực thể, hoặc `undefined` khi chỉ mục không chỉ tới nó. */
function levelEntityOf(spatial: NormalizedSpatial, levelId: string): Level | undefined {
  const entity = spatial.byId[levelId];

  if (entity === undefined || !('order' in entity) || !('elevationMm' in entity)) {
    return undefined;
  }

  return entity as Level;
}

/**
 * Báo cáo thẳng hàng của cả chồng tầng, hoặc `null`.
 *
 * `null` có đúng hai nghĩa và cả hai đều là "không có gì để nói", không phải một
 * sự cố: dưới hai tầng thì không có cặp nào để so, và một đồ thị mà `detectAxes`
 * hay `alignFloors` từ chối đọc thì không có báo cáo nào để hiện. Trường hợp thứ
 * hai đi qua `catch` cùng lý do `useViewer3D` bắt `toBuildFloorInput`: một mô
 * hình không dò được trục là một lượt dò đã sai, không phải một mã lỗi để in ra.
 */
export function alignmentOf(spatial: NormalizedSpatial | null): AlignmentReportLike | null {
  if (spatial === null) {
    return null;
  }

  const storeys = storeysOf(spatial);

  if (storeys.length < MIN_COMPARABLE_FLOORS) {
    return null;
  }

  try {
    const plans: FloorPlan[] = [];

    for (const storey of storeys) {
      const level = levelEntityOf(spatial, storey.id);

      if (level === undefined) {
        continue;
      }

      plans.push({
        levelId: storey.id,
        name: storey.name,
        floorElevationMm: millimetres(storey.elevationMm),
        clearHeightMm: millimetres(storey.heightMm),
        // `SpatialGraph.axes` là `Axis[]` đã gắn nhãn người, KHÔNG phải
        // `DetectedAxis[]` — xem docblock đầu file.
        axes: detectAxes(solidWallsOnLevel(spatial, level)),
      });
    }

    if (plans.length < MIN_COMPARABLE_FLOORS) {
      return null;
    }

    const report: FloorAlignmentReport = alignFloors(plans);

    return report;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Cổng thật.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Cổng đọc kho.
 *
 * `readSpatial` là tham số chứ không phải một lượt `useStore` bên trong: một cổng
 * đọc kho từ trong ruột sẽ không kiểm được nếu không dựng cả `zustand`, và hook
 * là nơi đã có `useStore` sẵn. Cùng chữ ký `createViewerShellGateway`.
 */
export function createExplodedViewGateway(
  readSpatial: () => NormalizedSpatial | null,
): ExplodedViewGateway {
  return {
    readFloorAreas: (): ReadonlyMap<string, number> => floorAreasOf(readSpatial()),
    readVerticalCores: (): readonly ExplodedCoreProbe[] => coreProbesOf(readSpatial()),
    readAlignment: (): AlignmentReportLike | null => alignmentOf(readSpatial()),
  };
}

/* -------------------------------------------------------------------------- */
/* Cổng có dữ liệu — story và bài kiểm.                                        */
/* -------------------------------------------------------------------------- */

/** Cổng giả — cùng bộ mẫu của vỏ, không bảng dữ liệu thứ hai (A14). */
export function createExplodedViewFixtureGateway(
  spatial: NormalizedSpatial | null = VIEWER_FIXTURE_SPATIAL,
): ExplodedViewGateway {
  return {
    readFloorAreas: (): ReadonlyMap<string, number> => floorAreasOf(spatial),
    readVerticalCores: (): readonly ExplodedCoreProbe[] => coreProbesOf(spatial),
    readAlignment: (): AlignmentReportLike | null => alignmentOf(spatial),
  };
}
