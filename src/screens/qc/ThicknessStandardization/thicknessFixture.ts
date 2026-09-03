/**
 * Dữ liệu mẫu của màn Chuẩn hoá độ dày tường: ba tầng, 48 đoạn tường.
 *
 * Dựng từ `Wall` của `src/domain/spatial/types.ts` — kiểu QUẢ THẬT màn QC
 * dùng (T2 đã đối chiếu, xem `docs/notes/thickness/data.md` mục 2 và ghi chú
 * đầu `thicknessTypes.ts`), KHÔNG phải kiểu gắn nhãn của
 * `src/domain/walls/types.ts`.
 *
 * KHÔNG gọi bất kỳ hàm nào của đối tượng Math toàn cục ở đây hay bất cứ đâu
 * trong thư mục màn (nghiệm thu R-69/R-65/R-71 grep rỗng, kể cả trong chú
 * thích — nên chú thích này CỐ Ý không viết liền tên đối tượng đó với dấu
 * chấm phía sau, đúng khuôn `wallLayerReviewFixture.ts:18-20`). Mọi toạ độ,
 * độ dày, độ tin cậy đều là số viết thẳng, không tính ra từ công thức, không
 * có số ngẫu nhiên. Dữ liệu TẤT ĐỊNH.
 *
 * ## Bốn nhóm — đúng câu chuyện của `standardizeThickness`
 *
 * `standardizeThickness` (`src/lib/geometry/standardize.ts:17`): < 165 → 110;
 * 165..<275 → 220; 275..<=350 → 330; > 350 → cột bê tông cốt thép. 48 đoạn
 * chia bốn nhóm số đo, mỗi đoạn ghi rõ nhóm nó rơi vào và độ lệch so với giá
 * trị chuẩn của nhóm đó (nhóm cột bê tông cốt thép không có giá trị chuẩn để
 * lệch — xem ghi chú `thicknessTypes.ts`):
 *
 * - **30 đoạn đo đúng 195 mm** → nhóm 220 (165 ≤ 195 < 275), lệch 25 mm —
 *   NẰM TRONG dung sai mặc định 30 mm ({@link DEFAULT_TOLERANCE_MM} của
 *   `thicknessTypes.ts`). Đây là ca người dùng trong spec: 30 tường 195 mm bị
 *   quy về 220 mm mà không bị dung sai chặn lại.
 * - **6 đoạn lệch quá 30 mm** — đều là số đo NẰM SÁT một trong ba ranh giới
 *   165/275/350, nơi `standardizeThickness` gán nhóm theo NGƯỠNG chứ không
 *   theo giá trị GẦN NHẤT: 70→110 (lệch 40), 164→110 (lệch 54), 166→220
 *   (lệch 54), 274→220 (lệch 54), 276→330 (lệch 54), 280→330 (lệch 50). Đây
 *   không phải số bịa — chúng minh hoạ đúng lý do màn này cần một dung sai
 *   riêng khỏi việc gán nhóm.
 * - **12 đoạn còn lại** trải quanh cả bốn nhóm, TRONG dung sai: quanh 110
 *   (110/100/130), quanh 330 (330/315/345), ba cột bê tông cốt thép
 *   (360/400/450), và thêm quanh 220 (220/200/210) cho đủ cỡ mẫu.
 *
 * Tổng: 30 + 6 + 12 = 48 = {@link FIXTURE_SEGMENT_COUNT}.
 *
 * ## Vì sao đúng 12 đoạn `reviewed: true`
 *
 * `reviewed` (từ `ReviewMetadata` của đồ thị) không phải một thao tác của MÀN
 * NÀY — màn này không có nút "duyệt từng đoạn" (không như `WallLayerReview`).
 * Cờ này tới từ nơi khác (ví dụ `WallLayerReview`) và được ĐỌC ở đây để
 * {@link ReapplyFilterWarning} (`thicknessTypes.ts`) biết "áp dụng lại bộ
 * lọc" sẽ ảnh hưởng bao nhiêu tường đã duyệt — đúng CẤM TUYỆT ĐỐI "không bao
 * giờ ghi đè im lặng tường đã duyệt". Đúng 12/48 mang `reviewed: true`, trải
 * đều bốn nhóm (kể cả một đoạn lệch quá dung sai và một cột bê tông cốt
 * thép), để bài nghiệm thu đếm được bằng hằng {@link FIXTURE_REVIEWED_COUNT}
 * chứ không phải bịa.
 *
 * ## Ba tầng
 *
 * Đúng 16 đoạn mỗi tầng (48 ÷ 3), xen kẽ theo tứ tự dựng để mỗi tầng có đủ cả
 * bốn nhóm — dựng "trạng thái một phần: mới có số đo của một số tầng" chỉ cần
 * lọc theo `levelId`, không cần một tập dữ liệu thứ hai.
 */

