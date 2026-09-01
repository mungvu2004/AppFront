/**
 * Hợp đồng kiểu view-model của màn QC "Đọc kích thước OCR" (`DimensionOcrReview`)
 * — route dự kiến `ROUTE_PATTERNS.projectDimensions`, đường dẫn dạng
 * "projects/:id/floors/:floorId/layers/dimensions" (QĐ-1 của điều phối viên —
 * T8 đăng ký route này, T3 KHÔNG chạm `src/routes/**`).
 *
 * Đây là NỀN MÓNG (lớp L1), đúng khuôn `ObjectLayerReview/objectLayerTypes.ts`
 * và `WallLayerReview/types.ts` của hai màn QC anh em: chỉ khai KIỂU và HẰNG,
 * không import React, không import `src/store`, `src/api`, `src/lib/http`. Ba
 * worker lớp sau (T5 viết hook + gateway, T6/T7 viết canvas/danh sách/dải đối
 * chiếu/chế độ bàn phím) import DỰA VÀO đúng những gì khai ở đây. Thêm một
 * trường hay đổi hình dạng một kiểu đã khai là quyết định của điều phối viên —
 * hỏi bằng `orca orchestration ask` trước khi tự thêm.
 *
 * ## Bảy trạng thái (A11/R-63) — tên lấy NGUYÊN VĂN từ `SEVEN_STATES`
 *
 * Đặc tả gốc của T3 gợi ý nhánh thứ năm tên là `'ready'`. Đã mở
 * `src/lib/testing/sevenStateScenarios.ts` (nguồn thật của R-63) — nhánh đó
 * tên là `'success'`, không có `'ready'` nào cả. {@link DimensionOcrScreenState}
 * theo đúng bộ khẳng định, đúng chỉ dẫn "MỞ FILE KIỂM, đừng đoán tên" của chính
 * đặc tả T3.
 *
 * | Trạng thái  | Nghĩa ở màn Đọc kích thước OCR                                        |
 * |-------------|------------------------------------------------------------------------|
 * | `empty`     | OCR không đọc được chuỗi kích thước nào (`rows` rỗng) — view dẫn sang  |
 * |             | hiệu chỉnh tỷ lệ thủ công, vì nguyên nhân thường gặp nhất là tầng chưa |
 * |             | có `scaleMillimetresPerPixel`                                          |
 * | `loading`   | đang OCR / đang tải lớp kích thước                                     |
 * | `partial`   | có chuỗi dưới ngưỡng tin cậy chưa duyệt, hoặc OCR mới xong một phần —  |
 * |             | trạng thái CHÍNH của màn (18/34)                                       |
 * | `error`     | lớp dữ liệu kích thước hỏng; ẢNH NỀN vẫn xem được (không phải màn trắng)|
 * | `success`   | `reviewCounter.reviewed === reviewCounter.total` — 34/34               |
 * | `forbidden` | vai Người xem: canvas chỉ xem, danh sách ẩn nút sửa/duyệt              |
 * | `collapsed` | ẩn danh sách + dải đối chiếu, chỉ còn canvas toàn khung                |
 */

import type { Confidence, WallId } from '@/domain/spatial/types';
import type { MillimetresPerPixel } from '@/domain/units/types';
import type { ViewStatusCode } from '@/lib/viewmodel/types';

export type DimensionOcrScreenState =
  | 'empty'
  | 'loading'
  | 'partial'
  | 'error'
  | 'success'
  | 'forbidden'
  | 'collapsed';

/* -------------------------------------------------------------------------- */
/* Bộ lọc SegmentedControl.                                                    */
/* -------------------------------------------------------------------------- */

/** Ba lựa chọn của bộ lọc danh sách, đúng thứ tự SegmentedControl hiện. */
export type DimensionFilterId = 'all' | 'lowConfidence' | 'unreviewed';

export const DIMENSION_FILTER_IDS: readonly DimensionFilterId[] = ['all', 'lowConfidence', 'unreviewed'];

/* -------------------------------------------------------------------------- */
/* Bộ đếm duyệt — "18/34 kích thước đã duyệt".                                 */
/* -------------------------------------------------------------------------- */

/** Số thô cho bộ đếm và cho test khẳng định bằng hằng (không phải câu chữ ghép sẵn). */
export interface DimensionReviewCounter {
  readonly reviewed: number;
  readonly total: number;
}

/* -------------------------------------------------------------------------- */
/* Toạ độ pixel dùng chung cho ảnh cắt và canvas.                              */
/* -------------------------------------------------------------------------- */

