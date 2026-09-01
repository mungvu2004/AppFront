/**
 * Dữ liệu mẫu của màn "Quản lý trục & căn tầng": một công trình ba tầng, mỗi
 * tầng có lưới tường tạo ra đúng 4 trục ngang (A, B, C, D) và 4 trục dọc
 * (1, 2, 3, 4).
 *
 * Không tự sinh trục, không tự tính lệch tầng (CẤM TUYỆT ĐỐI): trục ở đây LUÔN
 * đi qua `detectAxes()`, và độ lệch giữa các tầng LUÔN đi qua `alignFloors()` —
 * cả hai của `src/domain/axes`. File này chỉ dựng tường mẫu rồi gọi đúng hai
 * hàm đó; không công thức hình học nào viết tay ở đây (R-61, R-71).
 *
 * `detectAxes` nhận `Wall` của `src/domain/walls/types.ts` (centreline +
 * `baseElevationMm`/`topElevationMm`), KHÔNG PHẢI `Wall` của
 * `src/domain/spatial/types.ts` (levelId + `heightMm` + `openingIds`…) mà
 * `WallLayerReviewFixture` dùng — hai kiểu trùng tên nhưng khác hình dạng.
 *
 * ## Lưới ba tầng
 *
 * Tầng 1 (gốc): trục dọc tại x = 0/5.000/10.000/15.000 mm, trục ngang tại
 * y = 0/4.000/8.000/12.000 mm. Tầng 2 XÂY TRÊN tầng 1 (không hở, không chồng —
 * `floorElevationMm` khớp đúng trần tầng dưới) nhưng LỆCH CÓ CHỦ Ý: trục dọc
 * thứ tư dịch thêm 200 mm (x = 15.200 thay vì 15.000), ba trục dọc kia và cả
 * bốn trục ngang giữ nguyên toạ độ tầng 1. Vì đây không phải một phép tịnh
 * tiến đều, `alignFloors()` không thể "kéo" cả lưới về khớp — trục thứ tư luôn
 * còn dư đúng 200 mm sau khi đã tìm phép dịch tốt nhất, vượt
 * `ALIGNMENT_WARNING_THRESHOLD_MM` (150 mm). Tầng 3 dịch ĐỀU cả lưới thêm
 * 100 mm theo x và 60 mm theo y so với tầng 1 — một phép tịnh tiến thật, nên
 * `alignFloors()` tìm được đúng phép dịch bù lại và độ lệch còn lại bằng 0:
 * "trong dung sai" là kết quả của thuật toán căn tầng, không phải vì tầng 3 vốn
 * đã đứng nguyên chỗ tầng 1.
 *
 * KHÔNG gọi bất kỳ hàm nào của đối tượng `Math` toàn cục ở đây — mọi toạ độ
 * viết thẳng, không tính ra từ công thức, không có số ngẫu nhiên. Dữ liệu TẤT
 * ĐỊNH, đúng khuôn `wallLayerReviewFixture.ts`.
 */

import {
  AXIS_ALIGNMENT_THRESHOLD_MM,
  detectAxes,
  verticalAxes,
  type DetectedAxis,
} from '@/domain/axes/detect';
import {
  buildAxisGrid,
  labelAxes,
  toAxisPosition,
  type AxisGrid,
  type AxisPosition,
  type LabelledAxis,
} from '@/domain/axes/label';
import {
  ALIGNMENT_WARNING_THRESHOLD_MM,
  alignFloors,
  type FloorAlignmentReport,
  type FloorIssue,
  type FloorPlan,
  type FloorTransform,
} from '@/domain/axes/alignFloors';
import type { PointMm } from '@/domain/units/compare';
import { millimetresPerPixel, scaleFromRatio, type Scale } from '@/domain/units/scale';
import { millimetres, type Millimetres } from '@/domain/units/types';
import type { LevelId, WallId } from '@/domain/spatial/types';
import type { Wall } from '@/domain/walls/types';

