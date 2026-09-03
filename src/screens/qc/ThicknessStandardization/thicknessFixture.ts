/**
 * Dữ liệu mẫu của màn Chuẩn hoá độ dày tường: 48 đoạn, dựng từ `Wall` của
 * `src/domain/walls/types.ts` — KHÁC domain của hai màn QC anh em, xem ghi chú
 * đầu `thicknessTypes.ts`. `Wall` đó không có `confidence`/`reviewed`/tầng, nên
 * mỗi đoạn bọc trong {@link ThicknessFixtureWall}: `wall` (đúng hình dạng
 * domain), cộng ba trường ngoài domain mà hook cần để dựng `ThicknessSegmentRow`.
 *
 * Bốn nhóm, theo thứ tự dựng (khớp thứ tự mã `W-001`…`W-048`):
 *
 * - **W-001..W-030 — 30 đoạn đo ĐÚNG 195 mm** (ca người dùng chính của đặc tả).
 *   Một cụm lớn, đồng nhất — sai số hiệu chỉnh có hệ thống, gợi ý nhóm 220 mm.
 *   Xem quyết định đã duyệt X4 ở `thicknessTypes.ts`: cụm đông này được MIỄN
 *   khỏi phép kiểm dung sai per-wall, dù cách nhóm 220 tới 25 mm (> `DEFAULT_TOLERANCE_MM`).
 * - **W-031..W-035 — 5 đoạn quanh 110 mm** (108/110/112/105/115), lệch ≤5 mm,
 *   trong dung sai, gợi ý nhóm 110.
 * - **W-036..W-039 — 4 đoạn quanh 330 mm** (325/330/335/328), lệch ≤5 mm,
 *   trong dung sai, gợi ý nhóm 330.
 * - **W-040..W-042 — 3 đoạn cột bê tông cốt thép** (480/520/560 mm) — vượt xa
 *   330, KHÔNG gợi ý một trong ba nhóm chuẩn. Xem ghi chú thiếu-logic ở X2
 *   (`thicknessTypes.ts`): bộ mẫu chỉ đảm bảo một khoảng trống 115 mm
 *   (365↔480 mm) không đoạn nào rơi vào, không tự quyết ngưỡng phân loại thật.
 * - **W-043..W-048 — 6 đoạn ĐO LẺ, mỗi đoạn một giá trị KHÔNG lặp lại**
 *   (80/145/170/260/300/365 mm), mỗi đoạn lệch >20 mm so với nhóm chuẩn gần
 *   nhất — đúng SÁU đoạn mà câu tóm tắt "6 tường lệch quá 20 mm sẽ không đổi"
 *   của đặc tả cần. `isUnclusteredOutlier` dưới đây tính lại đúng sáu đoạn
 *   này TỪ DỮ LIỆU, không đếm tay — xem quyết định đã duyệt X4.
 *
 * Trải trên BA tầng (`floorName`) qua `baseElevationMm`/`topElevationMm` —
 * `Wall` của domain này không có `levelId` nên "tầng" chỉ có nghĩa qua cao độ.
 * Mười hai đoạn `reviewed: true` (chọn rải trong cả năm nhóm, cả ba tầng, để
 * không nhóm/tầng nào độc quyền "đã duyệt"). Độ tin cậy trải đủ ba mức của
 * `confidenceLevel` (`src/lib/format/semantic.ts`): `certain` (≥0,90),
 * `suggested` (0,70–0,89), `needsReview` (<0,70).
 *
 * KHÔNG có số ngẫu nhiên nào trong file này — mọi mã, toạ độ, độ dày, độ tin
 * cậy đều là đối số VIẾT THẲNG tại từng lời gọi `wallEntry(...)`, không suy ra
 * từ chỉ số vòng lặp. Dữ liệu TẤT ĐỊNH.
 */

import { isThicknessInRange, type Wall, type WallKind } from '@/domain/walls/types';
import type { WallId } from '@/domain/spatial/types';
import { millimetres } from '@/domain/units/types';

import { DEFAULT_TOLERANCE_MM, THICKNESS_GROUPS_MM } from './thicknessTypes';

/* -------------------------------------------------------------------------- */
/* Mã tường và tầng.                                                           */
/* -------------------------------------------------------------------------- */

/** `1` → `'W-001'`. Thuần đệm số, không một phép tính hình học nào. */
const wallIdOf = (code: number): WallId => `W-${String(code).padStart(3, '0')}` as WallId;

/** Chiều cao tường đồng nhất trong bộ mẫu — 3 m thông thuỷ. */
const WALL_HEIGHT_MM = 3000;