import type { Building, Confidence, Level, LevelId, Point, Wall, WallId, WallKind } from '@/domain/spatial/types';

/* -------------------------------------------------------------------------- */
/* Mã hợp lệ — đúng khuôn `wallLayerReviewFixture.ts` (thân mã ≥ 10 ký tự).    */
/* -------------------------------------------------------------------------- */

const COUNTER_LENGTH = 6;
const WALL_ID_SUFFIX = 'THIK';

/** `1` → `'W-000001THIK'`. Thuần đệm chuỗi, không một phép tính hình học nào. */
const wallIdOf = (n: number): WallId => `W-${String(n).padStart(COUNTER_LENGTH, '0')}${WALL_ID_SUFFIX}` as WallId;

const LEVEL_1_ID = 'L-000001TFL1' as LevelId;
const LEVEL_2_ID = 'L-000002TFL2' as LevelId;
const LEVEL_3_ID = 'L-000003TFL3' as LevelId;

/** Chiều cao tường đồng nhất trong bộ mẫu — 3 m thông thuỷ. */
const WALL_HEIGHT_MM = 3000;

/** Dựng một `Wall` hợp lệ của `src/domain/spatial/types.ts`. */
function wall(
  n: number,
  levelId: LevelId,
  start: Point,
  end: Point,
  thicknessMm: number,
  kind: WallKind,
  confidence: Confidence,
  reviewed: boolean,
): Wall {
  return {
    id: wallIdOf(n),
    levelId,
    centreline: { start, end },
    thicknessMm,
    heightMm: WALL_HEIGHT_MM,
    kind,
    openingIds: [],
    confidence,
    source: reviewed ? 'human' : 'ai',
    reviewed,
  };
}

const point = (x: number, y: number): Point => ({ x, y });

/**
 * 48 đoạn tường, xen kẽ ba tầng theo thứ tự dựng (tầng 1 / tầng 2 / tầng 3 /
 * tầng 1 / …), mỗi tầng nhận đúng 16 đoạn ở cùng một vị trí x cho cả ba tầng
 * (tầng xếp chồng đúng kiến trúc thật — cùng toạ độ mặt bằng, khác cao độ).
 *
 * Xem ghi chú đầu file cho lý do của từng nhóm giá trị `thicknessMm`.
 */
