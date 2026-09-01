/**
 * Dữ liệu mẫu của màn Đọc kích thước OCR: đúng 34 chuỗi kích thước, 18 đã
 * duyệt, 9 dưới ngưỡng độ tin cậy (khớp "18/34 kích thước đã duyệt" và trạng
 * thái "Một phần" của đặc tả gốc).
 *
 * `Dimension` là kiểu THẬT của `src/domain/spatial/types.ts` — không bịa hình
 * dạng thứ hai. Ngưỡng "dưới độ tin cậy" tái dùng `CONFIDENCE_SUGGESTED_THRESHOLD`
 * (0,70) đã có ở `src/lib/format/semantic.ts`, cùng ngưỡng mà
 * `wallLayerReviewFixture.ts` dùng cho băng `needsReview` — không tự đặt một
 * ngưỡng thứ hai.
 *
 * Tầng dùng lại NGUYÊN `WALL_LAYER_FIXTURE_LEVEL` và `WALL_LAYER_FIXTURE_WALLS`
 * của `WallLayerReview` (không dựng lại mặt bằng lần thứ hai), và mỗi chuỗi
 * kích thước gắn `referenceIds` với một `WallId` THẬT trong bộ mẫu đó — không
 * phải chuỗi hiển thị trang trí kiểu `'W-014' as WallId` — nên caption "Gắn
 * với #W-xxx" mà T5 suy ra sau này trỏ tới một tường có thật.
 *
 * `Dimension.valueMm` là giá trị OCR ĐỌC ĐƯỢC (in trên bản vẽ); giá trị đo từ
 * hình học là khoảng cách giữa `line.start` và `line.end` — con số đó KHÔNG được
 * tính ở đây (không gọi `distanceBetween`, không gọi bất kỳ hàm nào của `Math`
 * toàn cục), T5 mới là nơi đo và so lệch. Mọi đoạn `line` trong file này nằm
 * ngang (`start.y === end.y`) và `start.x === 0`, nên "giá trị đo từ hình học"
 * ĐỌC RA được thẳng từ `end.x` mà không cần một phép tính nào — đây là lý do
 * duy nhất hai đầu đoạn được chọn thẳng hàng, không phải để tiện vẽ.
 *
 * KHÔNG gọi bất kỳ hàm nào của đối tượng `Math` toàn cục ở đây — mọi con số
 * viết thẳng, không tính ra từ công thức, không có số ngẫu nhiên. Dữ liệu
 * TẤT ĐỊNH, đúng khuôn `wallLayerReviewFixture.ts` và `objectLayerFixture.ts`.
 */

import type { Dimension, DimensionId, Level, Point, Wall } from '@/domain/spatial/types';
import { CONFIDENCE_SUGGESTED_THRESHOLD } from '@/lib/format/semantic';

import { WALL_LAYER_FIXTURE_LEVEL, WALL_LAYER_FIXTURE_WALLS } from '../WallLayerReview/wallLayerReviewFixture';

/** Tầng duy nhất của bộ mẫu — tái dùng nguyên tầng của `WallLayerReview` (xem ghi chú đầu file). */
export const DIMENSION_OCR_FIXTURE_LEVEL: Level = WALL_LAYER_FIXTURE_LEVEL;

/*
 * Mã hợp lệ của bộ mẫu — cùng lý do đã ghi ở `wallLayerReviewFixture.ts`:
 * `src/domain/spatial/ids.ts` đòi thân mã dài ít nhất 10 ký tự `[0-9A-Z]`, nên
 * mã rút gọn kiểu `"M-018"` không phải một `DimensionId` hợp lệ theo
 * `isIdOfKind('dimension', ...)`. Bộ mẫu sinh mã ĐÚNG KHUÔN `createId`: tiền
 * tố, 6 chữ số đếm, rồi bốn ký tự đuôi cố định (không ngẫu nhiên, để dữ liệu
 * TẤT ĐỊNH).
 */
const COUNTER_LENGTH = 6;
const DIMENSION_ID_SUFFIX = 'DIMS';

