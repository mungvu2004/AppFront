/**
 * Dữ liệu mẫu của màn Duyệt tên phòng: một tầng, ĐÚNG 14 phòng, tổng diện tích
 * ĐÚNG 248,60 m² — khớp `SAMPLE_TOTAL_AREA_M2` của
 * `src/domain/spatial/__fixtures__/sampleBuilding.ts`, lấy làm mốc đối chiếu
 * thay vì gõ tay 248,6 lần thứ hai.
 *
 * Bộ kích thước dùng đúng gợi ý của đặc tả — cộng ra đúng tổng mà không cần
 * số lẻ nào:
 *
 *   12 phòng 5.000 × 3.400 mm = 17,00 m² mỗi phòng = 204,00
 *    1 phòng (mã hiển thị #R-005) 4.600 × 4.000 mm = 18,40
 *    1 phòng (mã hiển thị #R-014) 5.240 × 5.000 mm = 26,20
 *   Tổng = 204,00 + 18,40 + 26,20 = 248,60 m²
 *
 * `areaM2` của TỪNG phòng tính bằng `computeArea(outline)` của
 * `src/domain/rooms/area.ts` — không gõ tay; tổng đối chiếu tính bằng
 * `totalArea(...)` (cộng ở đơn vị mm² rồi mới làm tròn MỘT lần), không phải
 * cộng các `areaM2` đã làm tròn của từng phòng — xem lý do "cộng rồi làm tròn
 * một lần" ở đầu `area.ts`.
 *
 * ## Mã hợp lệ — vì sao dài hơn "R-005"
 *
 * Đúng khuôn `wallLayerReviewFixture.ts`: `src/domain/spatial/ids.ts` đòi thân
 * mã dài ít nhất 10 ký tự `[0-9A-Z]`, nên `"R-005"` KHÔNG phải một `RoomId`
 * hợp lệ theo `isIdOfKind('room', ...)` — mọi lệnh nghiệp vụ trên phòng của bộ
 * mẫu (đổi tên, đổi công năng, gộp, tách) sẽ bị `dispatch.ts` từ chối nếu id
 * ngắn. `roomIdOf('R-005')` sinh đúng khuôn `createId`: tiền tố, sáu chữ số
 * đếm, bốn ký tự đuôi cố định (bộ mẫu phải TẤT ĐỊNH). Mã hiển thị ngắn
 * (`"#R-005"`) là việc của hook (T5) khi dựng `RoomLabelViewModel.codeLabel`,
 * đọc ngược sáu chữ số đếm — bộ mẫu này chỉ cần đúng chữ số đếm ở đúng vị trí.
 *
 * ## Tên phòng phản ánh đúng thực tế người duyệt gặp
 *
 * - Hai phòng (#R-005, #R-012) mang tên OCR đọc thành chữ HOA —
 *   `"PHÒNG NGỦ 1"`, `"PHÒNG NGỦ 2"` — giữ NGUYÊN dấu tiếng Việt (chỉ sai kiểu
 *   chữ hoa/thường, không sai chính tả), để không phạm luật "mọi thứ người
 *   dùng đọc là tiếng Việt có dấu" (CLAUDE.md) trong lúc mô phỏng lỗi OCR.
 * - Đúng BA phòng (#R-003, #R-004, #R-009) để trống tên (chuỗi rỗng) — phục vụ
 *   trạng thái `partial`/`empty` của danh sách "Chưa đặt tên".
 * - Chín phòng còn lại đặt tên đúng kiểu câu, chữ thường (A6).
 *
 * `source`/`confidence`: năm phòng chưa có tên chuẩn (ba tên rỗng, hai tên
 * OCR viết hoa) mang `source: 'ai'` và `confidence < 1`; A5 — KHÔNG phòng nào
 * trong số đó `reviewed: true`. Chín phòng còn lại đã được người duyệt xác
 * nhận: `source: 'human'`, `reviewed: true`, `confidence: 1`.
 *
 * ## Vòng tường hở — CHỦ Ý không có trong bộ mẫu này
 *
 * Đặc tả liệt `WeldedGap` (`src/domain/rooms/graph.ts`) là phần "nếu tiện",
 * dùng cho trạng thái 1 (rỗng) và 3 (một phần). Bộ mẫu 14 phòng dưới đây KHÔNG
 * đi kèm một danh sách tường tương ứng (phòng không cần tường thật để tồn tại
 * hợp lệ — `Room.wallIds` chỉ là tham chiếu chuỗi, không được `normalizeSpatial`
 * đối chiếu ngược). Dựng thêm một bộ tường riêng chỉ để tạo một khe hở giả nằm
 * ngoài nghiệm thu của T4 (mục 2.2 chỉ đòi 14 phòng, tổng diện tích, và
 * #R-005 = 18,40 m²) và không phục vụ gì cho ba worker lớp sau nếu họ lấy
 * tường thật từ tầng dữ liệu khác — nên để trống, T5 tự quyết nguồn tường khi
 * cần minh hoạ trạng thái đó.
 *
 * KHÔNG gọi bất kỳ hàm nào của đối tượng `Math` toàn cục — mọi con số viết
 * thẳng, không tính ra từ công thức, không có số ngẫu nhiên. Dữ liệu TẤT ĐỊNH,
 * đúng khuôn `wallLayerReviewFixture.ts`.
 */