interface FixtureFloor {
  readonly name: string;
  readonly baseElevationMm: number;
}

/**
 * Ba tầng của bộ mẫu — tên hiển thị và cao độ đáy, cách nhau đúng `WALL_HEIGHT_MM`.
 * Khai kiểu bộ ba cố định (không phải `FixtureFloor[]` chung chung) để chỉ số
 * `0 | 1 | 2` tra thẳng ra một `FixtureFloor`, không phải `FixtureFloor | undefined`
 * (`noUncheckedIndexedAccess`).
 */
const FLOORS: readonly [FixtureFloor, FixtureFloor, FixtureFloor] = [
  { name: 'Tầng 1', baseElevationMm: 0 },
  { name: 'Tầng 2', baseElevationMm: 3000 },
  { name: 'Tầng 3', baseElevationMm: 6000 },
];

/* -------------------------------------------------------------------------- */
/* Một đoạn của bộ mẫu — `Wall` domain cộng ba trường ngoài domain.            */
/* -------------------------------------------------------------------------- */

/**
 * Một đoạn tường của bộ mẫu: `Wall` đúng hình dạng `src/domain/walls/types.ts`
 * (dùng thẳng được với `isThicknessInRange`, `cleanupWalls`, `resolveWallShapes`),
 * cộng ba trường mà `Wall` đó không mang — hook (T5) đọc cả bốn để dựng một
 * `ThicknessSegmentRow`.
 */
export interface ThicknessFixtureWall {
  readonly wall: Wall;
  readonly confidence: number;
  readonly reviewed: boolean;
  readonly floorName: string;
}

/** Dựng một đoạn của bộ mẫu — mọi đối số viết thẳng tại chỗ gọi, không suy ra từ `code`. */
function wallEntry(
  code: number,
  xStartMm: number,
  xEndMm: number,
  thicknessMm: number,
  kind: WallKind,
  floorIndex: 0 | 1 | 2,
  confidence: number,
  reviewed: boolean,
): ThicknessFixtureWall {
  const floor = FLOORS[floorIndex];
  return {
    wall: {
      id: wallIdOf(code),
      kind,
      centreline: {
        start: { x: millimetres(xStartMm), y: millimetres(0) },
        end: { x: millimetres(xEndMm), y: millimetres(0) },
      },
      thicknessMm: millimetres(thicknessMm),
      baseElevationMm: millimetres(floor.baseElevationMm),
      topElevationMm: millimetres(floor.baseElevationMm + WALL_HEIGHT_MM),
    },
    confidence,
    reviewed,
    floorName: floor.name,
  };
}

/* -------------------------------------------------------------------------- */
/* 48 đoạn.                                                                    */
/* -------------------------------------------------------------------------- */

