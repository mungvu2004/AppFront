/**
 * Dữ liệu mẫu của màn Duyệt lớp tường: một tầng, 48 tường, 12 đã duyệt.
 *
 * Dựng một mặt bằng ĐỌC ĐƯỢC — lưới 5 cột × 4 hàng phòng, tường bao + tường
 * ngăn — chứ không phải 48 đoạn ngẫu nhiên. Mọi đầu tường dùng lại ĐÚNG cùng
 * một giá trị toạ độ số nguyên ở nơi chúng gặp nhau (0 mm lệch, không phải chỉ
 * "trong ngưỡng 50 mm" của `DEFAULT_JOINT_THRESHOLD_MM`,
 * `src/domain/walls/joints.ts:63`), nên `resolveJoints`/`resolveWallShapes`
 * giải được mọi nút giao mà không cần hàn (weld) gì thêm.
 *
 * Lưới: 6 đường dọc x = 0/2.500/5.000/7.500/10.000/12.500, 5 đường ngang
 * y = 0/2.200/4.400/6.600/8.800 (đơn vị mm). Lưới đầy đủ (5 cột × 4 hàng
 * phòng) cho 49 đoạn tường; BỎ ĐÚNG MỘT đoạn ngăn nội bộ (đoạn dọc x=5.000,
 * y 2.200→4.400) để gộp hai phòng liền kề thành một phòng lớn hơn — đây là
 * cách 48 tường ra đúng số mà vẫn là một mặt bằng hợp lệ, không phải một lưới
 * bị cắt xén tuỳ tiện.
 *
 * KHÔNG gọi bất kỳ hàm nào của đối tượng `Math` toàn cục ở đây hay bất cứ đâu
 * trong thư mục màn — nghiệm thu cuối grep rỗng (kể cả trong chú thích, nên
 * chú thích này CỐ Ý không viết liền tên đối tượng đó với dấu chấm phía sau).
 * Mọi toạ độ, độ dày, độ tin cậy đều là số viết thẳng, không tính ra từ công
 * thức, không có số ngẫu nhiên. Dữ liệu TẤT ĐỊNH.
 */

import { normalizeSpatial, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Building, Confidence, Level, LevelId, Point, Wall, WallId, WallKind } from '@/domain/spatial/types';
import { millimetresPerPixel } from '@/domain/units/scale';

/*
 * Mã hợp lệ của bộ mẫu — vì sao dài hơn "W-001".
 *
 * `src/domain/spatial/ids.ts` đòi thân mã dài ít nhất `MIN_BODY_LENGTH` = 10 ký
 * tự `[0-9A-Z]` (6 ký tự đếm + 4 ký tự ngẫu nhiên, `ids.ts:40-43,95`). Mã rút
 * gọn `W-001` có thân dài BA, nên `isIdOfKind('wall', 'W-001')` trả `false` và
 * `src/lib/commands/dispatch.ts:285` từ chối MỌI lệnh trên tường của bộ mẫu với
 * "đối tượng W-001 trong bản vẽ không phải loại wall." Hệ quả đo được: duyệt,
 * đổi độ dày, tách, nối, xoá đều không chạy — tức bản nghiệm thu bàn phím
 * 12 → 17 → 12 không thể đạt.
 *
 * Nên bộ mẫu sinh mã ĐÚNG KHUÔN `createId`: tiền tố, 6 chữ số đếm, rồi bốn ký
 * tự đuôi. Đuôi ở đây là hằng chứ không ngẫu nhiên — dữ liệu bộ mẫu phải TẤT
 * ĐỊNH, và số đếm đã đủ bảo đảm không hai mã nào trùng nhau.
 *
 * Nhãn người đọc KHÔNG dài theo: `wallDisplayCode` của `wallLayerReviewGateway.ts`
 * đọc ngược sáu chữ số đếm ra "#W-014", đúng mã mà đặc tả đòi thanh tra hiện.
 */

/** Số chữ số của phần đếm trong thân mã — `COUNTER_LENGTH` của `ids.ts:41`. */
const COUNTER_LENGTH = 6;

/** Bốn ký tự đuôi, cố định để bộ mẫu tất định (xem ghi chú trên). */
const WALL_ID_SUFFIX = 'WALL';
const LEVEL_ID_SUFFIX = 'LVL0';

