/**
 * Hợp đồng kiểu của màn QC "Chuẩn hoá độ dày tường" (`ThicknessStandardization`).
 *
 * Đây là NỀN MÓNG (lớp L1), đúng khuôn `WallLayerReview/types.ts` và
 * `RoomLabelReview/roomLabelTypes.ts` — hai màn QC anh em đã xong. Chỉ khai
 * KIỂU và HẰNG. Không import React, không import `src/api`, `src/store`,
 * `src/lib/http`. Ba worker lớp sau (T5 — hook, T6 — biểu đồ/canvas, T7 —
 * bảng/tóm tắt) import DỰA VÀO đúng những gì khai ở đây. Thêm một trường hay
 * đổi hình dạng một kiểu đã khai là quyết định của điều phối viên — hỏi bằng
 * `orca orchestration ask` trước khi tự thêm (xem "KHOÁ SAU KHI XONG" cuối
 * file).
 *
 * ## Hàm chuẩn hoá THẬT — điều phối viên đã xác minh, dùng thẳng
 *
 * `standardizeThickness(rawThicknessMm): { original_mm, standardized }` ở
 * `src/lib/geometry/standardize.ts:17` là NGUỒN THẬT DUY NHẤT quyết định một
 * số đo mm rơi vào nhóm nào:
 *
 * ```
 * < 165        -> 110
 * 165 .. < 275 -> 220
 * 275 .. <= 350-> 330
 * > 350        -> 'CONCRETE_COLUMN'
 * ```
 *
 * Màn này (hook T5) GỌI hàm đó, không tự làm tròn, không khai lại bảng nhóm —
 * file này chỉ khai HÌNH DẠNG dữ liệu hook cần, không khai lại logic.
 * `standardizeThickness(195).standardized === 220` đúng câu chuyện gốc của
 * đặc tả (30 tường 195 mm bị quy về 220 mm).
 *
 * ## X1 — vì sao `ThicknessGroup` là BÍ DANH của `WallThickness`, không phải một union mới
 *
 * `WallThickness = 110 | 220 | 330 | 'CONCRETE_COLUMN'` đã khai ở
 * `src/types/spatial.ts:14`, đúng bốn nhóm hàm `standardizeThickness` sinh ra.
 * Khai một union thứ hai trùng lặp ở đây là thứ có thể trôi khỏi kiểu gốc khi
 * một trong hai chỗ đổi mà chỗ kia quên theo — nên {@link ThicknessGroup}
 * dùng lại nguyên kiểu đó (R-61: hook chỉ nối lại logic đã có, không tự chế
 * hình dạng song song). Đây cũng là câu trả lời cho X2: `'CONCRETE_COLUMN'`
 * là kết quả HỢP LỆ của chính `standardizeThickness` (> 350 mm), không phải
 * một nhóm bịa thêm — nó đếm được, hiển thị được, nhưng KHÔNG có lệnh áp
 * (không có thao tác "đổi tường này thành cột bê tông cốt thép").
 *
 * Phần bổ sung thật của màn này — thứ `WallThickness` không mang — là NHÃN
 * TIẾNG VIỆT và THỨ TỰ HIỂN THỊ cho từng nhóm: {@link THICKNESS_GROUPS_MM},
 * {@link CONCRETE_COLUMN_GROUP}, {@link THICKNESS_GROUP_DISPLAY_ORDER},
 * {@link THICKNESS_GROUP_LABELS}.
 *
 * ## X3 — dung sai mặc định là 30 mm, không phải 20 mm
 *
 * Câu ví dụ gốc của đặc tả ("6 tường lệch quá 20 mm sẽ không đổi") xung đột số
 * học với câu chuyện chính (30 tường 195 mm phải quy về 220, lệch 25 mm) nếu
 * dung sai là 20: khi đó cả 30 tường mũi nhọn cũng bị tính vượt dung sai. Điều
 * phối viên đã quyết: {@link DEFAULT_TOLERANCE_MM} = 30 (KHÔNG phải 20), giữ
 * dung sai ĐỒNG NHẤT theo từng tường — không có "dung sai theo cụm" tự chế
 * (đó là công thức bịa, phạm R-61). Con số 20 mm trong đặc tả chỉ là ví dụ; ô
 * dung sai là số người dùng sửa được (`NumericField` ở tầng component, T7 lo
 * phần đó). Câu tóm tắt {@link ApplyPreview.sentence} phải ghép từ số đếm và
 * dung sai ĐANG ĐẶT — không viết chuỗi cứng "6 tường lệch quá 20 mm".
 *
 * ## Vì sao KHÔNG có `sortThresholds`/`clampThresholds` ở đây
 *
 * Đặc tả gợi ý kèm hai hàm thuần này "nếu cần giữ thứ tự tăng dần" khi kéo một
 * ngưỡng. Cả hai màn QC anh em (`WallLayerReview/types.ts`,
 * `RoomLabelReview/roomLabelTypes.ts`) đều tự đặt luật riêng cho file này:
 * "chỉ khai KIỂU và HẰNG" — không một hàm nào, kể cả hàm thuần. Giữ đúng luật
 * đó ở đây: sắp lại ba ngưỡng sau khi kéo là một phép tính (mục B của
 * `CLAUDE.md`: "Tính toán không nằm trong màn hình"), nên nó thuộc về
 * `useThicknessStandardization.ts` của T5, không phải file kiểu này — một
 * dòng `[...t].sort((a, b) => a - b)` trong hook không cần một hàm xuất khẩu
 * riêng ở đây.
 *
 * ## Bảy trạng thái (A11/R-63) — tên lấy NGUYÊN VĂN từ `SEVEN_STATES`
 *
 * `src/lib/testing/sevenStateScenarios.ts` (`SEVEN_STATES`) dùng `'success'`,
 * KHÔNG dùng `'done'` — đúng tiền lệ hai màn QC anh em. {@link ThicknessScreenState}
 * dùng nguyên bảy tên đó.
 *
 * | Trạng thái  | Nghĩa ở màn Chuẩn hoá độ dày tường                                   |
 * |-------------|-----------------------------------------------------------------------|
 * | `empty`     | mọi đoạn đã ở đúng nhóm chuẩn, không còn gì để áp; hoặc chưa có số đo |
 * | `loading`   | đang tải số đo — biểu đồ vẽ khung xương đúng `HISTOGRAM_HEIGHT_PX`    |
 * | `partial`   | mới có số đo một phần (một số nhóm hoặc một số tầng) — trạng thái CHÍNH |
 * | `error`     | lớp số đo hỏng                                                        |
 * | `success`   | vừa áp xong; dòng kết quả + nút hoàn tác (A8); nếu hết lệch thì tóm tắt lên mức đã duyệt |
 * | `forbidden` | vai Người xem: ẩn nút áp/gộp/sửa dung sai                             |
 * | `collapsed` | ẩn canvas xem trước, chỉ còn biểu đồ + hai bảng                       |
 *
 * ## Vì sao `measuredMm`/`deviationMm` là `number` trần, không gắn nhãn
 *
 * T2 đã đối chiếu: màn QC dùng `Wall` của `src/domain/spatial/types.ts`
 * (`thicknessMm: Millimetres = number`, KHÔNG gắn nhãn — xem
 * `docs/notes/thickness/data.md` mục 2), khác kiểu `Wall` gắn nhãn của
 * `src/domain/walls/types.ts` mà `standardizeThickness`/`cleanup.ts` dùng nội
 * bộ. Hợp đồng dưới đây theo đúng quy ước của dữ liệu nó bọc — trần, không gắn
 * nhãn — đúng khuôn `WallRowViewModel.thicknessMm` của `WallLayerReview`. Khi
 * hook cần gọi các hàm gắn nhãn (nếu có), nó tự bọc số bằng `millimetres()`
 * tại chỗ gọi, không đổi kiểu ở đây.
 *
 * ## Vì sao `deviationMm`/`exceedsTolerance` LUÔN là `0`/`false` ở nhóm cột bê tông cốt thép
 *
 * `'CONCRETE_COLUMN'` không có một giá trị mm chuẩn để so — X2 nói rõ nó
 * "đếm được, hiển thị được, nhưng KHÔNG có lệnh áp". Không có mục tiêu số thì
 * không có "lệch bao nhiêu" để nói, nên hook phải đặt `deviationMm: 0` và
 * `exceedsTolerance: false` cho mọi đoạn thuộc nhóm này — không suy ra một
 * ngưỡng giả.
 *
 * ## `ThicknessSegmentRow.status` dùng lại `ViewStatusCode`, không khai mã mới
 *
 * Đặc tả liệt kê đúng bốn mã `'verified' | 'attention' | 'violation' | 'neutral'`
 * — trùng khớp {@link ViewStatusCode} của `src/lib/viewmodel/types.ts:68` (A4:
 * đúng ba màu trạng thái + trung tính, không có mã thứ năm). Dùng lại thẳng
 * kiểu đó (R-61) thay vì khai một union giống hệt.
 *
 * ## `ThicknessStandardizationProps` — bổ sung ngoài danh sách khai tối thiểu (R-59)
 *
 * Đúng khuôn `RoomLabelReviewProps` (không phải cặp `{ panel, canvas }` như
 * `WallLayerReviewProps` — màn này có nhiều mảnh ngang hàng: biểu đồ, canvas
 * xem trước, hai bảng, tóm tắt, thanh áp dụng — không có một cặp panel/canvas
 * hai cột rõ ràng để gói). {@link ThicknessStandardizationProps} là kiểu hook
 * `useThicknessStandardization` (T5) trả về; `ThicknessStandardization.tsx`
 * (T7) cắt lát cho từng view con bằng đúng các `*Props` khai bên dưới. Thuần
 * cộng thêm: xoá kiểu này không đổi hình dạng của bất kỳ trường nào bên trong
 * các `*Props` con.
 */

