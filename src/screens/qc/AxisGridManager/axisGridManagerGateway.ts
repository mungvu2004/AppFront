/**
 * Cổng dữ liệu và tầng lệnh của màn S-15 "Quản lý trục và gốc toạ độ" — mọi
 * lời gọi ra khỏi màn đi qua đây.
 *
 * Cùng khuôn `wallLayerReviewGateway.ts` (tiền lệ được điều phối viên chỉ
 * định): một danh sách khả năng, một bản kê nợ endpoint, một `interface` cho
 * hình dạng cổng, một factory dựng cổng thật và một factory dựng cổng có dữ
 * liệu cho test và story (R-73).
 *
 * ## Lệnh trục dựng TRONG cổng — quyết định Q1 của điều phối viên
 *
 * `src/lib/commands/business/` chỉ có `wallCommands` · `openingCommands` ·
 * `roomFloorCommands`; KHÔNG có lệnh trục nào, và R-68 cấm thêm file vào
 * `src/lib` trong lúc dựng màn. Lệnh trục vì vậy dựng tại đây bằng nguyên thuỷ
 * công khai `createCommand` + `changeForAdd`/`changeForRemove`/`changeForUpdate`,
 * đúng tiền lệ `wall.approve` (`wallLayerReviewGateway.ts:482-508`). Hợp lệ vì
 * `CommandType` là `string` MỞ và `validateCommands` chỉ đòi `command.type`
 * khác rỗng, không so với một bảng cho phép; thứ DUY NHẤT bị so bảng là
 * `change.kind`, mà `'axis'` đã là một `EntityKind` có sẵn
 * (`src/domain/spatial/ids.ts:15-23`).
 *
 * Lệnh tự hoàn tác được: `changeForUpdate` mang ĐỦ ảnh chụp `before`/`after`
 * (không phải diff), và `invertCommand` chỉ hoán đổi hai ảnh đó — không một
 * dòng nào phải viết thêm cho `Ctrl+Z`.
 *
 * ## Căn tự động = ĐÚNG MỘT lệnh (yêu cầu nghiệm thu)
 *
 * {@link buildAutoAlignCommand} nhận kết quả `alignFloors` (M-11) — màn không
 * tự tính lệch — rồi gom phép biến đổi của MỌI tầng được chọn vào ĐÚNG MỘT
 * `Command`. `dispatch` sinh đúng một `UndoEntry` và gọi `history.push` đúng
 * một lần cho toàn bộ `command.changes` (`dispatch.ts:605-626`), nên số bước
 * lịch sử tăng đúng 1 và một lần `Ctrl+Z` trả về nguyên trạng.
 *
 * ## Gốc toạ độ KHÔNG phải một lệnh — quyết định đã sửa của điều phối viên
 *
 * Quyết định Q1 ban đầu ghi "bốn lệnh trục", kể cả `axis.setOrigin`. Điều phối
 * viên đã tự sửa sau khảo sát: **không có chỗ nào ghi gốc toạ độ**.
 * `NormalizedSpatial` không có trường `origin`, `Level` cũng không
 * (`spatial/types.ts:104-117`), `SpatialPatch` chỉ phủ bảy `EntityKind`, và
 * JSDoc của chính `src/domain/axes/label.ts:22-26` nói *"the origin never
 * changes the reference"* — `setOrigin` KHÔNG dời trục nào, nên `changeForUpdate`
 * không có cặp ảnh chụp thật nào để mang.
 *
 * Vì vậy {@link AXIS_COMMAND_TYPES} còn BA lệnh, và giao trục neo là TRẠNG THÁI
 * MÀN của hook, ghép vào lưới bằng `buildAxisGrid(axes, setOrigin(point))`.
 * A8 không bị phạm: A8 phủ các THAY ĐỔI MÔ HÌNH, còn chọn giao trục neo là
 * khung đọc — cùng loại với `ghostEnabled` và `isCollapsed`, không ai mong
 * `Ctrl+Z` hoàn tác chúng.
 *
 * ## Hai việc chưa có đường
 *
 * - `persistAxisGrid` — **NOT FOUND**. Không endpoint nào của `src/api` biết
 *   tới trục: `ENDPOINTS` chỉ có `auth`/`drawings`/`featureFlags`/`floors`/
 *   `projects`/`quality`/`spatial`, và thân yêu cầu gần nhất —
 *   `PatchSpatialFloorInput.body` là `Partial<FloorWriteBody>` — chỉ mang
 *   `name`/`order`/`elevationMm`/`heightMm`/`areaM2`/`drawings`.
 * - `persistAxisOrigin` — **NOT FOUND**, và đây là hệ quả trực tiếp của mục
 *   trên: lựa chọn giao trục neo không sống qua được một lần tải trang. Cổng
 *   thật trả nhánh `supported: false` CÓ KIỂU để màn NÓI RA sự thật đó bằng
 *   chính nhãn của nó, thay vì im lặng hoặc bịa một lượt lưu đã xong.
 */