/** `'W-001'` → `'W-000001WALL'`. Thuần cắt chuỗi, không một phép tính nào. */
const wallIdOf = (code: string): WallId =>
  `W-${code.slice(2).padStart(COUNTER_LENGTH, '0')}${WALL_ID_SUFFIX}` as WallId;

/** Tầng duy nhất của bộ mẫu. */
const LEVEL_ID = `L-${'1'.padStart(COUNTER_LENGTH, '0')}${LEVEL_ID_SUFFIX}` as LevelId;

/** Chiều cao tường đồng nhất trong bộ mẫu — 3 m thông thuỷ. */
const WALL_HEIGHT_MM = 3000;

/**
 * Dựng một `Wall` hợp lệ của `src/domain/spatial/types.ts`.
 *
 * A5: `reviewed: true` chỉ đánh dấu việc người duyệt, nên `source` đi kèm
 * `reviewed` chứ không phải một tham số độc lập — không tường nào trong bộ mẫu
 * dựng được vừa `source: 'ai'` vừa `reviewed: true` (xem `WALL_LAYER_FIXTURE_WALLS`
 * bên dưới: đúng 12 lệnh `wall(...)` truyền `reviewed = true`).
 */
function wall(
  code: string,
  start: Point,
  end: Point,
  thicknessMm: number,
  kind: WallKind,
  confidence: Confidence,
  reviewed: boolean,
): Wall {
  return {
    id: wallIdOf(code),
    levelId: LEVEL_ID,
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

/**
 * 48 tường, đúng 12 tường `reviewed: true`.
 *
 * Bốn nhóm, theo thứ tự dựng (khớp thứ tự mã `W-001`…`W-048`):
 * - W-001..W-005, W-021..W-025 — tường bao ngang (`envelope`), dày 330 mm.
 * - W-006..W-020 — tường ngăn ngang nội bộ (`partition`); ba tường đầu
 *   (W-006/007/008) mang độ dày KHÔNG CHUẨN 175/235/90 mm để bộ lọc thứ ba có
 *   cái để lọc — `STANDARD_THICKNESSES_MM` của `src/domain/walls/cleanup.ts:70-72`
 *   là ba băng `[110, 220, 330]` của WALL_THICKNESS_CHOICES, ba giá trị này không nằm trong đó.
 * - W-026..W-029, W-045..W-048 — tường bao dọc (`envelope`), dày 330 mm.
 * - W-030..W-044 — tường ngăn dọc chịu lực (`loadBearing`), dày 220 mm; thiếu
 *   đoạn x=5.000, y 2.200→4.400 (bị bỏ có chủ đích, xem ghi chú đầu file).
 *
 * `W-014` — ví dụ thanh tra của đặc tả — có `confidence: 0.71` và
 * `thicknessMm: 220` đúng như yêu cầu, `reviewed: false`.
 *
 * Ngưỡng "cần chú ý" của màn là băng `needsReview` của
 * `src/lib/format/semantic.ts` — **dưới 0,70** (xem `isLowConfidence` ở
 * `wallLayerReviewGateway.ts`). Đúng SÁU tường của bộ mẫu nằm dưới ngưỡng đó,
 * nên gạch chéo và bộ lọc "Chỉ hiện độ tin cậy thấp" luôn có cái để hiện:
 * W-004 (0,58), W-007 (0,62), W-010 (0,65), W-017 (0,68), W-021 (0,55),
 * W-033 (0,60).
 *
 * Ba tường nữa nằm trong băng `suggested` (0,70 ≤ x < 0,90) — W-014 (0,71),
 * W-026 (0,72), W-041 (0,74) — nên chúng vẫn là `attention` trong danh sách
 * nhưng KHÔNG bị gạch chéo. Câu này từng ghi "chín tường có confidence < 0,75",
 * đúng theo một ngưỡng 0,75 không tồn tại trong mã.
 */
export const WALL_LAYER_FIXTURE_WALLS: readonly Wall[] = [
  wall('W-001', { x: 0, y: 0 }, { x: 2500, y: 0 }, 330, 'envelope', 0.76, false),
  wall('W-002', { x: 2500, y: 0 }, { x: 5000, y: 0 }, 330, 'envelope', 0.92, true),
  wall('W-003', { x: 5000, y: 0 }, { x: 7500, y: 0 }, 330, 'envelope', 0.99, false),
  wall('W-004', { x: 7500, y: 0 }, { x: 10000, y: 0 }, 330, 'envelope', 0.58, false),
  wall('W-005', { x: 10000, y: 0 }, { x: 12500, y: 0 }, 330, 'envelope', 0.95, true),
  wall('W-006', { x: 0, y: 2200 }, { x: 2500, y: 2200 }, 175, 'partition', 0.82, false),
  wall('W-007', { x: 2500, y: 2200 }, { x: 5000, y: 2200 }, 235, 'partition', 0.62, false),
  wall('W-008', { x: 5000, y: 2200 }, { x: 7500, y: 2200 }, 90, 'partition', 0.95, false),
  wall('W-009', { x: 7500, y: 2200 }, { x: 10000, y: 2200 }, 110, 'partition', 0.9, true),
  wall('W-010', { x: 10000, y: 2200 }, { x: 12500, y: 2200 }, 110, 'partition', 0.65, false),
  wall('W-011', { x: 0, y: 4400 }, { x: 2500, y: 4400 }, 110, 'partition', 0.88, false),
  wall('W-012', { x: 2500, y: 4400 }, { x: 5000, y: 4400 }, 110, 'partition', 0.93, true),
  wall('W-013', { x: 5000, y: 4400 }, { x: 7500, y: 4400 }, 110, 'partition', 0.91, false),
  wall('W-014', { x: 7500, y: 4400 }, { x: 10000, y: 4400 }, 220, 'partition', 0.71, false),
  wall('W-015', { x: 10000, y: 4400 }, { x: 12500, y: 4400 }, 110, 'partition', 0.79, false),
  wall('W-016', { x: 0, y: 6600 }, { x: 2500, y: 6600 }, 110, 'partition', 0.97, true),
  wall('W-017', { x: 2500, y: 6600 }, { x: 5000, y: 6600 }, 110, 'partition', 0.68, false),
  wall('W-018', { x: 5000, y: 6600 }, { x: 7500, y: 6600 }, 110, 'partition', 0.97, false),
  wall('W-019', { x: 7500, y: 6600 }, { x: 10000, y: 6600 }, 110, 'partition', 0.85, false),
  wall('W-020', { x: 10000, y: 6600 }, { x: 12500, y: 6600 }, 110, 'partition', 0.92, true),
  wall('W-021', { x: 0, y: 8800 }, { x: 2500, y: 8800 }, 330, 'envelope', 0.55, false),
  wall('W-022', { x: 2500, y: 8800 }, { x: 5000, y: 8800 }, 330, 'envelope', 0.93, false),
  wall('W-023', { x: 5000, y: 8800 }, { x: 7500, y: 8800 }, 330, 'envelope', 0.78, false),
  wall('W-024', { x: 7500, y: 8800 }, { x: 10000, y: 8800 }, 330, 'envelope', 0.96, true),
  wall('W-025', { x: 10000, y: 8800 }, { x: 12500, y: 8800 }, 330, 'envelope', 0.96, false),
  wall('W-026', { x: 0, y: 0 }, { x: 0, y: 2200 }, 330, 'envelope', 0.72, false),
  wall('W-027', { x: 0, y: 2200 }, { x: 0, y: 4400 }, 330, 'envelope', 0.9, true),
  wall('W-028', { x: 0, y: 4400 }, { x: 0, y: 6600 }, 330, 'envelope', 0.81, false),
  wall('W-029', { x: 0, y: 6600 }, { x: 0, y: 8800 }, 330, 'envelope', 0.9, false),
  wall('W-030', { x: 2500, y: 0 }, { x: 2500, y: 2200 }, 220, 'loadBearing', 0.87, false),
  wall('W-031', { x: 2500, y: 2200 }, { x: 2500, y: 4400 }, 220, 'loadBearing', 0.94, true),
  wall('W-032', { x: 2500, y: 4400 }, { x: 2500, y: 6600 }, 220, 'loadBearing', 0.94, false),
  wall('W-033', { x: 2500, y: 6600 }, { x: 2500, y: 8800 }, 220, 'loadBearing', 0.6, false),
  wall('W-034', { x: 5000, y: 0 }, { x: 5000, y: 2200 }, 220, 'loadBearing', 0.77, false),
  wall('W-035', { x: 5000, y: 4400 }, { x: 5000, y: 6600 }, 220, 'loadBearing', 0.98, true),
  wall('W-036', { x: 5000, y: 6600 }, { x: 5000, y: 8800 }, 220, 'loadBearing', 0.98, false),
  wall('W-037', { x: 7500, y: 0 }, { x: 7500, y: 2200 }, 220, 'loadBearing', 0.83, false),
  wall('W-038', { x: 7500, y: 2200 }, { x: 7500, y: 4400 }, 220, 'loadBearing', 0.92, false),
  wall('W-039', { x: 7500, y: 4400 }, { x: 7500, y: 6600 }, 220, 'loadBearing', 0.93, true),
  wall('W-040', { x: 7500, y: 6600 }, { x: 7500, y: 8800 }, 220, 'loadBearing', 0.8, false),
  wall('W-041', { x: 10000, y: 0 }, { x: 10000, y: 2200 }, 220, 'loadBearing', 0.74, false),
  wall('W-042', { x: 10000, y: 2200 }, { x: 10000, y: 4400 }, 220, 'loadBearing', 0.89, false),
  wall('W-043', { x: 10000, y: 4400 }, { x: 10000, y: 6600 }, 220, 'loadBearing', 0.97, true),
  wall('W-044', { x: 10000, y: 6600 }, { x: 10000, y: 8800 }, 220, 'loadBearing', 0.84, false),
  wall('W-045', { x: 12500, y: 0 }, { x: 12500, y: 2200 }, 330, 'envelope', 0.86, false),
  wall('W-046', { x: 12500, y: 2200 }, { x: 12500, y: 4400 }, 330, 'envelope', 0.76, false),
  wall('W-047', { x: 12500, y: 4400 }, { x: 12500, y: 6600 }, 330, 'envelope', 0.99, false),
  wall('W-048', { x: 12500, y: 6600 }, { x: 12500, y: 8800 }, 330, 'envelope', 0.82, false),
];

/** Tổng số tường của bộ mẫu — test khẳng định bằng hằng, không bằng số viết tay (R-71). */
export const WALL_LAYER_FIXTURE_TOTAL = 48;

/** Số tường đã duyệt của bộ mẫu. */
export const WALL_LAYER_FIXTURE_REVIEWED = 12;

/** Tầng duy nhất — diện tích 12,5 m × 8,8 m = 110 m² (bao ngoài, không trừ tường). */
export const WALL_LAYER_FIXTURE_LEVEL: Level = {
  id: LEVEL_ID,
  name: 'Tầng 1',
  order: 0,
  elevationMm: 0,
  heightMm: WALL_HEIGHT_MM,
  areaM2: 110,
  scaleMillimetresPerPixel: millimetresPerPixel(12),
  confidence: 1,
  source: 'human',
  reviewed: true,
};

/** Toà nhà chứa tầng mẫu — dữ liệu tối thiểu cho `SpatialGraph.building`. */
export const WALL_LAYER_FIXTURE_BUILDING: Building = {
  name: 'Nhà mẫu QC lớp tường',
  datumElevationMm: 0,
  confidence: 1,
  source: 'human',
  reviewed: true,
};

/** Đồ thị đầy đủ — chỉ tầng, tường; các danh sách khác rỗng vì màn này không cần tới. */
const WALL_LAYER_FIXTURE_GRAPH = {
  building: WALL_LAYER_FIXTURE_BUILDING,
  levels: [WALL_LAYER_FIXTURE_LEVEL],
  walls: WALL_LAYER_FIXTURE_WALLS,
  openings: [],
  furniture: [],
  rooms: [],
  axes: [],
  dimensions: [],
  notes: [],
};

/** Dạng phẳng, dựng sẵn bằng `normalizeSpatial` để hook dùng thẳng, không tự chuẩn hoá lại. */
export const WALL_LAYER_FIXTURE_NORMALIZED: NormalizedSpatial = normalizeSpatial(WALL_LAYER_FIXTURE_GRAPH);
