/**
 * Hợp đồng kiểu của màn QC "Chuẩn hoá độ dày tường" (`ThicknessStandardization`).
 *
 * Đây là NỀN MÓNG (lớp L1), đúng khuôn `WallLayerReview/types.ts` và
 * `RoomLabelReview/roomLabelTypes.ts` của hai màn QC anh em: chỉ khai KIỂU và
 * HẰNG, không import React, không import `src/api`, `src/store`, `src/lib/http`.
 * T5 (hook + gateway), T6 (biểu đồ + canvas xem trước) và T7 (bảng + tóm tắt)
 * import DỰA VÀO đúng những gì khai ở đây. Thêm một trường hay đổi hình dạng
 * một kiểu đã khai là quyết định của điều phối viên — hỏi bằng
 * `orca orchestration ask` trước khi tự thêm; xem "KHOÁ SAU KHI XONG" cuối file.
 *
 * ## Nguồn dữ liệu — MỘT domain khác với hai màn QC anh em
 *
 * `WallLayerReview`/`RoomLabelReview` dựng trên `Wall` của
 * `src/domain/spatial/types.ts` (đồ thị nhiều tầng, `WallKind =
 * 'loadBearing'|'partition'|'envelope'`). Màn này dựng trên `Wall` KHÁC —
 * `src/domain/walls/types.ts:61` (mô hình hình học "dọn tường": centreline +
 * độ dày, `WallKind = 'loadBearing'|'partition'|'railing'|'glazed'`,
 * `MIN_WALL_THICKNESS_MM = 60`, `MAX_WALL_THICKNESS_MM = 600`). Đây là quyết
 * định đã duyệt của điều phối viên (mục 1 "HỢP ĐỒNG ĐÃ XÁC MINH" của đặc tả
 * T4), không phải một lựa chọn của lớp này — `Wall` đó KHÔNG có `levelId`
 * hay tầng (`floorName` ở đây tới từ khoảng cao độ `baseElevationMm`/
 * `topElevationMm`, xem `thicknessFixture.ts`) và KHÔNG có `confidence`/
 * `reviewed` (hai trường đó bọc riêng trong `ThicknessFixtureWall` của
 * `thicknessFixture.ts`, không phải một phần của `Wall`).
 *
 * ## Ba nhóm chuẩn — quyết định đã duyệt X1
 *
 * `WALL_THICKNESS_CHOICES` của `src/screens/qc/WallLayerReview/types.ts:168`
 * (`[110, 220, 330]`) là bộ BA BĂNG hệ thiết kế sơn được — khớp đúng ba token
 * CSS `--wall-110`/`--wall-220`/`--wall-330`. `STANDARD_THICKNESSES_MM` của
 * `src/domain/walls/cleanup.ts:70` (`[100, 150, 200, 220, 300, 400]`) là một
 * danh sách KHÁC — độ dày XÂY được mà một wall có thể làm tròn về, chỉ trùng
 * nhau ở 220. Màn này "chuẩn hoá độ dày" theo nghĩa hệ thiết kế (ba băng tô
 * được), nên khai lại {@link THICKNESS_GROUPS_MM} ở ĐÂY, bằng `[110, 220,
 * 330]`, KHÔNG dùng `STANDARD_THICKNESSES_MM` — đúng khuôn "định nghĩa lại,
 * không nhập chéo" mà `roomLabelTypes.ts` đã dùng cho các hằng cỡ chữ của nó.
 *
 * ## Cột bê tông cốt thép — quyết định đã duyệt X2
 *
 * `'CONCRETE_COLUMN'` là nhóm thứ TƯ: đếm được (`ThicknessSummary.concreteColumnCount`),
 * hiển thị được (chú giải, mã màu `var(--text-primary)` — xem
 * `src/components/canvas/materialMap.ts:29`), nhưng KHÔNG có lệnh áp — không
 * "chuẩn hoá cột về 220mm" nào có nghĩa. {@link ThicknessGroup} phản ánh điều
 * đó bằng cách gộp nó vào CÙNG một kiểu hợp với ba con số, thay vì tách một
 * kiểu "áp được" riêng: mọi nơi đọc `ThicknessGroup` đều phải xử lý nhánh này,
 * và trình biên dịch nhắc chứ không phải tài liệu.
 *
 * `src/domain/walls/types.ts` không có trường nào đánh dấu "đây là cột" —
 * `WallKind` chỉ có bốn nhãn, không nhãn nào tên "column". Đây là THIẾU LOGIC
 * THẬT (R-69): không hàm nào trong `src/domain/walls/**` phân loại được một
 * `Wall` là cột hay tường. `thicknessFixture.ts` né vấn đề này bằng cách dựng
 * ba đoạn "cột" có `thicknessMm` vượt xa nhóm 330 — 480/520/560 mm, cách xa
 * 330 hơn 100 mm — trong khi SÁU đoạn "lệch quá dung sai" (X4) không đoạn nào
 * vượt quá 365 mm; có một khoảng trống 115 mm (365↔480) không đoạn nào của bộ
 * mẫu rơi vào. T5 (hook) PHẢI hỏi điều phối viên trước khi cài đặt phép phân
 * loại cột thật (ngưỡng chính xác, hay tín hiệu khác như tỷ lệ dài/dày) — bộ
 * mẫu chỉ đảm bảo MỌI ngưỡng hợp lý nằm trong khoảng trống đó đều phân loại
 * đúng, không thay cho quyết định đó.
 *
 * ## Thang chuyển động — quyết định đã duyệt X3
 *
 * Đặc tả gốc xin 240 ms / 400 ms; `MOTION_DURATIONS_MS` của
 * `src/lib/motion/tokens.ts:62` chỉ có `{instant:120, fast:180, standard:260,
 * slow:340}`. T6/T7 dùng `standard` (260 ms) cho hoạt ảnh xếp lại bảng/biểu đồ,
 * `slow` (340 ms) cho nháy hàng khi chọn — không hằng số viết tay nào khác.
 *
 * ## Dung sai mặc định và cụm đo hệ thống — quyết định đã duyệt X4
 *
 * {@link DEFAULT_TOLERANCE_MM} = 20, lấy từ câu "6 tường lệch quá 20 mm sẽ
 * không đổi" của đặc tả gốc. Bộ mẫu 48 đoạn (`thicknessFixture.ts`) đồng thời
 * cần **30 đoạn đo đúng 195 mm** — ca người dùng chính của màn — và với
 * `THICKNESS_GROUPS_MM` cố định, khoảng cách 195↔220 (nhóm gần nhất) là 25 mm,
 * TỰ NÓ đã vượt 20 mm. Nếu `exceedsTolerance` chỉ đơn thuần là "khoảng cách
 * tới nhóm chuẩn gần nhất > dung sai" thì cả 30 đoạn đó sẽ bị đếm là "lệch quá
 * dung sai", mâu thuẫn với đúng SÁU đoạn mà câu tóm tắt "6 tường ... sẽ không
 * đổi" đòi.
 *
 * Quyết định đã duyệt (hỏi trực tiếp điều phối viên qua `orca orchestration
 * ask`, xem lịch sử phiên): {@link DEFAULT_TOLERANCE_MM} lọc TƯỜNG ĐO LẺ —
 * một giá trị đo KHÔNG lặp lại ở tường nào khác trong cùng bộ dữ liệu — chứ
 * KHÔNG lọc một CỤM đo lớn, đồng nhất. 30 tường cùng đo đúng 195 mm là một
 * SAI SỐ HIỆU CHỈNH CÓ HỆ THỐNG (một lỗi tỷ lệ/OCR làm lệch toàn bộ một loại
 * tường), được chấp nhận chuẩn hoá bất kể khoảng cách numeric tới nhóm chuẩn.
 * Một tường đo 260 mm mà KHÔNG tường nào khác trong bộ dữ liệu đo trùng giá
 * trị đó là NHIỄU — một lần đọc không chắc chắn, không đại diện cho gì khác —
 * và bị {@link DEFAULT_TOLERANCE_MM} loại khỏi lượt áp nếu lệch quá xa.
 *
 * T5 (hook) PHẢI cài `ThicknessSegmentRow.exceedsTolerance` theo đúng quy tắc
 * này: đo lẻ (không tường nào khác của kết quả dò cùng đo giá trị đó) VÀ lệch
 * quá {@link DEFAULT_TOLERANCE_MM} so với nhóm chuẩn gần nhất ⟹ `true`; một
 * cụm đo (từ hai tường trở lên cùng giá trị) không bao giờ `true` vì lý do
 * này — dù khoảng cách tới nhóm chuẩn là bao nhiêu. Nhóm `CONCRETE_COLUMN`
 * không có nhóm chuẩn để so nên `exceedsTolerance` của nó luôn `false` (khớp
 * X2: không có lệnh áp thì không có gì để "lệch"). `thicknessFixture.ts` cài
 * đặt executable đúng quy tắc này (hàm `isUnclusteredOutlier`), không chỉ ghi
 * trong chú thích, để test đối chiếu được bằng hằng.
 */