export const THICKNESS_FIXTURE_WALLS: readonly ThicknessFixtureWall[] = [
  // -- W-001..W-030 — 30 đoạn đo đúng 195 mm, tầng 1-2-3 (10 mỗi tầng). ------
  wallEntry(1, 0, 800, 195, 'partition', 0, 0.95, true),
  wallEntry(2, 1000, 1800, 195, 'partition', 0, 0.92, true),
  wallEntry(3, 2000, 2800, 195, 'partition', 0, 0.88, true),
  wallEntry(4, 3000, 3800, 195, 'partition', 0, 0.9, false),
  wallEntry(5, 4000, 4800, 195, 'partition', 0, 0.83, false),
  wallEntry(6, 5000, 5800, 195, 'partition', 0, 0.77, false),
  wallEntry(7, 6000, 6800, 195, 'partition', 0, 0.65, false),
  wallEntry(8, 7000, 7800, 195, 'partition', 0, 0.58, false),
  wallEntry(9, 8000, 8800, 195, 'partition', 0, 0.72, false),
  wallEntry(10, 9000, 9800, 195, 'partition', 0, 0.91, false),
  wallEntry(11, 10000, 10800, 195, 'partition', 1, 0.94, true),
  wallEntry(12, 11000, 11800, 195, 'partition', 1, 0.89, true),
  wallEntry(13, 12000, 12800, 195, 'partition', 1, 0.99, true),
  wallEntry(14, 13000, 13800, 195, 'partition', 1, 0.81, false),
  wallEntry(15, 14000, 14800, 195, 'partition', 1, 0.63, false),
  wallEntry(16, 15000, 15800, 195, 'partition', 1, 0.7, false),
  wallEntry(17, 16000, 16800, 195, 'partition', 1, 0.96, false),
  wallEntry(18, 17000, 17800, 195, 'partition', 1, 0.55, false),
  wallEntry(19, 18000, 18800, 195, 'partition', 1, 0.86, false),
  wallEntry(20, 19000, 19800, 195, 'partition', 1, 0.93, false),
  wallEntry(21, 20000, 20800, 195, 'partition', 2, 0.68, false),
  wallEntry(22, 21000, 21800, 195, 'partition', 2, 0.79, false),
  wallEntry(23, 22000, 22800, 195, 'partition', 2, 0.97, false),
  wallEntry(24, 23000, 23800, 195, 'partition', 2, 0.61, false),
  wallEntry(25, 24000, 24800, 195, 'partition', 2, 0.84, false),
  wallEntry(26, 25000, 25800, 195, 'partition', 2, 0.9, false),
  wallEntry(27, 26000, 26800, 195, 'partition', 2, 0.73, false),
  wallEntry(28, 27000, 27800, 195, 'partition', 2, 0.66, false),
  wallEntry(29, 28000, 28800, 195, 'partition', 2, 0.98, false),
  wallEntry(30, 29000, 29800, 195, 'partition', 2, 0.8, false),

  // -- W-031..W-035 — 5 đoạn quanh 110 mm, lệch ≤5 mm, trong dung sai. -------
  wallEntry(31, 30000, 30800, 108, 'railing', 0, 0.91, true),
  wallEntry(32, 31000, 31800, 110, 'railing', 0, 0.76, false),
  wallEntry(33, 32000, 32800, 112, 'railing', 1, 0.85, true),
  wallEntry(34, 33000, 33800, 105, 'railing', 1, 0.64, false),
  wallEntry(35, 34000, 34800, 115, 'railing', 2, 0.95, false),

  // -- W-036..W-039 — 4 đoạn quanh 330 mm, lệch ≤5 mm, trong dung sai. -------
  wallEntry(36, 35000, 35800, 325, 'loadBearing', 0, 0.93, true),
  wallEntry(37, 36000, 36800, 330, 'loadBearing', 0, 0.78, false),
  wallEntry(38, 37000, 37800, 335, 'loadBearing', 1, 0.99, true),
  wallEntry(39, 38000, 38800, 328, 'loadBearing', 2, 0.59, false),

  // -- W-040..W-042 — 3 đoạn cột bê tông cốt thép, vượt xa 330 mm. -----------
  wallEntry(40, 39000, 39800, 480, 'loadBearing', 0, 0.9, true),
  wallEntry(41, 40000, 40800, 520, 'loadBearing', 1, 0.74, false),
  wallEntry(42, 41000, 41800, 560, 'loadBearing', 2, 0.6, false),

  // -- W-043..W-048 — 6 đoạn đo lẻ, mỗi đoạn lệch >20 mm so với nhóm gần nhất. --
  wallEntry(43, 42000, 42800, 80, 'partition', 0, 0.88, true),
  wallEntry(44, 43000, 43800, 145, 'glazed', 0, 0.55, false),
  wallEntry(45, 44000, 44800, 170, 'railing', 1, 0.92, false),
  wallEntry(46, 45000, 45800, 260, 'loadBearing', 1, 0.67, false),
  wallEntry(47, 46000, 46800, 300, 'partition', 2, 0.81, false),
  wallEntry(48, 47000, 47800, 365, 'loadBearing', 2, 0.97, false),
];

/* -------------------------------------------------------------------------- */
/* Hằng đếm sẵn — test khẳng định bằng hằng, không đếm lại tay (R-71).         */
/* -------------------------------------------------------------------------- */

/** Tổng số đoạn của bộ mẫu. */
export const FIXTURE_SEGMENT_COUNT = THICKNESS_FIXTURE_WALLS.length;

/** Số đoạn đã duyệt (`reviewed: true`) của bộ mẫu. */
export const FIXTURE_REVIEWED_COUNT = THICKNESS_FIXTURE_WALLS.filter((entry) => entry.reviewed).length;

/** Số đoạn đo đúng 195 mm — ca người dùng chính của đặc tả. */
export const FIXTURE_MEASURED_195_COUNT = THICKNESS_FIXTURE_WALLS.filter(
  (entry) => entry.wall.thicknessMm === 195,
).length;

/**
 * Khoảng cách tới nhóm chuẩn gần nhất trong {@link THICKNESS_GROUPS_MM}.
 * Chỉ dùng cho phép tự kiểm của FILE NÀY — không phải thuật toán chính thức
 * của màn (đó là việc của T5, xem ghi chú thiếu-logic ở X2, `thicknessTypes.ts`).
 */