import { computeArea, totalArea } from '@/domain/rooms/area';
import { SAMPLE_TOTAL_AREA_M2 } from '@/domain/spatial/__fixtures__/sampleBuilding';
import type { Building, Confidence, Level, LevelId, Point, Room, RoomId, RoomUsage, WallId } from '@/domain/spatial/types';
import type { PointMm } from '@/domain/units/compare';
import { millimetresPerPixel } from '@/domain/units/scale';
import { millimetres } from '@/domain/units/types';

/** Số chữ số của phần đếm trong thân mã — `COUNTER_LENGTH` của `ids.ts:41`. */
const COUNTER_LENGTH = 6;

/** Bốn ký tự đuôi, cố định để bộ mẫu tất định (xem ghi chú đầu file). */
const ROOM_ID_SUFFIX = 'ROOM';
const WALL_ID_SUFFIX = 'WALL';
const LEVEL_ID_SUFFIX = 'LVL0';

/** `'R-005'` → `'R-000005ROOM'`. Thuần cắt chuỗi, không một phép tính nào. */
const roomIdOf = (code: string): RoomId =>
  `R-${code.slice(2).padStart(COUNTER_LENGTH, '0')}${ROOM_ID_SUFFIX}` as RoomId;

/** `'W-005'` → `'W-000005WALL'`. Mã tường chủ chỉ để điền `Room.wallIds`, không có `Wall` thật đứng sau (xem ghi chú đầu file). */
const wallIdOf = (code: string): WallId =>
  `W-${code.slice(2).padStart(COUNTER_LENGTH, '0')}${WALL_ID_SUFFIX}` as WallId;

/** Tầng duy nhất của bộ mẫu. */
const LEVEL_ID = `L-${'1'.padStart(COUNTER_LENGTH, '0')}${LEVEL_ID_SUFFIX}` as LevelId;

/** Chiều cao tầng đồng nhất trong bộ mẫu — 3 m thông thuỷ. */
const LEVEL_HEIGHT_MM = 3000;

/** Một điểm phẳng của đồ thị (`Point`, không gắn nhãn) sang `PointMm` gắn nhãn mà `computeArea` đòi. */
const toMm = (point: Point): PointMm => ({ x: millimetres(point.x), y: millimetres(point.y) });

/**
 * Dựng một `Room` hợp lệ của `src/domain/spatial/types.ts`, diện tích tính
 * bằng `computeArea` chứ không gõ tay.
 */
function room(
  code: string,
  usage: RoomUsage,
  name: string,
  outline: readonly Point[],
  wallCode: string,
  confidence: Confidence,
  reviewed: boolean,
): Room {
  return {
    id: roomIdOf(code),
    levelId: LEVEL_ID,
    name,
    usage,
    outline,
    areaM2: computeArea(outline.map(toMm)),
    wallIds: [wallIdOf(wallCode)],
    confidence,
    source: reviewed ? 'human' : 'ai',
    reviewed,
  };
}

