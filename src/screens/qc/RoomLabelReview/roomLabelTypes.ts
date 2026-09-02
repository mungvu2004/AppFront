/**
 * Hợp đồng kiểu view-model của màn QC "Duyệt tên phòng" (`RoomLabelReview`) —
 * route `ROUTE_PATTERNS.projectRooms` (`/projects/:id/floors/:floorId/layers/rooms`),
 * khai ở `src/routes/paths.ts` (T4 là chủ sở hữu duy nhất của file đó).
 *
 * Đây là NỀN MÓNG (lớp L1), đúng khuôn `WallLayerReview/types.ts` và
 * `ObjectLayerReview/objectLayerTypes.ts` của hai màn QC anh em: chỉ khai KIỂU
 * và HẰNG, không import React, không import `src/api`, `src/store`,
 * `src/lib/http`. Ba worker lớp sau (hook/gateway, canvas, panel) import DỰA
 * VÀO đúng những gì khai ở đây. Thêm một trường hay đổi hình dạng một kiểu đã
 * khai là quyết định của điều phối viên — hỏi bằng `orca orchestration ask`
 * trước khi tự thêm.
 *
 * ## Bảy trạng thái (A11/R-63)
 *
 * | Trạng thái  | Nghĩa ở màn Duyệt tên phòng                                          |
 * |-------------|------------------------------------------------------------------------|
 * | `empty`     | AI không dò ra phòng nào ở tầng này (`rooms.length === 0`)             |
 * | `loading`   | đang tải lớp phòng                                                     |
 * | `partial`   | còn phòng chưa đặt tên hoặc chưa duyệt — trạng thái CHÍNH của màn      |
 * | `error`     | lớp dữ liệu phòng hỏng; ẢNH NỀN vẫn xem được (không phải màn trắng)    |
 * | `success`   | mọi phòng đã có tên và đã duyệt (`summary.unnamedCount === 0`)         |
 * | `forbidden` | vai Người xem: ẩn nút đổi tên/công năng/gộp/tách/duyệt                 |
 * | `collapsed` | ẩn panel trái + thanh tra, chỉ còn canvas toàn khung                   |
 *
 * Bất biến đi kèm, cùng khuôn `WallLayerViewProps`/`ObjectLayerReviewModel`:
 *
 * 1. `state === 'empty'` ⟺ `rooms.length === 0` ⟺ `emptyNotice !== null`.
 * 2. `state === 'partial'` ⟺ `rooms.length > 0` và `summary.unnamedCount > 0`,
 *    hoặc còn phòng có tên nhưng `status !== 'confirmed'`.
 * 3. `state === 'success'` ⟺ `rooms.length > 0`, `summary.unnamedCount === 0`
 *    và mọi phần tử của `rooms` có `status === 'confirmed'`.
 * 4. `state === 'error'` ⟺ `errorMessage !== null` ⟺ `rooms` rỗng dù
 *    `summary.roomCount` có thể khác 0 (lớp dữ liệu hỏng, không phải AI chưa
 *    dò ra phòng nào).
 * 5. `state === 'forbidden'` ⟺ `isViewerRole === true` ⟺ `viewerRoleNotice !== null`.
 * 6. `state === 'collapsed'` ⟺ `isCollapsed === true`.
 * 7. `state === 'loading'` ⟺ `rooms` rỗng, `summary.roomCount === 0`, và ba cờ
 *    `emptyNotice`/`errorMessage`/`viewerRoleNotice` đều `null`.
 *
 * ## Vì sao `outlineMm` là `Point` KHÔNG gắn nhãn, còn `labelAnchorMm` là `PointMm`
 *
 * Hai canvas anh em đã xong (`WallShapeViewModel.outline`,
 * `HostWallOutlineViewModel.outline`) đều vẽ thẳng từ `readonly Point[]` —
 * `Point` trần của `src/domain/spatial/types.ts`, không gắn nhãn. Canvas của
 * màn này (T6) nhiều khả năng ghép chung hạ tầng vẽ đa giác với hai canvas đó,
 * nên {@link RoomLabelViewModel.outlineMm} theo đúng khuôn ấy: `Point` trần.
 * Ngược lại {@link RoomLabelViewModel.labelAnchorMm} là kết quả THẲNG của
 * `computeLargestInnerRectangle` (`src/domain/rooms/area.ts`), hàm trả về toạ
 * độ kiểu `PointMm` gắn nhãn (`src/domain/units/compare.ts`) — hook chỉ
 * chuyền tay kết quả đó, không ánh xạ lại, nên trường này giữ nguyên nhãn.
 * Trộn hai quy ước trong cùng một kiểu nghe lạ nhưng đúng nguồn dữ liệu của
 * từng trường; xem ghi chú tương tự ở `WallLayerReview/types.ts` cho
 * `thicknessMm`/`millimetresPerPixel`.
 *
 * ## `RoomLabelReviewProps` là kiểu hook trả về, KHÔNG phải một cặp panel/canvas
 *
 * `WallLayerReview` gói props thành `{ panel, canvas }`; `ObjectLayerReview`
 * (đã dựng xong cả năm view con) chọn cách khác — `ObjectLayerReviewViewProps`
 * chính là bí danh của `ObjectLayerReviewModel`, kiểu `useObjectLayerReview`
 * trả về, và view cha (`ObjectLayerReview.tsx`) tự cắt lát cho từng view con
 * bằng cách chuyền đúng field cần. Màn này theo đúng khuôn ObjectLayerReview
 * (được đặc tả trỏ đích danh làm mẫu): {@link RoomLabelReviewProps} là kiểu
 * TOÀN BỘ mô hình, còn năm kiểu `RoomLabel*Props` bên dưới là phần cắt lát cho
 * từng view con, để hai worker viết panel/inspector/canvas làm việc song song
 * mà không phải đoán view cha ghép props kiểu gì.
 *
 * ## CẢNH BÁO CHO WORKER LỚP SAU — ba chỗ thiếu logic, phải hỏi trước khi cắm
 *
 * 1. **Không có lệnh nghiệp vụ nào để duyệt một phòng.**
 *    `ROOM_FLOOR_COMMAND_TYPES` (`src/lib/commands/business/roomFloorCommands.ts:67-74`)
 *    chỉ có bốn lệnh: `room.rename`, `room.changeUsage`, `room.merge`,
 *    `room.split`. Không có `room.approve`/`room.review` nào để đặt
 *    `reviewed: true`. Đúng ca của `WallLayerReview/types.ts` (cảnh báo #1 ở
 *    đó, cùng gốc, cùng cách xử lý): người viết `useRoomLabelReview.ts` gặp
 *    {@link RoomLabelReviewProps.onApprove} sẽ KHÔNG tìm thấy lệnh để gọi —
 *    R-69: DỪNG và hỏi điều phối viên, đề xuất một lệnh nghiệp vụ mới, KHÔNG
 *    tự chế một đường ghi tắt `reviewed: true` ngoài tầng lệnh.
 * 2. **`room.merge`/`room.split` cần nhiều hơn hai id/một điểm.**
 *    `MergeRoomsInput` (`roomFloorCommands.ts:311-316`) còn cần `outline` của
 *    phòng sau khi gộp; `SplitRoomInput` (`roomFloorCommands.ts:428-436`) còn
 *    cần `newRoomId` (mint được bằng `createId('room')`, giống cách `onSplit`
 *    của tường tự mint `secondWallId` — xem ghi chú ở `WallLayerReview/types.ts`)
 *    và `firstOutline`/`secondOutline`. {@link RoomLabelReviewProps.onMerge} và
 *    {@link RoomLabelReviewProps.onSplit} CHỦ Ý chỉ mang id/điểm — view không
 *    được tính hình học (R-60). Hook phải tự suy ra phần hình học còn thiếu từ
 *    hàm có sẵn trong `src/domain/rooms`; nếu không có hàm hợp/cắt đa giác nào
 *    sẵn, đây là thiếu logic thật (R-69) — DỪNG và hỏi, đừng tự chế công thức
 *    hình học mới trong màn.
 * 3. **Chưa có hàm chuẩn hoá tên nào trong `src/domain` hay `src/lib`.** Đã
 *    tìm — không có `normalizeName`/`sentenceCase`/tương đương nào chuyển
 *    `"PHÒNG NGỦ 1"` (OCR viết hoa) thành `"Phòng ngủ 1"` (kiểu câu, A6).
 *    `useRoomLabelReview.ts` cần một hàm thuần như vậy trước khi dựng được
 *    {@link RoomLabelNormalizePreview}; nếu không tìm được logic có sẵn, đây
 *    là thiếu logic thật (R-69) — DỪNG và hỏi, đừng tự chế bằng tay trong hook.
 *
 * ## "Vòng hở phải kèm một bước đi tiếp cụ thể" — thoả bằng dữ liệu, không phải callback trên viewmodel
 *
 * {@link RoomLabelGapViewModel} không mang callback: nó mang `wallIds` (đủ để
 * view lắp một liên kết "Xem tại lớp tường" bằng
 * {@link RoomLabelReviewProps.onNavigateToWalls}, đúng khuôn các viewmodel
 * khác trong repo không bao giờ tự cầm hàm xử lý — hành vi luôn nằm ở Props,
 * dữ liệu luôn nằm ở ViewModel).
 */