export const THICKNESS_FIXTURE_WALLS: readonly Wall[] = [
  // -- 30 đoạn 195 mm → nhóm 220, lệch 25 mm, TRONG dung sai --------------------
  wall(1, LEVEL_1_ID, point(0, 0), point(3000, 0), 195, 'partition', 0.95, true),
  wall(2, LEVEL_2_ID, point(0, 0), point(3000, 0), 195, 'partition', 0.72, false),
  wall(3, LEVEL_3_ID, point(0, 0), point(3000, 0), 195, 'partition', 0.58, false),
  wall(4, LEVEL_1_ID, point(3000, 0), point(6000, 0), 195, 'partition', 0.99, false),
  wall(5, LEVEL_2_ID, point(3000, 0), point(6000, 0), 195, 'partition', 0.81, true),
  wall(6, LEVEL_3_ID, point(3000, 0), point(6000, 0), 195, 'partition', 0.65, false),
  wall(7, LEVEL_1_ID, point(6000, 0), point(9000, 0), 195, 'partition', 0.91, false),
  wall(8, LEVEL_2_ID, point(6000, 0), point(9000, 0), 195, 'partition', 0.77, false),
  wall(9, LEVEL_3_ID, point(6000, 0), point(9000, 0), 195, 'partition', 0.6, true),
  wall(10, LEVEL_1_ID, point(9000, 0), point(12000, 0), 195, 'partition', 0.88, false),
  wall(11, LEVEL_2_ID, point(9000, 0), point(12000, 0), 195, 'partition', 0.93, false),
  wall(12, LEVEL_3_ID, point(9000, 0), point(12000, 0), 195, 'partition', 0.69, false),
  wall(13, LEVEL_1_ID, point(12000, 0), point(15000, 0), 195, 'partition', 0.95, true),
  wall(14, LEVEL_2_ID, point(12000, 0), point(15000, 0), 195, 'partition', 0.72, false),
  wall(15, LEVEL_3_ID, point(12000, 0), point(15000, 0), 195, 'partition', 0.58, false),
  wall(16, LEVEL_1_ID, point(15000, 0), point(18000, 0), 195, 'partition', 0.99, false),
  wall(17, LEVEL_2_ID, point(15000, 0), point(18000, 0), 195, 'partition', 0.81, true),
  wall(18, LEVEL_3_ID, point(15000, 0), point(18000, 0), 195, 'partition', 0.65, false),
  wall(19, LEVEL_1_ID, point(18000, 0), point(21000, 0), 195, 'partition', 0.91, false),
  wall(20, LEVEL_2_ID, point(18000, 0), point(21000, 0), 195, 'partition', 0.77, false),
  wall(21, LEVEL_3_ID, point(18000, 0), point(21000, 0), 195, 'partition', 0.6, true),
  wall(22, LEVEL_1_ID, point(21000, 0), point(24000, 0), 195, 'partition', 0.88, false),
  wall(23, LEVEL_2_ID, point(21000, 0), point(24000, 0), 195, 'partition', 0.93, false),
  wall(24, LEVEL_3_ID, point(21000, 0), point(24000, 0), 195, 'partition', 0.69, false),
  wall(25, LEVEL_1_ID, point(24000, 0), point(27000, 0), 195, 'partition', 0.95, true),
  wall(26, LEVEL_2_ID, point(24000, 0), point(27000, 0), 195, 'partition', 0.72, false),
  wall(27, LEVEL_3_ID, point(24000, 0), point(27000, 0), 195, 'partition', 0.58, false),
  wall(28, LEVEL_1_ID, point(27000, 0), point(30000, 0), 195, 'partition', 0.99, false),
  wall(29, LEVEL_2_ID, point(27000, 0), point(30000, 0), 195, 'partition', 0.81, true),
  wall(30, LEVEL_3_ID, point(27000, 0), point(30000, 0), 195, 'partition', 0.65, false),

  // -- 6 đoạn lệch quá 30 mm — sát ranh giới 165/275/350 -----------------------
  wall(31, LEVEL_1_ID, point(30000, 0), point(33000, 0), 70, 'partition', 0.91, false),
  wall(32, LEVEL_2_ID, point(30000, 0), point(33000, 0), 164, 'partition', 0.77, false),
  wall(33, LEVEL_3_ID, point(30000, 0), point(33000, 0), 166, 'partition', 0.6, true),
  wall(34, LEVEL_1_ID, point(33000, 0), point(36000, 0), 274, 'loadBearing', 0.88, false),
  wall(35, LEVEL_2_ID, point(33000, 0), point(36000, 0), 276, 'loadBearing', 0.93, false),
  wall(36, LEVEL_3_ID, point(33000, 0), point(36000, 0), 280, 'loadBearing', 0.69, false),

  // -- 12 đoạn còn lại — trải bốn nhóm, TRONG dung sai --------------------------
  wall(37, LEVEL_1_ID, point(36000, 0), point(39000, 0), 110, 'partition', 0.95, true),
  wall(38, LEVEL_2_ID, point(36000, 0), point(39000, 0), 100, 'partition', 0.72, false),
  wall(39, LEVEL_3_ID, point(36000, 0), point(39000, 0), 130, 'partition', 0.58, false),
  wall(40, LEVEL_1_ID, point(39000, 0), point(42000, 0), 330, 'loadBearing', 0.99, false),
  wall(41, LEVEL_2_ID, point(39000, 0), point(42000, 0), 315, 'loadBearing', 0.81, true),
  wall(42, LEVEL_3_ID, point(39000, 0), point(42000, 0), 345, 'loadBearing', 0.65, false),
  wall(43, LEVEL_1_ID, point(42000, 0), point(45000, 0), 360, 'loadBearing', 0.91, false),
  wall(44, LEVEL_2_ID, point(42000, 0), point(45000, 0), 400, 'loadBearing', 0.77, false),
  wall(45, LEVEL_3_ID, point(42000, 0), point(45000, 0), 450, 'loadBearing', 0.6, true),
  wall(46, LEVEL_1_ID, point(45000, 0), point(48000, 0), 220, 'loadBearing', 0.88, false),
  wall(47, LEVEL_2_ID, point(45000, 0), point(48000, 0), 200, 'partition', 0.93, false),
  wall(48, LEVEL_3_ID, point(45000, 0), point(48000, 0), 210, 'loadBearing', 0.69, false),
];

