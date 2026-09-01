/**
 * Hợp đồng kiểu view-model của màn QC "Lớp đối tượng" (`ObjectLayerReview`) —
 * route `ROUTE_PATTERNS.projectObjects`. Xem `.orca-notes/T4-routes.fragment.md`
 * cạnh thư mục màn cho mảnh route/i18n mà T8 sẽ gộp; T4 KHÔNG được sửa
 * `src/routes/**` hay `src/i18n/vi.json`.
 *
 * Đây là NỀN MÓNG (lớp L1), đúng khuôn `WallLayerReview/types.ts` của màn anh
 * em: chỉ khai KIỂU và HẰNG, không import React, không import `src/store`,
 * `src/api`, `src/lib/http`. Ba worker lớp sau (T5 viết hook, T6 viết
 * canvas/panel trái/danh sách, T7 viết inspector/status bar/tool rail) import
 * DỰA VÀO đúng những gì khai ở đây. Thêm một trường hay đổi hình dạng một kiểu
 * đã khai là quyết định của điều phối viên, không phải của người viết view lớp
 * sau — hỏi bằng `orca orchestration ask` trước khi tự thêm.
 *
 * ## Bảy trạng thái (A11) — tên lấy nguyên văn từ `SEVEN_STATES`
 *
 * Đặc tả gốc gọi nhánh thứ năm là "Xong". `src/lib/testing/sevenStateScenarios.ts`
 * dùng tên `'success'`, không dùng `'done'` — {@link ObjectLayerScreenState}
 * theo đúng bộ khẳng định, như chỉ dẫn của điều phối viên trong đặc tả gốc.
 *
 * ## 21 = 9 + 7 + 5 — số này không bao giờ viết tay ở nơi thứ hai
 *
 * {@link ObjectLayerCounts.total} không phải một trường độc lập: nó luôn được
 * dựng bằng {@link createObjectLayerCounts}, hàm duy nhất cộng ba lớp con lại.
 * Bộ mẫu (`objectLayerFixture.ts`) và mọi hook dùng kiểu này gọi đúng một hàm
 * đó, không gõ tay số 21 ở hai chỗ.
 */

import type { Confidence, Point, SwingDirection, WallId } from '@/domain/spatial/types';
import type { Millimetres, MillimetresPerPixel } from '@/domain/units/types';
import type { RelativePosition } from '@/domain/openings/types';
import type { MeasurementState } from '@/hooks/useMeasurementLabel';
import type { ColorTokenName } from '@/lib/coloring/scales';
import type { ViewStatusCode } from '@/lib/viewmodel/types';

/* -------------------------------------------------------------------------- */
/* Ba lớp con.                                                                 */
/* -------------------------------------------------------------------------- */

/** Ba lớp con của màn, đúng thứ tự cây lớp ở panel trái. */
export type ObjectLayerId = 'door' | 'window' | 'furniture';

/** Mọi lớp con, theo thứ tự cây lớp. */
export const OBJECT_LAYER_IDS: readonly ObjectLayerId[] = ['door', 'window', 'furniture'];

/** Nhãn tiếng Việt của một lớp con — viết thường, kiểu câu (A6). */
export const OBJECT_LAYER_LABELS: Readonly<Record<ObjectLayerId, string>> = {
  door: 'cửa đi',
  window: 'cửa sổ',
  furniture: 'nội thất',
};

/** Cờ bật/tắt của ba lớp con — dùng cho cây lớp và cho canvas. */
export type ObjectLayerVisibility = Readonly<Record<ObjectLayerId, boolean>>;

/* -------------------------------------------------------------------------- */
/* Tám loại con cụ thể (chip lọc).                                             */
/* -------------------------------------------------------------------------- */

/** Tám loại con, đúng thứ tự hàng chip lọc của đặc tả gốc. */
export type ObjectSubtype =
  | 'singleDoor'
  | 'doubleDoor'
  | 'window'
  | 'bed'
  | 'sofa'
  | 'diningTable'
  | 'toilet'
  | 'basin';