import type { Confidence, Point, RoomId, RoomUsage, WallId } from '@/domain/spatial/types';
import type { MillimetresPerPixel } from '@/domain/units/types';
import type { PointMm } from '@/domain/units/compare';
import type { RuleSeverity } from '@/domain/rules/registry';
import type { ColorTokenName } from '@/lib/coloring/scales';

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái (A11/R-63).                                                  */
/* -------------------------------------------------------------------------- */

/** Đúng bảy trạng thái của A11, tên lấy nguyên từ `SEVEN_STATES`. Xem bảng ở đầu file. */
export type RoomLabelScreenState =
  | 'empty'
  | 'loading'
  | 'partial'
  | 'error'
  | 'success'
  | 'forbidden'
  | 'collapsed';

/* -------------------------------------------------------------------------- */
/* Ảnh cắt gốc đặt cạnh ConfidenceMeter — định nghĩa lại, KHÔNG nhập chéo từ    */
/* DimensionOcrReview (đặc tả yêu cầu, xem `DimensionCropViewModel`).          */
/* -------------------------------------------------------------------------- */

/** Một điểm trên ảnh bản vẽ, tính bằng pixel — cục bộ của màn này. */
export interface RoomLabelPixelPoint {
  readonly x: number;
  readonly y: number;
}

