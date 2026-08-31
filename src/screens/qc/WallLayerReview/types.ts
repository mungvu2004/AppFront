/**
 * Hợp đồng props của màn QC "Duyệt lớp tường" (`WallLayerReview`) — route
 * `ROUTE_PATTERNS.projectWalls` (`/projects/:id/floors/:floorId/layers/walls`),
 * đã khai sẵn trong `src/routes/paths.ts` và có một dòng route trong
 * `src/routes/router.tsx` trỏ tới `<Placeholder name="Canvas" />`. Xem
 * `routes.fragment.md` cạnh file này — T8 chỉ cần thay placeholder đó, không
 * cần thêm hằng đường dẫn mới.
 *
 * Đây là NỀN MÓNG (lớp L1): file này là API công khai DUY NHẤT giữa người viết
 * hook (`useWallLayerReview.ts`), người viết view canvas
 * (`WallLayerReviewCanvas.tsx`) và người viết view panel
 * (`WallLayerReviewPanel.tsx` + `WallLayerReview.tsx`). Ba worker lớp sau viết
 * DỰA VÀO đúng những gì khai ở đây — xem "KHOÁ SAU KHI XONG" ở cuối file.
 *
 * Quy tắc cho cả file: chỉ khai KIỂU và HẰNG. Không import React. Không import
 * `src/store`, `src/api`, `src/lib/http`. Mọi import khác đều là `import type`
 * (xoá lúc biên dịch), theo đúng khuôn `PipelineFailure/types.ts` — file đó
 * cũng `import type` từ `src/components/feedback` mà không phá luật "view
 * thuần" nào, vì kiểu bị xoá hoàn toàn khỏi JS đầu ra.
 *
 * ## Bảy trạng thái (A11/R-63) — tên lấy NGUYÊN VĂN từ `SEVEN_STATES`
 *
 * Đặc tả gốc gợi ý nhánh thứ năm tên là `done`. `src/lib/testing/sevenStateScenarios.ts`
 * (`SEVEN_STATES`) và hai màn L1 đã xong (`ScaleCalibration/types.ts`,
 * `PipelineFailure/types.ts`) đều dùng `'success'`. Theo đúng chỉ dẫn của
 * điều phối viên — "bộ khẳng định đòi tên khác thì theo nó" — {@link WallLayerScreenState}
 * dùng `'success'`, KHÔNG dùng `'done'`. Xem bảng ý nghĩa từng nhánh tại
 * {@link WallLayerScreenState}.
 *
 * `WallLayerScreenState` giữ hình dạng CHUỖI PHẲNG (giống hai màn trên), không
 * phải một union có tải trọng theo nhánh. Lý do: hai màn L1 đã xong trong repo
 * đều chọn hình dạng này và nó đã chứng minh chạy được qua `expectSevenStates`;
 * "mỗi nhánh mang đúng dữ liệu nó cần" (yêu cầu gốc của điều phối viên) được
 * thoả bằng các trường CÓ THỂ NULL trên {@link WallLayerViewProps}, đi kèm một
 * bảng bất biến ánh xạ trạng thái ⟺ trường nào khác `null` — đúng khuôn
 * `ScaleCalibrationViewModel` đang dùng. Nhân đôi khái niệm "trạng thái" thành
 * hai kiểu (một chuỗi phẳng cho A11, một union có tải trọng cho nội dung) chỉ
 * hợp lý khi MỘT VÙNG trên màn đổi hẳn nội dung tại chỗ (đúng tình huống của
 * `PipelineFailureBand`, nơi một dải cảnh báo được thay bằng stepper rồi bằng
 * toast). Màn này là canvas + panel hai cột cố định, không có vùng nào đổi
 * hình dạng kiểu đó, nên không cần `WallLayerScreenBand`.
 *
 * ## Vì sao có thêm `Millimetres` KHÔNG gắn nhãn (không branded)
 *
 * `src/domain/spatial/types.ts` tự khai `Millimetres = number` (dòng 16), KHÁC
 * với `Millimetres = Quantity<'mm'>` gắn nhãn của `src/domain/units/types.ts`.
 * `Wall.thicknessMm`, `Point.x/y` của đồ thị đều là `number` trần. Hợp đồng
 * dưới đây theo đúng quy ước của dữ liệu nó bọc: `thicknessMm` trong
 * {@link WallRowViewModel} và {@link WallInspectorViewModel} là `number` trần,
 * không phải `Millimetres` gắn nhãn — gắn nhãn ở đây chỉ thêm một lượt ép kiểu
 * không đổi được gì, vì nguồn dữ liệu vốn đã trần. Field {@link WallLayerCanvasProps.millimetresPerPixel}
 * thì NGƯỢC LẠI — nó đọc thẳng từ `Level.scaleMillimetresPerPixel`, một trường
 * dùng `MillimetresPerPixel` gắn nhãn của `src/domain/units/types.ts` (xem
 * `src/domain/spatial/types.ts:13,116`), nên giữ nguyên nhãn đó.
 *
 * ## "vật liệu" trong đặc tả gốc = nhãn `WallKind`
 *
 * Đồ thị (`src/domain/spatial/types.ts`) không có trường vật liệu nào cho
 * tường — chỉ có `kind: 'loadBearing' | 'partition' | 'envelope'`. Repo đã có
 * bảng nhãn tiếng Việt cho nó: `WALL_KIND_LABELS` ở
 * `src/lib/commands/business/shared.ts:191` ("tường chịu lực", "vách ngăn",
 * "tường bao"). {@link WallInspectorViewModel.kindLabel} là chỗ luật nhà thắng
 * chữ trong đặc tả (cùng loại quyết định với 240ms → 260ms của `PipelineFailure`):
 * "vật liệu" đổi thành "loại tường", lấy từ bảng đã có, không bịa một khái
 * niệm vật liệu mới.
 *
 * ## Ba lệnh nghiệp vụ đã có sẵn — chữ ký hàm xử lý bám theo Input của chúng
 *
 * `src/lib/commands/business/wallCommands.ts` đã có `ChangeWallThicknessInput
 * { wallId, thicknessMm }`, `SplitWallInput { wallId, at, secondWallId }` và
 * `MergeWallsInput { wallId, otherWallId }`. {@link WallLayerViewProps.onChangeThickness}
 * và {@link WallLayerViewProps.onMerge} lấy đúng tên trường của hai input đó
 * (R-61: hook chỉ nối lại logic đã có). `onSplit` nhận `wallId` và điểm cắt
 * `at: Point` — hook tự mint `secondWallId` bằng `nextId('wall')` của
 * `src/lib/tools/toolMachine.ts:297` giống các tool khác, KHÔNG phải việc của
 * view (R-60: view không tính, không mint id).
 *
 * ## CẢNH BÁO CHO WORKER LỚP SAU — hai chỗ thiếu logic, phải hỏi trước khi cắm
 *
 * 1. **Không có lệnh nghiệp vụ nào để duyệt/bỏ qua một tường.**
 *    `WALL_COMMAND_TYPES` (`wallCommands.ts:98-106`) chỉ có bảy lệnh: `draw`,
 *    `dragEnd`, `changeThickness`, `changeKind`, `split`, `merge`, `remove`.
 *    Không có `wall.approve` hay `wall.review` nào cả, và không có lệnh nào
 *    tương tự ở `src/lib/commands/business/shared.ts`. Người viết
 *    `useWallLayerReview.ts` gặp `onApprove`/`onSkip` sẽ KHÔNG tìm thấy lệnh để
 *    gọi — đây là R-69: DỪNG và `orca orchestration ask` điều phối viên, đề
 *    xuất một lệnh nghiệp vụ mới (nhóm `wall.review` hay tương tự), KHÔNG tự
 *    chế một đường ghi tắt `reviewed: true` ngoài tầng lệnh.
 * 2. **`onMerge` có lệnh (`wall.merge`) nhưng KHÔNG có tool.** `ToolId` của
 *    `src/lib/tools/toolMachine.ts:84-92` chỉ có tám mục: `select`, `pan`,
 *    `drawWall`, `placeOpening`, `placeFurniture`, `measure`, `splitWall`,
 *    `annotate` — không có mục nào cho "nối đoạn". `src/lib/tools/tools.ts`
 *    cũng đặt nhãn `splitWall` là "cắt", khác chữ "tách đoạn" mà đặc tả màn
 *    này dùng; `i18n.fragment.json` giữ nguyên chữ đặc tả, T8/hook tự cân nhắc
 *    có gộp hai chữ hay không. Người viết hook cần hỏi trước khi quyết cách
 *    người dùng chọn được hai tường để gộp (giữ tool riêng, hay chọn nhiều rồi
 *    bấm nút) — không tự chế một `ToolId` thứ chín ở tầng màn.
 *
 * ## Phần thêm ngoài 8 mục "khai tối thiểu" của đặc tả
 *
 * `WallThicknessChoice`, `WallLayerFilterKey`, `WallInspectorAdvanced`,
 * `WallShapeViewModel` là kiểu phụ trợ nhỏ, tách ra vì {@link WallLayerViewProps}
 * và {@link WallLayerCanvasProps} cần tới chúng. `WallLayerReviewProps` là kiểu
 * TOP-LEVEL duy nhất KHÔNG có trong danh sách 8 mục — thêm vào vì R-59 cần
 * `WallLayerReview.tsx` có một kiểu props DUY NHẤT để nhận, và không có nó thì
 * ba worker lớp sau phải tự bịa mỗi người một cách ghép panel + canvas. Đây là
 * bổ sung thuần cộng thêm (additive): không đổi hình dạng của một trong 8 mục
 * đã khai, chỉ gói chúng lại. Nếu điều phối viên muốn bỏ nó, ba worker lớp sau
 * vẫn dùng được `WallLayerViewProps` + `WallLayerCanvasProps` độc lập.
 */