/** Mọi loại con, theo thứ tự hàng chip lọc. */
export const OBJECT_SUBTYPES: readonly ObjectSubtype[] = [
  'singleDoor',
  'doubleDoor',
  'window',
  'bed',
  'sofa',
  'diningTable',
  'toilet',
  'basin',
];

/** Nhãn tiếng Việt của một loại con — viết thường, kiểu câu (A6). */
export const OBJECT_SUBTYPE_LABELS: Readonly<Record<ObjectSubtype, string>> = {
  singleDoor: 'cửa đơn',
  doubleDoor: 'cửa đôi',
  window: 'cửa sổ',
  bed: 'giường',
  sofa: 'sofa',
  diningTable: 'bàn ăn',
  toilet: 'bồn cầu',
  basin: 'chậu rửa',
};

/**
 * Lớp con mà một loại con thuộc về — bản đồ duy nhất, để "cửa đơn thuộc lớp
 * cửa đi" không bị viết lại rải rác ở hook hay ở view.
 */
export const OBJECT_SUBTYPE_LAYER: Readonly<Record<ObjectSubtype, ObjectLayerId>> = {
  singleDoor: 'door',
  doubleDoor: 'door',
  window: 'window',
  bed: 'furniture',
  sofa: 'furniture',
  diningTable: 'furniture',
  toilet: 'furniture',
  basin: 'furniture',
};

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái (A11) — tên lấy nguyên văn từ SEVEN_STATES.                  */
/* -------------------------------------------------------------------------- */

/**
 * Đúng bảy trạng thái của A11.
 *
 * | Trạng thái  | Nghĩa ở màn Lớp đối tượng                                          |
 * |-------------|----------------------------------------------------------------------|
 * | `empty`     | AI không tìm thấy đối tượng nào (`counts.total === 0`)              |
 * | `loading`   | đang tải lớp đối tượng                                              |
 * | `partial`   | có đối tượng dưới ngưỡng tin cậy, hoặc nhánh nội thất lỗi riêng      |
 * | `error`     | lớp dữ liệu đối tượng hỏng                                          |
 * | `success`   | `reviewCounter.reviewed === reviewCounter.total` — 21/21             |
 * | `forbidden` | vai Người xem: canvas chỉ xem, panel ẩn nút duyệt/xoá/gắn tường      |
 * | `collapsed` | ẩn cả hai panel, chỉ còn canvas toàn khung                          |
 */
export type ObjectLayerScreenState =
  | 'empty'
  | 'loading'
  | 'partial'
  | 'error'
  | 'success'
  | 'forbidden'
  | 'collapsed';

/* -------------------------------------------------------------------------- */
/* Bộ đếm duyệt — "9/21 đối tượng đã duyệt".                                   */
/* -------------------------------------------------------------------------- */

/** Số thô cho bộ đếm và cho test khẳng định bằng hằng (không phải câu chữ ghép sẵn). */
export interface ObjectReviewCounter {
  readonly reviewed: number;
  readonly total: number;
}

/* -------------------------------------------------------------------------- */
/* Đối tượng — gắn vào tường, hoặc chưa gắn.                                   */
/* -------------------------------------------------------------------------- */

/**
 * Phần chung của một đối tượng lớp cửa/cửa sổ/nội thất, không kể việc nó đã
 * gắn vào tường nào. Tách riêng để {@link AttachedReviewObject} và
 * {@link OrphanReviewObject} không thể lệch nhau — thêm một trường ở đây thêm
 * vào cả hai, đúng khuôn `OpeningCore` của `src/domain/openings/types.ts`.
 */
export interface ReviewObjectCore {
  /** Mã hiển thị, ví dụ `"D-007"`, `"S-003"`, `"F-002"` — không phải id domain đầy đủ. */
  readonly id: string;
  readonly layer: ObjectLayerId;
  readonly subtype: ObjectSubtype;
  readonly widthMm: Millimetres;
  readonly heightMm: Millimetres;
  /** Cao độ bệ cửa, tính từ chân tường chủ — chỉ có ở cửa sổ, `null` ở cửa đi/nội thất. */
  readonly sillHeightMm: Millimetres | null;
  /** Hướng mở, nhìn từ trong phòng ra — nội thất không có cánh mở nên dùng `'fixed'`. */
  readonly swing: SwingDirection;
  readonly confidence: Confidence;
  /**
   * `true` chỉ khi lệnh `opening.approve` (QĐ-3) đã chạy — A5: xanh "đã xác
   * minh" chỉ đánh dấu việc người duyệt, đầu ra AI không bao giờ đặt cờ này.
   */
  readonly reviewed: boolean;
}