/** Một điểm trên ảnh bản vẽ, tính bằng pixel của `<svg viewBox>`. */
export interface DimensionPixelPoint {
  readonly x: number;
  readonly y: number;
}

/** Một hình chữ nhật trên ảnh bản vẽ, tính bằng pixel. */
export interface DimensionPixelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/* -------------------------------------------------------------------------- */
/* Ảnh cắt 1:1 của vùng gốc — CẤM TUYỆT ĐỐI: mỗi số đọc được phải có ảnh cắt.  */
/* -------------------------------------------------------------------------- */

/**
 * Bề rộng/cao hiển thị CHUẨN của một ảnh cắt — hai hằng số duy nhất, không viết
 * số thô 160/96 rải rác ở view hay ở hook (R-71).
 */
export const DIMENSION_CROP_DISPLAY_WIDTH_PX = 160;
export const DIMENSION_CROP_DISPLAY_HEIGHT_PX = 96;

/**
 * Mọi thứ view cần để vẽ ảnh cắt 1:1 của vùng gốc cạnh một số đọc được.
 *
 * `sourcePx` là khung cắt TRÊN ẢNH GỐC (toạ độ pixel của ảnh bản vẽ đầy đủ);
 * `displayWidthPx` và `displayHeightPx` là kích thước Ô HIỂN THỊ của ảnh cắt
 * đó trên màn hình — luôn bằng {@link DIMENSION_CROP_DISPLAY_WIDTH_PX} và
 * {@link DIMENSION_CROP_DISPLAY_HEIGHT_PX}, cấp qua trường thay vì view tự
 * import hằng số của tầng khác (R-60, R-71).
 */
export interface DimensionCropViewModel {
  readonly imageUrl: string;
  readonly sourcePx: DimensionPixelRect;
  readonly displayWidthPx: number;
  readonly displayHeightPx: number;
  /** Mô tả tiếng Việt cho trình đọc màn hình (R-72), ví dụ "Ảnh cắt vùng ghi kích thước #M-014". */
  readonly alt: string;
}

/* -------------------------------------------------------------------------- */
/* Một hàng danh sách duyệt.                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Một hàng của danh sách 34 chuỗi kích thước.
 *
 * `valueMm` là số thô CHỈ để cấp cho ô nhập (đơn vị mm cố định hiển thị bên
 * phải ô, không phải ô nhập tự do đổi đơn vị — CẤM TUYỆT ĐỐI); `valueLabel` là
 * chuỗi đã định dạng cho phần đọc (A15: định dạng số ở viewmodel, không ở view).
 * Không mang token màu hay tên class (A15 + A1): {@link DimensionRowViewModel.statusCode}
 * là mã trung lập, view tự quyết token nào vẽ nó.
 */
export interface DimensionRowViewModel {
  /** Mã hiển thị, ví dụ `"M-014"` — không phải `DimensionId` domain đầy đủ. */
  readonly id: string;
  /** Ví dụ `"#M-014"`, mono-lg. */
  readonly codeLabel: string;
  /** Số thô, mm — CHỈ cấp cho ô nhập; đơn vị mm cố định hiển thị bên phải, không phải ô tự do. */
  readonly valueMm: number;
  /** Ví dụ `"6.000 mm"` — chuỗi đã định dạng cho phần đọc. */
  readonly valueLabel: string;
  readonly confidence: Confidence;
  readonly isReviewed: boolean;
  readonly isLowConfidence: boolean;
  /**
   * `'verified'` CHỈ khi `isReviewed` (A5). `'attention'` khi `isLowConfidence`
   * mà chưa duyệt. `'neutral'` còn lại. Không bao giờ `'violation'` ở màn này.
   */
  readonly statusCode: ViewStatusCode;
  /** Caption liên kết suy ra, ví dụ `"Gắn với #W-014"`. `null` khi không suy ra được tường chủ. */
  readonly hostWallLabel: string | null;
  /** Tường chủ để bấm liên kết bay tới (R-07). `null` cùng lúc với `hostWallLabel`. */
  readonly hostWallId: WallId | null;
  /** Ảnh cắt gốc đi kèm — CẤM TUYỆT ĐỐI: mỗi số đọc được phải có, không tuỳ chọn. */
  readonly crop: DimensionCropViewModel;
}

/* -------------------------------------------------------------------------- */
/* Thứ canvas vẽ — một chuỗi kích thước trên bản vẽ.                           */
/* -------------------------------------------------------------------------- */