/** Một hình chữ nhật trên ảnh bản vẽ, tính bằng pixel — cục bộ của màn này. */
export interface RoomLabelPixelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Bề rộng/cao hiển thị CHUẨN của ảnh cắt tên phòng — hai hằng số duy nhất,
 * không viết số thô rải rác ở view hay ở hook (R-71). Chọn độc lập với
 * `DIMENSION_CROP_DISPLAY_WIDTH_PX`/`_HEIGHT_PX` của màn OCR kích thước —
 * hai màn không dùng chung hằng số, đúng yêu cầu "định nghĩa lại".
 */
export const ROOM_LABEL_CROP_DISPLAY_WIDTH_PX = 160;
export const ROOM_LABEL_CROP_DISPLAY_HEIGHT_PX = 96;

/* -------------------------------------------------------------------------- */
/* Cỡ chữ của nhãn trên canvas — mở rộng của lớp L2, xem ghi chú.              */
/* -------------------------------------------------------------------------- */

/*
 * Ba hằng dưới đây được lớp L2 (hook/cổng) THÊM vào file này, theo đúng đường
 * mở rộng mà khối "KHOÁ SAU KHI XONG" ở cuối file cho phép: chúng không đổi
 * hình dạng một kiểu nào đã khai, chỉ đặt tên cho hai con số mà
 * {@link RoomLabelViewModel.labelFits} phải so.
 *
 * Vì sao chúng ở ĐÂY chứ không trong hook: `labelFits` là một cờ của viewmodel,
 * và cỡ chữ nó so là cỡ chữ lớp giao diện vẽ nhãn — hai dòng, tên phòng ở
 * `text-[15px]` và mã phòng ở `text-[13px]` theo đặc tả. Viết thẳng 15 và 13
 * trong thân hàm của hook là đúng thứ R-71 cấm; đặt tên cho chúng cạnh hai hằng
 * kích thước ảnh cắt là chỗ duy nhất còn lại mà cả hook lẫn view đọc chung.
 *
 * Không có hằng "diện tích tối thiểu để hiện nhãn" nào trong `src/domain` (đã
 * tìm: `MIN_LABEL`/`LABEL_AREA` ra rỗng) và bịa một ngưỡng mét vuông là phạm
 * R-71, nên phép quyết định ẩn/hiện nhãn là SO HAI KÍCH THƯỚC: hộp chữ nhật
 * trong lớn nhất mà M-07 tính, với hộp chữ hai dòng cần — xem `labelFitsIn`
 * trong `roomLabelReviewGateway.ts`.
 */