import {
  axisLine,
  detectAxes,
  horizontalAxes,
  verticalAxes,
  type DetectedAxis,
} from '@/domain/axes/detect';
import {
  applyFloorTransform,
  transformAxis,
  type FloorAlignment,
  type FloorAlignmentReport,
  type FloorPlan,
  type FloorTransform,
} from '@/domain/axes/alignFloors';
import { labelAxes, PROJECT_ORIGIN, type LabelledAxis } from '@/domain/axes/label';
import { compareNearly, type PointMm } from '@/domain/units/compare';
import { millimetres, type Millimetres } from '@/domain/units/types';
import type { Pixels, Scale } from '@/domain/units/scale';
import { createId } from '@/domain/spatial/ids';
import { isEntityOfKind, normalizeSpatial, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type {
  Axis,
  AxisId,
  Building,
  Level,
  LevelId,
  Segment,
  Wall,
} from '@/domain/spatial/types';
import { toPointMm, toSolidWall } from '@/lib/commands/business/shared';
import {
  changeForAdd,
  changeForRemove,
  changeForUpdate,
  createCommand,
} from '@/lib/commands/createCommand';
import type { Command, EntityChange } from '@/lib/commands/types';
import {
  createIncrementalRuleRunner,
  dispatch,
  type DispatchDeps,
  type DispatchResult,
  type SpatialPort,
} from '@/lib/commands/dispatch';
import {
  createHistoryStack,
  NO_SELECTION,
  type HistoryStack,
  type SelectionSnapshot,
} from '@/lib/commands/history';
import { formatLength } from '@/lib/format/measure';
import { formatNumber } from '@/lib/format/number';
import { createUndoTicket, UNDO_WINDOW_MS, type UndoTicket } from '@/lib/mutations/undoTicket';
import { commit } from '@/store/commit';
import { useStore } from '@/store';

import {
  AXIS_GRID_FIXTURE_FLOOR1,
  AXIS_GRID_FIXTURE_FLOORS,
  AXIS_GRID_FIXTURE_SCALE,
} from './axisGridFixture';
import type { AxisGridDirection, AxisGridPixelRect, AxisSpacingViolation } from './axisGridTypes';

/* -------------------------------------------------------------------------- */
/* Khả năng — những gì màn hỏi thế giới bên ngoài.                             */
/* -------------------------------------------------------------------------- */

/** Tên máy đọc của từng việc màn cần. Mỗi việc chưa làm được có một dòng nợ. */
export const AXIS_GRID_CAPABILITIES = [
  'readAxisLayer',
  'readAxisGraph',
  'writeAxisGraph',
  'persistAxisGrid',
  'persistAxisOrigin',
] as const;

export type AxisGridCapability = (typeof AXIS_GRID_CAPABILITIES)[number];

/** Việc trong danh sách trên mà bản cài đặt THẬT chưa làm được. Chỉ được ngắn đi. */
export const AXIS_GRID_MISSING_CAPABILITIES = ['persistAxisGrid', 'persistAxisOrigin'] as const;

export type AxisGridMissingCapability = (typeof AXIS_GRID_MISSING_CAPABILITIES)[number];

/** Endpoint còn thiếu của từng khả năng, viết nguyên văn cho người nối dây sau. */
export const AXIS_GRID_MISSING_ENDPOINTS: Readonly<
  Record<AxisGridMissingCapability, string>
> = {
  persistAxisGrid:
    'Không endpoint nào của src/api biết tới trục: ENDPOINTS chỉ có auth/drawings/featureFlags/floors/projects/quality/spatial (src/api/endpoints.ts:18-82), và PatchSpatialFloorInput.body là Partial<FloorWriteBody> (src/api/client.ts:87-92,144-148) chỉ mang name/order/elevationMm/heightMm/areaM2/drawings — không có chỗ cho mảng trục hay gốc toạ độ',
  persistAxisOrigin:
    'Gốc toạ độ không có chỗ ghi ở BẤT KỲ tầng nào: NormalizedSpatial không có trường origin, Level (src/domain/spatial/types.ts:104-117) cũng không, SpatialPatch chỉ phủ bảy EntityKind, và AxisOrigin của src/domain/axes/label.ts:72-79 là một giá trị thuần không entity nào mang. Giao trục neo vì vậy chỉ sống trong phiên làm việc hiện tại và mất sau một lần tải lại trang',
};

/** Một khả năng chưa tồn tại. `supported: false` là câu trả lời thật, không phải lỗi. */
export interface AxisGridUnsupported {
  readonly supported: false;
  readonly capability: AxisGridMissingCapability;
  /** Lấy nguyên từ {@link AXIS_GRID_MISSING_ENDPOINTS}. */
  readonly missing: string;
}

export interface AxisGridSupported<TValue> {
  readonly supported: true;
  readonly value: TValue;
}

export type AxisGridCapabilityResult<TValue> = AxisGridSupported<TValue> | AxisGridUnsupported;

/** Dựng nhánh "chưa có đường làm việc này" — một chỗ duy nhất ghép tên với nợ. */
export function unsupported(capability: AxisGridMissingCapability): AxisGridUnsupported {
  return {
    supported: false,
    capability,
    missing: AXIS_GRID_MISSING_ENDPOINTS[capability],
  };
}

/* -------------------------------------------------------------------------- */
/* Khoảng cách tối thiểu giữa hai trục — quyết định Q3.1.                      */
/* -------------------------------------------------------------------------- */

/**
 * Hai trục gần nhau hơn mức này thì bản vẽ không đọc được nữa — luật sản phẩm
 * của màn S-15, không phải ngưỡng hình học của `src/domain`.
 *
 * Cố tình KHÔNG tái dùng `AXIS_ALIGNMENT_THRESHOLD_MM` (`detect.ts:46`): hằng
 * đó là ngưỡng GOM tường thành một trục — nó chạy TRƯỚC khi trục tồn tại — còn
 * hằng này so hai trục ĐÃ có nhãn với nhau. Hai việc khác hẳn, dùng lẫn là sai
 * nghĩa (`.orca-notes/S15-T1-axes.contract.md` mục A và G.1).
 *
 * Chuyển xuống `src/domain/axes` khi nào tầng lô-gic có module lệnh trục thật;
 * lúc dựng màn thì R-68 cấm thêm file vào đó, và đặt hằng cạnh chính hàm kiểm
 * tra là cách duy nhất không phạm luật — cùng khuôn `MIN_WALL_LAYER_ZOOM` /
 * `ZOOM_STEP` của `wallLayerReviewGateway.ts`.
 */
export const MIN_AXIS_SPACING_MM: Millimetres = millimetres(100);

/* -------------------------------------------------------------------------- */
/* Hộp bao N điểm — bản thứ tư có chủ ý, quyết định Q3.3.                      */
/* -------------------------------------------------------------------------- */

/** Hộp bao đo bằng milimét công trình. */
export interface AxisGridBoundsMm {
  readonly x: Millimetres;
  readonly y: Millimetres;
  readonly width: Millimetres;
  readonly height: Millimetres;
}

/**
 * Hộp bao của một chuỗi điểm.
 *
 * Không gọi lại được: `src/domain/spatial/types.ts:37-40` chỉ khai KIỂU
 * `BoundingBox`, và hai hàm dựng hộp có sẵn (`boxAround`, `marqueeBox`) đều
 * nhận HAI điểm, không phải N. Đây là bản thứ tư của cùng một phép gấp —
 * `WallLayerReview`, `ObjectLayerReview` và `DimensionOcrReview` mỗi màn một
 * bản, mỗi bản có JSDoc biện minh y hệt — và điều phối viên đã chốt đi theo
 * đúng tiền lệ đó (Q3.3) thay vì nhập chéo từ cổng của màn khác: màn không phụ
 * thuộc màn.
 *
 * Phép gấp bằng so sánh, không gọi tới đối tượng toán học toàn cục.
 */
export function boundsOfPoints(points: readonly PointMm[]): AxisGridBoundsMm | null {
  const first = points[0];

  if (first === undefined) {
    return null;
  }

  let left = first.x;
  let right = first.x;
  let top = first.y;
  let bottom = first.y;

  for (const point of points) {
    left = point.x < left ? point.x : left;
    right = point.x > right ? point.x : right;
    top = point.y < top ? point.y : top;
    bottom = point.y > bottom ? point.y : bottom;
  }

  return {
    x: left,
    y: top,
    width: millimetres(right - left),
    height: millimetres(bottom - top),
  };
}

/** Bốn đỉnh của một hộp bao, theo chiều kim đồng hồ — đường bao bóng ma tầng dưới. */
export function outlineOfBounds(bounds: AxisGridBoundsMm): readonly PointMm[] {
  const right = millimetres(bounds.x + bounds.width);
  const bottom = millimetres(bounds.y + bounds.height);

  return [
    { x: bounds.x, y: bounds.y },
    { x: right, y: bounds.y },
    { x: right, y: bottom },
    { x: bounds.x, y: bottom },
  ];
}

/** Hộp bao milimét đọc lại bằng pixel của `<svg viewBox>`. */
export function toPixelRect(bounds: AxisGridBoundsMm, scale: Scale): AxisGridPixelRect {
  return {
    x: scale.millimetresToPixels(bounds.x),
    y: scale.millimetresToPixels(bounds.y),
    width: scale.millimetresToPixels(bounds.width),
    height: scale.millimetresToPixels(bounds.height),
  };
}

/** Một điểm milimét đọc lại bằng pixel. */
export function toPixelPoint(
  point: PointMm,
  scale: Scale,
): { readonly x: Pixels; readonly y: Pixels } {
  return { x: scale.millimetresToPixels(point.x), y: scale.millimetresToPixels(point.y) };
}

/* -------------------------------------------------------------------------- */
/* Trục của đồ thị ↔ trục của hình học.                                        */
/* -------------------------------------------------------------------------- */

/**
 * Một `Axis` của đồ thị đọc ra vựng hình học của `src/domain/axes`.
 *
 * Đây là phép đọc NGƯỢC của `axisLine` (`detect.ts:266-277`), không phải một
 * công thức mới: `axisLine` viết `{coordinateMm, startMm, endMm}` thành hai đầu
 * mút, hàm này đọc hai đầu mút đó trở lại. Hai trường mà đồ thị không giữ —
 * `spreadMm` (độ lệch giữa các tường thành viên) và `wallIds` — trả về giá trị
 * rỗng: `alignFloors`, `labelAxes` và `axisLine` đều không đọc tới chúng, chỉ
 * `detectAxes` sinh ra chúng.
 */
export function toDetectedAxis(axis: Axis): DetectedAxis {
  const isVertical = axis.direction === 'vertical';
  const startAlong = isVertical ? axis.line.start.y : axis.line.start.x;
  const endAlong = isVertical ? axis.line.end.y : axis.line.end.x;

  return {
    direction: axis.direction,
    coordinateMm: millimetres(isVertical ? axis.line.start.x : axis.line.start.y),
    startMm: millimetres(startAlong < endAlong ? startAlong : endAlong),
    endMm: millimetres(startAlong < endAlong ? endAlong : startAlong),
    spreadMm: millimetres(0),
    wallIds: [],
  };
}

/** Cả một danh sách, giữ nguyên thứ tự đồ thị. */
export function toDetectedAxes(axes: readonly Axis[]): readonly DetectedAxis[] {
  return axes.map((axis) => toDetectedAxis(axis));
}

/** Trục hình học viết trở lại thành đoạn thẳng của đồ thị, qua `axisLine`. */
export function toGraphSegment(detected: DetectedAxis): Segment {
  const line = axisLine(detected);

  return {
    start: { x: line.start.x, y: line.start.y },
    end: { x: line.end.x, y: line.end.y },
  };
}

/** Cùng một trục, đặt ở toạ độ khác — hình học đi qua `axisLine`, không tự tính. */
export function withCoordinate(axis: Axis, coordinateMm: Millimetres): Axis {
  const moved: DetectedAxis = { ...toDetectedAxis(axis), coordinateMm };

  return { ...axis, line: toGraphSegment(moved) };
}

/** Cùng một trục, đã dời theo phép biến đổi căn tầng — qua `transformAxis` (M-11). */
export function withFloorTransform(axis: Axis, transform: FloorTransform): Axis {
  const moved = transformAxis(toDetectedAxis(axis), transform);

  return { ...axis, direction: moved.direction, line: toGraphSegment(moved) };
}

/** Cùng một tường, đã dời theo phép biến đổi căn tầng — qua `applyFloorTransform` (M-11). */
export function wallWithFloorTransform(wall: Wall, transform: FloorTransform): Wall {
  const start = applyFloorTransform(toPointMm(wall.centreline.start), transform);
  const end = applyFloorTransform(toPointMm(wall.centreline.end), transform);

  return {
    ...wall,
    centreline: { start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } },
  };
}