import type { WallId } from '@/domain/spatial/types';
import type { PointMm } from '@/domain/units/compare';
import type { ViewStatusCode } from '@/lib/viewmodel/types';

/* -------------------------------------------------------------------------- */
/* Ba nhóm chuẩn + cột bê tông cốt thép (X1, X2).                              */
/* -------------------------------------------------------------------------- */

/** Ba băng độ dày hệ thiết kế sơn được — xem ghi chú X1 đầu file. */
export const THICKNESS_GROUPS_MM = [110, 220, 330] as const;

/** Nhóm thứ tư: cột bê tông cốt thép — đếm/hiển thị được, KHÔNG có lệnh áp (X2). */
export const CONCRETE_COLUMN_GROUP = 'CONCRETE_COLUMN' as const;

/** Một trong ba độ dày chuẩn, hoặc nhóm cột bê tông cốt thép. */
export type ThicknessGroup = (typeof THICKNESS_GROUPS_MM)[number] | typeof CONCRETE_COLUMN_GROUP;

/** Nhãn tiếng Việt của từng nhóm — nguồn duy nhất, tránh ba worker gõ tay ba lần. */
export const THICKNESS_GROUP_LABELS: Readonly<Record<ThicknessGroup, string>> = {
  110: '110 mm',
  220: '220 mm',
  330: '330 mm',
  CONCRETE_COLUMN: 'cột bê tông cốt thép',
};