import type { AxisSpacingViolation } from './axisGridTypes';

/* -------------------------------------------------------------------------- */
/* Dựng tường lưới — cách duy nhất trục được phép "sinh ra" trong file này.    */
/* -------------------------------------------------------------------------- */

const WALL_THICKNESS_MM: Millimetres = millimetres(220);

function wallId(code: string): WallId {
  return `W-${code}` as WallId;
}

function levelId(code: string): LevelId {
  return `L-${code}` as LevelId;
}

function point(x: number, y: number): PointMm {
  return { x: millimetres(x), y: millimetres(y) };
}

/** Truy cập mảng an toàn với `noUncheckedIndexedAccess` — ném lỗi sớm thay vì để `undefined` trôi đi. */
function at<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) {
    throw new Error(`Chỉ số ${String(index)} vượt quá mảng có ${String(values.length)} phần tử.`);
  }
  return value;
}

function gridWall(code: string, start: PointMm, end: PointMm, elevationMm: number, clearHeightMm: number): Wall {
  return {
    id: wallId(code),
    kind: 'loadBearing',
    centreline: { start, end },
    thicknessMm: WALL_THICKNESS_MM,
    baseElevationMm: millimetres(elevationMm),
    topElevationMm: millimetres(elevationMm + clearHeightMm),
  };
}

/**
 * Lưới tường đầy đủ cho một tầng: mỗi đường dọc trong `verticalXsMm` và mỗi
 * đường ngang trong `horizontalYsMm` được chia thành nhiều đoạn tường ngắn tại
 * các điểm giao — ít nhất hai đoạn mỗi đường, đủ `MIN_WALLS_PER_AXIS` của
 * `detectAxes()`, và toạ độ trùng khít tại điểm giao nên không đoạn nào lệch
 * cụm nào.
 */
function buildGridWalls(
  floorCode: string,
  verticalXsMm: readonly number[],
  horizontalYsMm: readonly number[],
  elevationMm: number,
  clearHeightMm: number,
): readonly Wall[] {
  const walls: Wall[] = [];

  verticalXsMm.forEach((x, xIndex) => {
    for (let segment = 0; segment < horizontalYsMm.length - 1; segment += 1) {
      const yStart = at(horizontalYsMm, segment);
      const yEnd = at(horizontalYsMm, segment + 1);
      walls.push(
        gridWall(`${floorCode}V${String(xIndex)}S${String(segment)}`, point(x, yStart), point(x, yEnd), elevationMm, clearHeightMm),
      );
    }
  });

  horizontalYsMm.forEach((y, yIndex) => {
    for (let segment = 0; segment < verticalXsMm.length - 1; segment += 1) {
      const xStart = at(verticalXsMm, segment);
      const xEnd = at(verticalXsMm, segment + 1);
      walls.push(
        gridWall(`${floorCode}H${String(yIndex)}S${String(segment)}`, point(xStart, y), point(xEnd, y), elevationMm, clearHeightMm),
      );
    }
  });

  return walls;
}

/* -------------------------------------------------------------------------- */
/* Ba tầng — toạ độ lưới.                                                      */
/* -------------------------------------------------------------------------- */

const FLOOR1_VERTICAL_X_MM: readonly number[] = [0, 5000, 10000, 15000];
const FLOOR1_HORIZONTAL_Y_MM: readonly number[] = [0, 4000, 8000, 12000];

/** Trục dọc thứ tư dịch +200 mm — LỆCH CÓ CHỦ Ý, không phải tịnh tiến đều (xem ghi chú đầu file). */
const FLOOR2_VERTICAL_X_MM: readonly number[] = [0, 5000, 10000, 15200];
const FLOOR2_HORIZONTAL_Y_MM: readonly number[] = FLOOR1_HORIZONTAL_Y_MM;