/* -------------------------------------------------------------------------- */
/* Đọc đồ thị.                                                                 */
/* -------------------------------------------------------------------------- */

const NO_AXES: readonly Axis[] = Object.freeze([]);
const NO_WALLS: readonly Wall[] = Object.freeze([]);
const NO_LEVELS: readonly Level[] = Object.freeze([]);

/** Tầng của đồ thị, theo đúng thứ tự đồ thị giữ chúng. */
export function levelsOf(graph: NormalizedSpatial | null): readonly Level[] {
  if (graph === null) {
    return NO_LEVELS;
  }

  const levels: Level[] = [];

  for (const id of graph.byKind.level) {
    const entity = graph.byId[id];

    if (entity !== undefined && isEntityOfKind('level', entity)) {
      levels.push(entity);
    }
  }

  return levels;
}

/** Tầng đang xem, hoặc tầng đầu tiên khi nơi gọi chưa chỉ định. */
export function levelOf(
  graph: NormalizedSpatial | null,
  levelId: LevelId | undefined,
): Level | null {
  const levels = levelsOf(graph);

  if (levelId === undefined) {
    return levels[0] ?? null;
  }

  return levels.find((level) => level.id === levelId) ?? null;
}

/** Trục của một tầng, theo đúng thứ tự đồ thị giữ chúng. */
export function axesOfLevel(
  graph: NormalizedSpatial | null,
  levelId: LevelId | null,
): readonly Axis[] {
  if (graph === null || levelId === null) {
    return NO_AXES;
  }

  const axes: Axis[] = [];

  for (const id of graph.byKind.axis) {
    const entity = graph.byId[id];

    if (entity !== undefined && isEntityOfKind('axis', entity) && entity.levelId === levelId) {
      axes.push(entity);
    }
  }

  return axes;
}

/** Tường của một tầng, theo đúng thứ tự đồ thị giữ chúng. */
export function wallsOfLevel(
  graph: NormalizedSpatial | null,
  levelId: LevelId | null,
): readonly Wall[] {
  if (graph === null || levelId === null) {
    return NO_WALLS;
  }

  const walls: Wall[] = [];

  for (const id of graph.byKind.wall) {
    const entity = graph.byId[id];

    if (entity !== undefined && isEntityOfKind('wall', entity) && entity.levelId === levelId) {
      walls.push(entity);
    }
  }

  return walls;
}

/**
 * Trục dò được từ tường chịu lực của một tầng — GỌI `detectAxes` (M-10).
 *
 * Màn không tự sinh trục: hàm này chỉ đổi tường của đồ thị sang vựng hình học
 * (`toSolidWall`, cùng hàm mà tầng lệnh S-07 dùng) rồi giao cho `detectAxes`.
 */
export function detectAxesOfLevel(
  graph: NormalizedSpatial | null,
  level: Level | null,
): readonly DetectedAxis[] {
  if (level === null) {
    return [];
  }

  const walls = wallsOfLevel(graph, level.id).map((wall) => toSolidWall(wall, level));

  return detectAxes(walls);
}

/**
 * Mọi tầng của đồ thị đọc thành `FloorPlan` cho `alignFloors` (M-11).
 *
 * `clearHeightMm` lấy thẳng `level.heightMm` — chiều cao thông thuỷ mà đồ thị
 * giữ — và `floorElevationMm` lấy `level.elevationMm`; không con số nào dựng
 * tại đây.
 */