import type { Confidence, Point, WallId } from '@/domain/spatial/types';
import type { WallThickness } from '@/types/spatial';
import type { ViewStatusCode } from '@/lib/viewmodel/types';

/* -------------------------------------------------------------------------- */
/* Bốn nhóm chuẩn hoá — xem "X1" ở đầu file.                                   */
/* -------------------------------------------------------------------------- */

/** Bí danh của `WallThickness` — xem "X1" ở đầu file vì sao không khai union mới. */
export type ThicknessGroup = WallThickness;

/** Ba nhóm SỐ, theo thứ tự hiển thị tăng dần. Không gồm cột bê tông cốt thép. */
export const THICKNESS_GROUPS_MM = [110, 220, 330] as const;

/** Nhóm thứ tư — cột bê tông cốt thép. Đếm được, hiển thị được, không có lệnh áp (X2). */
export const CONCRETE_COLUMN_GROUP: ThicknessGroup = 'CONCRETE_COLUMN';

/** Cả bốn nhóm, đúng thứ tự hiển thị — ba nhóm số trước, cột bê tông cốt thép sau cùng. */
export const THICKNESS_GROUP_DISPLAY_ORDER: readonly ThicknessGroup[] = [
  ...THICKNESS_GROUPS_MM,
  CONCRETE_COLUMN_GROUP,
];

