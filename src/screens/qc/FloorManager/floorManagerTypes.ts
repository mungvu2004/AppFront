/**
 * Hợp đồng kiểu view-model của màn S-16 "Quản lý tầng" (`FloorManager`).
 *
 * NỀN MÓNG: chỉ khai KIỂU và HẰNG. Không import React, không `@/store`,
 * không `@/api`, không `@/lib/http` — cùng kỷ luật `axisGridTypes.ts`.
 *
 * ## Bảy trạng thái (A11 / R-63)
 *
 * Tên lấy NGUYÊN VĂN từ `SEVEN_STATES` của
 * `src/lib/testing/sevenStateScenarios.ts` — không bịa nhánh thứ tám tên
 * `'ready'` hay `'done'`.
 *
 * ## A15 — số đọc là chuỗi, số vẽ là số
 *
 * Mọi trường kết thúc bằng `Text` là chuỗi ĐÃ ĐỊNH DẠNG ở hook; view chỉ đặt
 * nó vào thẻ. Mọi trường kết thúc bằng `Mm`/`Ratio` là số thô, CHỈ để so sánh,
 * sắp xếp và vẽ — view không được đọc ngược một chuỗi `*Text` ra số, cũng
 * không được định dạng một số `*Mm` thành chuỗi.
 *
 * ĐÓNG BĂNG kể từ lúc T5/T6/T7 bắt đầu (`notes/floor-manager/blueprint.md`).
 * File này ở nhánh T6 là một bản chép NGUYÊN VĂN để typecheck chạy được
 * trong lúc T5 chưa đẩy bản của mình lên — T7 lấy bản của T5 làm chuẩn khi
 * ráp lại (xem TASK-SPEC.md mục 1).
 */

import type { Millimetres, SquareMetres } from '@/domain/units/types';

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái màn.                                                         */
/* -------------------------------------------------------------------------- */

export type FloorManagerScreenState =
  | 'empty'
  | 'loading'
  | 'partial'
  | 'error'
  | 'success'
  | 'forbidden'
  | 'collapsed';

/* -------------------------------------------------------------------------- */
/* Ba ô sửa được của một dòng.                                                 */
/* -------------------------------------------------------------------------- */

/** Ba ô người dùng gõ được trong một dòng bảng. */
export type FloorEditableField = 'name' | 'elevation' | 'height';

/**
 * Giá trị ĐANG GÕ của ba ô sửa được — bộ đệm văn bản, không phải số.
 *
 * Đây là lý do ba trường này KHÔNG phạm A15: chúng là `value` của một
 * `<input>` do người dùng gõ, không phải một con số do màn hiển thị. Lúc ô
 * không được sửa, hook đặt chúng bằng phần SỐ của chuỗi đã định dạng (không
 * kèm hậu tố " m"), để lần gõ đầu tiên không phải xoá đơn vị.
 *
 * Ô rời tiêu điểm hoặc Enter → `onFloorFieldCommit`; Esc → `onFloorFieldCancel`
 * (A12: Esc đóng lớp trên cùng, ở đây là lượt sửa đang mở).
 */
export interface FloorRowDraft {
  readonly name: string;
  readonly elevation: string;
  readonly height: string;
}

/* -------------------------------------------------------------------------- */
/* Một dòng bảng.                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Một tầng, ở dạng một dòng bảng.
 *
 * Mười cột của bảng đọc thẳng từ đây; không ô nào tính thêm gì.
 */
export interface FloorRowVm {
  readonly id: string;
  /** Tên tầng người dùng đặt, ví dụ `"Tầng trệt"`. Không phải mã. */
  readonly name: string;

  /** Ví dụ `"-3,0 m"`. `formatLength(elevationMm, { unit: 'm', fractionDigits: 1 })`. */
  readonly elevationText: string;
  /** Số thô: để so trùng cao độ, để sắp thứ tự, để đặt dải lát cắt. Không vẽ ra chữ. */
  readonly elevationMm: Millimetres;

  /** Ví dụ `"3,9 m"`. Cùng công thức định dạng với `elevationText`. */
  readonly heightText: string;
  /** Số thô: mẫu số của `SectionBandVm.bandHeightRatio` và của tổng chiều cao. */
  readonly heightMm: Millimetres;