export function floorPlansOf(graph: NormalizedSpatial | null): readonly FloorPlan[] {
  return levelsOf(graph).map((level) => ({
    levelId: level.id,
    name: level.name,
    floorElevationMm: millimetres(level.elevationMm),
    clearHeightMm: millimetres(level.heightMm),
    axes: toDetectedAxes(axesOfLevel(graph, level.id)),
  }));
}

/* -------------------------------------------------------------------------- */
/* Chặn hai trục cách nhau dưới MIN_AXIS_SPACING_MM.                           */
/* -------------------------------------------------------------------------- */

/** Trục đã gán nhãn, chỉ một hướng, giữ nguyên thứ tự toạ độ tăng dần. */
export function axesInDirection(
  labelled: readonly LabelledAxis[],
  direction: AxisGridDirection,
): readonly LabelledAxis[] {
  const detected = labelled.map((item) => item.axis);
  const kept = new Set(
    direction === 'vertical' ? verticalAxes(detected) : horizontalAxes(detected),
  );

  return labelled.filter((item) => kept.has(item.axis));
}

export interface SpacingCheckInput {
  /** Nhãn của trục đang được đặt hoặc kéo — nó KHÔNG nằm trong `neighbours`. */
  readonly label: string;
  readonly direction: AxisGridDirection;
  readonly coordinateMm: Millimetres;
  /** Mọi trục CÙNG HƯỚNG khác, đã gán nhãn. */
  readonly neighbours: readonly LabelledAxis[];
  /** Ngưỡng; vắng mặt thì dùng {@link MIN_AXIS_SPACING_MM}. */
  readonly minimumMm?: Millimetres;
}

/**
 * Trục hàng xóm vi phạm khoảng cách tối thiểu, hoặc `null` khi mọi thứ ổn.
 *
 * Khoảng cách là phép TRỪ hai toạ độ trên mảng đã sắp tăng dần — hợp đồng của
 * `detectAxes`/`verticalAxes`/`horizontalAxes`, không phải may mắn (quyết định
 * Q3.2). Trục vi phạm đầu tiên theo thứ tự toạ độ được nêu tên, nên câu chặn
 * luôn nói ĐÍCH DANH hai trục.
 */
export function findSpacingViolation(input: SpacingCheckInput): AxisSpacingViolation | null {
  const minimumMm = input.minimumMm ?? MIN_AXIS_SPACING_MM;

  for (const neighbour of axesInDirection(input.neighbours, input.direction)) {
    const gap = neighbour.axis.coordinateMm - input.coordinateMm;
    const distanceMm = millimetres(gap < 0 ? -gap : gap);

    if (compareNearly(distanceMm, minimumMm) < 0) {
      return {
        firstLabel: neighbour.label,
        secondLabel: input.label,
        actualMm: distanceMm,
        minimumMm,
      };
    }
  }

  return null;
}

/**
 * Toạ độ của một trục mới trong nhóm — bước lưới của chính nhóm đó, nối tiếp.
 *
 * `AxisGridManagerProps.onAxisAdd` chỉ mang HƯỚNG, không mang toạ độ (hợp đồng
 * props đã đóng băng), nên chỗ đặt phải suy ra từ dữ liệu đang có. Quy tắc,
 * điều phối viên đã duyệt, không đưa vào một hằng số mới nào:
 *
 * 1. Nhóm có từ hai trục: toạ độ trục cuối cộng khoảng cách hai trục cuối —
 *    đúng bước lưới người vẽ đang dùng. Phép trừ trên mảng đã sắp tăng dần là
 *    hợp đồng của `detectAxes` (quyết định Q3.2), không phải công thức tự chế.
 * 2. Nhóm có đúng một trục: cộng chiều dài của chính trục đó (`endMm -
 *    startMm`) — một kích thước thật của bản vẽ, không phải con số nghĩ ra.
 * 3. Nhóm rỗng: `PROJECT_ORIGIN` — gốc mặc định của mọi dự án mới
 *    (`label.ts:76-79`).
 *
 * Kết quả vẫn phải qua {@link findSpacingViolation} trước khi sinh lệnh.
 */
export function nextAxisCoordinateMm(
  labelled: readonly LabelledAxis[],
  direction: AxisGridDirection,
): Millimetres {
  const group = axesInDirection(labelled, direction);
  const last = group[group.length - 1];

  if (last === undefined) {
    return millimetres(
      direction === 'vertical' ? PROJECT_ORIGIN.point.x : PROJECT_ORIGIN.point.y,
    );
  }

  const previous = group[group.length - 2];
  const pitchMm =
    previous === undefined
      ? last.axis.endMm - last.axis.startMm
      : last.axis.coordinateMm - previous.axis.coordinateMm;

  return millimetres(last.axis.coordinateMm + pitchMm);
}

/**
 * Mã của một trục sắp thêm — do `labelAxes` (M-10) đặt, không phải màn.
 *
 * Trục mới được xếp vào cùng danh sách với các trục đang có rồi cả bộ đi qua
 * `labelAxes`; mã trả về là mã mà chính thuật toán đặt tên đã cấp cho nó. Nhờ
 * vậy mã trên câu chặn, trên nhật ký hoạt động và mã hiện ở panel là MỘT.
 */
export function labelForNewAxis(
  existing: readonly DetectedAxis[],
  candidate: DetectedAxis,
): string {
  const named = labelAxes([...existing, candidate]).find((item) => item.axis === candidate);

  if (named === undefined) {
    throw new Error('labelAxes bỏ sót trục vừa thêm — hợp đồng của nó là trả về đủ mọi trục.');
  }

  return named.label;
}

/**
 * Khổ bản vẽ của một tầng: hộp bao mọi đầu mút trục và tim tường đang có.
 *
 * Trục mới phải dài bằng lưới hiện có, nếu không nó là một đoạn cụt trên bản
 * vẽ. `null` khi tầng chưa có gì để đo — lúc đó nơi gọi tự quyết.
 */
export function levelExtentMm(
  graph: NormalizedSpatial | null,
  levelId: LevelId | null,
): AxisGridBoundsMm | null {
  const points: PointMm[] = [];

  for (const axis of axesOfLevel(graph, levelId)) {
    points.push(toPointMm(axis.line.start), toPointMm(axis.line.end));
  }

  for (const wall of wallsOfLevel(graph, levelId)) {
    points.push(toPointMm(wall.centreline.start), toPointMm(wall.centreline.end));
  }

  return boundsOfPoints(points);
}

export interface CreateAxisEntityInput {
  readonly id: AxisId;
  readonly levelId: LevelId;
  readonly label: string;
  readonly direction: AxisGridDirection;
  readonly coordinateMm: Millimetres;
  /** Khổ bản vẽ; trục mới trải hết bề của lưới theo phương vuông góc. */
  readonly extent: AxisGridBoundsMm | null;
}

/**
 * Một trục mới của đồ thị.
 *
 * A5: `reviewed` luôn `false` và `source` luôn `'human'` — người dùng vừa vẽ nó
 * bằng tay, nhưng chưa ai duyệt, nên cờ xanh "đã xác minh" vẫn tắt. Không tham
 * số nào cho phép nơi gọi bật cờ đó.
 */