/** Một đối tượng đã biết tường nào chứa nó và vị trí dọc tường đó. */
export interface AttachedReviewObject extends ReviewObjectCore {
  readonly hostWallId: WallId;
  /** Phần trăm dọc tim tường chủ, từ đầu `start`, `0..1` (dùng lại {@link RelativePosition} của M-08/M-09). */
  readonly relativePosition: RelativePosition;
}

/**
 * Một đối tượng chưa gắn được vào tường nào — KHÔNG bị xoá, giữ lại toạ độ vẽ
 * ra để hiện badge "Chưa gắn vào tường nào" và cho hành động "Gắn vào tường
 * gần nhất" (gọi M-08, màn không tự tìm — CẤM TUYỆT ĐỐI).
 *
 * `hostWallId === null` và không có `relativePosition`: một đối tượng chưa
 * gắn không có "vị trí trên tường" nào để mà đọc. Phân biệt ở kiểu, không
 * phải ở một cờ boolean rời — trình biên dịch chặn việc đọc nhầm vị trí không
 * tồn tại, đúng khuôn `OrphanOpening`.
 */
export interface OrphanReviewObject extends ReviewObjectCore {
  readonly hostWallId: null;
  /** Toạ độ tuyệt đối lúc dò ra — để canvas vẫn vẽ được nó ở đúng chỗ. */
  readonly tracedCentre: Point;
}

/** Một đối tượng, ở một trong hai trạng thái gắn tường. */
export type ReviewObject = AttachedReviewObject | OrphanReviewObject;

/** Đối tượng này đã gắn vào một tường chưa? */
export function isAttachedObject(object: ReviewObject): object is AttachedReviewObject {
  return object.hostWallId !== null;
}

/** Đối tượng này còn đang trôi, chưa gắn tường nào? */
export function isOrphanObject(object: ReviewObject): object is OrphanReviewObject {
  return object.hostWallId === null;
}

/* -------------------------------------------------------------------------- */
/* Bộ đếm ba lớp con — 21 = 9 + 7 + 5, đúng ở mọi nơi xuất hiện.               */
/* -------------------------------------------------------------------------- */

/**
 * Số đếm của ba lớp con và tổng. `total` không phải trường tự do — nó chỉ
 * được dựng qua {@link createObjectLayerCounts}, nên "21 = 9 + 7 + 5 phải
 * đúng ở mọi nơi xuất hiện" (CẤM TUYỆT ĐỐI) là một bất biến của kiểu, không
 * phải một quy ước phải nhớ.
 */
export interface ObjectLayerCounts {
  readonly doorCount: number;
  readonly windowCount: number;
  readonly furnitureCount: number;
  readonly total: number;
}

/**
 * Điểm dựng {@link ObjectLayerCounts} DUY NHẤT — `total` luôn bằng tổng ba
 * lớp con, không có đường nào khác để tạo ra kiểu này với `total` sai lệch.
 */
export function createObjectLayerCounts(
  doorCount: number,
  windowCount: number,
  furnitureCount: number,
): ObjectLayerCounts {
  return {
    doorCount,
    windowCount,
    furnitureCount,
    total: doorCount + windowCount + furnitureCount,
  };
}

/** Đếm ba lớp con trực tiếp từ một danh sách đối tượng — dùng ở bộ mẫu và ở hook. */
export function countObjectsByLayer(objects: readonly ReviewObject[]): ObjectLayerCounts {
  return createObjectLayerCounts(
    objects.filter((object) => object.layer === 'door').length,
    objects.filter((object) => object.layer === 'window').length,
    objects.filter((object) => object.layer === 'furniture').length,
  );
}

/* -------------------------------------------------------------------------- */
/* Một dòng danh sách gộp theo nhóm.                                           */
/* -------------------------------------------------------------------------- */