/** Nhãn tiếng Việt của từng nhóm, viết thường kiểu câu trừ mã trục/số (A6). */
export const THICKNESS_GROUP_LABELS: Readonly<Record<ThicknessGroup, string>> = {
  110: '110 mm',
  220: '220 mm',
  330: '330 mm',
  CONCRETE_COLUMN: 'cột bê tông cốt thép',
};

/* -------------------------------------------------------------------------- */
/* Dung sai, ngưỡng, kích thước khung xương — xem "X3" ở đầu file.             */
/* -------------------------------------------------------------------------- */

/** Dung sai mặc định, mm. ĐÃ CHỐT = 30 (KHÔNG phải 20 trong câu ví dụ của đặc tả) — xem "X3". */
export const DEFAULT_TOLERANCE_MM = 30;

/** Bề rộng một cột biểu đồ, mm. */
export const HISTOGRAM_BIN_MM = 5;

/** Chiều cao khung biểu đồ, px — khung xương lúc tải PHẢI đúng chiều cao này để không nhảy khung. */
export const HISTOGRAM_HEIGHT_PX = 200;

/** Bề rộng cố định của canvas xem trước, px. */
export const THICKNESS_PREVIEW_CANVAS_WIDTH_PX = 320;

/**
 * Ba ngưỡng kéo được của biểu đồ, theo thứ tự tăng dần — ranh giới
 * 110↔220, 220↔330, 330↔cột bê tông cốt thép. Chỉ số (0/1/2) khớp tham số
 * `index` của {@link ThicknessHistogramProps.onThresholdDrag}.
 */
