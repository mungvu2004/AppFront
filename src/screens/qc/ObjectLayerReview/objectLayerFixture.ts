/**
 * Dữ liệu mẫu của màn Lớp đối tượng: đúng 21 đối tượng — 9 cửa đi, 7 cửa sổ,
 * 5 nội thất — 9 đã duyệt, 5 dưới ngưỡng tin cậy 0,75.
 *
 * ## Vì sao cửa sổ dùng tiền tố `S-`, không phải `W-`
 *
 * Repo này dùng tiền tố `W-` cho TƯỜNG (`WallId`, `src/domain/spatial/types.ts:71`).
 * Đối tượng "cửa sổ" của màn này không phải một `Wall`, nên nếu cũng đặt mã
 * `W-001`…`W-007` thì mã cửa sổ và mã tường đụng nhau ngay trên cùng một màn
 * (tường chủ của một cửa sổ rất có thể tình cờ trùng mã hiển thị với chính
 * cửa sổ đó). Vì đây là mã HIỂN THỊ của tầng view-model, không phải `WallId`/
 * `OpeningId` domain, ta tự chọn tiền tố không đụng: cửa đi giữ `D-` (khớp
 * `ID_PREFIX_BY_KIND.opening`), cửa sổ dùng `S-` (viết tắt "sổ"), nội thất
 * giữ `F-` (khớp `ID_PREFIX_BY_KIND.furniture`).
 *
 * ## Mã tường chủ chỉ là mã HIỂN THỊ, không phải `WallId` domain hợp lệ
 *
 * `hostWallId` ở đây là các chuỗi ngắn kiểu `'W-014'`, đúng dạng liên kết bấm
 * được mà đặc tả đòi hiện ("#W-014"). Chúng khớp kiểu `WallId` = `` `W-${string}` ``
 * ở mức TypeScript (mọi chuỗi bắt đầu bằng `"W-"` đều thoả mãn kiểu mẫu đó),
 * nhưng KHÔNG phải id hợp lệ theo `isIdOfKind('wall', ...)` của
 * `src/domain/spatial/ids.ts` (đòi thân mã dài tối thiểu 10 ký tự — xem ghi
 * chú đầu `wallLayerReviewFixture.ts`). Bộ mẫu này không tự dựng một `Wall`
 * thật nào — T5 (`objectLayerReviewGateway.ts`) là nơi quyết định lấy tường
 * thật ở đâu (ví dụ tái dùng `WALL_LAYER_FIXTURE_WALLS` của màn tường) và đối
 * chiếu mã hiển thị này với id thật đó.
 *
 * KHÔNG gọi bất kỳ hàm nào của đối tượng `Math` toàn cục ở đây — mọi con số
 * viết thẳng, không tính ra từ công thức, không có số ngẫu nhiên. Dữ liệu
 * TẤT ĐỊNH, đúng khuôn `wallLayerReviewFixture.ts`.
 */

import type { Point, SwingDirection, WallId } from '@/domain/spatial/types';
import { millimetres } from '@/domain/units/types';

import {
  countObjectsByLayer,
  type AttachedReviewObject,
  type ObjectLayerCounts,
  type ObjectSubtype,
  type OrphanReviewObject,
  type ReviewObject,
} from './objectLayerTypes';

/** Kích thước thật của MỌI cửa đi trong bộ mẫu (đặc tả gốc: "900 x 2200 mm"). */
const DOOR_WIDTH_MM = millimetres(900);
const DOOR_HEIGHT_MM = millimetres(2200);

/** Kích thước và cao độ bệ thật của MỌI cửa sổ trong bộ mẫu (đặc tả gốc: "sillHeightMm 900"). */
const WINDOW_WIDTH_MM = millimetres(1200);
const WINDOW_HEIGHT_MM = millimetres(1500);
const WINDOW_SILL_HEIGHT_MM = millimetres(900);