/**
 * Một dòng của danh sách gộp theo ba nhóm gấp được — mã, kích thước, tường
 * chủ, độ tin cậy, đã định dạng sẵn (A15: định dạng số ở viewmodel, không ở
 * view). `hostWallLabel` là `null` cho một dòng chưa gắn tường — view tự vẽ
 * badge cần chú ý thay vì một liên kết rỗng.
 */
export interface ObjectListRowViewModel {
  readonly id: string;
  readonly layer: ObjectLayerId;
  readonly subtype: ObjectSubtype;
  /** Ví dụ `"#D-007"`. */
  readonly codeLabel: string;
  /** Ví dụ `"900 × 2.200 mm"` (P-01). */
  readonly sizeLabel: string;
  /** Ví dụ `"#W-014"`. `null` khi {@link isOrphanObject}. */
  readonly hostWallLabel: string | null;
  readonly confidence: Confidence;
  /** `'verified'` chỉ khi `reviewed`; `'attention'` khi tin cậy thấp hoặc chưa gắn tường mà chưa duyệt; `'neutral'` còn lại. */
  readonly statusCode: ViewStatusCode;
  readonly isReviewed: boolean;
  readonly isLowConfidence: boolean;
  readonly isOrphan: boolean;
}

/* -------------------------------------------------------------------------- */
/* Panel trái: bộ đếm + cây lớp + chip lọc.                                    */
/* -------------------------------------------------------------------------- */

/** Mọi thứ panel trái nhận. Danh sách gộp bên dưới là một view riêng, xem {@link ObjectLayerListProps}. */
export interface ObjectLayerLeftPanelProps {
  readonly counts: ObjectLayerCounts;
  readonly reviewCounter: ObjectReviewCounter;
  /** "9/21 đối tượng đã duyệt", đã ghép sẵn ở hook (A15). */
  readonly reviewProgressLabel: string;
  readonly layerVisibility: ObjectLayerVisibility;
  readonly onToggleLayer: (layer: ObjectLayerId) => void;
  readonly subtypeFilters: ReadonlySet<ObjectSubtype>;
  readonly onToggleSubtypeFilter: (subtype: ObjectSubtype) => void;
}

/* -------------------------------------------------------------------------- */
/* Danh sách gộp theo ba nhóm gấp được.                                        */
/* -------------------------------------------------------------------------- */

/** Mọi thứ view danh sách nhận. */
export interface ObjectLayerListProps {
  readonly rows: readonly ObjectListRowViewModel[];
  readonly selectedObjectId: string | null;
  readonly onSelect: (objectId: string | null) => void;
  readonly onHover: (objectId: string | null) => void;
  /** Nhóm nào trong ba nhóm đang gấp lại. */
  readonly collapsedGroups: ObjectLayerVisibility;
  readonly onToggleGroupCollapsed: (layer: ObjectLayerId) => void;
}

/* -------------------------------------------------------------------------- */
/* Canvas giữa — ký hiệu kiến trúc, không phải khung bao.                      */
/* -------------------------------------------------------------------------- */

/** Hình tường nền để canvas vẽ mờ phía sau đối tượng — canvas KHÔNG tự tính hình học. */
export interface HostWallOutlineViewModel {
  readonly id: WallId;
  /** Đa giác đóng, ít nhất bốn đỉnh — hook truyền nguyên, không tính lại (CẤM TUYỆT ĐỐI). */
  readonly outline: readonly Point[];
}

/** Mọi thứ view canvas nhận. */
export interface ObjectLayerCanvasProps {
  readonly objects: readonly ReviewObject[];
  readonly wallOutlines: readonly HostWallOutlineViewModel[];
  readonly selectedObjectId: string | null;
  readonly hoveredObjectId: string | null;
  readonly layerVisibility: ObjectLayerVisibility;
  /** Tỷ lệ mm/px của tầng. */
  readonly millimetresPerPixel: MillimetresPerPixel;
  readonly backgroundImageUrl: string | null;
  /** Mô tả ảnh nền cho trình đọc màn hình (R-72). */
  readonly backgroundImageAlt: string;
  /** `false` ở trạng thái `forbidden`: xem/phóng to được, chọn/kéo thì không. */
  readonly isInteractive: boolean;
  readonly onSelect: (objectId: string | null) => void;
  readonly onHover: (objectId: string | null) => void;
}

