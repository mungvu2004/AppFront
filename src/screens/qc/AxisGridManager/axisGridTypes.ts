/**
 * Hợp đồng kiểu view-model của màn QC "Quản lý trục & căn tầng" (`AxisGridManager`).
 *
 * Đây là NỀN MÓNG (lớp L1), đúng khuôn `WallLayerReview/types.ts`,
 * `ObjectLayerReview/objectLayerTypes.ts` và `DimensionOcrReview/dimensionOcrTypes.ts`
 * của ba màn QC anh em: chỉ khai KIỂU và HẰNG, không import React, không import
 * `src/store`, `src/api`, `src/lib/http`. Ba worker lớp sau (hook, view canvas,
 * view panel) import DỰA VÀO đúng những gì khai ở đây. Thêm một trường hay đổi
 * hình dạng một kiểu đã khai là quyết định của điều phối viên — hỏi bằng
 * `orca orchestration ask` trước khi tự thêm, kể cả người đã viết file này.
 *
 * ## Bảy trạng thái (A11/R-63) — tên lấy NGUYÊN VĂN từ `SEVEN_STATES`
 *
 * `src/lib/testing/sevenStateScenarios.ts` là nguồn thật. {@link AxisGridScreenState}
 * theo đúng bộ khẳng định đó, không bịa nhánh thứ năm tên `'ready'` hay `'done'`.
 *
 * | Trạng thái  | Nghĩa ở màn Quản lý trục & căn tầng                                  |
 * |-------------|------------------------------------------------------------------------|
 * | `empty`     | chưa có trục nào (dò tự động lẫn thêm tay đều chưa có kết quả)        |
 * | `loading`   | đang dò trục / đang tính căn tầng                                     |
 * | `partial`   | mới có trục dọc, chưa có trục ngang — trạng thái giữa của việc dò trục|
 * | `error`     | lớp dữ liệu trục hỏng                                                 |
 * | `success`   | đủ cả hai chiều trục, mọi tầng trong dung sai (`warningBanner === null`)|
 * | `forbidden` | vai Người xem: canvas chỉ xem, không thêm/xoá/kéo được trục           |
 * | `collapsed` | ẩn panel trái + panel căn tầng, chỉ còn canvas toàn khung             |
 *
 * ## Vì sao `direction` là một union cục bộ, không phải `AxisDirection` của domain
 *
 * `src/domain/spatial/types.ts` đã có `AxisDirection = 'horizontal' | 'vertical'`,
 * cùng hình dạng hệt bên dưới. Đặc tả gốc của task này liệt kê tường minh
 * `'horizontal' | 'vertical'` cho từng trường hướng trục thay vì trỏ tới domain,
 * và ranh giới nhập của L1 (mục 0.4 CLAUDE.md) chỉ mở bốn nhóm kiểu hình học cụ
 * thể (`detect.ts`, `label.ts`, `alignFloors.ts`, `units/types.ts`) — không có
 * `spatial/types.ts`. {@link AxisGridDirection} vì vậy khai lại union đó tại chỗ,
 * cùng giá trị, không tăng thêm ranh giới nhập.
 *
 * ## A15 — mọi độ lệch hiện bằng chữ, đủ pixel và milimét
 *
 * CẤM TUYỆT ĐỐI của đặc tả gốc: "Mọi độ lệch hiện bằng chữ đều, đủ cả pixel và
 * milimét." Đây là lý do {@link OriginPanelViewModel} có bốn trường chữ
 * (`offsetXPxText`, `offsetYPxText`, `offsetXMmText`, `offsetYMmText`) thay vì
 * hai, và vì sao {@link AxisRowViewModel.spacingMm} luôn đi kèm
 * {@link AxisRowViewModel.spacingText} — số thô chỉ để so sánh (ví dụ với
 * `AXIS_ALIGNMENT_THRESHOLD_MM`), chữ đã định dạng mới là thứ view vẽ ra
 * (A15: định dạng số ở viewmodel, không ở view).
 *
 * ## CẤM TUYỆT ĐỐI "không cho hai trục cách nhau dưới 100 mm"
 *
 * {@link AxisSpacingViolation} là kiểu câu chặn khi người dùng thêm/kéo một trục
 * lại gần trục khác hơn `AXIS_ALIGNMENT_THRESHOLD_MM` (100 mm,
 * `src/domain/axes/detect.ts`). Bốn trường của nó đủ để hook lớp sau ghép câu
 * "trục A cách trục B Z mm, dưới mức tối thiểu 100 mm" mà không phải tra lại
 * đâu là hai trục liên quan.
 */