/** Cỡ chữ dòng tên phòng trên canvas. */
export const ROOM_LABEL_NAME_FONT_SIZE_PX = 15;

/** Cỡ chữ dòng mã phòng trên canvas. */
export const ROOM_LABEL_CODE_FONT_SIZE_PX = 13;

/**
 * Chiều cao tối thiểu của hộp nhãn: hai dòng chữ chồng nhau.
 *
 * Cận DƯỚI, không phải chiều cao thật của hai dòng (chiều cao dòng luôn lớn hơn
 * cỡ chữ) — một hộp thấp hơn tổng hai cỡ chữ thì chắc chắn không chứa nổi hai
 * dòng, nên đây là phép loại trừ an toàn chứ không phải một ước lượng.
 */
export const ROOM_LABEL_MIN_LABEL_BOX_HEIGHT_PX =
  ROOM_LABEL_NAME_FONT_SIZE_PX + ROOM_LABEL_CODE_FONT_SIZE_PX;

/**
 * Mọi thứ view cần để vẽ ảnh cắt 1:1 của vùng ghi tên phòng, đặt cạnh
 * `ConfidenceMeter`. `sourcePx` là khung cắt TRÊN ẢNH GỐC; `displayWidthPx`/
 * `displayHeightPx` là kích thước Ô HIỂN THỊ, luôn bằng
 * {@link ROOM_LABEL_CROP_DISPLAY_WIDTH_PX}/{@link ROOM_LABEL_CROP_DISPLAY_HEIGHT_PX}.
 */
export interface RoomLabelCropViewModel {
  readonly imageUrl: string;
  readonly sourcePx: RoomLabelPixelRect;
  readonly displayWidthPx: number;
  readonly displayHeightPx: number;
  /** Mô tả tiếng Việt cho trình đọc màn hình (R-72), ví dụ "Ảnh cắt tên phòng #R-005". */
  readonly alt: string;
}

/* -------------------------------------------------------------------------- */
/* Một dòng nhắc công năng — không bao giờ chặn thao tác.                      */
/* -------------------------------------------------------------------------- */

/**
 * Một dòng nhắc từ luật công năng (`src/domain/rules/registry.ts`, ví dụ
 * `ROOM-MIN-AREA`, `ROOM-UNNAMED`) gắn với một phòng. CẤM TUYỆT ĐỐI: một nhắc
 * nhở KHÔNG BAO GIỜ khoá nút duyệt/đổi tên — nó chỉ hiện cạnh phòng, người
 * duyệt tự quyết có sửa theo hay không.
 */
export interface RoomLabelNoticeViewModel {
  /** Mã luật, ví dụ `"ROOM-MIN-AREA"` — khớp `Rule.code` của tầng luật. */
  readonly ruleCode: string;
  readonly severity: RuleSeverity;
  readonly message: string;
  readonly suggestion: string;
  /**
   * Đường dẫn sang màn luật không gian, đã ghép sẵn bằng
   * `ROUTES.project.rules(projectId)` ở hook (R-65: không đường dẫn thô ở
   * view). View render bằng liên kết điều hướng thẳng, không cần một
   * `onNavigate` riêng cho mỗi dòng nhắc.
   */
  readonly ruleRouteHref: string;
}