export function createAxisEntity(input: CreateAxisEntityInput): Axis {
  const isVertical = input.direction === 'vertical';
  const extent = input.extent;
  const startAlong =
    extent === null ? millimetres(0) : isVertical ? extent.y : extent.x;
  const endAlong =
    extent === null
      ? millimetres(0)
      : millimetres(isVertical ? extent.y + extent.height : extent.x + extent.width);

  const detected: DetectedAxis = {
    direction: input.direction,
    coordinateMm: input.coordinateMm,
    startMm: startAlong,
    endMm: endAlong,
    spreadMm: millimetres(0),
    wallIds: [],
  };

  return {
    id: input.id,
    levelId: input.levelId,
    label: input.label,
    direction: input.direction,
    line: toGraphSegment(detected),
    confidence: 1,
    source: 'human',
    reviewed: false,
  };
}

/** Số milimét trần, để ghép vào câu vốn đã có sẵn chữ "mm" (bảng chuỗi S15-T4). */
const millimetreCount = (valueMm: Millimetres): string =>
  formatNumber(valueMm, { maxFractionDigits: 1 });

/**
 * Câu chặn, nêu đích danh hai trục — nguyên văn `constraint.message` của
 * `.orca-notes/S15-T4-copy.md`, bốn chỗ chèn điền tại đây.
 *
 * Số không viết tay: `{{minimum}}` đọc từ chính `violation.minimumMm` (tức
 * {@link MIN_AXIS_SPACING_MM}), nên câu chữ không thể lệch khỏi hằng (R-71) —
 * đúng lý do điều phối viên đã sửa bảng chuỗi T4 bỏ con số trần đi.
 */
export function describeSpacingViolation(violation: AxisSpacingViolation): string {
  return (
    `không thể đặt ${violation.firstLabel} và ${violation.secondLabel} cách nhau dưới ` +
    `${millimetreCount(violation.minimumMm)} mm — khoảng cách tối thiểu này giữ cho bước dò hai ` +
    `trục khác nhau phân biệt được. khoảng cách hiện tại: ${millimetreCount(violation.actualMm)} mm.`
  );
}

/** Bản ngắn cho `aria-live` — nguyên văn `constraint.ariaLive` của bảng chuỗi S15-T4. */
export function announceSpacingViolation(violation: AxisSpacingViolation): string {
  return (
    `không thể đặt ${violation.firstLabel} và ${violation.secondLabel} cách dưới ` +
    `${millimetreCount(violation.minimumMm)} mm`
  );
}

/* -------------------------------------------------------------------------- */
/* Tầng lệnh — lệnh trục dựng bằng nguyên thuỷ công khai (Q1).                 */
/* -------------------------------------------------------------------------- */

/**
 * Loại của từng lệnh trục.
 *
 * Không lệnh nào tồn tại ở `src/lib/commands/business`; hằng đặt tên ở đây là
 * chỗ DUY NHẤT các chuỗi đó được viết, nên nhật ký hoạt động, đo đạc và bài
 * kiểm cùng đọc một nguồn (R-71).
 */
export const AXIS_COMMAND_TYPES = {
  add: 'axis.add',
  remove: 'axis.remove',
  move: 'axis.move',
  autoAlign: 'axis.autoAlign',
} as const;

export type AxisCommandType = (typeof AXIS_COMMAND_TYPES)[keyof typeof AXIS_COMMAND_TYPES];

/** Câu mô tả trên nhật ký hoạt động — `validateCommands` đòi nó khác rỗng. */
export const addAxisDescription = (label: string): string => `Thêm trục ${label}.`;

/** Lượt "suy ra từ tường bao": cả lưới dò được vào một lệnh, nên mô tả là số nhiều. */
export const addAxesDescription = (count: number): string =>
  `Thêm ${formatNumber(count, { fractionDigits: 0, grouping: false })} trục dò được từ tường chịu lực.`;

export const removeAxisDescription = (label: string): string => `Xoá trục ${label}.`;

export const moveAxisDescription = (label: string, coordinateMm: Millimetres): string =>
  `Chuyển trục ${label} tới ${formatLength(coordinateMm, { unit: 'mm' })}.`;

/** Nguyên văn `undoToast.message` của bảng chuỗi S15-T4. */
export const autoAlignDescription = (floorCount: number): string =>
  `Đã căn chỉnh ${formatNumber(floorCount, { fractionDigits: 0, grouping: false })} tầng thành công.`;

/** Nguyên văn `undoToast.confirmMessage` của bảng chuỗi S15-T4. */
export const AUTO_ALIGN_UNDONE_MESSAGE = 'Đã hoàn tác căn chỉnh.';

export interface BuildAddAxisInput {
  /** Một trục khi người dùng bấm "Thêm trục"; cả lưới khi họ suy ra từ tường bao. */
  readonly axes: readonly Axis[];
  readonly actorId: string;
}

/**
 * Thêm một hoặc nhiều trục trong ĐÚNG MỘT lệnh.
 *
 * Ảnh chụp `after` đầy đủ, nên `invertCommand` xoá lại được; và vì cả lưới dò
 * được nằm trong một `Command`, lượt "suy ra từ tường bao" cũng chỉ tốn một
 * lần `Ctrl+Z` — cùng lý do đã ghi ở {@link buildAutoAlignCommand}.
 *
 * `null` khi danh sách rỗng: `validateCommands` từ chối lệnh không có thay đổi
 * nào, nên dựng nó ra chỉ để hỏng ở bước đầu là vô ích.
 */
export function buildAddAxisCommand(input: BuildAddAxisInput): Command | null {
  const first = input.axes[0];

  if (first === undefined) {
    return null;
  }

  return createCommand({
    type: AXIS_COMMAND_TYPES.add,
    actorId: input.actorId,
    description:
      input.axes.length === 1
        ? addAxisDescription(first.label)
        : addAxesDescription(input.axes.length),
    changes: input.axes.map((axis) => changeForAdd('axis', axis)),
  });
}

export interface BuildRemoveAxisInput {
  readonly axis: Axis;
  readonly actorId: string;
}

/** Xoá một trục. Ảnh chụp `before` đầy đủ, nên `invertCommand` dựng lại được. */
export function buildRemoveAxisCommand(input: BuildRemoveAxisInput): Command {
  return createCommand({
    type: AXIS_COMMAND_TYPES.remove,
    actorId: input.actorId,
    description: removeAxisDescription(input.axis.label),
    changes: [changeForRemove('axis', input.axis)],
  });
}

export interface BuildMoveAxisInput {
  readonly before: Axis;
  readonly coordinateMm: Millimetres;
  readonly actorId: string;
}

/**
 * Kéo một trục sang toạ độ mới.
 *
 * Hình học đi qua `axisLine` (xem {@link withCoordinate}), và cả hai ảnh chụp
 * là bản ghi ĐẦY ĐỦ, nên `Ctrl+Z` trả trục về đúng chỗ cũ mà không cần biết
 * lệnh này nghĩa là gì.
 */