/** Tịnh tiến đều +100 mm / +60 mm so với tầng 1 — `alignFloors()` bù lại được hoàn toàn. */
const FLOOR3_VERTICAL_X_MM: readonly number[] = [100, 5100, 10100, 15100];
const FLOOR3_HORIZONTAL_Y_MM: readonly number[] = [60, 4060, 8060, 12060];

const FLOOR_CLEAR_HEIGHT_MM = 3000;
const FLOOR1_ELEVATION_MM = 0;
const FLOOR2_ELEVATION_MM = FLOOR1_ELEVATION_MM + FLOOR_CLEAR_HEIGHT_MM;
const FLOOR3_ELEVATION_MM = FLOOR2_ELEVATION_MM + FLOOR_CLEAR_HEIGHT_MM;

const FLOOR1_LEVEL_ID = levelId('AXISFLOOR1');
const FLOOR2_LEVEL_ID = levelId('AXISFLOOR2');
const FLOOR3_LEVEL_ID = levelId('AXISFLOOR3');

const FLOOR1_WALLS = buildGridWalls('F1', FLOOR1_VERTICAL_X_MM, FLOOR1_HORIZONTAL_Y_MM, FLOOR1_ELEVATION_MM, FLOOR_CLEAR_HEIGHT_MM);
const FLOOR2_WALLS = buildGridWalls('F2', FLOOR2_VERTICAL_X_MM, FLOOR2_HORIZONTAL_Y_MM, FLOOR2_ELEVATION_MM, FLOOR_CLEAR_HEIGHT_MM);
const FLOOR3_WALLS = buildGridWalls('F3', FLOOR3_VERTICAL_X_MM, FLOOR3_HORIZONTAL_Y_MM, FLOOR3_ELEVATION_MM, FLOOR_CLEAR_HEIGHT_MM);

/** Biến thể tầng 2 KHÔNG lệch — chỉ dùng cho kịch bản `success` ("mọi tầng trong dung sai"). */
const FLOOR2_ALIGNED_WALLS = buildGridWalls('F2A', FLOOR1_VERTICAL_X_MM, FLOOR1_HORIZONTAL_Y_MM, FLOOR2_ELEVATION_MM, FLOOR_CLEAR_HEIGHT_MM);

const FLOOR1_AXES: readonly DetectedAxis[] = detectAxes(FLOOR1_WALLS);
const FLOOR2_AXES: readonly DetectedAxis[] = detectAxes(FLOOR2_WALLS);
const FLOOR3_AXES: readonly DetectedAxis[] = detectAxes(FLOOR3_WALLS);
const FLOOR2_ALIGNED_AXES: readonly DetectedAxis[] = detectAxes(FLOOR2_ALIGNED_WALLS);

function assertEightAxes(axes: readonly DetectedAxis[], floorName: string): void {
  if (axes.length !== 8) {
    throw new Error(`${floorName} phải dò ra đúng 8 trục (4 ngang + 4 dọc), hiện có ${String(axes.length)}.`);
  }
}

assertEightAxes(FLOOR1_AXES, 'Tầng 1');
assertEightAxes(FLOOR2_AXES, 'Tầng 2');
assertEightAxes(FLOOR3_AXES, 'Tầng 3');
assertEightAxes(FLOOR2_ALIGNED_AXES, 'Tầng 2 (biến thể đã căn)');

/* -------------------------------------------------------------------------- */
/* Ba tầng — FloorPlan cho `alignFloors()`.                                    */
/* -------------------------------------------------------------------------- */

export const AXIS_GRID_FIXTURE_FLOOR1: FloorPlan = {
  levelId: FLOOR1_LEVEL_ID,
  name: 'Tầng 1',
  floorElevationMm: millimetres(FLOOR1_ELEVATION_MM),
  clearHeightMm: millimetres(FLOOR_CLEAR_HEIGHT_MM),
  axes: FLOOR1_AXES,
};