/** Dựng một đối tượng đã gắn vào tường. */
function attached(
  id: string,
  subtype: ObjectSubtype,
  layer: ReviewObject['layer'],
  widthMm: number,
  heightMm: number,
  sillHeightMm: number | null,
  swing: SwingDirection,
  hostWallId: WallId,
  relativePosition: number,
  confidence: number,
  reviewed: boolean,
): AttachedReviewObject {
  return {
    id,
    layer,
    subtype,
    widthMm: millimetres(widthMm),
    heightMm: millimetres(heightMm),
    sillHeightMm: sillHeightMm === null ? null : millimetres(sillHeightMm),
    swing,
    confidence,
    reviewed,
    hostWallId,
    relativePosition,
  };
}

/** Dựng một đối tượng chưa gắn được vào tường nào (CẤM TUYỆT ĐỐI: không tự xoá). */
function orphan(
  id: string,
  subtype: ObjectSubtype,
  layer: ReviewObject['layer'],
  widthMm: number,
  heightMm: number,
  swing: SwingDirection,
  tracedCentre: Point,
  confidence: number,
  reviewed: boolean,
): OrphanReviewObject {
  return {
    id,
    layer,
    subtype,
    widthMm: millimetres(widthMm),
    heightMm: millimetres(heightMm),
    sillHeightMm: null,
    swing,
    confidence,
    reviewed,
    hostWallId: null,
    tracedCentre,
  };
}

/**
 * Chín cửa đi — `D-001`..`D-009`.
 *
 * `D-007` là ví dụ thanh tra nguyên văn của đặc tả gốc: `"900 × 2.200 mm"`,
 * tường chủ `"#W-014"`, độ tin cậy 0,71 (dưới ngưỡng, chưa duyệt).
 * `D-009` là đối tượng CHƯA GẮN vào tường nào của bộ mẫu — `OrphanReviewObject`.
 */
const DOOR_OBJECTS: readonly ReviewObject[] = [
  attached('D-001', 'singleDoor', 'door', DOOR_WIDTH_MM, DOOR_HEIGHT_MM, null, 'left', 'W-001' as WallId, 0.5, 0.95, true),
  attached('D-002', 'singleDoor', 'door', DOOR_WIDTH_MM, DOOR_HEIGHT_MM, null, 'right', 'W-002' as WallId, 0.3, 0.88, true),
  attached('D-003', 'doubleDoor', 'door', DOOR_WIDTH_MM, DOOR_HEIGHT_MM, null, 'double', 'W-003' as WallId, 0.5, 0.91, true),
  attached('D-004', 'singleDoor', 'door', DOOR_WIDTH_MM, DOOR_HEIGHT_MM, null, 'left', 'W-004' as WallId, 0.2, 0.6, false),
  attached('D-005', 'singleDoor', 'door', DOOR_WIDTH_MM, DOOR_HEIGHT_MM, null, 'right', 'W-005' as WallId, 0.7, 0.82, true),
  attached('D-006', 'doubleDoor', 'door', DOOR_WIDTH_MM, DOOR_HEIGHT_MM, null, 'double', 'W-006' as WallId, 0.5, 0.77, false),
  attached('D-007', 'singleDoor', 'door', DOOR_WIDTH_MM, DOOR_HEIGHT_MM, null, 'left', 'W-014' as WallId, 0.4, 0.71, false),
  attached('D-008', 'singleDoor', 'door', DOOR_WIDTH_MM, DOOR_HEIGHT_MM, null, 'right', 'W-008' as WallId, 0.5, 0.93, true),
  orphan('D-009', 'singleDoor', 'door', DOOR_WIDTH_MM, DOOR_HEIGHT_MM, 'left', { x: 6200, y: 3100 }, 0.55, false),
];