import type { Confidence, Point, WallId } from '@/domain/spatial/types';
import type { MillimetresPerPixel } from '@/domain/units/types';
import type { ViewStatusCode } from '@/lib/viewmodel/types';

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái (A11/R-63).                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Đúng bảy trạng thái của A11, tên lấy nguyên từ `SEVEN_STATES`.
 *
 * Ý nghĩa từng nhánh trên màn Duyệt lớp tường — bốn nhánh đầu tách bạch bằng
 * SỐ TƯỜNG DÒ RA và SỐ TƯỜNG ĐÃ DUYỆT, không phải bằng việc dữ liệu đã tới hay
 * chưa (đó là việc của `loading`/`error` riêng):
 *
 * | Trạng thái  | Nghĩa ở màn Duyệt lớp tường                                        |
 * |-------------|---------------------------------------------------------------------|
 * | `empty`     | AI không dò ra tường nào ở tầng này (`reviewCounter.total === 0`)   |
 * | `loading`   | đang tải lớp tường; canvas có thể đã hiện ảnh nền, panel thì chưa   |
 * | `partial`   | đã có tường, nhưng `0 < reviewed < total` — trạng thái CHÍNH của màn |
 * | `error`     | lớp dữ liệu tường hỏng; ẢNH NỀN vẫn xem được (không phải màn trắng) |
 * | `success`   | `reviewed === total` — mọi tường đã duyệt, nút "Sang lớp Cửa..." mở |
 * | `forbidden` | vai Người xem: canvas chỉ xem, panel ẩn nút duyệt/xoá/tách/gộp      |
 * | `collapsed` | ẩn cả hai panel (danh sách + thanh tra), chỉ còn canvas toàn khung  |
 */