/* -------------------------------------------------------------------------- */
/* Hằng số dùng chung — không hằng số viết tay nào khác trong T6/T7 (R-71).    */
/* -------------------------------------------------------------------------- */

/** Dung sai mặc định, mm — xem ghi chú X4 đầu file. */
export const DEFAULT_TOLERANCE_MM = 20;

/** Bề rộng một cột của biểu đồ, mm. */
export const HISTOGRAM_BIN_MM = 5;

/** Chiều cao CỐ ĐỊNH của biểu đồ, px — khung xương lúc tải phải đúng chiều cao này (chống nhảy khung). */
export const HISTOGRAM_HEIGHT_PX = 200;

/** Bề rộng CỐ ĐỊNH của canvas xem trước, px. */
export const THICKNESS_PREVIEW_CANVAS_WIDTH_PX = 320;

/* -------------------------------------------------------------------------- */
/* Ba ngưỡng kéo được trên biểu đồ.                                            */
/* -------------------------------------------------------------------------- */

/**
 * Ba ngưỡng phân nhóm trên biểu đồ, mm, LUÔN tăng dần: `[a, b, c]` với
 * `a ≤ b ≤ c`. Đoạn đo ≤ `a` gợi ý nhóm 110; trong khoảng `(a, b]` gợi ý nhóm
 * 220; trong khoảng `(b, c]` gợi ý nhóm 330; lớn hơn `c` gợi ý cột bê tông cốt
 * thép — ba đường kéo được chia bốn dải ứng với bốn nhánh của
 * {@link ThicknessGroup}. Người dùng kéo từng đường trên biểu đồ qua
 * `ThicknessHistogramProps.onThresholdDrag`; giá trị KHỞI TẠO do T5 (hook)
 * chọn từ dữ liệu thật, không phải hằng số ở đây.
 */