/** `'M-018'` → `'M-000018DIMS'`. Thuần cắt chuỗi, không một phép tính nào. */
const dimensionIdOf = (code: string): DimensionId =>
  `M-${code.slice(2).padStart(COUNTER_LENGTH, '0')}${DIMENSION_ID_SUFFIX}` as DimensionId;

/**
 * Tường THẬT của bộ mẫu ở chỉ số `index` (0..47) — ném lỗi ngay lúc nạp module
 * nếu chỉ số sai, thay vì để `undefined` trôi vào một `Dimension.referenceIds`
 * trỏ tới chỗ không tồn tại. `WALL_LAYER_FIXTURE_WALLS[index]` kiểu
 * `Wall | undefined` vì `noUncheckedIndexedAccess`; hàm này là cửa hẹp DUY
 * NHẤT thu hẹp lại kiểu đó.
 */
function wallAt(index: number): Wall {
  const wall = WALL_LAYER_FIXTURE_WALLS[index];

  if (wall === undefined) {
    throw new Error(`Bộ mẫu tường của WallLayerReview không có tường ở chỉ số ${index}.`);
  }

  return wall;
}

/**
 * Dựng một `Dimension` hợp lệ. `wallIndex` là chỉ số vào
 * `WALL_LAYER_FIXTURE_WALLS` (0..47) — `referenceIds` trỏ tới `Wall.id` THẬT
 * ở chỉ số đó, không phải một chuỗi hiển thị bịa ra.
 *
 * A5: `reviewed: true` chỉ đánh dấu việc người duyệt, nên `source` đi kèm
 * `reviewed` chứ không phải một tham số độc lập — đúng khuôn `wall()` của
 * `wallLayerReviewFixture.ts`.
 */
function dimension(
  code: string,
  wallIndex: number,
  start: Point,
  end: Point,
  valueMm: number,
  confidence: number,
  reviewed: boolean,
): Dimension {
  return {
    id: dimensionIdOf(code),
    levelId: DIMENSION_OCR_FIXTURE_LEVEL.id,
    kind: 'linear',
    referenceIds: [wallAt(wallIndex).id],
    line: { start, end },
    valueMm,
    confidence,
    source: reviewed ? 'human' : 'ai',
    reviewed,
  };
}

/**
 * `M-018` — ví dụ nghiệm thu độ lệch NHỎ: OCR đọc 6.090 mm, hình học đo được
 * 6.000 mm (`end.x`), lệch đúng 1,5%. T8 in chuỗi này và chứng minh dải đối
 * chiếu KHÔNG tô màu nó (`isSignificant === false`, do T5 quyết, không phải
 * ở đây).
 */
export const DIMENSION_OCR_FIXTURE_MINOR_DEVIATION: Dimension = dimension(
  'M-018',
  17,
  { x: 0, y: 5400 },
  { x: 6000, y: 5400 },
  6090,
  0.79,
  false,
);

/**
 * `M-028` — ví dụ nghiệm thu độ lệch ĐÁNG KỂ: OCR đọc 9.225 mm, hình học đo
 * được 9.000 mm, lệch đúng 2,5%. T8 chứng minh dải đối chiếu CÓ tô màu đúng
 * mục này, và CHỈ mục này trong hai ví dụ nghiệm thu.
 */
export const DIMENSION_OCR_FIXTURE_SIGNIFICANT_DEVIATION: Dimension = dimension(
  'M-028',
  27,
  { x: 0, y: 8400 },
  { x: 9000, y: 8400 },
  9225,
  0.74,
  false,
);

/**
 * 34 chuỗi kích thước, đúng thứ tự `M-001`..`M-034`. 18 mục `reviewed: true`;
 * chín mục (`M-002`, `M-006`, `M-010`, `M-014`, `M-017`, `M-021`, `M-025`,
 * `M-029`, `M-033`) có `confidence < 0,70` — dưới
 * {@link CONFIDENCE_SUGGESTED_THRESHOLD}, khớp "9 mục dưới ngưỡng độ tin cậy"
 * của trạng thái Một phần. `M-018` và `M-028` là hai ví dụ nghiệm thu độ lệch
 * ở trên, ghép lại vào đúng vị trí thứ 18 và 28 của danh sách.
 */