export type WallLayerScreenState =
  | 'empty'
  | 'loading'
  | 'partial'
  | 'error'
  | 'success'
  | 'forbidden'
  | 'collapsed';

/* -------------------------------------------------------------------------- */
/* Độ dày — điều khiển BA lựa chọn, không bao giờ là ô nhập tự do.             */
/* -------------------------------------------------------------------------- */

/**
 * Ba độ dày mà điều khiển ba lựa chọn cho phép.
 *
 * Đặc tả gốc ghi 110/220/330 mm, nhưng `STANDARD_THICKNESSES_MM` trong
 * `src/domain/walls/cleanup.ts:70-72` là `[100, 150, 200, 220, 300, 400]` — nên
 * 110 và 330 sẽ luôn bị bộ lọc "chỉ hiện độ dày không chuẩn" đánh dấu, làm bộ
 * lọc đó vô nghĩa. Điều phối viên đã duyệt đổi sang ba giá trị CHUẨN có thật.
 *
 * Đặt ở ĐÚNG MỘT CHỖ để đổi lại về 110/220/330 chỉ tốn một dòng.
 */
export const WALL_THICKNESS_CHOICES = [100, 220, 300] as const;

/** Một trong ba giá trị của {@link WALL_THICKNESS_CHOICES}. */
export type WallThicknessChoice = (typeof WALL_THICKNESS_CHOICES)[number];