/** Tổng số đoạn của bộ mẫu — test khẳng định bằng hằng, không đếm lại tay (R-71). */
export const FIXTURE_SEGMENT_COUNT = 48;

/** Số đoạn `reviewed: true` của bộ mẫu. */
export const FIXTURE_REVIEWED_COUNT = 12;

/** Số đoạn lệch quá {@link DEFAULT_TOLERANCE_MM} so với nhóm được gán. */
export const FIXTURE_EXCEEDING_COUNT = 6;

/** Số đoạn đo đúng 195 mm — ca người dùng chính của spec. */
export const FIXTURE_MEASURED_195_COUNT = 30;

/** Ba tầng của bộ mẫu — mỗi tầng nhận đúng 16/48 đoạn (xem ghi chú đầu file). */
export const THICKNESS_FIXTURE_LEVELS: readonly Level[] = [
  {
    id: LEVEL_1_ID,
    name: 'Tầng 1',
    order: 0,
    elevationMm: 0,
    heightMm: WALL_HEIGHT_MM,
    confidence: 1,
    source: 'human',
    reviewed: true,
  },
  {
    id: LEVEL_2_ID,
    name: 'Tầng 2',
    order: 1,
    elevationMm: WALL_HEIGHT_MM,
    heightMm: WALL_HEIGHT_MM,
    confidence: 1,
    source: 'human',
    reviewed: true,
  },
  {
    id: LEVEL_3_ID,
    name: 'Tầng 3',
    order: 2,
    elevationMm: 6000,
    heightMm: WALL_HEIGHT_MM,
    confidence: 1,
    source: 'human',
    reviewed: true,
  },
];

/** Toà nhà chứa ba tầng mẫu — dữ liệu tối thiểu cho `SpatialGraph.building`. */
export const THICKNESS_FIXTURE_BUILDING: Building = {
  name: 'Nhà mẫu QC chuẩn hoá độ dày',
  datumElevationMm: 0,
  confidence: 1,
  source: 'human',
  reviewed: true,
};