/* -------------------------------------------------------------------------- */
/* Một dòng phòng đã sẵn sàng để vẽ — không còn phép tính nào.                 */
/* -------------------------------------------------------------------------- */

/**
 * Ba chấm trạng thái của danh sách phòng.
 *
 * `'unnamed'` khi `name` rỗng, bất kể `reviewed`. `'confirmed'` CHỈ khi
 * `reviewed === true` (A5: xanh "đã xác minh" chỉ đánh dấu việc người duyệt —
 * đổi tên không tự đặt cờ này, xem `createRenameRoomCommand`). `'suggested'`
 * là phần còn lại: có tên (do AI gợi ý hoặc người vừa đổi) nhưng chưa duyệt.
 */
export type RoomLabelStatus = 'unnamed' | 'suggested' | 'confirmed';

/**
 * Một dòng phòng đã sẵn sàng để VẼ, không còn phép tính nào (A15: định dạng ở
 * viewmodel, không ở view; dấu thập phân là dấu phẩy).
 */
export interface RoomLabelViewModel {
  readonly id: RoomId;
  /** Mã hiển thị chữ đều, ví dụ `"#R-005"`, dùng cho mono-lg. */
  readonly codeLabel: string;
  readonly name: string;
  /** `name.trim() !== ''` — hook tính sẵn, view không tự `trim()` (R-61/A15). */
  readonly hasName: boolean;
  readonly usage: RoomUsage;
  /** Lấy từ `ROOM_USAGE_LABELS` (`src/domain/rules/registry.ts:390`). */
  readonly usageLabel: string;
  /** Ví dụ `"18,40 m²"` (`formatArea`, `src/lib/format/measure.ts`). */
  readonly areaText: string;
  /** Ví dụ `"17.600 mm"` (`formatLength`, chu vi tính bằng `computePerimeter`). */
  readonly perimeterText: string;
  /** Chiều cao thông thuỷ đã định dạng. `null` khi tầng chưa có `heightMm` đáng tin — đồ thị hiện KHÔNG lưu chiều cao riêng cho từng phòng. */
  readonly clearHeightText: string | null;
  /** Đa giác đóng, ngược kim đồng hồ — xem ghi chú đầu file vì sao trần, không gắn nhãn. */
  readonly outlineMm: readonly Point[];
  /**
   * Tâm nhãn — kết quả THẲNG của `computeLargestInnerRectangle`
   * (`src/domain/rooms/area.ts`), hook không tính lại (R-61).
   */
  readonly labelAnchorMm: PointMm;
  /**
   * Nhãn tên có vừa hộp lớn nhất bên trong phòng không — canvas CHỈ đọc cờ
   * này để quyết định ẩn nhãn, không tự suy luận gì thêm (R-60).
   */
  readonly labelFits: boolean;
  /** Mã token nền theo công năng — CẤM TUYỆT ĐỐI: phải RẤT NHẠT, tương phản chữ trên nền ≥ 4,5:1. */
  readonly fillToken: ColorTokenName;
  readonly confidence: Confidence;
  /** Ví dụ `"AI đề xuất"` (`describeConfidence`, `src/lib/format/semantic.ts`). */
  readonly confidenceLabel: string;
  /** `true` khi tên hiện tại tới từ OCR/AI (`source === 'ai'`), chưa chắc đã đúng chính tả/kiểu câu. */
  readonly nameFromOcr: boolean;
  /** Ảnh cắt gốc đặt cạnh `ConfidenceMeter`. `null` khi tên không tới từ OCR (không có gì để cắt). */
  readonly crop: RoomLabelCropViewModel | null;
  readonly status: RoomLabelStatus;
  /** Nhắc từ luật công năng — không bao giờ chặn thao tác, xem {@link RoomLabelNoticeViewModel}. */
  readonly notices: readonly RoomLabelNoticeViewModel[];
}

/* -------------------------------------------------------------------------- */
/* Vòng tường hở — CẤM TUYỆT ĐỐI: phải kèm một bước đi tiếp cụ thể.            */
/* -------------------------------------------------------------------------- */