/* -------------------------------------------------------------------------- */
/* Bộ đếm duyệt — "12/48 tường đã duyệt".                                      */
/* -------------------------------------------------------------------------- */

/**
 * Số thô cho thanh tiến độ 4px và cho test khẳng định bằng hằng.
 *
 * View được PHÉP tính `reviewed / total` làm phân số tiến độ ngay tại chỗ —
 * `eslint-rules/no-raw-number.js:21` gọi đích danh "a progress fraction" là
 * thứ luật này CHỦ Ý bỏ qua. Câu chữ "12/48 tường đã duyệt" thì KHÔNG được ghép
 * ở view; xem {@link WallLayerViewProps.reviewProgressLabel}.
 */
export interface WallReviewCounter {
  readonly reviewed: number;
  readonly total: number;
}

/* -------------------------------------------------------------------------- */
/* Ba cờ lọc.                                                                  */
/* -------------------------------------------------------------------------- */

/** Ba cờ lọc của panel danh sách. */
export interface WallLayerFilters {
  readonly onlyUnreviewed: boolean;
  readonly onlyLowConfidence: boolean;
  readonly onlyNonStandardThickness: boolean;
}

/** Tên một cờ lọc, dùng làm tham số của {@link WallLayerViewProps.onToggleFilter}. */
export type WallLayerFilterKey = keyof WallLayerFilters;

/* -------------------------------------------------------------------------- */
/* Một dòng danh sách ảo hoá (cao 40).                                         */
/* -------------------------------------------------------------------------- */

/**
 * Một dòng của danh sách 48 tường.
 *
 * Không mang token màu hay tên class (A15 + A1): {@link WallRowViewModel.statusCode}
 * là mã trung lập, view tự quyết token nào vẽ nó. `isReviewed` không phải mã
 * màu — nó là dữ liệu (dùng để khoá nút "Duyệt đoạn này" khi đã duyệt rồi),
 * tách khỏi `statusCode` vì hai việc khác nhau: một cái quyết định MÀU, một
 * cái quyết định NÚT nào bấm được.
 */