/** Đa giác chữ nhật đơn giản, đáy chung tại `y = 0` (phía hành lang), đỉnh tại `y = depthMm`. */
function rectangle(startXMm: number, endXMm: number, depthMm: number): readonly Point[] {
  return [
    { x: startXMm, y: 0 },
    { x: endXMm, y: 0 },
    { x: endXMm, y: depthMm },
    { x: startXMm, y: depthMm },
  ];
}

/** Chiều sâu thường gặp — mười hai phòng 17,00 m² dùng chung độ sâu này. */
const STANDARD_DEPTH_MM = 3400;

/**
 * 14 phòng, một dãy dọc hành lang, ĐÚNG khớp bộ kích thước ở đầu file.
 *
 * Chín phòng đã được người duyệt xác nhận tên (nguồn `human`, đã duyệt); năm
 * phòng còn nguyên kết quả AI — ba tên rỗng, hai tên OCR viết hoa — chưa
 * phòng nào trong số đó `reviewed: true` (A5).
 */
export const ROOM_LABEL_FIXTURE_ROOMS: readonly Room[] = [
  room('R-001', 'livingRoom', 'phòng khách chung', rectangle(0, 5000, STANDARD_DEPTH_MM), 'W-001', 1, true),
  room('R-002', 'bedroom', 'phòng ngủ 3', rectangle(5000, 10000, STANDARD_DEPTH_MM), 'W-002', 1, true),
  room('R-003', 'bedroom', '', rectangle(10000, 15000, STANDARD_DEPTH_MM), 'W-003', 0.62, false),
  room('R-004', 'bedroom', '', rectangle(15000, 20000, STANDARD_DEPTH_MM), 'W-004', 0.58, false),
  room('R-005', 'bedroom', 'PHÒNG NGỦ 1', rectangle(20000, 24600, 4000), 'W-005', 0.81, false),
  room('R-006', 'bathroom', 'phòng tắm chung', rectangle(24600, 29600, STANDARD_DEPTH_MM), 'W-006', 1, true),
  room('R-007', 'kitchen', 'bếp', rectangle(29600, 34600, STANDARD_DEPTH_MM), 'W-007', 1, true),
  room('R-008', 'corridor', 'hành lang tầng hai', rectangle(34600, 39600, STANDARD_DEPTH_MM), 'W-008', 1, true),
  room('R-009', 'stairwell', '', rectangle(39600, 44600, STANDARD_DEPTH_MM), 'W-009', 0.66, false),
  room('R-010', 'utility', 'phòng kỹ thuật điện', rectangle(44600, 49600, STANDARD_DEPTH_MM), 'W-010', 1, true),
  room('R-011', 'other', 'phòng đa năng', rectangle(49600, 54600, STANDARD_DEPTH_MM), 'W-011', 1, true),
  room('R-012', 'bedroom', 'PHÒNG NGỦ 2', rectangle(54600, 59600, STANDARD_DEPTH_MM), 'W-012', 0.79, false),
  room('R-013', 'bathroom', 'phòng tắm riêng', rectangle(59600, 64600, STANDARD_DEPTH_MM), 'W-013', 1, true),
  room('R-014', 'livingRoom', 'phòng sinh hoạt chung', rectangle(64600, 69840, 5000), 'W-014', 1, true),
];

/** Tổng số phòng của bộ mẫu — test khẳng định bằng hằng, không bằng số viết tay (R-71). */
export const ROOM_LABEL_FIXTURE_TOTAL = ROOM_LABEL_FIXTURE_ROOMS.length;

/**
 * Tổng diện tích của bộ mẫu, tính bằng `totalArea` (cộng mm² rồi làm tròn một
 * lần) — KHÔNG cộng các `areaM2` đã làm tròn của từng phòng.
 */
export const ROOM_LABEL_FIXTURE_TOTAL_AREA_M2 = totalArea(
  ROOM_LABEL_FIXTURE_ROOMS.map((entry) => entry.outline.map((corner) => toMm(corner))),
);

/** Số phòng chưa đặt tên — tính từ mảng, không gõ tay. */
export const ROOM_LABEL_FIXTURE_UNNAMED_COUNT = ROOM_LABEL_FIXTURE_ROOMS.filter(
  (entry) => entry.name === '',
).length;