/**
 * Một vòng tường hở khiến phòng dò ra không khép được — nguồn dữ liệu thật là
 * `WeldedGap` của `src/domain/rooms/graph.ts` (`buildWallGraph`), hook chuyền
 * tay `gapMm`/`position` sau khi định dạng, không tính lại.
 */
export interface RoomLabelGapViewModel {
  /** Các tường có đầu bị hàn/kéo lại để đóng vòng hở — đã sắp xếp. */
  readonly wallIds: readonly WallId[];
  /** Khe hở đã định dạng, ví dụ `"62 mm"` (`WeldedGap.gapMm` qua `formatLength`). */
  readonly gapText: string;
  /** Vị trí khe hở trên bản vẽ — cùng nhãn `PointMm` với nguồn `WeldedGap.position`. */
  readonly positionMm: PointMm;
}

/* -------------------------------------------------------------------------- */
/* Dòng tóm tắt đầu panel trái.                                                */
/* -------------------------------------------------------------------------- */

/** Dòng tóm tắt đầu panel trái — ba số duy nhất, không câu chữ ghép sẵn ở đây. */
export interface RoomLabelSummaryViewModel {
  /** Ví dụ `"248,60 m²"` (`formatArea` trên tổng tính bằng `totalArea`, KHÔNG cộng các `areaText` đã làm tròn — xem ghi chú `src/domain/rooms/area.ts`). */
  readonly totalAreaText: string;
  readonly roomCount: number;
  readonly unnamedCount: number;
}

/* -------------------------------------------------------------------------- */
/* Xem trước "Chuẩn hoá tên".                                                  */
/* -------------------------------------------------------------------------- */

/** Một dòng của bảng xem trước "Chuẩn hoá tên". */
export interface RoomLabelNormalizeRow {
  readonly roomId: RoomId;
  /** Ví dụ `"#R-005"`. */
  readonly codeLabel: string;
  readonly from: string;
  readonly to: string;
}

/**
 * Bảng xem trước "Chuẩn hoá tên" — LUÔN hiện trước khi áp dụng (CẤM TUYỆT ĐỐI
 * "thao tác hàng loạt luôn xem trước trước khi áp"). Trạng thái "đã tính xong
 * xem trước nhưng chưa áp" là {@link RoomLabelReviewProps.normalizePreview}
 * khác `null` — kiểu này không tự mang một cờ trạng thái riêng, đúng khuôn các
 * viewmodel `xxx | null` khác trong repo (ví dụ `WallInspectorViewModel`).
 */
export interface RoomLabelNormalizePreview {
  readonly rows: readonly RoomLabelNormalizeRow[];
  /** `rows.length`, cấp sẵn để view không tự đếm mảng (R-61). */
  readonly changedCount: number;
}

/* -------------------------------------------------------------------------- */
/* Canvas giữa.                                                                */
/* -------------------------------------------------------------------------- */

/** Mọi thứ view canvas nhận. */
export interface RoomLabelCanvasProps {
  readonly rooms: readonly RoomLabelViewModel[];
  readonly selectedRoomId: RoomId | null;
  readonly hoveredRoomId: RoomId | null;
  /** Tỷ lệ mm/px của tầng. */
  readonly millimetresPerPixel: MillimetresPerPixel;
  /** Nguồn ảnh nền. `null` khi chưa có/đang tải — canvas vẽ khung xám chờ, không phải màn trắng. */
  readonly backgroundImageUrl: string | null;
  /** Mô tả ảnh nền cho trình đọc màn hình (R-72). */
  readonly backgroundImageAlt: string;
  /** `false` ở trạng thái `forbidden`: xem/phóng to được, chọn thì không. */
  readonly isInteractive: boolean;
  readonly onSelect: (roomId: RoomId | null) => void;
  readonly onHover: (roomId: RoomId | null) => void;
}

/* -------------------------------------------------------------------------- */
/* Panel trái: tóm tắt + bộ lọc + vòng hở + chuẩn hoá tên.                     */
/* -------------------------------------------------------------------------- */

