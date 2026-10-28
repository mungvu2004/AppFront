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

import type { Confidence, FurnitureKind, Point, ReviewMetadata, SwingDirection, WallId } from '@/domain/spatial/types';
import type { Millimetres, MillimetresPerPixel } from '@/domain/units/types';
import type { RelativePosition } from '@/domain/openings/types';
import type { FloorLayerSaveBlock } from '@/hooks/useAutosave';
import type { MeasurementState } from '@/hooks/useMeasurementLabel';
import type { ColorTokenName } from '@/lib/coloring/scales';
import type { ViewStatusCode } from '@/lib/viewmodel/types';

import type { FloorLayerReadFailure } from '../shared/floorLayerReadFailure';
import type { ProvisionalScaleNotice } from '../shared/provisionalScaleNotice';

import type { LayerGate } from './layerGate';

/* -------------------------------------------------------------------------- */
/* Ba lớp con.                                                                 */
/* -------------------------------------------------------------------------- */

/** Ba lớp con của màn, đúng thứ tự cây lớp ở panel trái. */
export type ObjectLayerId = 'door' | 'window' | 'furniture';

/** Mọi lớp con, theo thứ tự cây lớp. */
export const OBJECT_LAYER_IDS: readonly ObjectLayerId[] = ['door', 'window', 'furniture'];

/** Nhãn tiếng Việt của một lớp con — viết thường, kiểu câu (A6). */
export const OBJECT_LAYER_LABELS: Readonly<Record<ObjectLayerId, string>> = {
  door: 'Cửa đi',
  window: 'Cửa sổ',
  furniture: 'Nội thất',
};

/** Cờ bật/tắt của ba lớp con — dùng cho cây lớp và cho canvas. */
export type ObjectLayerVisibility = Readonly<Record<ObjectLayerId, boolean>>;

/* -------------------------------------------------------------------------- */
/* Tám loại con cụ thể (chip lọc).                                             */
/* -------------------------------------------------------------------------- */

/**
 * Chín loại con, đúng thứ tự hàng chip lọc: tám của đặc tả gốc, rồi `otherFurniture`.
 *
 * `otherFurniture` ("nội thất khác") là chỗ đứng của mọi `FurnitureKind` của đồ thị
 * không trùng nghĩa tuyệt đối với một loại con có sẵn (B-V6-13): ẩn chúng đi chính là
 * lỗi, còn gán "bàn ăn" cho mọi `table` là bịa một thông tin miền không có.
 */
export type ObjectSubtype =
  | 'singleDoor'
  | 'doubleDoor'
  | 'window'
  | 'bed'
  | 'sofa'
  | 'diningTable'
  | 'toilet'
  | 'basin'
  | 'otherFurniture';

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
  'otherFurniture',
];