  /** Ví dụ `"2 bản vẽ"`, hoặc `"chưa có bản vẽ"` khi `drawingCount === 0`. */
  readonly drawingCountText: string;
  /** Số thô, để test đếm và để `hasDrawing` không phải đọc ngược chuỗi. */
  readonly drawingCount: number;
  /** `drawingCount > 0`. Sai ⟺ {@link FloorRowVm.needsDrawing} đúng. */
  readonly hasDrawing: boolean;

  /** Ví dụ `"72"`. `"—"` (`MISSING_VALUE`) khi tầng chưa có bản vẽ nên chưa đếm được. */
  readonly wallCountText: string;
  /** Ví dụ `"34"`. Cùng quy ước `"—"` với {@link FloorRowVm.wallCountText}. */
  readonly roomCountText: string;

  /** Ví dụ `"248,60 m²"`, hoặc `"—"` khi `areaM2 === null`. `formatArea`. */
  readonly areaText: string;
  /** Số thô, để chân bảng cộng tổng. `null` khi tầng chưa có bản vẽ. */
  readonly areaM2: SquareMetres | null;

  /** Ví dụ `"45%"`. `formatPercent(qcProgressRatio, { fractionDigits: 0 })`. */
  readonly qcProgressText: string;
  /**
   * 0..1. CHỈ để vẽ bề rộng thanh tiến độ và để chọn variant của `Badge`
   * (`1` → `'verified'`; đây là việc của NGƯỜI DUYỆT nên A5 cho phép xanh
   * đã-xác-minh ở đúng chỗ này, và chỉ ở đây).
   */
  readonly qcProgressRatio: number;

  readonly isSelected: boolean;
  /** Chuột/bàn phím đang trỏ vào dòng này — dải lát cắt tương ứng sáng lên. */
  readonly isHovered: boolean;
  /** `true` ⟺ `hasDrawing === false`. Chấm cần chú ý + liên kết "tải lên" trong dòng. */
  readonly needsDrawing: boolean;
  /** Tầng bị ẩn khỏi mô hình 3D. Dòng mờ đi; tầng vẫn còn trong bảng và trong lát cắt. */
  readonly isHiddenIn3d: boolean;

  /** Giá trị đang gõ của ba ô sửa được. Luôn có mặt, kể cả khi không ai đang sửa. */
  readonly draft: FloorRowDraft;
  /** Ô đang được sửa của dòng này, `null` khi dòng đang nghỉ. */
  readonly editingField: FloorEditableField | null;
}

/* -------------------------------------------------------------------------- */
/* Lát cắt bên trái — một dải cho một tầng.                                    */
/* -------------------------------------------------------------------------- */

/**
 * Một dải của lát cắt.
 *
 * CẤM TUYỆT ĐỐI: *"Chiều cao dải PHẢI tỷ lệ với chiều cao thật — lát cắt là bản
 * xem trước hậu quả, không phải trang trí."* {@link SectionBandVm.bandHeightRatio}
 * là chỗ luật đó sống.
 */
export interface SectionBandVm {
  readonly levelId: string;
  /** Ví dụ `"Tầng trệt · 3,9 m"` — đã ghép sẵn ở hook, view không nối chuỗi số. */
  readonly label: string;
  /**
   * Phần chiều cao của dải này trên TỔNG chiều cao ngăn xếp — **một phân số
   * không đơn vị trong khoảng 0..1**, KHÔNG phải phần trăm và KHÔNG phải px.
   *
   * HOOK tính: `heightMm / totalStackHeightMm`. VIEW chỉ vẽ, và vẽ bằng
   * `style={{ flexGrow: band.bandHeightRatio }}` trên một cột flex có
   * `flex-basis: 0` — không nhân 100, không nhân px, không một phép tính nào
   * trong view (A15, `local/no-raw-number`).
   *
   * Tổng `bandHeightRatio` của mọi dải bằng 1 khi ngăn xếp không hở và không
   * chồng. Với bộ mẫu ở mục D, tổng đúng bằng 1.
   */
  readonly bandHeightRatio: number;
  readonly isSelected: boolean;
  /** Người dùng đang trỏ vào dòng bảng tương ứng, hoặc trỏ thẳng vào dải này. */
  readonly isHovered: boolean;
  /** Dải của tầng bị ẩn khỏi 3D — vẽ viền đứt thay vì nền đặc. */
  readonly isHiddenIn3d: boolean;
  /** Tầng chưa có bản vẽ — dải tô `state-attention-tint`, vẫn đúng tỷ lệ. */
  readonly needsDrawing: boolean;
}

/* -------------------------------------------------------------------------- */
/* Thang cao độ chạy dọc bên trái lát cắt.                                     */
/* -------------------------------------------------------------------------- */