export type ThicknessThresholds = readonly [number, number, number];

/** Chỉ số của một trong ba ngưỡng — tham số của `onThresholdDrag`. */
export type ThicknessThresholdIndex = 0 | 1 | 2;

/**
 * Sắp lại ba ngưỡng tăng dần — kéo ngưỡng giữa vượt qua ngưỡng biên không được
 * phép làm hỏng thứ tự `a ≤ b ≤ c`. Hàm thuần, không tính trung điểm hay số
 * viết tay nào khác — chỉ sắp xếp lại đúng ba số đã cho.
 */
export function sortThresholds(thresholds: ThicknessThresholds): ThicknessThresholds {
  const [first, second, third] = thresholds;
  const lowest = Math.min(first, second, third);
  const highest = Math.max(first, second, third);
  // Tổng trừ hai đầu ra giá trị giữa — đúng cả khi hai trong ba số bằng nhau.
  const middle = first + second + third - lowest - highest;
  return [lowest, middle, highest];
}

/** Giữ ba ngưỡng trong `[minMm, maxMm]`, rồi sắp lại tăng dần. */
export function clampThresholds(
  thresholds: ThicknessThresholds,
  minMm: number,
  maxMm: number,
): ThicknessThresholds {
  const [first, second, third] = thresholds;
  const clampOne = (value: number): number => Math.min(Math.max(value, minMm), maxMm);
  return sortThresholds([clampOne(first), clampOne(second), clampOne(third)]);
}

/* -------------------------------------------------------------------------- */
/* Một cột của biểu đồ.                                                        */
/* -------------------------------------------------------------------------- */

/** Một cột của biểu đồ độ dày — bề rộng `HISTOGRAM_BIN_MM`. */
export interface HistogramBin {
  readonly startMm: number;
  readonly endMm: number;
  readonly count: number;
  readonly wallIds: readonly WallId[];
}

/* -------------------------------------------------------------------------- */
/* Bảng nhóm bên trái — một hàng cho mỗi giá trị đo riêng biệt.                 */
/* -------------------------------------------------------------------------- */

/**
 * Một hàng của bảng nhóm — mọi tường đo ĐÚNG cùng `measuredMm` gộp vào một
 * hàng. `accepted` mặc định `false` cho MỌI hàng (CẤM TUYỆT ĐỐI: không tích
 * sẵn toàn bộ) — người dùng tự chọn nhóm nào được áp trước khi bấm nút áp.
 */
export interface ThicknessGroupRow {
  readonly measuredMm: number;
  readonly wallCount: number;
  readonly suggestedGroup: ThicknessGroup;
  readonly accepted: boolean;
  readonly wallIds: readonly WallId[];
}

/* -------------------------------------------------------------------------- */
/* Bảng chi tiết — 48 đoạn.                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Một hàng của bảng chi tiết 48 đoạn tường, đã sẵn sàng để VẼ — không còn
 * phép tính nào (A15: định dạng ở hook, không ở view; dấu thập phân là dấu
 * phẩy). `status` dùng đúng bốn mã của `ViewStatusCode`
 * (`src/lib/viewmodel/types.ts:65`): `'verified'` CHỈ khi `reviewed` (A5),
 * `'violation'` khi `exceedsTolerance` mà chưa duyệt, `'attention'` khi thuộc
 * nhóm `CONCRETE_COLUMN` hoặc độ tin cậy thấp mà chưa duyệt, `'neutral'` còn
 * lại.
 */