import type { Millimetres, Pixels } from '@/domain/units/types';

/* -------------------------------------------------------------------------- */
/* Hướng trục — union cục bộ, xem ghi chú đầu file.                            */
/* -------------------------------------------------------------------------- */

export type AxisGridDirection = 'horizontal' | 'vertical';

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái (A11/R-63) — tên lấy nguyên văn từ SEVEN_STATES.             */
/* -------------------------------------------------------------------------- */

export type AxisGridScreenState =
  | 'empty'
  | 'loading'
  | 'partial'
  | 'error'
  | 'success'
  | 'forbidden'
  | 'collapsed';

/* -------------------------------------------------------------------------- */
/* Câu chặn khoảng cách tối thiểu 100 mm (CẤM TUYỆT ĐỐI).                      */
/* -------------------------------------------------------------------------- */

/**
 * Đủ dữ liệu để nêu ĐÍCH DANH hai trục vi phạm khoảng cách tối thiểu.
 *
 * `minimumMm` luôn là `AXIS_ALIGNMENT_THRESHOLD_MM` của
 * `src/domain/axes/detect.ts` (100 mm) — cấp qua trường thay vì view/hook tự
 * viết tay con số đó lần thứ hai (R-71).
 */
export interface AxisSpacingViolation {
  readonly firstLabel: string;
  readonly secondLabel: string;
  readonly actualMm: Millimetres;
  readonly minimumMm: Millimetres;
}

/* -------------------------------------------------------------------------- */
/* Panel trái: một hàng trục, gộp theo nhóm hướng.                             */
/* -------------------------------------------------------------------------- */

/**
 * Một hàng trục trong panel trái.
 *
 * `label` là mã trục ("A", "1"…) — CHỖ ĐƯỢC viết hoa theo ngoại lệ của A6.
 * `spacingMm`/`spacingText` là khoảng cách tới trục KẾ TIẾP cùng nhóm hướng
 * (theo thứ tự toạ độ tăng dần); `null` cho trục cuối nhóm, vì không có trục
 * kế để so khoảng cách.
 */
export interface AxisRowViewModel {
  readonly id: string;
  readonly label: string;
  readonly direction: AxisGridDirection;
  /** Ví dụ `"5.000 mm"`. `null` ở trục cuối nhóm. */
  readonly spacingText: string | null;
  /** Số thô để so với `AXIS_ALIGNMENT_THRESHOLD_MM`. `null` cùng lúc với `spacingText`. */
  readonly spacingMm: Millimetres | null;
  readonly isVisible: boolean;
  readonly isSelected: boolean;
}

/** Một nhóm trục theo hướng — "Trục ngang" hoặc "Trục dọc". */
export interface AxisGroupViewModel {
  readonly direction: AxisGridDirection;
  readonly title: string;
  readonly rows: readonly AxisRowViewModel[];
  readonly addButtonLabel: string;
}

/* -------------------------------------------------------------------------- */
/* Mục "Gốc toạ độ".                                                           */
/* -------------------------------------------------------------------------- */

/** Một giao trục chọn được làm mốc gốc toạ độ — ví dụ value/label đều `"A-1"`. */
export interface AxisOriginAnchorOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Mục "Gốc toạ độ" của panel trái.
 *
 * `selectedAnchor` là `null` khi chưa có đủ trục cả hai hướng để tạo giao điểm
 * (ví dụ ở trạng thái `partial`, khi chỉ có trục dọc) — lúc đó `anchorOptions`
 * cũng rỗng và bốn trường chữ dưới đây đều là dấu gạch ngang chờ
 * (`MISSING_VALUE` của `src/lib/format/number.ts`), không phải chuỗi rỗng.
 */