export type ThicknessThresholds = readonly [lowMm: number, midMm: number, highMm: number];

/** Mặc định ĐÚNG BA số của `standardizeThickness` (`src/lib/geometry/standardize.ts:12-15`). */
export const DEFAULT_THICKNESS_THRESHOLDS: ThicknessThresholds = [165, 275, 350];

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái (A11/R-63) — xem bảng ở đầu file.                            */
/* -------------------------------------------------------------------------- */

/** Đúng bảy trạng thái của A11, tên lấy nguyên từ `SEVEN_STATES`. */
export type ThicknessScreenState =
  | 'empty'
  | 'loading'
  | 'partial'
  | 'error'
  | 'success'
  | 'forbidden'
  | 'collapsed';

/* -------------------------------------------------------------------------- */
/* Một cột của biểu đồ.                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Một cột biểu đồ — TRUNG TÍNH (CẤM TUYỆT ĐỐI: cột không mang màu nhóm). Chỉ
 * các DẢI nền phía sau (vẽ bằng `wallStrokeToken` ở độ mờ thấp, xem
 * `docs/notes/thickness/data.md` mục 5) mới mang màu xám tường — dải đó là
 * việc của T6, không cần một trường màu ở đây.
 */
export interface HistogramBin {
  readonly startMm: number;
  readonly endMm: number;
  readonly count: number;
  readonly wallIds: readonly WallId[];
}

/* -------------------------------------------------------------------------- */
/* Bảng nhóm bên trái — một dòng cho mỗi số đo khác nhau.                      */
/* -------------------------------------------------------------------------- */

/**
 * Một dòng của bảng nhóm. `accepted` mặc định `false` CHO MỌI HÀNG (CẤM TUYỆT
 * ĐỐI: không tích sẵn toàn bộ, không áp thay đổi nào trước khi người dùng bấm).
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
 * Một dòng của bảng chi tiết 48 đoạn, không còn phép tính nào (A15: định dạng
 * ở hook, không ở view; dấu thập phân là dấu phẩy).
 *
 * `deviationMm`/`exceedsTolerance` luôn `0`/`false` ở nhóm cột bê tông cốt
 * thép — xem ghi chú đầu file.
 */
export interface ThicknessSegmentRow {
  readonly wallId: WallId;
  /** Mã hiển thị chữ đều, ví dụ `"#W-014"`. */
  readonly code: string;
  readonly measuredMm: number;
  /** Ví dụ `"195,0 mm"` — một chữ số thập phân, dấu phẩy (A15). */
  readonly measuredLabel: string;
  readonly normalizedGroup: ThicknessGroup;
  readonly deviationMm: number;
  /** Ví dụ `"25,0 mm"`. */
  readonly deviationLabel: string;
  /** `deviationMm > toleranceMm` đang đặt — hook tính sẵn, view không tự so (R-61). */
  readonly exceedsTolerance: boolean;
  readonly confidence: Confidence;
  /** Ví dụ `"AI đề xuất"` (`describeConfidence`, `src/lib/format/semantic.ts`). */
  readonly confidenceLabel: string;
  readonly floorName: string;
  /** Đúng bốn mã của `ViewStatusCode` (A4) — dùng lại thẳng, xem ghi chú đầu file. */
  readonly status: ViewStatusCode;
  readonly reviewed: boolean;
}

/* -------------------------------------------------------------------------- */
/* Sắp xếp bảng chi tiết — "để trường hợp tệ nhất nổi lên đầu".                */
/* -------------------------------------------------------------------------- */