export interface ThicknessSegmentRow {
  readonly wallId: WallId;
  /** Mã hiển thị chữ đều, ví dụ `"#W-014"`. */
  readonly code: string;
  readonly measuredMm: number;
  /** Ví dụ `"195,0 mm"` — một chữ số thập phân, dấu phẩy (A15, ghép ở hook). */
  readonly measuredLabel: string;
  readonly normalizedGroup: ThicknessGroup;
  /** Khoảng cách tới nhóm chuẩn được gợi ý, luôn dương; `0` ở nhóm cột bê tông cốt thép. */
  readonly deviationMm: number;
  /** Ví dụ `"25,0 mm"`. */
  readonly deviationLabel: string;
  /** Xem ghi chú X4 đầu file — chỉ `true` cho một đo LẺ lệch quá {@link DEFAULT_TOLERANCE_MM}. */
  readonly exceedsTolerance: boolean;
  readonly confidence: number;
  /** Ví dụ `"AI đề xuất"` (`describeConfidence`, `src/lib/format/semantic.ts`). */
  readonly confidenceLabel: string;
  readonly floorName: string;
  readonly status: ViewStatusCode;
  readonly reviewed: boolean;
}

/* -------------------------------------------------------------------------- */
/* Dòng tóm tắt — bốn con số mono-lg.                                          */
/* -------------------------------------------------------------------------- */

/** Bốn con số tóm tắt của màn — không câu chữ ghép sẵn ở đây. */
export interface ThicknessSummary {
  readonly segmentCount: number;
  readonly normalizedCount: number;
  readonly exceedingToleranceCount: number;
  readonly concreteColumnCount: number;
}

/** Nhãn tiếng Việt viết thường cho từng con số của {@link ThicknessSummary}. */
export const THICKNESS_SUMMARY_LABELS: Readonly<Record<keyof ThicknessSummary, string>> = {
  segmentCount: 'tổng số đoạn tường',
  normalizedCount: 'đã chuẩn hoá',
  exceedingToleranceCount: 'lệch quá dung sai',
  concreteColumnCount: 'cột bê tông cốt thép',
};

/* -------------------------------------------------------------------------- */
/* Sắp xếp bảng chi tiết.                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Cột bảng chi tiết có thể sắp xếp theo. Mặc định
 * {@link DEFAULT_THICKNESS_SORT_KEY} — sắp theo sai lệch GIẢM DẦN, "để trường
 * hợp tệ nhất nổi lên đầu" (yêu cầu gốc của đặc tả).
 */
export type ThicknessSortKey = 'deviation' | 'measuredMm' | 'confidence' | 'floorName';

/** Cột sắp xếp mặc định khi mở màn. */
export const DEFAULT_THICKNESS_SORT_KEY: ThicknessSortKey = 'deviation';

/* -------------------------------------------------------------------------- */
/* Cảnh báo khi "áp dụng lại bộ lọc".                                          */
/* -------------------------------------------------------------------------- */

/**
 * Cảnh báo tại chỗ khi bấm "áp dụng lại bộ lọc" — CẤM TUYỆT ĐỐI: không bao
 * giờ ghi đè im lặng tường đã duyệt. `affectedReviewedCount`/`affectedWallIds`
 * phải nêu ĐÚNG SỐ tường đã duyệt bị ảnh hưởng; `excludeReviewed` là lựa chọn
 * người dùng đang bật (mặc định `true` — loại tường đã duyệt ra, đề nghị an
 * toàn hơn), không phải kết quả.
 */
export interface ReapplyFilterWarning {
  readonly affectedReviewedCount: number;
  readonly affectedWallIds: readonly WallId[];
  readonly excludeReviewed: boolean;
}

/* -------------------------------------------------------------------------- */
/* Xem trước trước khi áp — LUÔN hiện trước khi áp (CẤM TUYỆT ĐỐI).            */
/* -------------------------------------------------------------------------- */

/**
 * Tóm tắt trước khi áp, hiện thành câu kiểu "48 tường → 3 nhóm chuẩn. 6 tường
 * lệch quá 20 mm sẽ không đổi." — CẤM TUYỆT ĐỐI: luôn hiện trước khi áp, và
 * không tách thành nhiều bước hoàn tác (một lượt áp là MỘT vé hoàn tác, A8).
 * `unchangedWalls` liệt kê rõ, không phải một con số, để người dùng thấy
 * chính xác tường nào không đổi trước khi bấm xác nhận.
 */