export interface OriginPanelViewModel {
  readonly anchorOptions: readonly AxisOriginAnchorOption[];
  readonly selectedAnchor: string | null;
  readonly offsetXPxText: string;
  readonly offsetYPxText: string;
  readonly offsetXMmText: string;
  readonly offsetYMmText: string;
  /**
   * Bốn giá trị thô đi kèm bốn chuỗi trên, CHỈ để `useCountUp` chạy số khi đổi
   * giao trục neo (đặc tả mục Tương tác). View KHÔNG định dạng chúng và KHÔNG
   * đọc ngược chuỗi `*Text` — đó mới là thứ A15 cấm. Cùng khuôn với
   * {@link AxisRowViewModel.spacingMm} và {@link FloorAlignRowViewModel.offsetMm},
   * vốn đã mang số thô cạnh chuỗi ngay từ bản đầu; bốn trường này là chỗ sót.
   * Lúc nghỉ, `*Text` vẫn là nguồn sự thật hiển thị.
   */
  readonly offsetXPx: Pixels;
  readonly offsetYPx: Pixels;
  readonly offsetXMm: Millimetres;
  readonly offsetYMm: Millimetres;
}

/* -------------------------------------------------------------------------- */
/* Mục "Căn chỉnh giữa các tầng".                                              */
/* -------------------------------------------------------------------------- */

/**
 * Ba trạng thái căn tầng, đúng BA màu trạng thái mà A4 cho phép — không có
 * nhánh thứ tư. `'unalignable'` khi tầng khớp được ít hơn hai trục với tầng
 * chuẩn (`MIN_MATCHED_AXES` của `src/domain/axes/alignFloors.ts`); `'warning'`
 * khi khớp đủ nhưng độ lệch còn lại vượt `ALIGNMENT_WARNING_THRESHOLD_MM`
 * (150 mm); `'ok'` còn lại, kể cả tầng chuẩn (`isBase: true` luôn `'ok'`).
 */
export type FloorAlignStatus = 'ok' | 'warning' | 'unalignable';

/** Một tầng trong danh sách "Căn chỉnh giữa các tầng". */
export interface FloorAlignRowViewModel {
  readonly levelId: string;
  readonly name: string;
  /** Ví dụ `"200 mm"`. Độ lệch còn lại SAU căn tự động, không phải trước. */
  readonly offsetText: string;
  readonly offsetMm: Millimetres;
  readonly status: FloorAlignStatus;
  readonly isBase: boolean;
  readonly isHovered: boolean;
}

/* -------------------------------------------------------------------------- */
/* Canvas — mọi thứ đã ở toạ độ pixel, canvas không tự tính hình học.          */
/* -------------------------------------------------------------------------- */

/** Một điểm trên ảnh bản vẽ, tính bằng pixel của `<svg viewBox>`. */
export interface AxisGridPixelPoint {
  readonly x: Pixels;
  readonly y: Pixels;
}

/** Một hình chữ nhật trên ảnh bản vẽ, tính bằng pixel. */
export interface AxisGridPixelRect {
  readonly x: Pixels;
  readonly y: Pixels;
  readonly width: Pixels;
  readonly height: Pixels;
}

/** Một trục vẽ trên canvas — đoạn thẳng hai đầu, đã ở pixel. */
export interface AxisCanvasAxisViewModel {
  readonly id: string;
  readonly label: string;
  readonly direction: AxisGridDirection;
  readonly startPx: AxisGridPixelPoint;
  readonly endPx: AxisGridPixelPoint;
  readonly isVisible: boolean;
  readonly isHighlighted: boolean;
}