export const AXIS_GRID_FIXTURE_FLOOR2: FloorPlan = {
  levelId: FLOOR2_LEVEL_ID,
  name: 'Tầng 2',
  floorElevationMm: millimetres(FLOOR2_ELEVATION_MM),
  clearHeightMm: millimetres(FLOOR_CLEAR_HEIGHT_MM),
  axes: FLOOR2_AXES,
};

export const AXIS_GRID_FIXTURE_FLOOR3: FloorPlan = {
  levelId: FLOOR3_LEVEL_ID,
  name: 'Tầng 3',
  floorElevationMm: millimetres(FLOOR3_ELEVATION_MM),
  clearHeightMm: millimetres(FLOOR_CLEAR_HEIGHT_MM),
  axes: FLOOR3_AXES,
};

/** Biến thể tầng 2 KHÔNG lệch, chỉ dùng cho kịch bản `success`. */
const AXIS_GRID_FIXTURE_FLOOR2_ALIGNED: FloorPlan = {
  ...AXIS_GRID_FIXTURE_FLOOR2,
  axes: FLOOR2_ALIGNED_AXES,
};

/** Biến thể tầng 3 CHƯA dò ra trục nào — dùng cho kịch bản phụ "một số tầng có trục". */
const AXIS_GRID_FIXTURE_FLOOR3_PENDING: FloorPlan = {
  ...AXIS_GRID_FIXTURE_FLOOR3,
  axes: [],
};

/** Ba tầng — thứ tự đầu vào cũng là thứ tự `FloorAlignmentReport.floors` trả về. */
export const AXIS_GRID_FIXTURE_FLOORS: readonly FloorPlan[] = [
  AXIS_GRID_FIXTURE_FLOOR1,
  AXIS_GRID_FIXTURE_FLOOR2,
  AXIS_GRID_FIXTURE_FLOOR3,
];

/** Báo cáo căn tầng THẬT — tầng 2 cảnh báo (~200 mm), tầng 1/3 trong dung sai. */
export const AXIS_GRID_FIXTURE_REPORT: FloorAlignmentReport = alignFloors(AXIS_GRID_FIXTURE_FLOORS);

/** Báo cáo của bộ ba tầng đều trong dung sai — dùng cho kịch bản `success`. */
export const AXIS_GRID_FIXTURE_ALL_ALIGNED_REPORT: FloorAlignmentReport = alignFloors([
  AXIS_GRID_FIXTURE_FLOOR1,
  AXIS_GRID_FIXTURE_FLOOR2_ALIGNED,
  AXIS_GRID_FIXTURE_FLOOR3,
]);

/** Báo cáo khi tầng 3 chưa có trục nào — dùng cho kịch bản phụ "một số tầng có trục". */
export const AXIS_GRID_FIXTURE_PENDING_REPORT: FloorAlignmentReport = alignFloors([
  AXIS_GRID_FIXTURE_FLOOR1,
  AXIS_GRID_FIXTURE_FLOOR2,
  AXIS_GRID_FIXTURE_FLOOR3_PENDING,
]);

function findAlignment(report: FloorAlignmentReport, target: LevelId) {
  const found = report.floors.find((alignment) => alignment.levelId === target);
  if (found === undefined) {
    throw new Error(`Không thấy kết quả căn tầng của ${String(target)}.`);
  }
  return found;
}

function findIssue(report: FloorAlignmentReport, target: LevelId, kind: FloorIssue['kind']): FloorIssue {
  const found = report.issues.find((issue) => issue.levelId === target && issue.kind === kind);
  if (found === undefined) {
    throw new Error(`Không thấy cảnh báo "${kind}" cho ${String(target)}.`);
  }
  return found;
}

/**
 * Độ lệch còn lại của tầng 2 SAU căn tự động — để task nghiệm thu Lớp 3 in
 * được bảng "trước và sau" mà không phải tự tính (đọc thẳng từ
 * `FloorAlignmentReport`, không phải một con số viết tay thứ hai).
 */