/** Cột bảng chi tiết có thể sắp theo. Mặc định `'deviation'` (spec: tệ nhất lên đầu). */
export type ThicknessSortKey = 'deviation' | 'measured' | 'confidence' | 'floor';

export const DEFAULT_THICKNESS_SORT_KEY: ThicknessSortKey = 'deviation';

/* -------------------------------------------------------------------------- */
/* Bốn con số tóm tắt.                                                         */
/* -------------------------------------------------------------------------- */

/** Bốn con số mono-lg đầu màn. */
export interface ThicknessSummary {
  readonly segmentCount: number;
  readonly normalizedCount: number;
  readonly exceedingToleranceCount: number;
  readonly concreteColumnCount: number;
}

/** Nhãn tiếng Việt cho từng con số của {@link ThicknessSummary}, viết thường kiểu câu. */
export const THICKNESS_SUMMARY_LABELS: Readonly<Record<keyof ThicknessSummary, string>> = {
  segmentCount: 'tổng số đoạn tường',
  normalizedCount: 'đã ở đúng nhóm chuẩn',
  exceedingToleranceCount: 'lệch quá dung sai',
  concreteColumnCount: 'cột bê tông cốt thép',
};

/* -------------------------------------------------------------------------- */
/* Cảnh báo khi áp dụng lại bộ lọc.                                            */
/* -------------------------------------------------------------------------- */

/**
 * Cảnh báo tại chỗ khi bấm "áp dụng lại bộ lọc" (CẤM TUYỆT ĐỐI: không bao giờ
 * ghi đè im lặng tường đã duyệt). `affectedReviewedCount` phải là SỐ THẬT,
 * đếm từ dữ liệu, không phải một câu chữ cứng.
 */
export interface ReapplyFilterWarning {
  readonly affectedReviewedCount: number;
  readonly affectedWallIds: readonly WallId[];
  readonly excludeReviewed: boolean;
}

/* -------------------------------------------------------------------------- */
/* Xem trước trước khi áp — luôn hiện trước khi áp (đúng khuôn                */
/* `RoomLabelNormalizePreview`).                                               */
/* -------------------------------------------------------------------------- */

/**
 * Tóm tắt trước khi áp, ví dụ câu "48 tường → 3 nhóm chuẩn. 6 tường lệch quá
 * 30 mm sẽ không đổi." `sentence` PHẢI ghép từ số đếm và dung sai đang đặt ở
 * hook (A15) — cấm chuỗi cứng, xem "X3" ở đầu file. `unchangedWalls` là mảng
 * HÀNG ĐẦY ĐỦ (không phải một con số) vì đặc tả đòi liệt kê rõ tường nào
 * không đổi.
 */
export interface ApplyPreview {
  readonly totalWalls: number;
  readonly groupCount: number;
  readonly unchangedWalls: readonly ThicknessSegmentRow[];
  readonly sentence: string;
}

/* -------------------------------------------------------------------------- */
/* Canvas xem trước — không tính hình học ở view (R-60).                       */
/* -------------------------------------------------------------------------- */

/**
 * Một hình tường đã có sẵn đa giác, đủ để canvas xem trước vẽ — đúng khuôn
 * `WallShapeViewModel` của `WallLayerReview` (canvas KHÔNG tự tính hình học).
 */
export interface ThicknessWallShapeViewModel {
  readonly wallId: WallId;
  /** Đa giác đóng, ngược kim đồng hồ, ít nhất bốn đỉnh. */
  readonly outline: readonly Point[];
  readonly group: ThicknessGroup;
}

/** Một mục chú giải độ dày — token màu đã ghép sẵn (`wallStrokeToken`, view không tự chọn màu). */
export interface ThicknessLegendEntry {
  readonly group: ThicknessGroup;
  readonly label: string;
  /** Ví dụ `"var(--wall-220)"` — CSS custom property, view chỉ gán thẳng vào style (A1). */
  readonly colorToken: string;
}