export const DIMENSION_OCR_FIXTURE_DIMENSIONS: readonly Dimension[] = [
  dimension('M-001', 0, { x: 0, y: 300 }, { x: 900, y: 300 }, 900, 0.95, true),
  dimension('M-002', 1, { x: 0, y: 600 }, { x: 1200, y: 600 }, 1200, 0.68, false),
  dimension('M-003', 2, { x: 0, y: 900 }, { x: 1500, y: 900 }, 1500, 0.9, true),
  dimension('M-004', 3, { x: 0, y: 1200 }, { x: 1800, y: 1200 }, 1800, 0.82, false),
  dimension('M-005', 4, { x: 0, y: 1500 }, { x: 2100, y: 1500 }, 2100, 0.93, true),
  dimension('M-006', 5, { x: 0, y: 1800 }, { x: 2400, y: 1800 }, 2400, 0.65, false),
  dimension('M-007', 6, { x: 0, y: 2100 }, { x: 2700, y: 2100 }, 2700, 0.88, true),
  dimension('M-008', 7, { x: 0, y: 2400 }, { x: 3000, y: 2400 }, 3000, 0.97, true),
  dimension('M-009', 8, { x: 0, y: 2700 }, { x: 3300, y: 2700 }, 3300, 0.76, false),
  dimension('M-010', 9, { x: 0, y: 3000 }, { x: 3600, y: 3000 }, 3600, 0.6, false),
  dimension('M-011', 10, { x: 0, y: 3300 }, { x: 3900, y: 3300 }, 3900, 0.92, true),
  dimension('M-012', 11, { x: 0, y: 3600 }, { x: 4200, y: 3600 }, 4200, 0.85, true),
  dimension('M-013', 12, { x: 0, y: 3900 }, { x: 4500, y: 3900 }, 4500, 0.88, false),
  dimension('M-014', 13, { x: 0, y: 4200 }, { x: 4800, y: 4200 }, 4800, 0.55, false),
  dimension('M-015', 14, { x: 0, y: 4500 }, { x: 5100, y: 4500 }, 5100, 0.99, true),
  dimension('M-016', 15, { x: 0, y: 4800 }, { x: 5400, y: 4800 }, 5400, 0.94, true),
  dimension('M-017', 16, { x: 0, y: 5100 }, { x: 5700, y: 5100 }, 5700, 0.5, false),
  DIMENSION_OCR_FIXTURE_MINOR_DEVIATION,
  dimension('M-019', 18, { x: 0, y: 5700 }, { x: 6300, y: 5700 }, 6300, 0.87, true),
  dimension('M-020', 19, { x: 0, y: 6000 }, { x: 6600, y: 6000 }, 6600, 0.96, true),
  dimension('M-021', 20, { x: 0, y: 6300 }, { x: 6900, y: 6300 }, 6900, 0.45, false),
  dimension('M-022', 21, { x: 0, y: 6600 }, { x: 7200, y: 6600 }, 7200, 0.91, false),
  dimension('M-023', 22, { x: 0, y: 6900 }, { x: 7500, y: 6900 }, 7500, 0.83, true),
  dimension('M-024', 23, { x: 0, y: 7200 }, { x: 7800, y: 7200 }, 7800, 0.91, true),
  dimension('M-025', 24, { x: 0, y: 7500 }, { x: 8100, y: 7500 }, 8100, 0.62, false),
  dimension('M-026', 25, { x: 0, y: 7800 }, { x: 8400, y: 7800 }, 8400, 0.98, true),
  dimension('M-027', 26, { x: 0, y: 8100 }, { x: 8700, y: 8100 }, 8700, 0.86, true),
  DIMENSION_OCR_FIXTURE_SIGNIFICANT_DEVIATION,
  dimension('M-029', 28, { x: 0, y: 8700 }, { x: 9300, y: 8700 }, 9300, 0.58, false),
  dimension('M-030', 29, { x: 0, y: 9000 }, { x: 9600, y: 9000 }, 9600, 0.93, true),
  dimension('M-031', 30, { x: 0, y: 9300 }, { x: 9900, y: 9300 }, 9900, 0.89, true),
  dimension('M-032', 31, { x: 0, y: 9600 }, { x: 10200, y: 9600 }, 10200, 0.85, false),
  dimension('M-033', 32, { x: 0, y: 9900 }, { x: 10500, y: 9900 }, 10500, 0.69, false),
  dimension('M-034', 33, { x: 0, y: 10200 }, { x: 10800, y: 10200 }, 10800, 0.95, true),
];