/** Điểm gốc toạ độ vẽ trên canvas. `label` luôn là chuỗi cố định `"0,0"`. */
export interface AxisCanvasOriginViewModel {
  readonly pointPx: AxisGridPixelPoint;
  readonly label: string;
}

/**
 * Đường bao mờ của tầng dưới, chồng lên canvas để đối chiếu bằng mắt lúc căn
 * tầng. `isVisible` là cờ bật/tắt độc lập với việc dữ liệu có tồn tại hay
 * không — ẩn đi vẫn giữ nguyên `outlinePx` để bật lại không phải tính lại.
 */
export interface AxisCanvasGhostFloorViewModel {
  readonly levelId: string;
  readonly outlinePx: readonly AxisGridPixelPoint[];
  readonly isVisible: boolean;
}

/** Mọi thứ view canvas nhận. */
export interface AxisCanvasViewModel {
  readonly axes: readonly AxisCanvasAxisViewModel[];
  readonly origin: AxisCanvasOriginViewModel;
  /** `null` khi không có tầng nào bên dưới để làm bóng mờ đối chiếu. */
  readonly ghostFloor: AxisCanvasGhostFloorViewModel | null;
  readonly boundsPx: AxisGridPixelRect;
}

/* -------------------------------------------------------------------------- */
/* Dải cảnh báo căn tầng dính đầu màn.                                         */
/* -------------------------------------------------------------------------- */

/**
 * Dải cảnh báo khi có tầng lệch quá ngưỡng.
 *
 * `actionLabel` là nút "Xem trên bản vẽ" và đi cùng {@link
 * AxisGridManagerProps.onViewFloorOnDrawing} — KHÔNG phải `onAutoAlign`. Đặc tả
 * nói rõ dải này chỉ đưa người dùng tới chỗ lệch, việc căn là nút riêng ở mục
 * "Căn chỉnh giữa các tầng".
 *
 * `levelId` là tầng lệch nặng nhất — dải ở mức toàn màn nên nếu không mang sẵn
 * tầng thì nút không có gì để trỏ tới.
 */
export interface AxisGridWarningBanner {
  readonly message: string;
  readonly actionLabel: string;
  readonly levelId: string;
}

/* -------------------------------------------------------------------------- */
/* Toàn màn.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Mọi thứ view `<AxisGridManager />` nhận, trừ các hàm xử lý (xem
 * {@link AxisGridManagerProps}).
 *
 * Bất biến, cùng khuôn `WallLayerViewProps`/`ObjectLayerReviewModel`:
 * 1. `state === 'empty'` ⟺ `groups` không nhóm nào có `rows` ⟺ `emptyNotice !== null`.
 * 2. `state === 'partial'` ⟺ nhóm `'horizontal'` có `rows` rỗng trong khi nhóm
 *    `'vertical'` có ít nhất một hàng (mới dò được trục dọc).
 * 3. `state === 'success'` ⟺ `warningBanner === null` và mọi phần tử của
 *    `floors` có `status === 'ok'`.
 * 4. `state === 'error'` ⟺ `errorMessage !== null`.
 * 5. `state === 'forbidden'` ⟺ `isViewerRole === true` ⟺ `viewerRoleNotice !== null`.
 * 6. `state === 'collapsed'` ⟺ `isCollapsed === true`.
 * 7. `state === 'loading'` ⟺ `groups` không nhóm nào có `rows`, `floors` rỗng,
 *    ba cờ `emptyNotice`/`errorMessage`/`viewerRoleNotice` đều `null` — đây là
 *    cách `loading` tách khỏi `empty` dù cả hai đều "không có hàng nào".
 */