export interface ApplyPreview {
  readonly totalWalls: number;
  readonly groupCount: number;
  readonly unchangedWalls: readonly ThicknessSegmentRow[];
  readonly sentence: string;
}

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái (A11/R-63) — tên lấy NGUYÊN VĂN từ `SEVEN_STATES`.           */
/* -------------------------------------------------------------------------- */

/**
 * Đúng bảy trạng thái của A11. `src/lib/testing/sevenStateScenarios.ts`
 * (`SEVEN_STATES`) dùng `'success'` cho nhánh thứ năm, KHÔNG dùng `'done'` —
 * đặc tả gốc của T4 gợi ý `'done'` nhưng chỉ dẫn của điều phối viên ("bộ
 * khẳng định đòi tên khác thì theo nó") và tiền lệ của hai màn QC anh em
 * (`WallLayerReview`, `RoomLabelReview`) đều thắng: dùng `'success'`.
 *
 * | Trạng thái  | Nghĩa ở màn Chuẩn hoá độ dày tường                                |
 * |-------------|---------------------------------------------------------------------|
 * | `empty`     | mọi tường đã chuẩn hết, không còn gì để chuẩn hoá                   |
 * | `loading`   | đang tải/đo lại lớp tường — khung xương biểu đồ đúng `HISTOGRAM_HEIGHT_PX` |
 * | `partial`   | mới có số đo của một số tầng — TRẠNG THÁI CHÍNH của màn             |
 * | `error`     | lớp dữ liệu độ dày hỏng                                             |
 * | `success`   | vừa áp xong, kèm dòng kết quả và nút hoàn tác                       |
 * | `forbidden` | vai Người xem: ẩn nút áp/duyệt/gộp nhóm                             |
 * | `collapsed` | ẩn canvas xem trước                                                 |
 */
export type ThicknessScreenState =
  | 'empty'
  | 'loading'
  | 'partial'
  | 'error'
  | 'success'
  | 'forbidden'
  | 'collapsed';

/* -------------------------------------------------------------------------- */
/* Props của các thành phần con (T6, T7 cài đặt đúng những interface này).     */
/* -------------------------------------------------------------------------- */

/** Mọi thứ biểu đồ nhận. Cột biểu đồ trung tính; chỉ dải mang màu xám tường ở độ mờ thấp (CẤM TUYỆT ĐỐI). */
export interface ThicknessHistogramProps {
  readonly bins: readonly HistogramBin[];
  readonly thresholds: ThicknessThresholds;
  /** Nhãn chữ đều cho từng ngưỡng, ví dụ `"165 mm"` — đã định dạng ở hook (A15). */
  readonly thresholdLabels: readonly [string, string, string];
  readonly onThresholdDrag: (index: ThicknessThresholdIndex, mm: number) => void;
  readonly hoveredBinIndex: number | null;
  readonly onHoverBin: (index: number | null) => void;
  readonly isLoading: boolean;
}

/** Một tường đã có sẵn đa giác cho canvas xem trước — canvas KHÔNG tự tính hình học (R-60). */
export interface ThicknessPreviewWallViewModel {
  readonly id: WallId;
  /** Đa giác đóng, kết quả của `resolveWallShapes` (`src/domain/walls/joints.ts`), hook chuyền tay không tính lại. */
  readonly outline: readonly PointMm[];
  readonly group: ThicknessGroup;
}

/** Một dòng chú giải độ dày của canvas xem trước. */
export interface ThicknessPreviewLegendEntry {
  readonly group: ThicknessGroup;
  readonly label: string;
}