/** Mọi thứ canvas xem trước nhận. */
export interface ThicknessPreviewCanvasProps {
  readonly shapes: readonly ThicknessWallShapeViewModel[];
  readonly legend: readonly ThicknessLegendEntry[];
  /** Nhóm đang trỏ tới (từ bảng nhóm hoặc biểu đồ) — cùng khái niệm với {@link ThicknessGroupTableProps.hoveredGroup}. */
  readonly hoveredGroup: ThicknessGroup | null;
  /** Tường đang trỏ tới — cùng khái niệm với {@link ThicknessSegmentTableProps.hoveredWallId}. */
  readonly hoveredWallId: WallId | null;
  readonly onHoverWall: (wallId: WallId | null) => void;
  /** `true` ở trạng thái `collapsed` — CẤM TUYỆT ĐỐI: ẩn canvas xem trước, không xoá dữ liệu. */
  readonly isCollapsed: boolean;
}

/* -------------------------------------------------------------------------- */
/* Biểu đồ.                                                                    */
/* -------------------------------------------------------------------------- */

/** Mọi thứ biểu đồ nhận. */
export interface ThicknessHistogramProps {
  readonly bins: readonly HistogramBin[];
  readonly thresholds: ThicknessThresholds;
  readonly onThresholdDrag: (index: number, mm: number) => void;
  /** Nhãn chữ đã định dạng sẵn cho mỗi ngưỡng, cùng thứ tự với {@link ThicknessThresholds} (A15). */
  readonly thresholdLabels: readonly string[];
  readonly hoveredBinIndex: number | null;
  readonly onHoverBin: (index: number | null) => void;
  /** `true` khi số đo chưa tới — khung xương vẽ đúng {@link HISTOGRAM_HEIGHT_PX}, không nhảy khung. */
  readonly isLoading: boolean;
}

/* -------------------------------------------------------------------------- */
/* Bảng nhóm bên trái.                                                         */
/* -------------------------------------------------------------------------- */

/** Mọi thứ bảng nhóm nhận. */
export interface ThicknessGroupTableProps {
  readonly rows: readonly ThicknessGroupRow[];
  readonly hoveredGroup: ThicknessGroup | null;
  readonly onHoverGroup: (group: ThicknessGroup | null) => void;
  /** Tích/bỏ tích một dòng — CẤM TUYỆT ĐỐI: không tích sẵn, người dùng phải tự bấm. */
  readonly onToggleAccepted: (measuredMm: number, accepted: boolean) => void;
}

/* -------------------------------------------------------------------------- */
/* Bảng chi tiết — 48 đoạn.                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Mọi thứ bảng chi tiết nhận.
 *
 * Bảy trường CUỐI (chọn hàng theo lô, đổi nhóm tại ô, dải nháy) do điều phối
 * viên bổ sung sau khi T7 phát hiện hợp đồng ban đầu thiếu chỗ cho "chọn hàng
 * thì hiện dải hành động (`TableActionBar`)" của đặc tả S-18 — xem
 * `orca orchestration ask` của T7. Tên trường khớp đúng thứ T5 (hook) cấp,
 * không tự đặt tên khác. View vẫn chỉ BÁO sự kiện ra ngoài (A10) — không tự
 * áp thay đổi nào, không tự đặt hẹn giờ tắt nháy.
 */
export interface ThicknessSegmentTableProps {
  readonly rows: readonly ThicknessSegmentRow[];
  readonly sortKey: ThicknessSortKey;
  readonly onChangeSortKey: (key: ThicknessSortKey) => void;
  readonly hoveredWallId: WallId | null;
  readonly onHoverRow: (wallId: WallId | null) => void;