export function buildMoveAxisCommand(input: BuildMoveAxisInput): Command {
  const after = withCoordinate(input.before, input.coordinateMm);

  return createCommand({
    type: AXIS_COMMAND_TYPES.move,
    actorId: input.actorId,
    description: moveAxisDescription(input.before.label, input.coordinateMm),
    changes: [changeForUpdate('axis', input.before, after)],
  });
}

/* -------------------------------------------------------------------------- */
/* Căn tự động — MỘT lệnh cho MỌI tầng (Q3.4, yêu cầu nghiệm thu).             */
/* -------------------------------------------------------------------------- */

/** Phép biến đổi không dời gì — bỏ qua để lệnh không mang thay đổi rỗng. */
function movesNothing(transform: FloorTransform): boolean {
  return (
    transform.rotationDeg === 0 &&
    compareNearly(transform.translationMm.x, 0) === 0 &&
    compareNearly(transform.translationMm.y, 0) === 0
  );
}

export interface BuildAutoAlignInput {
  /** Kết quả của `alignFloors` — màn KHÔNG tự tính lệch (M-11). */
  readonly report: FloorAlignmentReport;
  /** Đồ thị đang sửa; trục và tường của từng tầng đọc ra từ đây. */
  readonly graph: NormalizedSpatial;
  readonly actorId: string;
  /** Chỉ căn những tầng này; vắng mặt thì căn MỌI tầng không phải tầng gốc. */
  readonly levelIds?: readonly LevelId[];
}

/** Tầng mà lệnh căn tự động thật sự chạm tới, theo đúng thứ tự báo cáo. */
export function alignableFloors(input: BuildAutoAlignInput): readonly FloorAlignment[] {
  return input.report.floors.filter(
    (alignment) =>
      !alignment.isBase &&
      !movesNothing(alignment.transform) &&
      (input.levelIds === undefined || input.levelIds.includes(alignment.levelId)),
  );
}

/**
 * Căn tự động, gói trong ĐÚNG MỘT `Command`.
 *
 * Đường ráp đúng theo quyết định Q3.4, dùng toàn hàm đã có:
 * 1. `alignFloors(floors)` đã chạy ở nơi gọi và cho `FloorAlignmentReport` —
 *    màn không tự tính lệch.
 * 2. Với mỗi `FloorAlignment` không phải tầng gốc: `transformAxis` dời từng
 *    trục và `applyFloorTransform` dời từng đầu mút tim tường.
 * 3. Mỗi kết quả bọc thành một `changeForUpdate` mang ảnh chụp đầy đủ.
 * 4. TOÀN BỘ thay đổi của TOÀN BỘ tầng vào một `createCommand` DUY NHẤT.
 *
 * Bước 4 là điều kiện nghiệm thu: `dispatch` sinh đúng một `UndoEntry` và gọi
 * `history.push` đúng một lần cho cả mảng `changes` (`dispatch.ts:605-626`),
 * nên số bước lịch sử tăng đúng 1 và một lần `Ctrl+Z` trả về nguyên trạng —
 * KHÔNG phải một bước cho mỗi tầng. `.orca-notes/S15-T2-commands.contract.md`
 * mục D trả lời dứt khoát "CÓ" cho câu hỏi này.
 *
 * `null` khi không tầng nào phải dời — không dựng một lệnh rỗng để rồi
 * `validateCommands` từ chối nó ở bước đầu.
 */
export function buildAutoAlignCommand(input: BuildAutoAlignInput): Command | null {
  const floors = alignableFloors(input);
  const changes: EntityChange[] = [];

  for (const alignment of floors) {
    for (const axis of axesOfLevel(input.graph, alignment.levelId)) {
      changes.push(changeForUpdate('axis', axis, withFloorTransform(axis, alignment.transform)));
    }

    for (const wall of wallsOfLevel(input.graph, alignment.levelId)) {
      changes.push(
        changeForUpdate('wall', wall, wallWithFloorTransform(wall, alignment.transform)),
      );
    }
  }

  if (changes.length === 0) {
    return null;
  }

  return createCommand({
    type: AXIS_COMMAND_TYPES.autoAlign,
    actorId: input.actorId,
    description: autoAlignDescription(floors.length),
    changes,
  });
}

/* -------------------------------------------------------------------------- */
/* Đường ghi — `dispatch` chạy qua `commit` (A10).                             */
/* -------------------------------------------------------------------------- */

/** Cửa đọc đồ thị đang sửa. Mặc định là store; test cắm một đồ thị cố định. */
export interface AxisGridGraphPort {
  readonly read: () => NormalizedSpatial | null;
}

/**
 * Cổng ghi của `dispatch`, cài bằng `commit`.
 *
 * `commit` nhận `SpatialPatch[]` và một nhãn tiếng Việt, đúng hai thứ
 * `applyPatches` có trong tay. Không dòng nào gọi `set()` hay `_applyPatches()`
 * (A10), và không dòng nào gọi `CommitResult.undo` — hoàn tác của màn đi qua
 * `HistoryStack` của S-06, không phải ngăn xếp zundo của store.
 */
export function createCommitSpatialPort(
  graph: AxisGridGraphPort,
  labelOf: () => string,
): SpatialPort {
  return {
    read: () => graph.read(),
    applyPatches: (patches) => {
      commit(patches, labelOf());
    },
  };
}

/** Bộ phụ thuộc năm bước của `dispatch`, gắn với ngăn xếp hoàn tác 100 bước của S-06. */
export interface AxisGridDispatchDeps {
  readonly deps: DispatchDeps;
  readonly history: HistoryStack;
  /** Nhãn của lượt dispatch đang chạy — `SpatialPort` đọc nó để đặt tên cho `commit`. */
  readonly setLabel: (label: string) => void;
}

export interface CreateAxisGridDispatchOptions {
  readonly graph: AxisGridGraphPort;
  readonly selectionBefore: () => SelectionSnapshot;
  readonly selectionAfter: () => SelectionSnapshot;
  /** Bước `sync` — đánh dấu bản vẽ bẩn cho tự lưu (A7). */
  readonly onSynced: () => void;
  readonly history?: HistoryStack;
}

/** Dựng `DispatchDeps` đầy đủ năm cổng — chép khuôn `createWallLayerDispatchDeps`. */
export function createAxisGridDispatchDeps(
  options: CreateAxisGridDispatchOptions,
): AxisGridDispatchDeps {
  const history = options.history ?? createHistoryStack();
  let label = '';

  const deps: DispatchDeps = {
    spatial: createCommitSpatialPort(options.graph, () => label),
    history: {
      push: (entry) => {
        history.push({
          entry,
          selectionBefore: options.selectionBefore(),
          selectionAfter: options.selectionAfter(),
        });
      },
      drop: (entryId) => {
        history.drop(entryId);
      },
    },
    rules: createIncrementalRuleRunner(),
    sync: {
      enqueue: () => {
        options.onSynced();
      },
    },
  };

  return {
    deps,
    history,
    setLabel: (next) => {
      label = next;
    },
  };
}