/** Mọi thứ canvas xem trước nhận — rộng cố định {@link THICKNESS_PREVIEW_CANVAS_WIDTH_PX}. */
export interface ThicknessPreviewCanvasProps {
  readonly walls: readonly ThicknessPreviewWallViewModel[];
  /** Nhóm đang trỏ tới (từ bảng nhóm) để tô sáng cả cụm — `null` khi không trỏ tới nhóm nào. */
  readonly highlightedGroup: ThicknessGroup | null;
  /** Tường đang trỏ tới (từ bảng chi tiết) để tô sáng một mình nó — `null` khi không trỏ tới tường nào. */
  readonly highlightedWallId: WallId | null;
  readonly legend: readonly ThicknessPreviewLegendEntry[];
  readonly isCollapsed: boolean;
}

/** Mọi thứ bảng nhóm bên trái nhận. */
export interface ThicknessGroupTableProps {
  readonly rows: readonly ThicknessGroupRow[];
  /** Tích/bỏ tích một hàng — CẤM TUYỆT ĐỐI: không hàng nào tích sẵn. */
  readonly onToggleAccepted: (measuredMm: number, accepted: boolean) => void;
  readonly hoveredMeasuredMm: number | null;
  readonly onHoverRow: (measuredMm: number | null) => void;
  readonly isLoading: boolean;
}

/** Mọi thứ bảng chi tiết 48 đoạn nhận. */
export interface ThicknessSegmentTableProps {
  readonly rows: readonly ThicknessSegmentRow[];
  readonly sortKey: ThicknessSortKey;
  readonly onSortChange: (key: ThicknessSortKey) => void;
  readonly hoveredWallId: WallId | null;
  readonly onHoverRow: (wallId: WallId | null) => void;
  readonly isLoading: boolean;
}

/** Mọi thứ dòng tóm tắt nhận. */
export interface ThicknessSummaryProps {
  readonly summary: ThicknessSummary;
}

/**
 * Mọi thứ thanh áp dụng dưới cùng nhận — xem trước, cảnh báo áp lại bộ lọc,
 * và kết quả sau khi áp, gộp một chỗ vì cả ba đều thuộc vòng đời của MỘT lượt
 * áp (CẤM TUYỆT ĐỐI: không tách thành nhiều bước hoàn tác).
 */
export interface ThicknessApplyBarProps {
  /** Xem trước trước khi áp. `null` khi chưa tính (chưa hàng nào được tích, hoặc chưa bấm "xem trước"). */
  readonly preview: ApplyPreview | null;
  /** Cảnh báo khi "áp dụng lại bộ lọc" đụng tường đã duyệt. `null` khi không có. */
  readonly reapplyWarning: ReapplyFilterWarning | null;
  /** Câu kết quả SAU khi đã áp, ví dụ "Đã chuẩn hoá 42/48 tường về 3 nhóm chuẩn.". `null` trước khi áp. */
  readonly resultSentence: string | null;
  readonly onOpenPreview: () => void;
  readonly onApply: () => void;
  readonly onCancelPreview: () => void;
  readonly onReapplyFilter: () => void;
  readonly onToggleExcludeReviewed: () => void;
  /** Hoàn tác lượt áp gần nhất (A8) — thường đi cùng toast, không tham số. */
  readonly onUndo: () => void;
  /** `true` ở vai Người xem — CẤM TUYỆT ĐỐI không hộp thoại, nên chỉ ẩn nút áp/hoàn tác. */
  readonly isViewerRole: boolean;
}

/* -------------------------------------------------------------------------- */
/* KHOÁ SAU KHI XONG                                                           */
/* -------------------------------------------------------------------------- */

/*
 * File này ĐÓNG BĂNG kể từ lúc lớp L1 xong. Worker lớp sau (T5 hook/gateway,
 * T6 biểu đồ/canvas, T7 bảng/tóm tắt) thấy thiếu một trường, sai một kiểu, hay
 * cần thêm một prop thì phải `orca orchestration ask` hỏi điều phối viên
 * trước — không tự thêm, không tự sửa, kể cả người đã viết file này. Cách hợp
 * lệ duy nhất để mở rộng là MỞ RỘNG kiểu ở file riêng, đúng khuôn
 * `UseScaleCalibrationHookOptions extends UseScaleCalibrationOptions` của màn
 * `ScaleCalibration`.
 */