export interface AxisGridViewModel {
  readonly state: AxisGridScreenState;
  readonly groups: readonly AxisGroupViewModel[];
  readonly origin: OriginPanelViewModel;
  readonly floors: readonly FloorAlignRowViewModel[];
  readonly canvas: AxisCanvasViewModel;
  readonly ghostEnabled: boolean;
  readonly warningBanner: AxisGridWarningBanner | null;
  /** Dưới 1.024px panel trái thành tấm trượt đáy — cùng mốc `ScaleCalibrationPanelProps.isCompact`. */
  readonly isCompact: boolean;
  readonly isCollapsed: boolean;
  /** `true` ở vai Người xem — CẤM TUYỆT ĐỐI không hộp thoại, nên đây chỉ ẩn nút. */
  readonly isViewerRole: boolean;
  readonly viewerRoleNotice: string | null;
  readonly emptyNotice: string | null;
  readonly errorMessage: string | null;
}

/* -------------------------------------------------------------------------- */
/* Props của view thuần `<AxisGridManager />`.                                 */
/* -------------------------------------------------------------------------- */

/**
 * Mọi thứ view thuần `<AxisGridManager />` nhận. View KHÔNG tự gọi store —
 * mọi thay đổi đi ra qua một trong các `on...` dưới đây (A10), và không hàm
 * nào trong số này tự dựng bên trong view (R-60).
 */
export interface AxisGridManagerProps {
  readonly viewModel: AxisGridViewModel;

  /* -- Trục ---------------------------------------------------------------- */
  readonly onAxisToggleVisibility: (axisId: string) => void;
  readonly onAxisSelect: (axisId: string | null) => void;
  readonly onAxisAdd: (direction: AxisGridDirection) => void;
  /** Kéo trục trên canvas tới toạ độ pixel mới; hook quy đổi mm và soát 100 mm. */
  readonly onAxisDrag: (axisId: string, coordinatePx: Pixels) => void;
  /** Xoá dùng vé hoàn tác (A8); toast Hoàn tác do hook dựng. */
  readonly onAxisRemove: (axisId: string) => void;
  /** Chọn một trục rồi bay khung nhìn canvas tới nó (R-07). */
  readonly onViewOnDrawing: (axisId: string) => void;

  /* -- Gốc toạ độ ------------------------------------------------------------ */
  readonly onAnchorChange: (anchorValue: string) => void;

  /* -- Tầng ngầm (ghost) và căn tầng ------------------------------------------ */
  readonly onGhostToggle: () => void;
  /**
   * Căn tự động TOÀN BỘ các tầng, trong ĐÚNG MỘT lệnh.
   *
   * Bản đầu nhận `levelId` (căn từng tầng một). Điều phối viên đã sửa: đặc tả
   * chỉ có MỘT nút "Căn chỉnh tự động" ở mục "Căn chỉnh giữa các tầng", và phần
   * chuyển động nói "từng tầng trượt vào vị trí, so le 60ms" — tức một thao tác
   * phủ mọi tầng. Quan trọng hơn, CẤM TUYỆT ĐỐI bắt "căn tự động phải hoàn tác
   * được trong MỘT thao tác": căn từng tầng một sẽ đẩy N bước vào ngăn xếp lịch
   * sử và cần N lần Ctrl+Z, hỏng đúng điều kiện nghiệm thu.
   */
  readonly onAutoAlign: () => void;
  readonly onFloorRowHover: (levelId: string | null) => void;
  /** Nút "Xem trên bản vẽ" của dải cảnh báo: bay khung nhìn tới tầng lệch. */
  readonly onViewFloorOnDrawing: (levelId: string) => void;

  /* -- Hoàn tác, thử lại, vỏ màn ----------------------------------------------- */
  readonly onUndo: () => void;
  readonly onRetry: () => void;
  readonly onToggleCollapsed: () => void;
}

/* -------------------------------------------------------------------------- */
/* KHOÁ SAU KHI XONG                                                           */
/* -------------------------------------------------------------------------- */

/*
 * File này ĐÓNG BĂNG kể từ lúc lớp L1 xong. Worker lớp sau (hook, view canvas,
 * view panel) thấy thiếu một trường, sai một kiểu, hay cần thêm một prop thì
 * phải `orca orchestration ask` hỏi điều phối viên trước — không tự thêm,
 * không tự sửa, kể cả người đã viết file này.
 */