  /** Các hàng đang được chọn để thao tác theo lô — nguồn cho `TableActionBar.selectedCount`. */
  readonly selectedWallIds: readonly WallId[];
  /** Tích/bỏ tích một hàng (ô đồng ý ở đầu hàng). */
  readonly onToggleRowSelected: (wallId: WallId, selected: boolean) => void;
  /** Tích/bỏ tích toàn bộ hàng đang hiển thị (ô đồng ý ở tiêu đề). */
  readonly onToggleAllSelected: (selected: boolean) => void;
  /** Bỏ chọn tất cả — nút "Bỏ chọn" của `TableActionBar`. */
  readonly onClearSelection: () => void;
  /** Đổi nhóm chuẩn hoá của MỘT hàng qua `SegmentedControl` ngay trong ô "độ dày chuẩn hoá". */
  readonly onChangeNormalizedGroup: (wallId: WallId, group: ThicknessGroup) => void;
  /** Gán một nhóm chuẩn cho TẤT CẢ hàng đang chọn — hành động chính phát từ `TableActionBar`. */
  readonly onApplySelectedGroup: (group: ThicknessGroup) => void;
  /**
   * Các hàng vừa được gán theo lô — nháy `--bg-flash` trong `slow` (340 ms).
   * Danh sách và hẹn giờ tắt nháy do hook giữ; view chỉ đọc, không tự đặt
   * `setTimeout`.
   */
  readonly flashingWallIds: readonly WallId[];
}

/* -------------------------------------------------------------------------- */
/* Tóm tắt bốn con số.                                                         */
/* -------------------------------------------------------------------------- */

/** Mọi thứ khối tóm tắt nhận. */
export interface ThicknessSummaryProps {
  readonly summary: ThicknessSummary;
}

/* -------------------------------------------------------------------------- */
/* Thanh áp dụng — dung sai, xem trước, áp, hoàn tác, áp dụng lại bộ lọc.       */
/* -------------------------------------------------------------------------- */

/**
 * Mọi thứ thanh áp dụng nhận. `preview` là `null` cho tới khi
 * {@link onOpenPreview} được gọi — đúng khuôn `RoomLabelNormalizePreviewProps`
 * (CẤM TUYỆT ĐỐI: bảng xem trước luôn hiện trước khi áp). `onUndo` là MỘT
 * hành động cho cả lượt áp (CẤM TUYỆT ĐỐI: không tách thành nhiều bước hoàn
 * tác).
 */
export interface ThicknessApplyBarProps {
  readonly preview: ApplyPreview | null;
  readonly toleranceMm: number;
  readonly onChangeTolerance: (mm: number) => void;
  readonly onOpenPreview: () => void;
  readonly onApplyPreview: () => void;
  readonly onCancelPreview: () => void;
  /** Hoàn tác thao tác gần nhất (A8) — thường đi cùng toast, không tham số. */
  readonly onUndo: () => void;
  /** `null` khi chưa bấm "áp dụng lại bộ lọc" hoặc không có tường đã duyệt bị ảnh hưởng. */
  readonly reapplyWarning: ReapplyFilterWarning | null;
  /** Xác nhận áp dụng lại — CẤM TUYỆT ĐỐI: không bao giờ ghi đè im lặng tường đã duyệt. */
  readonly onReapplyFilter: (excludeReviewed: boolean) => void;
  /**
   * Bỏ qua lớp cảnh báo mà không áp gì — nút "Huỷ" của lớp đó.
   *
   * Trường DUY NHẤT được thêm sau khi file này đóng băng ở lượt T8, và điều
   * phối viên duyệt riêng (xem `orca orchestration ask` của T8). Vì sao bắt
   * buộc: {@link onReapplyFilter} không có nhánh nào chỉ-bỏ-qua — gọi nó với
   * `false` lần thứ hai LÀ lượt áp cho tất cả — nên nếu không có prop này thì
   * nút "Huỷ" hoặc là nút chết, hoặc là một nút "Huỷ" thật sự đi áp. Hàm này
   * đi ĐÚNG đường mà phím Escape của hook đang gọi, để A12 ("Esc đóng lớp trên
   * cùng") và nút bấm là MỘT hành vi chứ không phải hai.
   */
  readonly onDismissReapplyWarning: () => void;
}

/* -------------------------------------------------------------------------- */
/* Toàn màn — kiểu hook trả về (R-59) — xem ghi chú đầu file.                  */
/* -------------------------------------------------------------------------- */

/**
 * Mọi thứ hook `useThicknessStandardization` trả về. View KHÔNG tự gọi store
 * — mọi thay đổi đi ra qua một trong các `on...` dưới đây (A10). KHÔNG có
 * trong danh sách khai tối thiểu của đặc tả — bổ sung thuần cộng thêm (R-59),
 * xem ghi chú đầu file. Xoá kiểu này không đổi hình dạng của bất kỳ trường
 * nào bên trong các `*Props` con — `ThicknessStandardization.tsx` (T7) vẫn
 * dùng được từng `*Props` độc lập nếu điều phối viên muốn bỏ kiểu gộp này.
 */