/** Chạy một lệnh qua đủ năm bước. Nhãn của lượt là mô tả của chính lệnh. */
export async function runAxisCommand(
  command: Command,
  bundle: AxisGridDispatchDeps,
): Promise<DispatchResult> {
  bundle.setLabel(command.description);

  return dispatch(command, bundle.deps);
}

/** Vùng chọn rỗng, cho lượt ghi không có gì được chọn trước đó. */
export const NO_AXIS_SELECTION: SelectionSnapshot = NO_SELECTION;

/* -------------------------------------------------------------------------- */
/* Vé hoàn tác (A8) — toast có nút Hoàn tác.                                   */
/* -------------------------------------------------------------------------- */

/** Loại thông báo của lượt căn tự động — nút "Hoàn tác" của toast đọc vé qua nó. */
export const AXIS_AUTO_ALIGN_NOTIFICATION_TYPE = 'axisGrid.autoAlign';

/** Loại thông báo của lượt xoá trục. */
export const AXIS_REMOVE_NOTIFICATION_TYPE = 'axisGrid.remove';

/** Câu trên toast hoàn tác sau khi xoá một trục. */
export const removeToastDescription = (label: string): string => `Đã xoá trục ${label}.`;

export interface CreateAxisUndoTicketOptions {
  readonly description: string;
  readonly undo: () => void;
  readonly now: () => number;
}

/**
 * Vé hoàn tác của một lượt ghi.
 *
 * `UNDO_WINDOW_MS` (8000 ms, A8) tới từ `src/lib/mutations/undoTicket.ts` — con
 * số không được viết lại ở màn (R-71), và `createUndoTicket` dùng nó làm mặc
 * định nên ở đây thậm chí không có tham số nào mang nó. `undo` trỏ vào
 * `history.undo()` của chính bộ `dispatchBundle` (ngăn xếp S-06), KHÔNG phải
 * `CommitResult.undo` của zundo.
 */
export function createAxisUndoTicket(options: CreateAxisUndoTicketOptions): UndoTicket {
  return createUndoTicket({
    description: options.description,
    now: options.now,
    undo: options.undo,
  });
}

/** Cửa sổ hoàn tác, xuất lại để hook và bài kiểm đọc đúng một nguồn. */
export { UNDO_WINDOW_MS };

/* -------------------------------------------------------------------------- */
/* Cái seam.                                                                   */
/* -------------------------------------------------------------------------- */

export interface ReadAxisLayerInput {
  readonly projectId: string;
  readonly floorId: string;
  readonly signal?: AbortSignal;
}

export interface PersistAxisGridInput {
  readonly projectId: string;
  readonly floorId: string;
  readonly graph: NormalizedSpatial;
}

export interface PersistAxisOriginInput {
  readonly projectId: string;
  readonly floorId: string;
  /** Giao trục người dùng chọn làm mốc, ví dụ `"A-1"`. */
  readonly anchor: string;
  /** Điểm mà `setOrigin` đã ghim lưới vào. */
  readonly point: PointMm;
}

/** Mỗi phương thức là một việc màn cần từ bên ngoài, và không có việc nào khác. */
export interface AxisGridManagerGateway {
  /** Khả năng nào cổng này làm được, trả lời ĐỒNG BỘ — màn phải biết trước lượt vẽ đầu. */
  readonly supports: Readonly<Record<AxisGridCapability, boolean>>;
  /** Lớp trục của tầng. Lỗi ở đây là trạng thái `error` của A11. */
  readonly readAxisLayer: (input: ReadAxisLayerInput) => Promise<NormalizedSpatial | null>;
  /** Đồ thị đang sửa — nơi `commit` vừa ghi vào. */
  readonly graph: AxisGridGraphPort;
  /** NOT FOUND — `persistAxisGrid`. Không bịa một lượt lưu; xem bản kê nợ ở đầu file. */
  readonly persistAxisGrid: (
    input: PersistAxisGridInput,
  ) => Promise<AxisGridCapabilityResult<void>>;
  /** NOT FOUND — `persistAxisOrigin`. Giao trục neo mất sau một lần tải lại trang. */
  readonly persistAxisOrigin: (
    input: PersistAxisOriginInput,
  ) => Promise<AxisGridCapabilityResult<void>>;
  /** Mã trục mới. Cùng cửa với `ToolContext.nextId` của `toolMachine`. */
  readonly nextAxisId: () => AxisId;
  /** Tỷ lệ mm ↔ px của bản vẽ; mọi quy đổi của màn đi qua đây (R-71). */
  readonly scale: Scale;
  /** Ai đang thao tác — đi vào `Command.actorId` và nhật ký hoạt động. */
  readonly actorId: string;
  /** Mốc giờ hiện tại. Tiêm được để test không phụ thuộc đồng hồ thật. */
  readonly now: () => number;
}

/**
 * Người thực hiện mặc định khi nơi gọi chưa truyền ai.
 *
 * Một chuỗi ĐẶT TÊN chứ không phải chuỗi rỗng: `validateCommands` từ chối lệnh
 * thiếu `actorId`, nên một mặc định rỗng sẽ làm mọi lệnh hỏng ở bước `validate`
 * thay vì hỏng ở chỗ người nối dây quên truyền.
 */
export const AXIS_GRID_DEFAULT_ACTOR_ID = 'axis-grid-reviewer';

export interface CreateAxisGridManagerGatewayOptions {
  /** Cửa đọc đồ thị. Vắng mặt thì cổng đọc thẳng store. */
  readonly graph?: AxisGridGraphPort;
  readonly actorId?: string;
  readonly now?: () => number;
  readonly nextAxisId?: () => AxisId;
  readonly scale?: Scale;
}

/** Cổng thật — thứ container lớp 3 gọi. */
export function createAxisGridManagerGateway(
  options: CreateAxisGridManagerGatewayOptions = {},
): AxisGridManagerGateway {
  const graph: AxisGridGraphPort = options.graph ?? {
    read: () => useStore.getState().spatial,
  };

  return {
    supports: {
      readAxisLayer: true,
      readAxisGraph: true,
      writeAxisGraph: true,
      persistAxisGrid: false,
      persistAxisOrigin: false,
    },

    readAxisLayer: () => Promise.resolve(graph.read()),

    graph,

    persistAxisGrid: () => Promise.resolve(unsupported('persistAxisGrid')),
    persistAxisOrigin: () => Promise.resolve(unsupported('persistAxisOrigin')),

    nextAxisId: options.nextAxisId ?? ((): AxisId => createId('axis')),
    scale: options.scale ?? AXIS_GRID_FIXTURE_SCALE,
    actorId: options.actorId ?? AXIS_GRID_DEFAULT_ACTOR_ID,
    now: options.now ?? ((): number => Date.now()),
  };
}

/* -------------------------------------------------------------------------- */
/* Bộ mẫu — chỗ story và test cắm vào (R-73).                                  */
/* -------------------------------------------------------------------------- */

/** Công trình mẫu — ba tầng của `axisGridFixture.ts`. */
export const AXIS_GRID_SAMPLE_BUILDING: Building = {
  name: 'Nhà mẫu QC lưới trục',
  datumElevationMm: 0,
  confidence: 1,
  source: 'human',
  reviewed: true,
};