/** Tổng số chuỗi kích thước của bộ mẫu — test khẳng định bằng hằng, không bằng số viết tay (R-71). */
export const DIMENSION_OCR_FIXTURE_TOTAL = DIMENSION_OCR_FIXTURE_DIMENSIONS.length;

/** Số chuỗi kích thước đã duyệt — tính từ mảng, không gõ tay. */
export const DIMENSION_OCR_FIXTURE_REVIEWED = DIMENSION_OCR_FIXTURE_DIMENSIONS.filter(
  (entry) => entry.reviewed,
).length;

/** Số chuỗi kích thước dưới ngưỡng độ tin cậy — tính từ mảng, tái dùng ngưỡng đã có (không tự đặt). */
export const DIMENSION_OCR_FIXTURE_LOW_CONFIDENCE = DIMENSION_OCR_FIXTURE_DIMENSIONS.filter(
  (entry) => entry.confidence < CONFIDENCE_SUGGESTED_THRESHOLD,
).length;

/*
 * KHẲNG ĐỊNH: mọi con số hợp đồng của bộ mẫu này đúng như đặc tả gốc đòi. Ném
 * lỗi ngay lúc nạp module — sai một trong ba điều kiện dưới đây là hỏng cả
 * nghiệm thu "18/34 kích thước đã duyệt, 9 dưới ngưỡng", nên phải hỏng sớm, ở
 * đây, không phải hỏng muộn ở một test không ai đọc log.
 */
if (DIMENSION_OCR_FIXTURE_TOTAL !== 34) {
  throw new Error(
    `Bộ mẫu Đọc kích thước OCR phải có đúng 34 chuỗi kích thước, hiện có ${DIMENSION_OCR_FIXTURE_TOTAL}.`,
  );
}
if (DIMENSION_OCR_FIXTURE_REVIEWED !== 18) {
  throw new Error(
    `Bộ mẫu phải có đúng 18 chuỗi kích thước đã duyệt, hiện có ${DIMENSION_OCR_FIXTURE_REVIEWED}.`,
  );
}
if (DIMENSION_OCR_FIXTURE_LOW_CONFIDENCE !== 9) {
  throw new Error(
    `Bộ mẫu phải có đúng 9 chuỗi kích thước dưới ngưỡng độ tin cậy, hiện có ${DIMENSION_OCR_FIXTURE_LOW_CONFIDENCE}.`,
  );
}

/* -------------------------------------------------------------------------- */
/* Biến thể theo trạng thái.                                                   */
/* -------------------------------------------------------------------------- */

/** Trạng thái `empty` — OCR không đọc được chuỗi kích thước nào. */
export const DIMENSION_OCR_FIXTURE_EMPTY: readonly Dimension[] = [];

/**
 * Trạng thái `success` — 34/34 đã duyệt. Giữ nguyên tường chủ / độ tin cậy /
 * giá trị, chỉ đổi `reviewed` thành `true` và `source` thành `'human'`, đúng
 * A5 (lệnh duyệt là đường duy nhất đặt cờ này, dữ liệu mẫu chỉ mô phỏng KẾT
 * QUẢ sau khi lệnh đó đã chạy 34 lần) — cùng khuôn `allReviewed()` của
 * `wallLayerReviewFixture.ts`.
 */
export const DIMENSION_OCR_FIXTURE_DONE: readonly Dimension[] = DIMENSION_OCR_FIXTURE_DIMENSIONS.map(
  (entry) => ({ ...entry, reviewed: true, source: 'human' }) as Dimension,
);

/** Trạng thái `partial` — bí danh của bộ mẫu chính, đọc tên cho rõ ở nơi gọi. */
export const DIMENSION_OCR_FIXTURE_PARTIAL: readonly Dimension[] = DIMENSION_OCR_FIXTURE_DIMENSIONS;