export interface ThicknessStandardizationProps {
  readonly state: ThicknessScreenState;

  /* -- Biểu đồ -------------------------------------------------------------- */
  readonly bins: readonly HistogramBin[];
  readonly thresholds: ThicknessThresholds;
  readonly thresholdLabels: readonly string[];
  readonly onThresholdDrag: (index: number, mm: number) => void;
  readonly hoveredBinIndex: number | null;
  readonly onHoverBin: (index: number | null) => void;
  readonly isLoading: boolean;

  /* -- Canvas xem trước ------------------------------------------------------ */
  readonly shapes: readonly ThicknessWallShapeViewModel[];
  readonly legend: readonly ThicknessLegendEntry[];
  readonly isCollapsed: boolean;
  readonly onToggleCollapsed: () => void;

  /* -- Trỏ tới dùng chung giữa canvas / hai bảng ----------------------------- */
  readonly hoveredGroup: ThicknessGroup | null;
  readonly onHoverGroup: (group: ThicknessGroup | null) => void;
  readonly hoveredWallId: WallId | null;
  readonly onHoverWall: (wallId: WallId | null) => void;

  /* -- Bảng nhóm bên trái ----------------------------------------------------- */
  readonly groupRows: readonly ThicknessGroupRow[];
  readonly onToggleAccepted: (measuredMm: number, accepted: boolean) => void;

  /* -- Bảng chi tiết ----------------------------------------------------------- */
  readonly segmentRows: readonly ThicknessSegmentRow[];
  readonly sortKey: ThicknessSortKey;
  readonly onChangeSortKey: (key: ThicknessSortKey) => void;

  /* -- Tóm tắt ------------------------------------------------------------------ */
  readonly summary: ThicknessSummary;

  /* -- Dung sai, xem trước, áp, hoàn tác, áp dụng lại bộ lọc --------------------- */
  readonly toleranceMm: number;
  readonly onChangeTolerance: (mm: number) => void;
  readonly preview: ApplyPreview | null;
  readonly onOpenPreview: () => void;
  readonly onApplyPreview: () => void;
  readonly onCancelPreview: () => void;
  readonly onUndo: () => void;
  readonly reapplyWarning: ReapplyFilterWarning | null;
  readonly onReapplyFilter: (excludeReviewed: boolean) => void;

  /* -- Vai trò, bảy trạng thái ---------------------------------------------------- */
  /** `true` ở vai Người xem — CẤM TUYỆT ĐỐI không hộp thoại, nên chỉ ẩn nút áp/gộp/sửa dung sai. */
  readonly isViewerRole: boolean;
  /** Câu giải thích thay nút áp ở vai Người xem. `null` ngoài `forbidden`. */
  readonly viewerRoleNotice: string | null;
  /** Câu của trạng thái `empty`. `null` ở trạng thái khác. */
  readonly emptyNotice: string | null;
  /** Lỗi của trạng thái `error`. `null` ở trạng thái khác. */
  readonly errorMessage: string | null;
}

/* -------------------------------------------------------------------------- */
/* KHOÁ SAU KHI XONG                                                           */
/* -------------------------------------------------------------------------- */

/*
 * File này ĐÓNG BĂNG kể từ lúc lớp L1 (T4) xong. Worker lớp sau (T5 — hook,
 * T6 — biểu đồ/canvas, T7 — bảng/tóm tắt) thấy thiếu một trường, sai một
 * kiểu, hay cần thêm một prop thì phải `orca orchestration ask` hỏi điều
 * phối viên trước — không tự thêm, không tự sửa, kể cả người đã viết file
 * này. Cách hợp lệ duy nhất để mở rộng là MỞ RỘNG kiểu ở file riêng, đúng
 * khuôn `UseScaleCalibrationHookOptions extends UseScaleCalibrationOptions`
 * của màn `ScaleCalibration`.
 */