export interface WallRowViewModel {
  readonly id: WallId;
  /** Mã hiển thị chữ đều — ví dụ `"#W-014"`. */
  readonly codeLabel: string;
  /** Độ dày thô, mm — có thể KHÔNG nằm trong {@link WALL_THICKNESS_CHOICES}. */
  readonly thicknessMm: number;
  /** Độ dày đã định dạng — ví dụ `"220 mm"`. */
  readonly thicknessLabel: string;
  /** Độ tin cậy thô `0..1`, cấp thẳng cho `ConfidenceMeter` (đúng khuôn `DimensionStringRow`). */
  readonly confidence: Confidence;
  /**
   * `'verified'` CHỈ khi `isReviewed` — A5: xanh đã xác minh chỉ đánh dấu việc
   * người duyệt. `'attention'` khi `isLowConfidence` hoặc `isNonStandardThickness`
   * mà chưa duyệt. `'neutral'` còn lại. Không bao giờ `'violation'` ở màn này.
   */
  readonly statusCode: ViewStatusCode;
  readonly isReviewed: boolean;
  /** Cờ "dưới ngưỡng cần chú ý" — ngưỡng sống ở hook, không viết tay ở view (R-71). */
  readonly isLowConfidence: boolean;
  /** Cờ "độ dày không chuẩn" — `thicknessMm` không khớp phần tử nào của {@link WALL_THICKNESS_CHOICES}. */
  readonly isNonStandardThickness: boolean;
}

/* -------------------------------------------------------------------------- */
/* Thanh tra đối tượng đang chọn.                                              */
/* -------------------------------------------------------------------------- */

/** Khối nâng cao của thanh tra — ba dòng, đều đã định dạng thành chuỗi. */
export interface WallInspectorAdvanced {
  /** "lệch Z" — ví dụ `"+150 mm"`. */
  readonly elevationOffsetLabel: string;
  /** "toạ độ đầu" — ví dụ `"(0, 0)"`. */
  readonly startPointLabel: string;
  /** "toạ độ cuối" — ví dụ `"(2.500, 0)"`. */
  readonly endPointLabel: string;
}

/**
 * Thanh tra tường đang chọn. `null` ở {@link WallLayerViewProps.inspector} khi
 * chưa chọn tường nào — view vẽ trạng thái rỗng của panel thanh tra, không
 * phải một `WallInspectorViewModel` giả với chuỗi rỗng.
 */
export interface WallInspectorViewModel {
  readonly id: WallId;
  /** Ví dụ `"#W-014"`. */
  readonly codeLabel: string;
  /** Độ dày ĐANG CHỌN của điều khiển ba lựa chọn — có thể không chuẩn (xem {@link WallRowViewModel.thicknessMm}). */
  readonly thicknessMm: number;
  /** Chiều dài đã định dạng — ví dụ `"4.250,00 mm"` (`formatLength(..., { unit: 'mm', fractionDigits: 2 })`). */
  readonly lengthLabel: string;
  /** Chiều cao đã định dạng — ví dụ `"3,00 m"`. */
  readonly heightLabel: string;
  readonly confidence: Confidence;
  /** "vật liệu" của đặc tả gốc — xem ghi chú đầu file. Lấy từ `WALL_KIND_LABELS`. */
  readonly kindLabel: string;
  readonly advanced: WallInspectorAdvanced;
}

/* -------------------------------------------------------------------------- */
/* Canvas giữa.                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Một hình tường đã có sẵn đa giác — canvas KHÔNG tự tính hình học (mục CẤM
 * TUYỆT ĐỐI "không tính hình học trong màn").
 *
 * `outline` dùng lại `Point` trần của `src/domain/spatial/types` chứ không
 * dựng một kiểu điểm thứ hai: hook tính đa giác qua
 * `src/domain/walls/joints.ts#resolveWallShapes` (đầu ra `WallShape.outline`
 * cũng là mảng điểm phẳng) rồi trả nguyên hình dạng đó, không ánh xạ lại.
 */
export interface WallShapeViewModel {
  readonly id: WallId;
  /** Đa giác đóng, ngược kim đồng hồ, ít nhất bốn đỉnh — xem `resolveWallShapes`. */
  readonly outline: readonly Point[];
  /** Cùng ý nghĩa với {@link WallRowViewModel.statusCode} — canvas và panel tô cùng một tường thống nhất một màu. */
  readonly statusCode: ViewStatusCode;
}