/** Mọi thứ panel trái nhận. Danh sách phòng là một view riêng, xem {@link RoomLabelListProps}. */
export interface RoomLabelLeftPanelProps {
  readonly summary: RoomLabelSummaryViewModel;
  /** Vòng tường hở đang chờ xử lý — xem {@link RoomLabelGapViewModel}. */
  readonly gaps: readonly RoomLabelGapViewModel[];
  readonly showOnlyUnnamed: boolean;
  readonly onToggleUnnamedFilter: () => void;
  /** Mở bảng xem trước "Chuẩn hoá tên" — áp/huỷ nằm ở {@link RoomLabelNormalizePreviewProps}. */
  readonly onOpenNormalizePreview: () => void;
  /** Chạy lại `buildWallGraph` để tìm vòng hở mới nhất. */
  readonly onCheckWallGaps: () => void;
  /** "đi sang lớp tường" — hook tự ghép `ROUTES.project.walls(projectId, floorId)`, view không biết đường dẫn (R-65). */
  readonly onNavigateToWalls: () => void;
  /** `true` ở vai Người xem — CẤM TUYỆT ĐỐI không hộp thoại, nên chỉ ẩn nút "Chuẩn hoá tên". */
  readonly isViewerRole: boolean;
}

/* -------------------------------------------------------------------------- */
/* Danh sách phòng.                                                            */
/* -------------------------------------------------------------------------- */

/** Mọi thứ view danh sách nhận. */
export interface RoomLabelListProps {
  readonly rooms: readonly RoomLabelViewModel[];
  readonly selectedRoomId: RoomId | null;
  readonly onSelect: (roomId: RoomId | null) => void;
  readonly onHover: (roomId: RoomId | null) => void;
  /** `true` ở vai Người xem — ẩn nút duyệt nhanh trên từng dòng. */
  readonly isViewerRole: boolean;
}

/* -------------------------------------------------------------------------- */
/* Thanh tra phòng đang chọn.                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Mọi thứ thanh tra nhận. `room` là `null` khi chưa chọn phòng nào — view vẽ
 * trạng thái rỗng của thanh tra, không phải một `RoomLabelViewModel` giả với
 * chuỗi rỗng. Dùng lại {@link RoomLabelViewModel} thay vì một kiểu thanh tra
 * riêng: mọi trường thanh tra cần (tên, công năng, diện tích, ảnh cắt, nhắc
 * công năng) đã có sẵn ở đó, tách thêm một kiểu chỉ nhân đôi khái niệm.
 */
export interface RoomLabelInspectorProps {
  readonly room: RoomLabelViewModel | null;
  /** `true` ở vai Người xem — CẤM TUYỆT ĐỐI không hộp thoại, nên chỉ ẩn nút sửa. */
  readonly isViewerRole: boolean;
  readonly onRename: (roomId: RoomId, name: string) => void;
  readonly onChangeUsage: (roomId: RoomId, usage: RoomUsage) => void;
  /** Xem CẢNH BÁO #2 đầu file: hook phải tự suy ra `outline` sau khi gộp. */
  readonly onMerge: (roomId: RoomId, otherRoomId: RoomId) => void;
  /** `at` là điểm cắt trên ranh phòng. Xem CẢNH BÁO #2 đầu file. */
  readonly onSplit: (roomId: RoomId, at: Point) => void;
  /** Xem CẢNH BÁO #1 đầu file: chưa có lệnh nghiệp vụ nào đứng sau hàm này. */
  readonly onApprove: (roomId: RoomId) => void;
}

/* -------------------------------------------------------------------------- */
/* Xem trước "Chuẩn hoá tên".                                                  */
/* -------------------------------------------------------------------------- */

/** Mọi thứ bảng xem trước "Chuẩn hoá tên" nhận. */
export interface RoomLabelNormalizePreviewProps {
  /** `null` khi bảng chưa mở — xem {@link RoomLabelNormalizePreview}. */
  readonly preview: RoomLabelNormalizePreview | null;
  readonly onApply: () => void;
  readonly onCancel: () => void;
}

/* -------------------------------------------------------------------------- */
/* Toàn màn — kiểu hook trả về, `RoomLabelReview.tsx` nhận đúng kiểu này.      */
/* -------------------------------------------------------------------------- */