/** Nhãn tiếng Việt của một loại con — viết thường, kiểu câu (A6). */
export const OBJECT_SUBTYPE_LABELS: Readonly<Record<ObjectSubtype, string>> = {
  singleDoor: 'Cửa đơn',
  doubleDoor: 'Cửa đôi',
  window: 'Cửa sổ',
  bed: 'Giường',
  sofa: 'Sofa',
  diningTable: 'Bàn ăn',
  toilet: 'Bồn cầu',
  basin: 'Chậu rửa',
  otherFurniture: 'Nội thất khác',
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
  otherFurniture: 'furniture',
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
  /**
   * Mã máy của thực thể trên đồ thị — khoá của tầng lệnh và của vùng chọn.
   *
   * Thêm theo quyết định của điều phối (B-V6-13): danh sách nay dựng từ đồ thị, nên mã
   * hiển thị không còn suy ngược được ra mã máy qua một bảng mẫu.
   */
  readonly entityId: string;
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
  /**
   * Nguồn gốc của thực thể trên đồ thị (FIX-P0-14). Vắng ở bộ mẫu cũ: khi đó suy từ `reviewed`.
   * Chưa duyệt không có nghĩa là của AI — đồ người vẽ vẫn là `'human'`.
   */
  readonly source?: ReviewMetadata['source'];
  /** Gợi ý của máy chưa được nhận (B3): vẽ nét đứt, Enter nhận, Del bỏ. Vắng = món thường. */
  readonly suggested?: boolean;
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

/**
 * Một LỖ MỞ chưa gắn tường — thứ người duyệt phải đi tìm tường cho nó.
 *
 * Nội thất đứng tự do cũng không có tường chủ (`Furniture` của đồ thị không có
 * `wallId`), nhưng đó là chỗ đứng bình thường của nó: không tô màu chú ý, không có
 * hành động "gắn vào tường gần nhất", và nó vẫn nằm trên đồ thị nên chọn được.
 */
export const isUnattachedOpening = (object: ReviewObject): object is OrphanReviewObject =>
  isOrphanObject(object) && object.layer !== 'furniture';

/* -------------------------------------------------------------------------- */
/* Mã máy suy từ mã hiển thị — bộ mẫu và đối tượng thêm tay.                   */
/* -------------------------------------------------------------------------- */

/** Số chữ số phần đếm trong thân mã — `COUNTER_LENGTH` của `src/domain/spatial/ids.ts:41`. */
const ID_COUNTER_LENGTH = 6;

/**
 * Bốn ký tự đuôi của mã máy, mỗi lớp con một đuôi.
 *
 * Cửa đi và cửa sổ CÙNG là `Opening` của đồ thị nên cùng tiền tố `D-`
 * (`ID_PREFIX_BY_KIND.opening`); hai đuôi khác nhau là thứ giữ cho `D-001` và
 * `S-001` không cùng một mã máy. Đuôi là hằng chứ không ngẫu nhiên — bộ mẫu
 * phải TẤT ĐỊNH, đúng khuôn `wallLayerReviewFixture.ts`.
 */
const ENTITY_ID_SUFFIX: Readonly<Record<ObjectLayerId, string>> = {
  door: 'DOOR',
  window: 'WNDW',
  furniture: 'FURN',
};

/** Tiền tố mã máy theo lớp con — `ID_PREFIX_BY_KIND.opening` / `.furniture`. */
const ENTITY_ID_PREFIX: Readonly<Record<ObjectLayerId, string>> = {
  door: 'D',
  window: 'D',
  furniture: 'F',
};

/**
 * Mã máy của một đối tượng, suy từ mã hiển thị của bộ mẫu.
 *
 * `D-007` → `D-000007DOOR`, `S-003` → `D-000003WNDW`, `F-002` → `F-000002FURN`.
 * Chỉ dùng ở chiều DỰNG (bộ mẫu, đối tượng thêm tay); đối tượng đọc từ đồ thị mang
 * sẵn {@link ReviewObjectCore.entityId}. Đặt ở đây chứ không ở cổng để bộ mẫu dùng
 * được mà không tạo vòng import (cổng nhập bộ mẫu).
 */
export function entityIdOf(displayId: string, layer: ObjectLayerId): string {
  const counter = displayId.slice(2).padStart(ID_COUNTER_LENGTH, '0');

  return `${ENTITY_ID_PREFIX[layer]}-${counter}${ENTITY_ID_SUFFIX[layer]}`;
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
  /** Tên loại người đọc: "Cửa đơn", "Giường", "Tủ bếp"… (K07). */
  readonly typeLabel: string;
  /** Ví dụ `"#D-007"`. */
  readonly codeLabel: string;
  /** Ví dụ `"900 × 2.200 mm"` (P-01). */
  readonly sizeLabel: string;
  /** Ví dụ `"#W-014"`. `null` khi {@link isOrphanObject}. */
  readonly hostWallLabel: string | null;
  readonly confidence: Confidence;
  /** `'verified'` chỉ khi `reviewed`; `'attention'` khi dưới ngưỡng tin cậy hoặc lỗ mở chưa gắn tường mà chưa duyệt; `'neutral'` còn lại. */
  readonly statusCode: ViewStatusCode;
  readonly isReviewed: boolean;
  readonly isLowConfidence: boolean;
  readonly isOrphan: boolean;
  /** Gợi ý của máy chưa nhận (B3) — dòng mang nhãn "Gợi ý". */
  readonly isSuggested?: boolean;
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
  /** Tên loại, cùng chữ với dòng danh sách (`objectTypeLabelOf`, K10). */
  readonly typeLabel: string;
  /** Loại đồ đạc của đồ thị — ô đổi loại của nội thất. `null` ở lỗ mở hoặc nội thất không đọc được loại. */
  readonly furnitureKind: FurnitureKind | null;
  /** "406 × 277 mm" — Rộng × Sâu của nội thất trên mặt bằng. */
  readonly sizeLabel: string;
  /** "Máy chưa chắc" / "Máy khá chắc" — cùng luật ngưỡng với danh sách (K10). */
  readonly confidenceLabel: string;
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
  /** Rộng × sâu (mm, đã làm tròn) cho hai ô số của nội thất đứng tự do; vắng ở lỗ mở. */
  readonly footprintMm?: { readonly widthMm: number; readonly depthMm: number };
  /** Gợi ý của máy chưa được nhận (B3). */
  readonly isSuggested?: boolean;
}

/**
 * Mười loại đồ đạc của đồ thị — ô đổi loại của nội thất (K10). Tên viết hoa chữ đầu, cùng chữ
 * `objectTypeLabelOf` in ở dòng danh sách (`other` là "Nội thất khác"). Chép ở đây vì
 * `FURNITURE_KIND_LABELS` nằm ở `@/lib/commands` mà view không được nhập (R-60). Mảng thường
 * (không `readonly`) vì `Select.options` nhận `SelectOption[]`.
 */
export const FURNITURE_KIND_OPTIONS: { label: string; value: FurnitureKind }[] = [
  { label: 'Bàn', value: 'table' },
  { label: 'Ghế', value: 'chair' },
  { label: 'Giường', value: 'bed' },
  { label: 'Tủ áo', value: 'wardrobe' },
  { label: 'Tủ bếp', value: 'kitchenCabinet' },
  { label: 'Thiết bị vệ sinh', value: 'sanitaryFixture' },
  { label: 'Máy giặt', value: 'washingMachine' },
  { label: 'Buồng tắm đứng', value: 'shower' },
  { label: 'Thang', value: 'stair' },
  { label: 'Nội thất khác', value: 'other' },
];

/** Mọi thứ view panel phải (inspector) nhận. */
export interface ObjectLayerInspectorProps {
  readonly inspector: ObjectInspectorViewModel | null;
  /** `true` ở vai Người xem — CẤM hộp thoại, nên chỉ ẩn nút, không khoá mờ. */
  readonly isViewerRole: boolean;
  readonly onChangeSubtype: (objectId: string, subtype: ObjectSubtype) => void;
  readonly onChangeSwing: (objectId: string, swing: SwingDirection) => void;
  /** Đổi loại một món nội thất (K10) — lệnh `furniture.changeKind`. */
  readonly onChangeFurnitureKind: (objectId: string, kind: FurnitureKind) => void;
  /** Kéo Slider vị trí — hook gộp thao tác kéo liên tục thành một lệnh (D-06, 400ms). */
  readonly onDragPosition: (objectId: string, relativePosition: RelativePosition) => void;
  /** Xoá dùng vé hoàn tác (A8); toast Hoàn tác do hook dựng. */
  readonly onDelete: (objectId: string) => void;
  readonly onApprove: (objectId: string) => void;
  /** Gọi M-08; màn không tự tính vị trí gắn (CẤM TUYỆT ĐỐI). */
  readonly onAttachToNearestWall: (objectId: string) => void;
  /** Bấm liên kết tường chủ: chọn tường đó và bay khung nhìn tới (R-07). */
  readonly onSelectHostWall: (wallId: WallId) => void;
  /** Tầng thiếu tỷ lệ: chân panel thay nút duyệt bằng lý do + lối sang bước Tỷ lệ. */
  readonly scaleLock?: ScaleLockAction | null;
  /** Đổi rộng × sâu của nội thất — lệnh `furniture.resize` (B3). */
  readonly onResize?: ((objectId: string, size: { readonly widthMm: number; readonly depthMm: number }) => void) | undefined;
  /** Xoay nội thất thêm 90° — lệnh `furniture.rotate` (B3). */
  readonly onRotate?: ((objectId: string) => void) | undefined;
  /** Tăng mỗi lần vừa vẽ xong một món: ô loại nội thất nhận focus (B3). */
  readonly focusKindToken?: number | undefined;
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
/* Thanh công cụ — phím C/S/N đặt nhóm (G4a-25: không trùng W "Vẽ tường"), 1/2/3 đổi loại trong nhóm.             */
/* -------------------------------------------------------------------------- */

/** Mọi thứ thanh công cụ nhận. */
export interface ObjectLayerToolRailProps {
  /** Nhóm loại đang chọn để đặt cho đối tượng đang chọn (`D`/`W`/`F`). `null` khi chưa chọn đối tượng. */
  readonly activeLayer: ObjectLayerId | null;
  readonly activeSubtype: ObjectSubtype | null;
  /** Nhóm đang vẽ: bấm lên bản vẽ là đặt một món mới của nhóm này (K07). `null` khi không vẽ. */
  readonly drawLayer: ObjectLayerId | null;
  /** Bật/tắt chế độ vẽ của một nhóm — nút rail "Vẽ cửa đi/cửa sổ/nội thất". */
  readonly onStartDraw: (layer: ObjectLayerId) => void;
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
  /** Nhóm chip đếm đang lọc danh sách; `null` = cả ba. Không đổi bản vẽ (K07). */
  readonly listLayerFilter: ObjectLayerId | null;
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
  readonly onChangeFurnitureKind: (objectId: string, kind: FurnitureKind) => void;
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
  /** Chip đếm: chỉ hiện một nhóm; bấm lại nhóm đang lọc thì hiện cả ba (K07). */
  readonly onFilterLayer: (layer: ObjectLayerId) => void;
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
  /** "1 / 3 đối tượng" khi bộ lọc đang ẩn bớt đối tượng; `null` khi danh sách đủ. */
  readonly filteredLabel: string | null;
  /** "5 mục dưới ngưỡng tin cậy, đã lọc sẵn". `null` khi không có mục nào. */
  readonly partialNotice: string | null;
  /** Màu dữ liệu ĐANG hiện — đúng ba khi bật cả ba lớp, không hơn (P-06). */
  readonly dataLayerTokens: readonly ColorTokenName[];
  /** Màu độ tin cậy của một đối tượng, do `src/lib/coloring` tô (P-06). */
  readonly confidenceTokenOf: (objectId: string) => ColorTokenName;
  /** Số bước còn hoàn tác được — D-06 gộp 20 lượt kéo thành đúng một bước. */
  readonly undoStepCount: number;
  /** Khung nhìn canvas (pixel bản vẽ → pixel khung); bấm liên kết tường chủ bay tới bằng R-07. */
  readonly viewport: ObjectLayerViewport;
  /** Vùng bản vẽ đang thấy — `viewBox` của `<svg>` phủ kín khung (BUG-403). */
  readonly viewBoxPx: PixelRect | null;
  /** Một px MÀN tính bằng px bản vẽ (= 1 / `viewport.zoom`) — chấm "chưa gắn" giữ cỡ (review-1 #4). */
  readonly unitPx: number;
  /** Hộp ảnh nền, pixel KHUNG. */
  readonly surfaceRectPx: PixelRect | null;
  /** Hộp của đối tượng đang chọn (hoặc đang rê), pixel KHUNG. */
  readonly haloRectPx: PixelRect | null;
  /** Canvas báo khổ khung đo được — "vừa khung" cần nó. */
  readonly onFrameResize: (size: { readonly width: number; readonly height: number }) => void;
  /** Nhóm loại đang chọn (`D`/`W`/`F`). */
  readonly activeLayer: ObjectLayerId | null;
  readonly activeSubtype: ObjectSubtype | null;
  /** Nhánh (a) của trạng thái một phần: chỉ hiện mục dưới ngưỡng tin cậy. */
  readonly isLowConfidenceOnly: boolean;
  /** Loại con có ít nhất một đối tượng trên tầng (BUG-590). */
  readonly availableSubtypes: ReadonlySet<ObjectSubtype>;
  /** Tường chủ vừa bấm "Tường chứa nó" — canvas tô viền nó (BUG-591). */
  readonly highlightedWallId: WallId | null;
  readonly onSelectLayer: (layer: ObjectLayerId) => void;
  readonly onSelectSubtypeSlot: (slot: 1 | 2 | 3) => void;
  /** Nhóm đang vẽ (rail "Vẽ …"); `null` khi không vẽ. */
  readonly drawLayer: ObjectLayerId | null;
  readonly onStartDraw: (layer: ObjectLayerId) => void;
  /**
   * Bấm lên bản vẽ ở chế độ vẽ: đặt một món mới tại điểm ấy (pixel bản vẽ, cùng hệ với `viewBoxPx`).
   * Kéo khi vẽ nội thất: `corner` là góc đối diện, món mới phủ đúng hộp kéo (B3).
   */
  readonly onPlaceAt: (point: PixelPoint, corner?: PixelPoint) => void;
  /** Đổi rộng × sâu / xoay 90° nội thất (B3). Vắng ở story/bộ mẫu cũ. */
  readonly onResize?: ObjectLayerInspectorProps['onResize'];
  readonly onRotate?: ObjectLayerInspectorProps['onRotate'];
  readonly focusKindToken?: number | undefined;
  /** Số gợi ý của máy chưa nhận trên tầng (B3); `0` ở vai chỉ xem. */
  readonly suggestionCount?: number | undefined;
  /** "3 gợi ý của máy đang chờ" — đã ghép sẵn (A15). */
  readonly suggestionLabel?: string | undefined;
  readonly onAcceptAllSuggestions?: (() => void) | undefined;
  readonly onRejectAllSuggestions?: (() => void) | undefined;
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
  readonly onAddManually: (kind?: 'door' | 'window') => void;
  /**
   * Tầng chưa có đoạn tường nào: "Thêm thủ công" chỉ dẫn tới toast lỗi, nên trạng thái rỗng mở
   * màn Duyệt tường thay vào đó (BUG-422). `null` khi tầng có tường hoặc không có lối điều hướng.
   */
  readonly onOpenWallLayer: (() => void) | null;
  /** Cổng sang bước sau (HOP-DONG-V6 câu 3): tường/cửa/phòng của tầng đã duyệt hết chưa. */
  readonly layerGate?: LayerGate | undefined;
  /** Đối tượng chưa duyệt kế tiếp (tin cậy thấp trước); `null` khi đã duyệt hết. */
  readonly nextPending?: { readonly id: string; readonly codeLabel: string } | null | undefined;
  /** "Đã lưu 14:02" đã định dạng; `null` khi chưa lưu lượt nào hoặc vai chỉ xem. */
  readonly saveLabel?: string | null | undefined;
  /** Mở lớp khác của tầng (cổng): `null` khi không có lối điều hướng (story, test). */
  readonly onOpenLayer?: ((layer: 'walls' | 'rooms') => void) | null | undefined;
  /** Khối lưu lớp của tầng — dải "Tải lại" / "Không lưu được" (F-04x-1). */
  readonly saveBlock?: FloorLayerSaveBlock | null | undefined;
  /** Dải tỉ lệ tạm (F-04x-2); `null` khi tầng đã có tỉ lệ thật. */
  readonly provisionalScaleNotice?: ProvisionalScaleNotice | null | undefined;
  /** Tầng thiếu tỷ lệ: mọi lệnh sửa bị chặn, nút chính thành lối sang bước Tỷ lệ. */
  readonly scaleLock?: ScaleLockAction | null | undefined;
  /** Đọc lớp của tầng hỏng khi chưa có tài liệu: thay cả màn, một lối ra (BUG-326). */
  readonly readFailure?: FloorLayerReadFailure | null | undefined;
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
  /** Cùng ý nghĩa với {@link ObjectListRowViewModel.statusCode} — canvas viền chú ý, làm mờ đã duyệt. */
  readonly statusCode: ViewStatusCode;
  /** Gợi ý của máy chưa nhận: nét đứt + nhãn "Gợi ý" (B3). */
  readonly isSuggested?: boolean;
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

/** Khoá tỷ lệ của tầng (UX-R1 r3): lý do + lối sang bước Tỷ lệ; `null` khi tầng không bị khoá. */
export interface ScaleLockAction {
  readonly reason: string;
  /** `null` khi màn không có lối điều hướng (story, test). */
  readonly onOpenScale: (() => void) | null;
}