/**
 * Thứ canvas vẽ cho MỘT chuỗi kích thước — mọi toạ độ đã tính sẵn, canvas
 * KHÔNG tự tính hình học (CẤM TUYỆT ĐỐI, R-60).
 */
export interface DimensionChainViewModel {
  /** Mã hiển thị, ví dụ `"M-014"` — khớp {@link DimensionRowViewModel.id}. */
  readonly id: string;
  /** Hai đầu chuỗi kích thước trên ảnh bản vẽ. */
  readonly startPx: DimensionPixelPoint;
  readonly endPx: DimensionPixelPoint;
  /** Vị trí đặt nhãn giá trị, thường lệch tâm đoạn về phía không đè lên nét vẽ. */
  readonly labelPositionPx: DimensionPixelPoint;
  /** Hộp bao của cả chuỗi (đường + nhãn), dùng để bắt sự kiện bấm chọn. */
  readonly boundsPx: DimensionPixelRect;
  readonly isSelected: boolean;
  readonly isReviewed: boolean;
  /** Nhãn giá trị ĐÃ ĐỊNH DẠNG, ví dụ `"6.000 mm"` (A15). */
  readonly valueLabel: string;
}

/* -------------------------------------------------------------------------- */
/* Dải đối chiếu dính đáy.                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Dải đối chiếu dính đáy của chuỗi kích thước đang chọn.
 *
 * CẢNH BÁO cho worker lớp sau: file này chỉ KHAI KIỂU. Không tính lệch, không
 * so ngưỡng, không quy đổi đơn vị (CẤM TUYỆT ĐỐI). `isSignificant` và ba chuỗi
 * dưới đây do hook lớp sau (T5) điền; view chỉ đọc, không tính lại.
 */
export interface DimensionCompareViewModel {
  /** Giá trị OCR đọc được, đã định dạng — ví dụ `"6.090 mm"`. */
  readonly ocrValueLabel: string;
  /** Giá trị đo từ hình học của bản vẽ, đã định dạng — ví dụ `"6.000 mm"`. */
  readonly measuredValueLabel: string;
  /** Phần trăm lệch, đã định dạng — ví dụ `"1,5%"` (dấu phẩy thập phân, A15). */
  readonly deviationLabel: string;
  /** `true` khi độ lệch đủ đáng kể để tô màu — view chỉ đọc cờ này, không tự so ngưỡng. */
  readonly isSignificant: boolean;
}

/* -------------------------------------------------------------------------- */
/* Hợp đồng props cho từng phần view.                                          */
/* -------------------------------------------------------------------------- */

/** Mọi thứ view canvas nhận. */
export interface DimensionOcrCanvasProps {
  readonly chains: readonly DimensionChainViewModel[];
  readonly selectedDimensionId: string | null;
  /** Tỷ lệ mm/px của tầng. */
  readonly millimetresPerPixel: MillimetresPerPixel;
  readonly backgroundImageUrl: string | null;
  /** Mô tả ảnh nền cho trình đọc màn hình (R-72). */
  readonly backgroundImageAlt: string;
  /** `false` ở trạng thái `forbidden`: xem/phóng to được, chọn thì không. */
  readonly isInteractive: boolean;
  readonly onSelect: (dimensionId: string | null) => void;
}

/** Mọi thứ view danh sách nhận. */
export interface DimensionOcrListProps {
  readonly rows: readonly DimensionRowViewModel[];
  readonly reviewCounter: DimensionReviewCounter;
  /** "18/34 kích thước đã duyệt", đã ghép sẵn ở hook (A15). */
  readonly reviewProgressLabel: string;
  readonly activeFilter: DimensionFilterId;
  readonly onFilterChange: (filter: DimensionFilterId) => void;
  readonly selectedDimensionId: string | null;
  readonly onSelect: (dimensionId: string | null) => void;
  /** `true` ở vai Người xem — CẤM TUYỆT ĐỐI không hộp thoại, nên đây chỉ ẩn nút. */
  readonly isViewerRole: boolean;
}

/** Mọi thứ view một hàng nhận. */
export interface DimensionOcrRowProps {
  readonly row: DimensionRowViewModel;
  readonly isSelected: boolean;
  readonly isViewerRole: boolean;
  readonly onSelect: (dimensionId: string | null) => void;
  /** Ô nhập số thô, đơn vị mm cố định hiển thị bên phải — không phải ô tự do (CẤM TUYỆT ĐỐI). */
  readonly onEdit: (dimensionId: string, valueMm: number) => void;
  readonly onApprove: (dimensionId: string) => void;
  readonly onCancelEdit: () => void;
}