/** Một vạch của thang cao độ. */
export interface ElevationTickVm {
  readonly id: string;
  /** Ví dụ `"7,5 m"`. Đã định dạng ở hook. */
  readonly labelText: string;
  /**
   * Vị trí vạch tính từ ĐÁY thang lên — phân số không đơn vị 0..1.
   *
   * HOOK tính: `(elevationMm - bottomMm) / totalStackHeightMm`. Trường này chỉ
   * để so sánh và để bài kiểm khẳng định; VIEW đặt vạch bằng
   * {@link ElevationTickVm.offsetCssPercent}, không nhân 100 lấy một lần nữa.
   */
  readonly offsetRatio: number;
  /**
   * Đúng `offsetRatio` ở dạng CHUỖI CSS đã sẵn sàng cắm vào `style`, ví dụ
   * `"73.4042553191%"`. Dấu thập phân của CSS là dấu CHẤM — đây là chuỗi máy
   * đọc, không phải số người đọc, nên A15 (dấu phẩy) không áp vào nó.
   *
   * Tồn tại vì `offsetRatio` không cắm thẳng vào `insetBlockEnd` được (khác
   * `flexGrow`, vốn nhận số trần), và vì phép nhân 100 phải xảy ra ở viewmodel
   * chứ không ở view (A15).
   */
  readonly offsetCssPercent: string;
}

/* -------------------------------------------------------------------------- */
/* Chân bảng — TÍNH RA từ dữ liệu, không in cứng.                              */
/* -------------------------------------------------------------------------- */

/**
 * Chân bảng tổng.
 *
 * **Mọi trường ở đây TÍNH RA từ `rows`, không một con số nào viết cứng.** Với
 * bộ mẫu chuẩn giá trị đúng là `"14,1 m"`, và nó phải là kết quả của phép
 * cộng chứ không phải một hằng chuỗi.
 */
export interface FloorTableFooterVm {
  /** Ví dụ `"4 tầng"`. */
  readonly floorCountText: string;
  /** Đỉnh tầng trên cùng trừ đáy tầng dưới cùng. Ví dụ `"14,1 m"`. */
  readonly totalHeightText: string;
  /** Tổng diện tích các tầng có số liệu. Ví dụ `"745,80 m²"`. */
  readonly totalAreaText: string;
  /** Ví dụ `"202"`, hoặc `"—"` khi chưa tầng nào đếm được. */
  readonly totalWallCountText: string;
  /** Ví dụ `"102"`, cùng quy ước `"—"`. */
  readonly totalRoomCountText: string;
}

/* -------------------------------------------------------------------------- */
/* Câu chặn trùng cao độ (CẤM TUYỆT ĐỐI).                                      */
/* -------------------------------------------------------------------------- */

/**
 * Đủ dữ liệu để nêu ĐÍCH DANH hai tầng đụng nhau về cao độ.
 *
 * CẤM TUYỆT ĐỐI: *"Không cho trùng cao độ; chặn bằng câu nói rõ hai tầng nào."*
 * Câu chữ KHÔNG soạn ở màn: nó lấy nguyên văn từ `validateChangeLevelElevation`
 * (`src/lib/commands/business/roomFloorCommands.ts:559`), hàm đã trả sẵn những
 * câu tiếng Việt gọi tên cả hai tầng. Kiểu này giữ hai cái tên ở dạng có cấu
 * trúc để `aria-live` đọc lại và để bài kiểm khẳng định mà không phải bóc chuỗi.
 */
export interface DuplicateElevationViolation {
  readonly firstFloorName: string;
  readonly secondFloorName: string;
  /** Cao độ đang đụng nhau, đã định dạng. Ví dụ `"3,9 m"`. */
  readonly elevationText: string;
}

/* -------------------------------------------------------------------------- */
/* Props của view thuần `<FloorManager />`.                                    */
/* -------------------------------------------------------------------------- */