/**
 * Mọi thứ hook `useRoomLabelReview` trả về. View KHÔNG tự gọi store — mọi
 * thay đổi đi ra qua một trong các `on...` dưới đây (A10). Xem đầu file vì
 * sao đây là kiểu TOÀN BỘ mô hình chứ không phải một cặp `{ panel, canvas }`.
 */
export interface RoomLabelReviewProps {
  readonly state: RoomLabelScreenState;
  readonly rooms: readonly RoomLabelViewModel[];
  readonly summary: RoomLabelSummaryViewModel;
  readonly gaps: readonly RoomLabelGapViewModel[];
  readonly selectedRoomId: RoomId | null;
  readonly hoveredRoomId: RoomId | null;
  readonly showOnlyUnnamed: boolean;
  /** `null` khi bảng "Chuẩn hoá tên" chưa mở. */
  readonly normalizePreview: RoomLabelNormalizePreview | null;
  readonly backgroundImageUrl: string | null;
  readonly backgroundImageAlt: string;
  readonly millimetresPerPixel: MillimetresPerPixel;
  /** Dưới 1.024px panel phải thành tấm trượt đáy — cùng mốc các màn QC anh em. */
  readonly isCompact: boolean;
  readonly isCollapsed: boolean;
  readonly isViewerRole: boolean;
  /** Câu giải thích thay nút duyệt ở vai Người xem. `null` ngoài `forbidden`. */
  readonly viewerRoleNotice: string | null;
  /** Câu của trạng thái `empty`. `null` ở trạng thái khác. */
  readonly emptyNotice: string | null;
  /** Lỗi của trạng thái `error`. `null` ở trạng thái khác. */
  readonly errorMessage: string | null;

  /* -- Hành động trên một phòng ------------------------------------------- */
  readonly onRename: (roomId: RoomId, name: string) => void;
  readonly onChangeUsage: (roomId: RoomId, usage: RoomUsage) => void;
  /** Xem CẢNH BÁO #2 đầu file. */
  readonly onMerge: (roomId: RoomId, otherRoomId: RoomId) => void;
  /** Xem CẢNH BÁO #2 đầu file. */
  readonly onSplit: (roomId: RoomId, at: Point) => void;
  /** Xem CẢNH BÁO #1 đầu file. */
  readonly onApprove: (roomId: RoomId) => void;

  /* -- Chọn / rê chuột (dùng chung với canvas và danh sách) ---------------- */
  readonly onSelect: (roomId: RoomId | null) => void;
  readonly onHover: (roomId: RoomId | null) => void;

  /* -- Chuẩn hoá tên hàng loạt ---------------------------------------------- */
  /** Tính bảng xem trước; CẤM TUYỆT ĐỐI: luôn xem trước trước khi áp. */
  readonly onOpenNormalizePreview: () => void;
  readonly onApplyNormalize: () => void;
  readonly onCancelNormalize: () => void;

  /* -- Bộ lọc, vòng hở, điều hướng, hoàn tác, vỏ màn ------------------------ */
  readonly onToggleUnnamedFilter: () => void;
  readonly onCheckWallGaps: () => void;
  readonly onNavigateToWalls: () => void;
  /** Hoàn tác thao tác gần nhất (A8) — thường đi cùng toast, không tham số. */
  readonly onUndo: () => void;
  readonly onToggleCollapsed: () => void;
}

/* -------------------------------------------------------------------------- */
/* KHOÁ SAU KHI XONG                                                           */
/* -------------------------------------------------------------------------- */

/*
 * File này ĐÓNG BĂNG kể từ lúc lớp L1 xong. Worker lớp sau (hook/gateway, view
 * canvas, view panel) thấy thiếu một trường, sai một kiểu, hay cần thêm một
 * prop thì phải `orca orchestration ask` hỏi điều phối viên trước — không tự
 * thêm, không tự sửa, kể cả người đã viết file này. Cách hợp lệ duy nhất để mở
 * rộng là MỞ RỘNG kiểu ở file riêng, đúng khuôn
 * `UseScaleCalibrationHookOptions extends UseScaleCalibrationOptions`.
 */