/** Mọi thứ dải đối chiếu dính đáy nhận. */
export interface DimensionOcrCompareBarProps {
  /** `null` khi chưa chọn chuỗi kích thước nào. */
  readonly compare: DimensionCompareViewModel | null;
}

/** Mọi thứ điều khiển chế độ duyệt bàn phím nhận. */
export interface DimensionOcrKeyboardModeProps {
  readonly isActive: boolean;
  readonly onToggle: () => void;
}

/* -------------------------------------------------------------------------- */
/* Kiểu trả về của hook `useDimensionOcrReview` — T5 cài đặt đúng kiểu này.    */
/* -------------------------------------------------------------------------- */

/**
 * Mọi thứ hook `useDimensionOcrReview` trả về. View KHÔNG tự gọi store — mọi
 * thay đổi đi ra qua một trong các `on...` dưới đây (A10).
 *
 * Bất biến, cùng khuôn `WallLayerViewProps` và `ObjectLayerReviewModel`:
 * 1. `state === 'empty'` ⟺ `reviewCounter.total === 0` ⟺ `emptyNotice !== null`.
 * 2. `state === 'partial'` ⟺ `0 < reviewCounter.reviewed < reviewCounter.total`.
 * 3. `state === 'success'` ⟺ `reviewCounter.reviewed === reviewCounter.total`
 *    và `reviewCounter.total > 0`.
 * 4. `state === 'error'` ⟺ `errorMessage !== null` ⟺ `rows` rỗng dù
 *    `reviewCounter.total` có thể khác 0 (lớp dữ liệu hỏng, không phải OCR
 *    chưa đọc được gì).
 * 5. `state === 'forbidden'` ⟺ `isViewerRole === true` ⟺ `viewerRoleNotice !== null`.
 * 6. `state === 'collapsed'` ⟺ `isCollapsed === true`.
 * 7. `state === 'loading'` ⟺ `rows` rỗng, `reviewCounter.total === 0`, ba cờ
 *    `emptyNotice`, `errorMessage`, `viewerRoleNotice` đều `null`.
 */
export interface DimensionOcrModel {
  readonly state: DimensionOcrScreenState;
  readonly rows: readonly DimensionRowViewModel[];
  readonly chains: readonly DimensionChainViewModel[];
  readonly reviewCounter: DimensionReviewCounter;
  /** "18/34 kích thước đã duyệt", đã ghép sẵn ở hook (A15). */
  readonly reviewProgressLabel: string;
  readonly activeFilter: DimensionFilterId;
  readonly selectedDimensionId: string | null;
  /** Dải đối chiếu của chuỗi đang chọn. `null` khi chưa chọn gì. */
  readonly compare: DimensionCompareViewModel | null;
  /** Cờ chế độ duyệt bàn phím (A12) — Enter duyệt, mũi tên chuyển hàng. */
  readonly isKeyboardReviewMode: boolean;
  readonly backgroundImageUrl: string | null;
  readonly backgroundImageAlt: string;
  readonly millimetresPerPixel: MillimetresPerPixel;
  readonly isCompact: boolean;
  readonly isCollapsed: boolean;
  readonly isViewerRole: boolean;
  readonly viewerRoleNotice: string | null;
  readonly emptyNotice: string | null;
  readonly errorMessage: string | null;

  /* -- Hành động trên một chuỗi kích thước ----------------------------------- */
  readonly onEdit: (dimensionId: string, valueMm: number) => void;
  readonly onApprove: (dimensionId: string) => void;
  readonly onCancelEdit: () => void;

  /* -- Chọn (dùng chung với canvas và danh sách) ----------------------------- */
  readonly onSelect: (dimensionId: string | null) => void;

  /* -- Bộ lọc, chế độ bàn phím, hoàn tác, vỏ màn ----------------------------- */
  readonly onFilterChange: (filter: DimensionFilterId) => void;
  readonly onToggleKeyboardMode: () => void;
  readonly onUndo: () => void;
  readonly onToggleCollapsed: () => void;
}

/* -------------------------------------------------------------------------- */
/* KHOÁ SAU KHI XONG                                                           */
/* -------------------------------------------------------------------------- */

/*
 * File này ĐÓNG BĂNG kể từ lúc lớp L1 xong. Worker lớp sau (gateway, hook, view
 * canvas/danh sách/dải đối chiếu/chế độ bàn phím) thấy thiếu một trường, sai
 * một kiểu, hay cần thêm một prop thì phải `orca orchestration ask` hỏi điều
 * phối viên trước — không tự thêm, không tự sửa, kể cả người đã viết file này.
 */