/** Mọi thứ view canvas nhận. */
export interface WallLayerCanvasProps {
  readonly shapes: readonly WallShapeViewModel[];
  readonly selectedWallId: WallId | null;
  readonly hoveredWallId: WallId | null;
  /** Cờ hiện tim tường — đường centreline mảnh vẽ chồng lên đa giác. */
  readonly showCentrelines: boolean;
  /** Tỷ lệ mm/px của tầng — nhãn gắn từ `Level.scaleMillimetresPerPixel`, xem ghi chú đầu file. */
  readonly millimetresPerPixel: MillimetresPerPixel;
  /** Nguồn ảnh nền. `null` khi chưa có / đang tải — canvas vẽ khung xám chờ, không phải màn trắng. */
  readonly backgroundImageUrl: string | null;
  /** Mô tả ảnh nền cho trình đọc màn hình (R-72). */
  readonly backgroundImageAlt: string;
  /** `false` ở trạng thái `forbidden`: canvas xem/phóng to được, chọn/kéo thì không. */
  readonly isInteractive: boolean;
  /** Bấm chọn một hình tường trên canvas; cùng hàm với {@link WallLayerViewProps.onSelect} (hook truyền chung một tham chiếu). */
  readonly onSelect: (wallId: WallId | null) => void;
  /** Rê chuột qua một hình tường trên canvas; cùng hàm với {@link WallLayerViewProps.onHover}. */
  readonly onHover: (wallId: WallId | null) => void;
}

/* -------------------------------------------------------------------------- */
/* Panel phải: danh sách + thanh tra + bộ lọc + hành động.                     */
/* -------------------------------------------------------------------------- */

/**
 * Mọi thứ view panel nhận, gồm cả các hàm xử lý. View KHÔNG tự gọi store —
 * mọi thay đổi đi ra qua một trong các `on...` dưới đây (A10).
 *
 * Bất biến đi kèm, cùng khuôn `ScaleCalibrationViewModel`:
 *
 * 1. `state === 'empty'` ⟺ `reviewCounter.total === 0` ⟺ `emptyNotice !== null`.
 * 2. `state === 'partial'` ⟺ `0 < reviewCounter.reviewed < reviewCounter.total`.
 * 3. `state === 'success'` ⟺ `reviewCounter.reviewed === reviewCounter.total`
 *    và `reviewCounter.total > 0`.
 * 4. `state === 'error'` ⟺ `errorMessage !== null` ⟺ `rows` rỗng dù `reviewCounter.total`
 *    có thể khác 0 (lớp dữ liệu hỏng, không phải chưa dò ra tường nào).
 * 5. `state === 'forbidden'` ⟺ `isViewerRole === true` ⟺ `viewerRoleNotice !== null`.
 * 6. `state === 'collapsed'` ⟺ `isCollapsed === true`.
 * 7. `state === 'loading'` ⟺ `rows` rỗng, `reviewCounter.total === 0`, và ba cờ
 *    `emptyNotice`/`errorMessage`/`viewerRoleNotice` đều `null` — đây là cách
 *    `loading` tách khỏi `empty` dù cả hai đều "rows rỗng, total 0".
 */
export interface WallLayerViewProps {
  readonly state: WallLayerScreenState;
  readonly rows: readonly WallRowViewModel[];
  readonly reviewCounter: WallReviewCounter;
  /** "12/48 tường đã duyệt", đã ghép sẵn ở hook (A15). */
  readonly reviewProgressLabel: string;
  readonly filters: WallLayerFilters;
  /** Luôn bằng {@link WALL_THICKNESS_CHOICES} — cấp qua props để view không import hằng số của tầng khác (R-60). */
  readonly thicknessChoices: readonly WallThicknessChoice[];
  readonly selectedWallId: WallId | null;
  readonly hoveredWallId: WallId | null;
  /** `null` khi chưa chọn tường nào. */
  readonly inspector: WallInspectorViewModel | null;
  /** Dưới 1.024px panel phải thành tấm trượt đáy — cùng mốc `ScaleCalibrationPanelProps.isCompact`. */
  readonly isCompact: boolean;
  readonly isCollapsed: boolean;
  /** `true` ở vai Người xem — CẤM TUYỆT ĐỐI không hộp thoại, nên đây chỉ ẩn nút, không khoá mờ. */
  readonly isViewerRole: boolean;
  /** Câu giải thích thay nút duyệt ở vai Người xem. `null` ngoài `forbidden`. */
  readonly viewerRoleNotice: string | null;
  /** Câu của trạng thái `empty` — "Chưa phát hiện được đoạn tường nào...". `null` ở trạng thái khác. */
  readonly emptyNotice: string | null;
  /** Lỗi của trạng thái `error`. `null` ở trạng thái khác. */
  readonly errorMessage: string | null;