/* -------------------------------------------------------------------------- */
/* Panel phải: thanh tra đối tượng đang chọn.                                  */
/* -------------------------------------------------------------------------- */

/**
 * Thanh tra đối tượng đang chọn. `null` ở {@link ObjectLayerInspectorProps.inspector}
 * khi chưa chọn đối tượng nào.
 */
export interface ObjectInspectorViewModel {
  readonly id: string;
  /** Ví dụ `"#D-007"`, mono-lg. */
  readonly codeLabel: string;
  readonly subtype: ObjectSubtype;
  /** Ví dụ `"900 mm"`. */
  readonly widthLabel: string;
  /** Ví dụ `"2.200 mm"`. */
  readonly heightLabel: string;
  /** FieldRow riêng cửa sổ — "cao độ bệ cửa". `null` ở cửa đi/nội thất. */
  readonly sillHeightLabel: string | null;
  /** Ví dụ `"#W-014"`, bấm được. `null` khi đối tượng chưa gắn tường nào. */
  readonly hostWallLabel: string | null;
  readonly hostWallId: WallId | null;
  /** `null` khi chưa gắn tường — Slider vị trí ẩn, thay bằng badge cần chú ý. */
  readonly relativePosition: RelativePosition | null;
  /** Số đo tới hai đầu tường, đã định dạng — chỉ có khi đã gắn tường. */
  readonly distanceToStartLabel: string | null;
  readonly distanceToEndLabel: string | null;
  readonly swing: SwingDirection;
  readonly confidence: Confidence;
  /** `true` khi {@link isOrphanObject} — điều khiển hiện badge + hành động "Gắn vào tường gần nhất". */
  readonly isOrphan: boolean;
  readonly reviewed: boolean;
}

/** Mọi thứ view panel phải (inspector) nhận. */
export interface ObjectLayerInspectorProps {
  readonly inspector: ObjectInspectorViewModel | null;
  /** `true` ở vai Người xem — CẤM hộp thoại, nên chỉ ẩn nút, không khoá mờ. */
  readonly isViewerRole: boolean;
  readonly onChangeSubtype: (objectId: string, subtype: ObjectSubtype) => void;
  readonly onChangeSwing: (objectId: string, swing: SwingDirection) => void;
  /** Kéo Slider vị trí — hook gộp thao tác kéo liên tục thành một lệnh (D-06, 400ms). */
  readonly onDragPosition: (objectId: string, relativePosition: RelativePosition) => void;
  /** Xoá dùng vé hoàn tác (A8); toast Hoàn tác do hook dựng. */
  readonly onDelete: (objectId: string) => void;
  readonly onApprove: (objectId: string) => void;
  /** Gọi M-08; màn không tự tính vị trí gắn (CẤM TUYỆT ĐỐI). */
  readonly onAttachToNearestWall: (objectId: string) => void;
  /** Bấm liên kết tường chủ: chọn tường đó và bay khung nhìn tới (R-07). */
  readonly onSelectHostWall: (wallId: WallId) => void;
}

/* -------------------------------------------------------------------------- */
/* Thanh trạng thái.                                                          */
/* -------------------------------------------------------------------------- */

/** Mọi thứ thanh trạng thái nhận. */
export interface ObjectLayerStatusBarProps {
  readonly state: ObjectLayerScreenState;
  readonly reviewCounter: ObjectReviewCounter;
  readonly reviewProgressLabel: string;
  /** Câu của trạng thái `empty`. `null` ở trạng thái khác. */
  readonly emptyNotice: string | null;
  /** Lỗi của trạng thái `error`. `null` ở trạng thái khác. */
  readonly errorMessage: string | null;
  /** Câu giải thích thay nút duyệt ở vai Người xem. `null` ngoài `forbidden`. */
  readonly viewerRoleNotice: string | null;
  /** Hàng cần chú ý của lớp nội thất khi nhánh nội thất lỗi riêng — không chặn cả màn. */
  readonly furnitureAttentionNotice: string | null;
  readonly isCollapsed: boolean;
  readonly onToggleCollapsed: () => void;
  readonly onUndo: () => void;
}