export const AXIS_GRID_FIXTURE_FLOOR2_EXPECTED_OFFSET_MM: Millimetres = findAlignment(
  AXIS_GRID_FIXTURE_REPORT,
  FLOOR2_LEVEL_ID,
).maxResidualMm;

/** Phép dịch/xoay tốt nhất mà `alignFloors()` tìm được cho tầng 2 — "trước" là {@link FLOOR2_VERTICAL_X_MM}, "sau" là phép này áp lên đó. */
export const AXIS_GRID_FIXTURE_FLOOR2_TRANSFORM: FloorTransform = findAlignment(
  AXIS_GRID_FIXTURE_REPORT,
  FLOOR2_LEVEL_ID,
).transform;

/** Câu cảnh báo THẬT của domain cho tầng 2 — không phải câu tự soạn ở view. */
export const AXIS_GRID_FIXTURE_FLOOR2_ISSUE: FloorIssue = findIssue(AXIS_GRID_FIXTURE_REPORT, FLOOR2_LEVEL_ID, 'alignment');

if (AXIS_GRID_FIXTURE_FLOOR2_EXPECTED_OFFSET_MM <= ALIGNMENT_WARNING_THRESHOLD_MM) {
  throw new Error(
    `Độ lệch tầng 2 phải lớn hơn ngưỡng cảnh báo ${String(ALIGNMENT_WARNING_THRESHOLD_MM)} mm, hiện là ${String(AXIS_GRID_FIXTURE_FLOOR2_EXPECTED_OFFSET_MM)} mm.`,
  );
}
if (findAlignment(AXIS_GRID_FIXTURE_REPORT, FLOOR1_LEVEL_ID).maxResidualMm !== 0) {
  throw new Error('Tầng gốc (tầng 1) phải có độ lệch bằng 0.');
}
if (findAlignment(AXIS_GRID_FIXTURE_REPORT, FLOOR3_LEVEL_ID).maxResidualMm > ALIGNMENT_WARNING_THRESHOLD_MM) {
  throw new Error('Tầng 3 phải trong dung sai (độ lệch không vượt ngưỡng cảnh báo) sau khi căn tự động.');
}
if (AXIS_GRID_FIXTURE_ALL_ALIGNED_REPORT.issues.length !== 0) {
  throw new Error('Bộ ba tầng của kịch bản "success" không được có cảnh báo nào.');
}

/* -------------------------------------------------------------------------- */
/* Lưới trục của tầng gốc — dùng cho panel trái và cho canvas.                 */
/* -------------------------------------------------------------------------- */

/** Trục tầng gốc, đã đặt tên — nguồn duy nhất của `AxisGroupViewModel.rows` (kịch bản đủ hai chiều). */
export const AXIS_GRID_FIXTURE_LABELLED_AXES: readonly LabelledAxis[] = labelAxes(FLOOR1_AXES);

/** Chỉ trục dọc, đã đặt tên — dùng cho kịch bản `partial` ("chỉ có trục dọc"). */
export const AXIS_GRID_FIXTURE_VERTICAL_LABELLED_AXES: readonly LabelledAxis[] = labelAxes(verticalAxes(FLOOR1_AXES));

/** Lưới trục tầng gốc, mốc gốc mặc định `(0, 0)` — dùng để tra giao trục gần nhất. */
export const AXIS_GRID_FIXTURE_GRID: AxisGrid = buildAxisGrid(AXIS_GRID_FIXTURE_LABELLED_AXES);

/** Điểm người dùng đã ghim làm gốc toạ độ — lệch có chủ đích khỏi giao "A-1" để bốn trường độ lệch có số thật để hiện. */
export const AXIS_GRID_FIXTURE_ORIGIN_POINT: PointMm = point(120, 85);