/**
 * TOÀN BỘ những gì view thuần `<FloorManager />` nhận.
 *
 * View KHÔNG gọi store (A10) và KHÔNG dựng một hàm xử lý nào bên trong (R-73):
 * mọi thay đổi đi ra qua một trong các `on...` dưới đây.
 *
 * ## Bất biến ràng buộc `state` với dữ liệu
 *
 * 1. `state === 'empty'`   ⟺ `rows` rỗng ⟺ `emptyNotice !== null`.
 * 2. `state === 'loading'` ⟺ `rows` rỗng, `emptyNotice`/`errorMessage`/
 *    `forbiddenNotice` đều `null` — đây là cách `loading` tách khỏi `empty` dù
 *    cả hai đều không có dòng nào.
 * 3. `state === 'partial'` ⟺ có ít nhất một dòng `needsDrawing === true`.
 * 4. `state === 'error'`   ⟺ `errorMessage !== null`.
 * 5. `state === 'success'` ⟺ `rows` không rỗng và MỌI dòng có
 *    `needsDrawing === false`.
 * 6. `state === 'forbidden'` ⟺ `canEdit === false` ⟺ `forbiddenNotice !== null`.
 * 7. `state === 'collapsed'` ⟺ `isCollapsed === true`.
 *
 * Thứ tự che nhau (hàm suy trạng thái của hook đi đúng thứ tự này):
 * `forbidden` → `collapsed` → `error` → `loading` → `empty` → `partial` →
 * `success`.
 */
export interface FloorManagerViewProps {
  readonly state: FloorManagerScreenState;

  /* -- Dữ liệu ------------------------------------------------------------- */

  /** Các tầng, **từ dưới lên** — cùng thứ tự `ReorderLevelsInput.levelIds`. */
  readonly rows: readonly FloorRowVm[];
  /** Dải lát cắt, cùng thứ tự và cùng số phần tử với {@link FloorManagerViewProps.rows}. */
  readonly bands: readonly SectionBandVm[];
  /** Vạch thang cao độ, từ đáy lên. */
  readonly elevationTicks: readonly ElevationTickVm[];
  /** Tổng chiều cao ngăn xếp, đã định dạng. Ví dụ `"14,1 m"`. */
  readonly totalHeightText: string;
  readonly footer: FloorTableFooterVm;

  /* -- Cờ trạng thái màn ---------------------------------------------------- */

  /**
   * `false` ở vai Người xem. Sai thì view ẩn **MỌI** hành động sửa: tay nắm
   * kéo, ba ô gõ, nút thêm/nhân bản/xoá/ẩn-3D, công tắc tự động tính cao độ,
   * liên kết "tải lên". CẤM TUYỆT ĐỐI không có hộp thoại, nên đây chỉ ẩn nút —
   * không dựng nút rồi vô hiệu hoá (A2: màu nhấn chỉ dành cho thứ bấm được).
   */
  readonly canEdit: boolean;
  /** Cột lát cắt thu gọn; bảng chiếm cả khung, còn nút bung lại. */
  readonly isCollapsed: boolean;
  /** Dưới 1.024px: lát cắt xuống DƯỚI bảng. Lớp trên đo bề rộng và truyền vào. */
  readonly isCompact: boolean;
  /** Công tắc "Tự động tính cao độ". Bật thì ô cao độ chỉ đọc và xếp lại tầng sẽ dồn cao độ. */
  readonly isAutoElevation: boolean;

  /* -- Câu nói ra ----------------------------------------------------------- */

  /** Câu của trạng thái Rỗng. `null` ở mọi trạng thái khác. */
  readonly emptyNotice: string | null;
  /** Câu của trạng thái Lỗi. `null` ở mọi trạng thái khác. */
  readonly errorMessage: string | null;
  /** Câu của vai Người xem. `null` ở mọi trạng thái khác. */
  readonly forbiddenNotice: string | null;
  /**
   * Câu chặn trùng cao độ của lượt sửa gần nhất, `null` khi lượt vừa rồi hợp lệ.
   *
   * Đi ra bằng trường RIÊNG, không nhét vào `errorMessage`: nhét vào đó sẽ lật
   * màn sang trạng thái `error` theo bất biến 4 ở trên, tức nói dối. View vẽ nó
   * thành `InlineAlert level="violation"` có `role="status"` ngay trên bảng.
   */
  readonly duplicateElevationMessage: string | null;
  /**
   * Cùng nội dung ở dạng có cấu trúc, cho `aria-live` và cho bài kiểm.
   * `null` cùng lúc với {@link FloorManagerViewProps.duplicateElevationMessage}.
   */
  readonly duplicateElevationViolation: DuplicateElevationViolation | null;

  /* -- Chọn và trỏ ---------------------------------------------------------- */

  readonly onSelectFloor: (floorId: string | null) => void;
  readonly onHoverFloor: (floorId: string | null) => void;

  /* -- Sửa ba ô ------------------------------------------------------------- */