/** Thứ tự tầng trong bộ mẫu — tầng gốc là 0, đúng quy ước của `Level.order`. */
const levelOrderOf = (index: number): number => index;

/**
 * Mã trục tất định của bộ mẫu — cùng khuôn `createId`, KHÔNG phải "A-1".
 *
 * Thân mã phải dài ít nhất 10 ký tự `[0-9A-Z]` hoặc `dispatch.ts:285` từ chối
 * mọi lệnh chạm tới trục đó ngay ở bước kiểm. Vẫn tất định: số đếm chạy trong
 * phạm vi một lượt dựng đồ thị, đuôi là hằng.
 */
const sampleAxisId = (counter: number): AxisId =>
  `A-${formatNumber(counter, { grouping: false, fractionDigits: 0 }).padStart(6, '0')}AXIS` as AxisId;

/** Mã tầng của bộ mẫu đọc thẳng từ `FloorPlan.levelId` — không đánh lại. */
function sampleLevel(floor: FloorPlan, index: number): Level {
  return {
    id: floor.levelId,
    name: floor.name,
    order: levelOrderOf(index),
    elevationMm: floor.floorElevationMm,
    heightMm: floor.clearHeightMm,
    scaleMillimetresPerPixel: AXIS_GRID_FIXTURE_SCALE.millimetresPerPixel,
    confidence: 1,
    source: 'ai',
    reviewed: false,
  };
}

/**
 * Trục của bộ mẫu, đã gán nhãn bằng `labelAxes` (M-10) rồi viết thành thực thể
 * đồ thị bằng `axisLine` — không toạ độ nào dựng tay ở đây.
 *
 * A5: `reviewed` luôn `false` và `source` luôn `'ai'`. Trục của bộ mẫu là đầu
 * ra của bước dò tự động, và đầu ra của AI không bao giờ được tự bật cờ xanh
 * "đã xác minh".
 */
function sampleAxes(floor: FloorPlan, nextId: () => AxisId): readonly Axis[] {
  return labelAxes(floor.axes).map((labelled) => ({
    id: nextId(),
    levelId: floor.levelId,
    label: labelled.label,
    direction: labelled.axis.direction,
    line: toGraphSegment(labelled.axis),
    confidence: 1,
    source: 'ai',
    reviewed: false,
  }));
}

export interface AxisGridSampleGraphOptions {
  /** Tầng đưa vào đồ thị; vắng mặt thì cả ba tầng của bộ mẫu. */
  readonly floors?: readonly FloorPlan[];
  /** `false` thì đồ thị có tầng nhưng CHƯA trục nào — đúng cảnh `empty`. */
  readonly withAxes?: boolean;
  /** `'vertical'` thì chỉ giữ trục dọc — đúng cảnh `partial`. */
  readonly onlyDirection?: AxisGridDirection;
}

/**
 * Đồ thị mẫu — dựng từ CHÍNH `axisGridFixture.ts`, không bịa bảng dữ liệu thứ
 * hai (R-70).
 *
 * Bộ mẫu giữ tầng dưới dạng `FloorPlan` của `src/domain/axes`; đồ thị của kho
 * giữ chúng dưới dạng `Level` + `Axis` của `src/domain/spatial`. Hàm này là
 * chỗ DUY NHẤT hai vựng đó gặp nhau, và nó chỉ đổi hình dạng: mọi toạ độ vẫn
 * là toạ độ mà `detectAxes` đã dò ra trong bộ mẫu.
 */
export function createAxisGridSampleGraph(
  options: AxisGridSampleGraphOptions = {},
): NormalizedSpatial {
  const floors = options.floors ?? AXIS_GRID_FIXTURE_FLOORS;
  const withAxes = options.withAxes ?? true;
  let counter = 0;
  const nextId = (): AxisId => {
    counter += 1;

    return sampleAxisId(counter);
  };

  const levels = floors.map((floor, index) => sampleLevel(floor, index));
  const axes = withAxes
    ? floors.flatMap((floor) =>
        sampleAxes(floor, nextId).filter(
          (axis) => options.onlyDirection === undefined || axis.direction === options.onlyDirection,
        ),
      )
    : [];

  return normalizeSpatial({
    building: AXIS_GRID_SAMPLE_BUILDING,
    levels,
    walls: [],
    openings: [],
    furniture: [],
    rooms: [],
    axes,
    dimensions: [],
    notes: [],
  });
}

/** Mã tầng gốc của bộ mẫu — nơi gọi không phải tự đoán. */
export const AXIS_GRID_SAMPLE_LEVEL_ID: LevelId = AXIS_GRID_FIXTURE_FLOOR1.levelId;

/** Cách bài kiểm ép một cảnh cụ thể, không sửa mã. */
export interface AxisGridGatewaySeed {
  /** Đồ thị cổng trả về. Vắng mặt thì đồ thị mẫu đủ ba tầng. */
  readonly graph?: NormalizedSpatial | null;
  /** `true` thì `readAxisLayer` ném — đúng cảnh `error` của bảy kịch bản. */
  readonly failReadAxisLayer?: boolean;
  /** `true` thì `persistAxisGrid` chạy thật (bộ mẫu có đường lưu). */
  readonly canPersist?: boolean;
  readonly actorId?: string;
  readonly now?: () => number;
  readonly nextAxisId?: () => AxisId;
  readonly scale?: Scale;
}

/** Cổng có dữ liệu — dùng chung giữa test và story, không bịa bảng dữ liệu thứ hai (R-70). */
export function createMockAxisGridManagerGateway(
  seed: AxisGridGatewaySeed = {},
): AxisGridManagerGateway {
  const canPersist = seed.canPersist ?? false;
  const graph = seed.graph === undefined ? createAxisGridSampleGraph() : seed.graph;
  let counter = 0;

  return {
    supports: {
      readAxisLayer: true,
      readAxisGraph: true,
      writeAxisGraph: true,
      persistAxisGrid: canPersist,
      persistAxisOrigin: canPersist,
    },

    readAxisLayer: () => {
      if (seed.failReadAxisLayer === true) {
        return Promise.reject(new Error('Không tải được lưới trục của tầng.'));
      }

      return Promise.resolve(graph);
    },

    graph: { read: () => useStore.getState().spatial ?? graph },

    persistAxisGrid: () =>
      Promise.resolve(
        canPersist ? { supported: true, value: undefined } : unsupported('persistAxisGrid'),
      ),

    persistAxisOrigin: () =>
      Promise.resolve(
        canPersist ? { supported: true, value: undefined } : unsupported('persistAxisOrigin'),
      ),

    nextAxisId:
      seed.nextAxisId ??
      ((): AxisId => {
        counter += 1;

        return `A-${formatNumber(counter, { grouping: false, fractionDigits: 0 }).padStart(6, '0')}MOCK` as AxisId;
      }),
    scale: seed.scale ?? AXIS_GRID_FIXTURE_SCALE,
    actorId: seed.actorId ?? AXIS_GRID_DEFAULT_ACTOR_ID,
    now: seed.now ?? ((): number => Date.now()),
  };
}