/* -------------------------------------------------------------------------- */
/* Thanh công cụ — phím D/W/F đặt nhóm, 1/2/3 đổi loại trong nhóm.             */
/* -------------------------------------------------------------------------- */

/** Mọi thứ thanh công cụ nhận. */
export interface ObjectLayerToolRailProps {
  /** Nhóm loại đang chọn để đặt cho đối tượng đang chọn (`D`/`W`/`F`). `null` khi chưa chọn đối tượng. */
  readonly activeLayer: ObjectLayerId | null;
  readonly activeSubtype: ObjectSubtype | null;
  readonly onSelectLayer: (layer: ObjectLayerId) => void;
  /** Vị trí 1/2/3 trong nhóm hiện tại (đúng thứ tự {@link OBJECT_SUBTYPES} lọc theo lớp). */
  readonly onSelectSubtypeSlot: (slot: 1 | 2 | 3) => void;
  readonly isViewerRole: boolean;
}

/* -------------------------------------------------------------------------- */
/* Kiểu trả về của hook `useObjectLayerReview` — T5 cài đặt đúng kiểu này.     */
/* -------------------------------------------------------------------------- */

/**
 * Mọi thứ hook `useObjectLayerReview` trả về. View KHÔNG tự gọi store — mọi
 * thay đổi đi ra qua một trong các `on...` dưới đây (A10).
 *
 * Bất biến, cùng khuôn `WallLayerViewProps`:
 * 1. `state === 'empty'` ⟺ `counts.total === 0` ⟺ `emptyNotice !== null`.
 * 2. `state === 'partial'` ⟺ có mục dưới ngưỡng tin cậy chưa duyệt, hoặc
 *    `furnitureAttentionNotice !== null`, với `0 < reviewCounter.reviewed`.
 * 3. `state === 'success'` ⟺ `reviewCounter.reviewed === reviewCounter.total`
 *    và `reviewCounter.total > 0`.
 * 4. `state === 'error'` ⟺ `errorMessage !== null` ⟺ `objects` rỗng dù
 *    `counts.total` có thể khác 0.
 * 5. `state === 'forbidden'` ⟺ `isViewerRole === true` ⟺ `viewerRoleNotice !== null`.
 * 6. `state === 'collapsed'` ⟺ `isCollapsed === true`.
 * 7. `state === 'loading'` ⟺ `objects` rỗng, `counts.total === 0`, ba cờ
 *    `emptyNotice`/`errorMessage`/`viewerRoleNotice` đều `null`.
 */
export interface ObjectLayerReviewModel {
  readonly state: ObjectLayerScreenState;
  /** Danh sách đối tượng thô — canvas và bộ chuyển đổi dòng danh sách đều đọc từ đây. */
  readonly objects: readonly ReviewObject[];
  readonly counts: ObjectLayerCounts;
  readonly reviewCounter: ObjectReviewCounter;
  readonly reviewProgressLabel: string;
  readonly selectedObjectId: string | null;
  readonly hoveredObjectId: string | null;
  readonly layerVisibility: ObjectLayerVisibility;
  readonly subtypeFilters: ReadonlySet<ObjectSubtype>;
  readonly collapsedGroups: ObjectLayerVisibility;
  readonly isCompact: boolean;
  readonly isCollapsed: boolean;
  readonly isViewerRole: boolean;
  readonly viewerRoleNotice: string | null;
  readonly emptyNotice: string | null;
  readonly errorMessage: string | null;
  readonly furnitureAttentionNotice: string | null;

  /* -- Hành động trên một đối tượng ------------------------------------------ */
  readonly onChangeSubtype: (objectId: string, subtype: ObjectSubtype) => void;
  readonly onChangeSwing: (objectId: string, swing: SwingDirection) => void;
  readonly onDragPosition: (objectId: string, relativePosition: RelativePosition) => void;
  readonly onDelete: (objectId: string) => void;
  readonly onApprove: (objectId: string) => void;
  readonly onAttachToNearestWall: (objectId: string) => void;
  readonly onSelectHostWall: (wallId: WallId) => void;