/** Bảy cửa sổ — `S-001`..`S-007`, mọi cửa sổ đều có `sillHeightMm: 900`. */
const WINDOW_OBJECTS: readonly ReviewObject[] = [
  attached('S-001', 'window', 'window', WINDOW_WIDTH_MM, WINDOW_HEIGHT_MM, WINDOW_SILL_HEIGHT_MM, 'fixed', 'W-009' as WallId, 0.5, 0.9, true),
  attached('S-002', 'window', 'window', WINDOW_WIDTH_MM, WINDOW_HEIGHT_MM, WINDOW_SILL_HEIGHT_MM, 'fixed', 'W-010' as WallId, 0.5, 0.85, true),
  attached('S-003', 'window', 'window', WINDOW_WIDTH_MM, WINDOW_HEIGHT_MM, WINDOW_SILL_HEIGHT_MM, 'fixed', 'W-011' as WallId, 0.5, 0.68, false),
  attached('S-004', 'window', 'window', WINDOW_WIDTH_MM, WINDOW_HEIGHT_MM, WINDOW_SILL_HEIGHT_MM, 'sliding', 'W-012' as WallId, 0.5, 0.93, true),
  attached('S-005', 'window', 'window', WINDOW_WIDTH_MM, WINDOW_HEIGHT_MM, WINDOW_SILL_HEIGHT_MM, 'fixed', 'W-013' as WallId, 0.5, 0.8, false),
  attached('S-006', 'window', 'window', WINDOW_WIDTH_MM, WINDOW_HEIGHT_MM, WINDOW_SILL_HEIGHT_MM, 'fixed', 'W-015' as WallId, 0.5, 0.97, true),
  attached('S-007', 'window', 'window', WINDOW_WIDTH_MM, WINDOW_HEIGHT_MM, WINDOW_SILL_HEIGHT_MM, 'fixed', 'W-016' as WallId, 0.5, 0.89, false),
];

/** Năm nội thất — `F-001`..`F-005`, mỗi cái một loại con khác nhau. Chưa cái nào được duyệt. */
const FURNITURE_OBJECTS: readonly ReviewObject[] = [
  attached('F-001', 'bed', 'furniture', 1600, 2000, null, 'fixed', 'W-017' as WallId, 0.5, 0.9, false),
  attached('F-002', 'sofa', 'furniture', 2000, 900, null, 'fixed', 'W-018' as WallId, 0.3, 0.85, false),
  attached('F-003', 'diningTable', 'furniture', 1600, 900, null, 'fixed', 'W-019' as WallId, 0.5, 0.72, false),
  attached('F-004', 'toilet', 'furniture', 400, 600, null, 'fixed', 'W-020' as WallId, 0.5, 0.88, false),
  attached('F-005', 'basin', 'furniture', 500, 400, null, 'fixed', 'W-023' as WallId, 0.5, 0.95, false),
];

/**
 * 21 đối tượng, đúng thứ tự D → S(cửa sổ) → F. Biến thể chính, dùng cho trạng
 * thái `partial` (9/21 đã duyệt, 5 dưới ngưỡng tin cậy).
 */
export const OBJECT_LAYER_FIXTURE_OBJECTS: readonly ReviewObject[] = [
  ...DOOR_OBJECTS,
  ...WINDOW_OBJECTS,
  ...FURNITURE_OBJECTS,
];

/**
 * Bộ đếm ba lớp con — tính từ chính mảng ở trên bằng {@link countObjectsByLayer},
 * KHÔNG viết tay ở nơi thứ hai (CẤM TUYỆT ĐỐI "21 = 9 + 7 + 5 phải đúng ở mọi
 * nơi xuất hiện").
 */
export const OBJECT_LAYER_FIXTURE_COUNTS: ObjectLayerCounts = countObjectsByLayer(
  OBJECT_LAYER_FIXTURE_OBJECTS,
);

/** Ngưỡng "cần chú ý" của màn — đặc tả gốc: "5 mục dưới ngưỡng tin cậy 0,75". */
const LOW_CONFIDENCE_THRESHOLD = 0.75;

/** Số đối tượng đã duyệt — tính từ mảng, không gõ tay. */
export const OBJECT_LAYER_FIXTURE_REVIEWED = OBJECT_LAYER_FIXTURE_OBJECTS.filter(
  (object) => object.reviewed,
).length;

/** Số đối tượng dưới ngưỡng tin cậy — tính từ mảng, không gõ tay. */
export const OBJECT_LAYER_FIXTURE_LOW_CONFIDENCE = OBJECT_LAYER_FIXTURE_OBJECTS.filter(
  (object) => object.confidence < LOW_CONFIDENCE_THRESHOLD,
).length;