/** Vị trí của điểm gốc trên lưới — trục gần nhất, kèm độ lệch (mm) tới trục đó, đọc bằng `toAxisPosition()`. */
export const AXIS_GRID_FIXTURE_ORIGIN_POSITION: AxisPosition = toAxisPosition(
  AXIS_GRID_FIXTURE_ORIGIN_POINT,
  AXIS_GRID_FIXTURE_GRID,
);

/* -------------------------------------------------------------------------- */
/* Tỷ lệ mm/px dùng chung cho mọi quy đổi canvas — quy đổi LUÔN qua đây.       */
/* -------------------------------------------------------------------------- */

/** 50 mm/px — đủ để lưới 15.200 × 12.060 mm vừa một canvas cỡ vài trăm pixel. */
export const AXIS_GRID_FIXTURE_SCALE: Scale = scaleFromRatio(millimetresPerPixel(50));

/** Bao ngoài toàn bản vẽ, đủ chứa cả ba tầng và điểm gốc — dùng để dựng `boundsPx`. */
export interface AxisGridFixtureBoundsMm {
  readonly x: Millimetres;
  readonly y: Millimetres;
  readonly width: Millimetres;
  readonly height: Millimetres;
}

export const AXIS_GRID_FIXTURE_DRAWING_BOUNDS_MM: AxisGridFixtureBoundsMm = {
  x: millimetres(0),
  y: millimetres(0),
  width: millimetres(15400),
  height: millimetres(12200),
};

/** Bao ngoài riêng tầng 1 — dùng làm đường bao "tầng dưới" (ghost) khi canvas đang xem tầng 2. */
export const AXIS_GRID_FIXTURE_FLOOR1_BOUNDS_MM: AxisGridFixtureBoundsMm = {
  x: millimetres(at(FLOOR1_VERTICAL_X_MM, 0)),
  y: millimetres(at(FLOOR1_HORIZONTAL_Y_MM, 0)),
  width: millimetres(at(FLOOR1_VERTICAL_X_MM, FLOOR1_VERTICAL_X_MM.length - 1) - at(FLOOR1_VERTICAL_X_MM, 0)),
  height: millimetres(at(FLOOR1_HORIZONTAL_Y_MM, FLOOR1_HORIZONTAL_Y_MM.length - 1) - at(FLOOR1_HORIZONTAL_Y_MM, 0)),
};

/* -------------------------------------------------------------------------- */
/* Câu chặn khoảng cách tối thiểu 100 mm — dữ liệu VI PHẠM, tách riêng khỏi    */
/* lưới hợp lệ ở trên (CẤM TUYỆT ĐỐI: không cho hai trục cách nhau dưới       */
/* 100 mm trong dữ liệu hợp lệ).                                              */
/* -------------------------------------------------------------------------- */

/**
 * Ví dụ một lượt kéo trục bị chặn: kéo trục dọc "2" (x = 5.000 mm ở tầng gốc)
 * lại gần trục dọc "1" (x = 0 mm) tới còn cách 80 mm — dưới
 * {@link AXIS_ALIGNMENT_THRESHOLD_MM} (100 mm). Đây KHÔNG phải toạ độ trục
 * thật của bộ mẫu, chỉ là dữ liệu minh hoạ cho câu chặn.
 */
export const AXIS_GRID_FIXTURE_SPACING_VIOLATION_EXAMPLE: AxisSpacingViolation = {
  firstLabel: '1',
  secondLabel: '2',
  actualMm: millimetres(80),
  minimumMm: AXIS_ALIGNMENT_THRESHOLD_MM,
};

if (AXIS_GRID_FIXTURE_SPACING_VIOLATION_EXAMPLE.actualMm >= AXIS_GRID_FIXTURE_SPACING_VIOLATION_EXAMPLE.minimumMm) {
  throw new Error('Dữ liệu minh hoạ câu chặn 100 mm phải thật sự vi phạm (nhỏ hơn ngưỡng tối thiểu).');
}