function nearestGroupDeviationMm(thicknessMm: number): number {
  const distances = THICKNESS_GROUPS_MM.map((group) => Math.abs(thicknessMm - group));
  return Math.min(...distances);
}

/**
 * Biên trên hợp lý cho "còn là một băng tường", dùng riêng cho phép tự kiểm
 * dưới đây. Nằm giữa khoảng trống 365↔480 mm mà bộ mẫu cố ý để trống (xem ghi
 * chú đầu file) — không phải một ngưỡng phân loại cột chính thức.
 */
const PLAUSIBLE_WALL_MAX_MM = 400;

/**
 * Một đoạn đo LẺ (không đoạn nào khác của bộ mẫu đo trùng giá trị này) và lệch
 * quá {@link DEFAULT_TOLERANCE_MM} so với nhóm chuẩn gần nhất — đúng định
 * nghĩa "lệch quá dung sai" của quyết định đã duyệt X4 (`thicknessTypes.ts`).
 * Một cụm đo (≥2 đoạn cùng giá trị, như 30 đoạn 195 mm) không bao giờ qua hàm
 * này dù lệch bao nhiêu; một đoạn cột bê tông cốt thép (ngoài
 * {@link PLAUSIBLE_WALL_MAX_MM}) cũng không, vì nó không có nhóm chuẩn để so.
 */
function isUnclusteredOutlier(thicknessMm: number, allThicknesses: readonly number[]): boolean {
  if (thicknessMm > PLAUSIBLE_WALL_MAX_MM) {
    return false;
  }
  const occurrences = allThicknesses.filter((value) => value === thicknessMm).length;
  return occurrences === 1 && nearestGroupDeviationMm(thicknessMm) > DEFAULT_TOLERANCE_MM;
}

const ALL_FIXTURE_THICKNESSES = THICKNESS_FIXTURE_WALLS.map((entry) => entry.wall.thicknessMm);

/** Số đoạn lệch quá dung sai — tính từ dữ liệu qua {@link isUnclusteredOutlier}, không gõ tay. */
export const FIXTURE_EXCEEDING_COUNT = THICKNESS_FIXTURE_WALLS.filter((entry) =>
  isUnclusteredOutlier(entry.wall.thicknessMm, ALL_FIXTURE_THICKNESSES),
).length;

/* -------------------------------------------------------------------------- */
/* Khẳng định — ném lỗi ngay lúc nạp module, không hỏng muộn ở một test.       */
/* -------------------------------------------------------------------------- */

if (FIXTURE_SEGMENT_COUNT !== 48) {
  throw new Error(`Bộ mẫu Chuẩn hoá độ dày tường phải có đúng 48 đoạn, hiện có ${String(FIXTURE_SEGMENT_COUNT)}.`);
}
if (FIXTURE_REVIEWED_COUNT !== 12) {
  throw new Error(`Bộ mẫu phải có đúng 12 đoạn đã duyệt, hiện có ${String(FIXTURE_REVIEWED_COUNT)}.`);
}
if (FIXTURE_MEASURED_195_COUNT !== 30) {
  throw new Error(`Bộ mẫu phải có đúng 30 đoạn đo 195 mm, hiện có ${String(FIXTURE_MEASURED_195_COUNT)}.`);
}
if (FIXTURE_EXCEEDING_COUNT !== 6) {
  throw new Error(`Bộ mẫu phải có đúng 6 đoạn lệch quá dung sai, hiện có ${String(FIXTURE_EXCEEDING_COUNT)}.`);
}
for (const entry of THICKNESS_FIXTURE_WALLS) {
  if (!isThicknessInRange(entry.wall.thicknessMm)) {
    throw new Error(`Tường ${entry.wall.id} có độ dày ${String(entry.wall.thicknessMm)} mm, ngoài 60–600 mm.`);
  }
}

/* -------------------------------------------------------------------------- */
/* Biến thể theo trạng thái.                                                   */
/* -------------------------------------------------------------------------- */

/** Trạng thái `empty` — chưa đo được đoạn tường nào. */
export const THICKNESS_FIXTURE_EMPTY: readonly ThicknessFixtureWall[] = [];

/** Tên ba tầng của bộ mẫu, đúng thứ tự {@link FLOORS} — dùng để lọc theo tầng ở kịch bản `partial`. */
export const THICKNESS_FIXTURE_FLOOR_NAMES: readonly string[] = FLOORS.map((floor) => floor.name);