  /* -- Chọn / rê chuột (dùng chung với canvas và danh sách) ------------------ */
  readonly onSelect: (objectId: string | null) => void;
  readonly onHover: (objectId: string | null) => void;

  /* -- Lớp con, bộ lọc, nhóm gấp, hoàn tác, vỏ màn --------------------------- */
  readonly onToggleLayer: (layer: ObjectLayerId) => void;
  readonly onToggleSubtypeFilter: (subtype: ObjectSubtype) => void;
  readonly onToggleGroupCollapsed: (layer: ObjectLayerId) => void;
  readonly onUndo: () => void;
  readonly onToggleCollapsed: () => void;

  /* -- Bổ sung của lớp L2 (T5) ---------------------------------------------- */

  /**
   * Những trường dưới đây là PHẦN THÊM của `useObjectLayerReview`, không phải
   * sửa đổi phần trên: chúng là kết quả đã tính sẵn mà `ObjectLayerListProps`,
   * `ObjectLayerInspectorProps` và `ObjectLayerCanvasProps` đòi, và A15 đặt
   * việc tính chúng ở viewmodel chứ không ở view. Không trường nào của hợp đồng
   * gốc bị đổi kiểu hay bị bỏ đi.
   */

  /** Toạ độ vẽ đã tính sẵn của MỌI đối tượng — canvas không tự tính gì. */
  readonly placements: readonly ObjectPlacementViewModel[];
  /** Số đo hai đầu tường của đối tượng đang chọn. `null` khi chưa chọn hoặc chưa gắn tường. */
  readonly dragMeasurement: ObjectDragMeasurement | null;
  /** Danh sách gộp theo ba nhóm, đã lọc và đã định dạng. */
  readonly rows: readonly ObjectListRowViewModel[];
  /** Thanh tra đối tượng đang chọn. `null` khi chưa chọn gì. */
  readonly inspector: ObjectInspectorViewModel | null;
  /** Hình tường nền để canvas vẽ mờ phía sau đối tượng. */
  readonly wallOutlines: readonly HostWallOutlineViewModel[];
  readonly backgroundImageUrl: string | null;
  readonly backgroundImageAlt: string;
  readonly millimetresPerPixel: MillimetresPerPixel;
  /** "tổng 21 đối tượng" — đã ghép sẵn (A15). */
  readonly layerTotalLabel: string;
  /** "5 mục dưới ngưỡng tin cậy, đã lọc sẵn". `null` khi không có mục nào. */
  readonly partialNotice: string | null;
  /** Màu dữ liệu ĐANG hiện — đúng ba khi bật cả ba lớp, không hơn (P-06). */
  readonly dataLayerTokens: readonly ColorTokenName[];
  /** Màu độ tin cậy của một đối tượng, do `src/lib/coloring` tô (P-06). */
  readonly confidenceTokenOf: (objectId: string) => ColorTokenName;
  /** Số bước còn hoàn tác được — D-06 gộp 20 lượt kéo thành đúng một bước. */
  readonly undoStepCount: number;
  /** Khung nhìn canvas; bấm liên kết tường chủ bay tới bằng R-07. */
  readonly viewport: ObjectLayerViewport;
  /** Nhóm loại đang chọn (`D`/`W`/`F`). */
  readonly activeLayer: ObjectLayerId | null;
  readonly activeSubtype: ObjectSubtype | null;
  /** Nhánh (a) của trạng thái một phần: chỉ hiện mục dưới ngưỡng tin cậy. */
  readonly isLowConfidenceOnly: boolean;
  readonly onSelectLayer: (layer: ObjectLayerId) => void;
  readonly onSelectSubtypeSlot: (slot: 1 | 2 | 3) => void;
  /** Thêm/bớt một đối tượng khỏi vùng chọn (S-10). */
  readonly onToggleSelect: (objectId: string) => void;
  /** Chọn cả một lớp con (S-10). */
  readonly onSelectLayerObjects: (layer: ObjectLayerId) => void;
  readonly onToggleLowConfidenceOnly: () => void;
  /**
   * Thêm một đối tượng bằng tay — hành động của nút "thêm thủ công" ở trạng
   * thái rỗng.
   *
   * Đi qua `opening.add` của S-07: màn đề nghị đúng một chỗ và `validateOpening`
   * của M-08 phán quyết, nên màn không tự tính vị trí gắn (CẤM TUYỆT ĐỐI). Lệnh
   * hoàn tác được như mọi lệnh khác, và KHÔNG đặt cờ duyệt (A5).
   */
  readonly onAddManually: () => void;
}