  /* -- Hành động trên một dòng ---------------------------------------------- */
  readonly onApprove: (wallId: WallId) => void;
  readonly onSkip: (wallId: WallId) => void;
  /** `thicknessMm` luôn là một phần tử của {@link WALL_THICKNESS_CHOICES} — CẤM TUYỆT ĐỐI "không bao giờ là ô nhập số tự do" ép ngay ở kiểu. */
  readonly onChangeThickness: (wallId: WallId, thicknessMm: WallThicknessChoice) => void;
  /** Xoá dùng vé hoàn tác (A8, CẤM TUYỆT ĐỐI "không hộp thoại"); toast Hoàn tác do hook dựng. */
  readonly onDelete: (wallId: WallId) => void;
  /** `at` là điểm cắt trên tim tường; hook tự mint `secondWallId` — xem ghi chú đầu file. */
  readonly onSplit: (wallId: WallId, at: Point) => void;
  /** Khớp `MergeWallsInput { wallId, otherWallId }` của `wallCommands.ts:705-708`. */
  readonly onMerge: (wallId: WallId, otherWallId: WallId) => void;

  /* -- Chọn / rê chuột (dùng chung với canvas) ------------------------------ */
  readonly onSelect: (wallId: WallId | null) => void;
  readonly onHover: (wallId: WallId | null) => void;

  /* -- Bộ lọc, hoàn tác, vỏ màn ---------------------------------------------- */
  readonly onToggleFilter: (filter: WallLayerFilterKey) => void;
  /** Hoàn tác thao tác gần nhất (A8) — thường đi cùng toast, không tham số. */
  readonly onUndo: () => void;
  readonly onToggleCollapsed: () => void;
}

/* -------------------------------------------------------------------------- */
/* Toàn màn — gói panel + canvas cho `WallLayerReview.tsx` (R-59).             */
/* -------------------------------------------------------------------------- */

/**
 * Mọi prop `WallLayerReview.tsx` nhận — KHÔNG có trong 8 mục "khai tối thiểu"
 * của đặc tả, thêm vào vì lý do đã nói ở đầu file (R-59 cần một điểm vào duy
 * nhất). Thuần cộng thêm: xoá kiểu này không đổi hình dạng của bất kỳ trường
 * nào bên trong `panel`/`canvas`.
 */
export interface WallLayerReviewProps {
  readonly panel: WallLayerViewProps;
  readonly canvas: WallLayerCanvasProps;
}

/* -------------------------------------------------------------------------- */
/* KHOÁ SAU KHI XONG                                                           */
/* -------------------------------------------------------------------------- */

/*
 * File này ĐÓNG BĂNG kể từ lúc lớp L1 xong. Worker lớp sau (hook, view canvas,
 * view panel) thấy thiếu một trường, sai một kiểu, hay cần thêm một prop thì
 * phải `orca orchestration ask` hỏi điều phối viên trước — không tự thêm,
 * không tự sửa, kể cả người đã viết file này. Cách hợp lệ duy nhất để mở rộng
 * là MỞ RỘNG kiểu ở file riêng, đúng khuôn `UseScaleCalibrationHookOptions
 * extends UseScaleCalibrationOptions` của màn `ScaleCalibration`.
 */