/** Số phòng đã được người duyệt xác nhận (`reviewed: true`) — tính từ mảng, không gõ tay. */
export const ROOM_LABEL_FIXTURE_REVIEWED_COUNT = ROOM_LABEL_FIXTURE_ROOMS.filter(
  (entry) => entry.reviewed,
).length;

/** Phòng mã hiển thị `#R-005` — ví dụ nghiệm thu của đặc tả (18,40 m²). */
export const ROOM_LABEL_FIXTURE_ROOM_R005: Room | undefined = ROOM_LABEL_FIXTURE_ROOMS.find(
  (entry) => entry.id === roomIdOf('R-005'),
);

/*
 * KHẲNG ĐỊNH: mọi con số hợp đồng của bộ mẫu này đúng như đặc tả đòi. Ném lỗi
 * ngay lúc nạp module — sai một trong bốn điều kiện dưới đây là hỏng nghiệm
 * thu "14 phòng, 248,60 m², #R-005 = 18,40 m²", nên phải hỏng sớm, ở đây,
 * không phải hỏng muộn ở một test không ai đọc log.
 */
if (ROOM_LABEL_FIXTURE_TOTAL !== 14) {
  throw new Error(`Bộ mẫu Duyệt tên phòng phải có đúng 14 phòng, hiện có ${ROOM_LABEL_FIXTURE_TOTAL}.`);
}
if (ROOM_LABEL_FIXTURE_TOTAL_AREA_M2 !== SAMPLE_TOTAL_AREA_M2) {
  throw new Error(
    `Tổng diện tích bộ mẫu phải khớp SAMPLE_TOTAL_AREA_M2 (${String(SAMPLE_TOTAL_AREA_M2)} m²), tính được ${String(ROOM_LABEL_FIXTURE_TOTAL_AREA_M2)} m².`,
  );
}
if (ROOM_LABEL_FIXTURE_ROOM_R005 === undefined || ROOM_LABEL_FIXTURE_ROOM_R005.areaM2 !== 18.4) {
  throw new Error(
    `Phòng #R-005 của bộ mẫu phải rộng đúng 18,40 m², hiện là ${String(ROOM_LABEL_FIXTURE_ROOM_R005?.areaM2)}.`,
  );
}
if (ROOM_LABEL_FIXTURE_UNNAMED_COUNT !== 3) {
  throw new Error(
    `Bộ mẫu phải có đúng 3 phòng chưa đặt tên, hiện có ${ROOM_LABEL_FIXTURE_UNNAMED_COUNT}.`,
  );
}

/* -------------------------------------------------------------------------- */
/* Tầng và toà nhà chứa bộ mẫu.                                                */
/* -------------------------------------------------------------------------- */

/** Tầng duy nhất — tỷ lệ bản vẽ mẫu, đã duyệt. */
export const ROOM_LABEL_FIXTURE_LEVEL: Level = {
  id: LEVEL_ID,
  name: 'Tầng 1',
  order: 0,
  elevationMm: 0,
  heightMm: LEVEL_HEIGHT_MM,
  areaM2: ROOM_LABEL_FIXTURE_TOTAL_AREA_M2,
  scaleMillimetresPerPixel: millimetresPerPixel(12),
  confidence: 1,
  source: 'human',
  reviewed: true,
};

/** Toà nhà chứa tầng mẫu — dữ liệu tối thiểu, đủ cho một `SpatialGraph.building`. */
export const ROOM_LABEL_FIXTURE_BUILDING: Building = {
  name: 'Nhà mẫu QC lớp phòng',
  datumElevationMm: 0,
  grossFloorAreaM2: ROOM_LABEL_FIXTURE_TOTAL_AREA_M2,
  confidence: 1,
  source: 'human',
  reviewed: true,
};

/* -------------------------------------------------------------------------- */
/* Biến thể theo trạng thái.                                                   */
/* -------------------------------------------------------------------------- */

/** Trạng thái `empty` — AI không dò ra phòng nào ở tầng này. */
export const ROOM_LABEL_FIXTURE_EMPTY: readonly Room[] = [];