/* -------------------------------------------------------------------------- */
/* Toạ độ vẽ đã tính sẵn — phía sản xuất cho canvas (T6) và số đo (T7).        */
/* -------------------------------------------------------------------------- */

/** Một điểm trên ảnh bản vẽ, tính bằng pixel của `<svg viewBox>`. */
export interface PixelPoint {
  readonly x: number;
  readonly y: number;
}

/** Một hình chữ nhật trên ảnh bản vẽ, tính bằng pixel. */
export interface PixelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Toạ độ vẽ của MỘT đối tượng — mọi thứ một ký hiệu kiến trúc cần, đã tính sẵn.
 *
 * Canvas KHÔNG tự tính hình học (CẤM TUYỆT ĐỐI, và A15/R-60): tâm tới từ
 * `placeOnWall` của M-08 với đối tượng đã gắn, từ `tracedCentre` với đối tượng
 * chưa gắn; hướng tới từ `wallBearing` của tường chủ.
 */
export interface ObjectPlacementViewModel {
  /** Mã hiển thị, ví dụ `"D-007"`. */
  readonly id: string;
  readonly layer: ObjectLayerId;
  readonly subtype: ObjectSubtype;
  readonly swing: SwingDirection;
  /** Tâm ký hiệu trên ảnh bản vẽ. */
  readonly centrePx: PixelPoint;
  /** Hướng chạy của tường chủ, độ, trong `[0, 360)`. `0` khi chưa gắn tường nào. */
  readonly angleDeg: number;
  /** Bề rộng đối tượng DỌC theo tường. */
  readonly widthPx: number;
  /**
   * Chiều sâu ký hiệu, tức **bề dày tường chủ** — KHÔNG phải `heightMm`.
   *
   * Một ký hiệu cửa trên mặt bằng cắt ngang hết bề dày tường; `heightMm` là
   * chiều cao đứng và không xuất hiện trên mặt bằng. Đối tượng chưa gắn không
   * có tường chủ để đọc bề dày nên rơi về chiều sâu của chính nó, và
   * {@link ObjectPlacementViewModel.isOrphan} nói rõ đó là trường hợp nào.
   */
  readonly depthPx: number;
  /** Hộp bao CHƯA XOAY quanh tâm — xoay nó bằng `angleDeg` quanh `centrePx`. */
  readonly boundsPx: PixelRect;
  /** Ví dụ `"#D-007"`. */
  readonly codeLabel: string;
  readonly isOrphan: boolean;
}

/**
 * Số đo tới HAI ĐẦU tường trong lúc kéo Slider vị trí.
 *
 * `MeasurementLabel` của `src/components/canvas` nhận đúng bộ này: hai điểm
 * đầu tường, điểm của đối tượng, hai điểm giữa để đặt nhãn, và hai chuỗi đã
 * định dạng (A15 — view không định dạng số).
 */
export interface ObjectDragMeasurement {
  readonly objectId: string;
  readonly state: MeasurementState;
  readonly wallStartPx: PixelPoint;
  readonly wallEndPx: PixelPoint;
  readonly objectPx: PixelPoint;
  readonly midToStartPx: PixelPoint;
  readonly midToEndPx: PixelPoint;
  /** Ví dụ `"1.240 mm"`. */
  readonly distanceToStartLabel: string;
  /** Ví dụ `"860 mm"`. */
  readonly distanceToEndLabel: string;
}

/** Khung nhìn canvas — `x`, `y` tính bằng pixel, `zoom` là hệ số. */
export interface ObjectLayerViewport {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}