  /** Người dùng vừa gõ; `draftValue` là NGUYÊN VĂN nội dung ô lúc này. */
  readonly onFloorFieldChange: (
    floorId: string,
    field: FloorEditableField,
    draftValue: string,
  ) => void;
  /** Rời tiêu điểm hoặc Enter — hook đọc số, soát trùng cao độ, rồi mới sinh lệnh. */
  readonly onFloorFieldCommit: (floorId: string, field: FloorEditableField) => void;
  /** Esc — bỏ giá trị đang gõ, trả ô về giá trị cũ (A12). */
  readonly onFloorFieldCancel: (floorId: string, field: FloorEditableField) => void;

  /* -- Kéo đổi thứ tự -------------------------------------------------------- */

  /**
   * Thứ tự MỚI của toàn bộ tầng, **từ dưới lên**.
   *
   * Truyền cả danh sách chứ không truyền `(floorId, toIndex)`: đây đúng hình
   * dạng `ReorderLevelsInput.levelIds`
   * (`src/lib/commands/business/roomFloorCommands.ts:649`), nên hook không phải
   * dựng lại danh sách và không có chỗ cho hai bên hiểu lệch chỉ số.
   *
   * Bàn phím là đường hạng nhất (A12): dòng đang chọn + `Alt+↑`/`Alt+↓` gọi
   * đúng hàm này với danh sách đã hoán vị.
   */
  readonly onReorderFloors: (floorIdsBottomUp: readonly string[]) => void;

  /* -- Thêm, nhân bản, ẩn, xoá ----------------------------------------------- */

  readonly onAddFloor: () => void;
  /**
   * Nhân bản một tầng.
   *
   * `copyFurniture` là cờ của hộp chọn "sao chép nội thất" đứng cạnh mục nhân
   * bản. Đây KHÔNG phải hộp thoại xác nhận (CẤM TUYỆT ĐỐI cấm hộp thoại cho
   * xoá; nhân bản cũng đi thẳng) — nó là một lựa chọn của chính hành động, và
   * A8 phủ nó bằng toast hoàn tác như mọi thay đổi khác.
   */
  readonly onDuplicateFloor: (
    floorId: string,
    options: { readonly copyFurniture: boolean },
  ) => void;
  /** Bật/tắt ẩn tầng khỏi mô hình 3D. Không rời màn, không hộp thoại. */
  readonly onToggleHiddenIn3d: (floorId: string) => void;
  /**
   * Xoá tầng. **KHÔNG hộp thoại** (CẤM TUYỆT ĐỐI) — xoá ngay, kèm toast hoàn
   * tác (A8). A9 không mâu thuẫn: A9 chỉ đòi hộp thoại cho việc A8 KHÔNG hoàn
   * tác được, và việc này hoàn tác được.
   */
  readonly onRemoveFloor: (floorId: string) => void;

  /* -- Công tắc và lối đi phụ ------------------------------------------------ */

  readonly onToggleAutoElevation: () => void;
  /** Liên kết "tải lên" trong dòng chưa có bản vẽ (trạng thái Một phần). */
  readonly onUploadDrawing: (floorId: string) => void;
  readonly onToggleCollapsed: () => void;
  readonly onRetry: () => void;
  readonly onUndo: () => void;
}

/* -------------------------------------------------------------------------- */
/* Hook trả về gì.                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Mọi thứ view nhận, cộng những gì CONTAINER cần.
 *
 * Trải đúng {@link FloorManagerViewProps}, nên container viết
 * `<FloorManager {...result} />` — không một prop nào phải nối tay.
 */
export interface UseFloorManagerResult extends FloorManagerViewProps {
  /** Ngăn xếp hoàn tác của chính màn — bài nghiệm thu đếm bước trên nó. */
  readonly historyStepCount: () => number;
  readonly canUndo: boolean;
  /**
   * Khả năng cổng không làm được, ở dạng câu đã sẵn sàng đọc cho người dùng.
   *
   * Rỗng khi cổng làm được hết. KHÔNG bịa endpoint để lấp: xem bản kê nợ ở
   * `floorManagerGateway.ts` và mục H của bản thiết kế.
   */
  readonly unsupportedNotices: readonly string[];
}

/*
 * File này ĐÓNG BĂNG. T5/T6/T7 thấy thiếu một trường, sai một kiểu, hay cần
 * thêm một prop thì `orca orchestration ask` hỏi điều phối viên trước — không
 * tự thêm, không tự sửa, kể cả người đã viết file này.
 */