/** Số đối tượng chưa gắn được vào tường nào — tính từ mảng, không gõ tay. */
export const OBJECT_LAYER_FIXTURE_ORPHANED = OBJECT_LAYER_FIXTURE_OBJECTS.filter(
  (object) => object.hostWallId === null,
).length;

/*
 * KHẲNG ĐỊNH: mọi con số hợp đồng của bộ mẫu này đúng như đặc tả gốc đòi.
 * Ném lỗi ngay lúc nạp module — sai một trong năm điều kiện dưới đây là hỏng
 * cả nghiệm thu "21 đối tượng ở cả bốn nơi", nên phải hỏng sớm, ở đây, không
 * phải hỏng muộn ở một test không ai đọc log.
 */
if (OBJECT_LAYER_FIXTURE_OBJECTS.length !== 21) {
  throw new Error(
    `Bộ mẫu lớp đối tượng phải có đúng 21 đối tượng, hiện có ${OBJECT_LAYER_FIXTURE_OBJECTS.length}.`,
  );
}
if (OBJECT_LAYER_FIXTURE_COUNTS.doorCount !== 9) {
  throw new Error(`Bộ mẫu phải có đúng 9 cửa đi, hiện có ${OBJECT_LAYER_FIXTURE_COUNTS.doorCount}.`);
}
if (OBJECT_LAYER_FIXTURE_COUNTS.windowCount !== 7) {
  throw new Error(`Bộ mẫu phải có đúng 7 cửa sổ, hiện có ${OBJECT_LAYER_FIXTURE_COUNTS.windowCount}.`);
}
if (OBJECT_LAYER_FIXTURE_COUNTS.furnitureCount !== 5) {
  throw new Error(
    `Bộ mẫu phải có đúng 5 nội thất, hiện có ${OBJECT_LAYER_FIXTURE_COUNTS.furnitureCount}.`,
  );
}
if (OBJECT_LAYER_FIXTURE_COUNTS.total !== 21) {
  throw new Error(`21 = 9 + 7 + 5 phải đúng — tổng tính được là ${OBJECT_LAYER_FIXTURE_COUNTS.total}.`);
}
if (OBJECT_LAYER_FIXTURE_REVIEWED !== 9) {
  throw new Error(`Bộ mẫu phải có đúng 9 đối tượng đã duyệt, hiện có ${OBJECT_LAYER_FIXTURE_REVIEWED}.`);
}
if (OBJECT_LAYER_FIXTURE_LOW_CONFIDENCE !== 5) {
  throw new Error(
    `Bộ mẫu phải có đúng 5 đối tượng dưới ngưỡng tin cậy, hiện có ${OBJECT_LAYER_FIXTURE_LOW_CONFIDENCE}.`,
  );
}
if (OBJECT_LAYER_FIXTURE_ORPHANED < 1) {
  throw new Error('Bộ mẫu phải có ít nhất một đối tượng chưa gắn vào tường nào.');
}

/* -------------------------------------------------------------------------- */
/* Biến thể theo trạng thái.                                                   */
/* -------------------------------------------------------------------------- */

/** Trạng thái `empty` — AI không tìm thấy đối tượng nào. */
export const OBJECT_LAYER_FIXTURE_EMPTY: readonly ReviewObject[] = [];

/**
 * Trạng thái `success` — 21/21 đã duyệt. Giữ nguyên tường chủ / độ tin cậy,
 * chỉ đổi `reviewed` thành `true`, đúng A5 (lệnh duyệt là đường duy nhất đặt
 * cờ này, dữ liệu mẫu chỉ mô phỏng KẾT QUẢ sau khi lệnh đó đã chạy 21 lần).
 */
export const OBJECT_LAYER_FIXTURE_DONE: readonly ReviewObject[] = OBJECT_LAYER_FIXTURE_OBJECTS.map(
  (object) => ({ ...object, reviewed: true }) as ReviewObject,
);

/** Trạng thái `partial` — bí danh của bộ mẫu chính, đọc tên cho rõ ở nơi gọi. */
export const OBJECT_LAYER_FIXTURE_PARTIAL: readonly ReviewObject[] = OBJECT_LAYER_FIXTURE_OBJECTS;
