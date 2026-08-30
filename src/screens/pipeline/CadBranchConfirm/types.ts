/**
 * Hợp đồng props của màn "Phát hiện tệp CAD" (`CadBranchConfirm`) — route
 * `/projects/:id/floors/:floorId/cad-confirm`.
 *
 * **ĐÂY LÀ BẢN GIAO KÈO KIỂU DÙNG CHUNG.** Ba worker tầng 2 (L2-A viết hook,
 * L2-B viết hộp thoại chốt nhánh, L2-C viết panel ánh xạ + canvas xem trước +
 * khối tuỳ chọn nhập) chạy SONG SONG và type theo đúng các kiểu ở đây. KHÔNG
 * AI được sửa file này — kể cả người viết file này. Ai thấy thiếu một trường,
 * sai một kiểu, hay cần thêm một prop thì phải `orca orchestration ask` hỏi
 * điều phối viên trước, không tự thêm/sửa. Cách hợp lệ duy nhất để một hook mở
 * rộng tham số của nó là MỞ RỘNG kiểu ở file riêng (đúng khuôn
 * `UseScaleCalibrationHookOptions extends UseScaleCalibrationOptions` của màn
 * `ScaleCalibration`), không sửa file này.
 *
 * File này CHỈ kiểu: không logic, không JSX, không import React, không import
 * `src/api`, `src/store`, `src/domain`, hay `src/lib/http` (mục 0.4, R-60).
 *
 * ## Hai giai đoạn, một route, không lồng hộp thoại
 *
 * Giai đoạn 1 ({@link CadBranchConfirmDialogProps}) là hộp thoại 560 chốt
 * nhánh CAD/AI. Giai đoạn 2 ({@link CadLayerMappingPanelProps} +
 * {@link CadLayerPreviewCanvasProps} + {@link CadImportOptionsProps}) chỉ mở
 * ra SAU KHI hộp thoại đã đóng vì người dùng chọn nhánh CAD — không hộp thoại
 * nào lồng bên trong hộp thoại khác.
 *
 * ## Chỉ hai lựa chọn chính
 *
 * {@link CadBranchChoice} có đúng hai giá trị: `'cad'` và `'ai'`. Không lựa
 * chọn thứ ba nào được thêm vào union này. Nút "Huỷ" ở chân hộp thoại không
 * phải một giá trị thứ ba của lựa chọn — nó là `onDismiss`, đóng hộp thoại mà
 * không chốt gì cả (người dùng quay lại sau).
 *
 * ## A15 — định dạng số đã xong ở đây, view chỉ hiển thị
 *
 * Mọi chuỗi người đọc trong các viewmodel dưới đây (nhãn số lớp đã ánh xạ,
 * số đối tượng sẽ nhập, số thực thể…) đã được định dạng sẵn (dấu thập phân là
 * dấu phẩy). Xem {@link CadMappingSummary}: view ghép "Đã ánh xạ 4/9 lớp · 312
 * đối tượng sẽ được nhập" từ CHUỖI, không tự làm tròn hay ghép số.
 *
 * ## A5 — không có gì ở đây được đánh dấu "đã xác minh"
 *
 * Đây là màn đọc tệp CAD và gán vai trò — không có bước người dùng "duyệt"
 * một AI output nào ở đây theo nghĩa A5. Không trường `statusCode` nào trong
 * file này mang giá trị `'verified'`.
 *
 * ## Vì sao thiếu khai báo đơn vị VẪN CHO CHỌN
 *
 * {@link CadFileDiagnostics.hasMissingUnitDeclaration} là cờ HIỂN THỊ CẢNH
 * BÁO, không phải cờ khoá nút — cùng lý lẽ `ScaleCalibration`
 * (`panel.canApply` không phụ thuộc cảnh báo). Hộp thoại giai đoạn 1 vẫn cho
 * chọn nhánh CAD khi cờ này bật; nó chỉ đổi dải cảnh báo hiển thị.
 *
 * ## Thực thể không hỗ trợ phải gọi tên, không được gộp
 *
 * {@link UnsupportedEntityKind} tách RIÊNG TỪNG LOẠI kèm số lượng — không một
 * trường tổng hợp "một số lỗi" hay "số lỗi" đơn lẻ nào thay thế được mảng này.
 *
 * ## Bảy trạng thái — chép đúng khuôn hai màn anh em, không phát minh khuôn thứ ba
 *
 * {@link CadBranchConfirmState} là một UNION PHẲNG bảy chuỗi, tên lấy nguyên
 * từ `SEVEN_STATES` (`src/lib/testing/sevenStateScenarios.ts`) — đúng khuôn
 * `ScaleCalibrationState` (`ScaleCalibration/types.ts:87-94`) và
 * `PipelineGraphState` (`PipelineGraph/types.ts:36-43`). Mọi viewmodel bên
 * dưới LUÔN có mặt ở mọi trạng thái (không phải discriminated union theo
 * nhánh state) — `null` là cách một trường nói "không áp dụng ở trạng thái
 * này", không phải trường biến mất khỏi kiểu.
 */

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái (A11 / R-63).                                                */
/* -------------------------------------------------------------------------- */

/**
 * Đúng bảy trạng thái của A11, tên lấy nguyên từ `SEVEN_STATES`.
 *
 * Ý nghĩa của từng nhánh trên màn này:
 *
 * | Trạng thái  | Nghĩa ở màn Phát hiện tệp CAD                                          |
 * |-------------|--------------------------------------------------------------------------|
 * | `empty`     | tệp không có lớp đặt tên, hệ thống chuyển sang ánh xạ theo loại hình học  |
 * | `loading`   | đang đọc `.dwg`, số thực thể tăng dần                                    |
 * | `partial`   | một số tầng không có CAD, HOẶC có thực thể không hỗ trợ (liệt kê đích danh)|
 * | `error`     | tệp hỏng hoặc phiên bản mới hơn mức hỗ trợ; chỉ còn lựa chọn AI           |
 * | `success`   | đã nhập hình học xong                                                     |
 * | `forbidden` | không có quyền                                                            |
 * | `collapsed` | panel ánh xạ thu gọn                                                      |
 */
export type CadBranchConfirmState =
  | 'empty'
  | 'loading'
  | 'partial'
  | 'error'
  | 'success'
  | 'forbidden'
  | 'collapsed';

/* -------------------------------------------------------------------------- */
/* Giai đoạn 1 — chốt nhánh.                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Hai lựa chọn chính của hộp thoại chốt nhánh. Chỉ hai giá trị — xem ghi chú
 * đầu file "Chỉ hai lựa chọn chính".
 */
export type CadBranchChoice = 'cad' | 'ai';

/** Một dòng của bảng so sánh ba dòng (độ chính xác · công việc QC · thời gian). */
export type CadBranchComparisonRowId = 'accuracy' | 'qcEffort' | 'time';

/** Một ô của bảng so sánh: giá trị đã có nhãn tiếng Việt cho một lựa chọn. */
export interface CadBranchComparisonCell {
  readonly rowId: CadBranchComparisonRowId;
  /** Nhãn tiếng Việt của dòng, viết thường kiểu câu — ví dụ "độ chính xác". */
  readonly rowLabel: string;
  /** Giá trị đã ghép chuỗi cho lựa chọn CAD — ví dụ "chính xác theo bản vẽ gốc". */
  readonly cadValueLabel: string;
  /** Giá trị đã ghép chuỗi cho lựa chọn AI — ví dụ "khoảng 92% theo độ đo chuẩn". */
  readonly aiValueLabel: string;
}

/** Một tầng, và tệp nguồn nó có: CAD thật hay chỉ ảnh quét. */
export interface CadFloorAvailability {
  readonly floorId: string;
  /** Tên tầng tiếng Việt hiển thị — ví dụ "Tầng 1". */
  readonly floorName: string;
  readonly hasCadFile: boolean;
}

/**
 * Chẩn đoán tệp CAD, dựng sẵn cho hộp thoại giai đoạn 1 và cho dải cảnh báo.
 *
 * `hasMissingUnitDeclaration === true` KHÔNG khoá nút chọn nhánh CAD — xem ghi
 * chú đầu file "Vì sao thiếu khai báo đơn vị VẪN CHO CHỌN".
 */
export interface CadFileDiagnostics {
  readonly hasMissingUnitDeclaration: boolean;
  /** Đơn vị hệ thống tự nhận, dùng làm gợi ý. `null` khi không đoán được. */
  readonly detectedUnit: CadDrawingUnit | null;
  /** Số phiên bản định dạng tệp — mã máy đọc, giữ nguyên dạng (A6). */
  readonly fileFormatVersion: string;
  readonly hasNamedLayers: boolean;
}

/** Mọi thứ hộp thoại giai đoạn 1 vẽ. */
export interface CadBranchConfirmDialogViewModel {
  readonly isOpen: boolean;
  readonly comparisonRows: readonly CadBranchComparisonCell[];
  readonly floorAvailability: readonly CadFloorAvailability[];
  readonly diagnostics: CadFileDiagnostics;
  /**
   * Câu cảnh báo dải trên khi {@link CadFileDiagnostics.hasMissingUnitDeclaration}
   * là `true`. `null` khi không có gì đáng cảnh báo. Không bao giờ khoá nút
   * "Dùng đường từ CAD".
   */
  readonly unitWarningMessage: string | null;
  readonly isRememberChoiceChecked: boolean;
  /** `true` khi tệp đang ở trạng thái `error`: chỉ còn lựa chọn AI hiện được bấm. */
  readonly isCadChoiceDisabled: boolean;
  /**
   * Câu giải thích vì sao lựa chọn CAD bị khoá, khi
   * {@link CadBranchConfirmDialogViewModel.isCadChoiceDisabled} là `true`. Nêu
   * rõ số phiên bản và gợi ý thiết lập khi xuất lại. `null` khi không khoá.
   */
  readonly cadChoiceDisabledReason: string | null;
}

/** Props của hộp thoại giai đoạn 1 — worker L2-B viết view theo kiểu này. */
export interface CadBranchConfirmDialogProps {
  readonly model: CadBranchConfirmDialogViewModel;
  readonly actions: Pick<
    CadBranchConfirmActions,
    'onChooseBranch' | 'onDismiss' | 'onToggleRemember'
  >;
}

/* -------------------------------------------------------------------------- */
/* Giai đoạn 2 — ánh xạ lớp.                                                   */
/* -------------------------------------------------------------------------- */

/** Bảy vai trò một lớp CAD có thể được gán. Định danh tiếng Anh (nhãn ở file text của L1-D). */
export type CadLayerRole =
  | 'wall'
  | 'door'
  | 'window'
  | 'dimension'
  | 'grid'
  | 'furniture'
  | 'ignore';

/** Đơn vị bản vẽ CAD gốc. */
export type CadDrawingUnit = 'mm' | 'cm' | 'm' | 'inch';

/** Cách đặt gốc toạ độ khi nhập hình học. */
export type CadOriginMode = 'keep-cad' | 'grid-a1';

/**
 * Một lớp CAD của bảng ánh xạ.
 *
 * `sourceColor` CHỈ để vẽ ô màu nhỏ trong bảng — không phải token màu giao
 * diện, nên `local/no-raw-color` không áp cho giá trị này (nó đọc từ tệp CAD,
 * không phải hằng số viết tay ở tầng giao diện).
 */
export interface CadLayer {
  readonly id: string;
  /** Tên lớp CAD nguyên văn, hiển thị chữ đều (mono). */
  readonly name: string;
  /** Số thực thể của lớp, hiển thị chữ đều (mono). */
  readonly entityCount: number;
  /** Màu CAD gốc, dạng CSS hợp lệ (`#rrggbb` hoặc tên màu CAD) — chỉ để vẽ ô nhỏ. */
  readonly sourceColor: string;
  /** Vai trò đã gán. Lớp chưa gán mặc định `'ignore'`. */
  readonly role: CadLayerRole;
}

/** Một mục của Select "Đơn vị bản vẽ" hoặc "Gốc toạ độ", đã có nhãn tiếng Việt. */
export interface CadSelectOption<TValue extends string> {
  readonly value: TValue;
  readonly label: string;
}

/** Mọi thứ panel trái 420 vẽ — bảng lớp CAD, không kèm khối "Tuỳ chọn nhập". */
export interface CadLayerMappingPanelViewModel {
  readonly layers: readonly CadLayer[];
  readonly roleOptions: readonly CadSelectOption<CadLayerRole>[];
  /** Lớp đang được rê chuột qua, để đồng bộ tô sáng với canvas xem trước. `null` khi rời. */
  readonly hoveredLayerId: string | null;
}

/** Props của panel trái — worker L2-C viết view theo kiểu này. */
export interface CadLayerMappingPanelProps {
  readonly model: CadLayerMappingPanelViewModel;
  readonly actions: Pick<CadBranchConfirmActions, 'onAssignRole' | 'onHoverLayer'>;
}

/** Mọi thứ khối gấp "Tuỳ chọn nhập" vẽ. */
export interface CadImportOptionsViewModel {
  readonly isExpanded: boolean;
  readonly unit: CadDrawingUnit;
  /**
   * Giá trị tự nhận làm gợi ý — cùng nguồn với
   * {@link CadFileDiagnostics.detectedUnit}, lặp lại ở đây để view giai đoạn 2
   * không phải đọc ngược sang viewmodel của hộp thoại giai đoạn 1 đã đóng.
   */
  readonly detectedUnit: CadDrawingUnit | null;
  readonly unitOptions: readonly CadSelectOption<CadDrawingUnit>[];
  readonly origin: CadOriginMode;
  readonly originOptions: readonly CadSelectOption<CadOriginMode>[];
}

/** Props của khối gấp "Tuỳ chọn nhập" — worker L2-C viết view theo kiểu này. */
export interface CadImportOptionsProps {
  readonly model: CadImportOptionsViewModel;
  readonly actions: Pick<
    CadBranchConfirmActions,
    'onChangeOrigin' | 'onChangeUnit' | 'onToggleImportOptions'
  >;
}

/** Chú giải một mức độ dày tường trên canvas xem trước. */
export interface CadWallThicknessLegendEntry {
  readonly id: string;
  /** Nhãn tiếng Việt đã định dạng — ví dụ "220 mm". */
  readonly label: string;
  /** Token màu giao diện (không phải màu CAD gốc) dùng để tô mẫu chú giải. */
  readonly colorToken: string;
}

import type { WallThickness } from '@/types/spatial';

/**
 * Một điểm trong hệ toạ độ bản vẽ, đơn vị milimét: `[x, y]`.
 *
 * Không dùng `{ x, y }` để canvas dựng thuộc tính `points` của SVG mà không phải
 * dịch kiểu ở giữa.
 */
export type CadPreviewPoint = readonly [number, number];

/**
 * Một thực thể vẽ được trên canvas xem trước.
 *
 * Vì sao trường này tồn tại (bổ sung 30-08-2026, coordinator duyệt): bản giao kèo
 * đầu tiên chỉ có `layers`, mà spec đòi hai thứ cần tới từng thực thể — "các thực
 * thể tương ứng đổi màu trên canvas" và "nổi bật liên kết hai chiều … và ngược
 * lại". Không có `id` thực thể do MỘT nguồn phát ra thì `hoveredEntityId` không
 * bao giờ khớp được giữa hook và canvas. `id` PHẢI do gateway đặt, không do view
 * tự sinh — view tự sinh là dữ liệu bịa (R-69).
 */
export interface CadPreviewEntity {
  readonly id: string;
  /** Lớp CAD chứa thực thể này — quyết định màu vẽ, theo vai trò đã gán cho lớp. */
  readonly layerId: string;
  readonly points: readonly CadPreviewPoint[];
  /**
   * Độ dày tường của thực thể này, chỉ có nghĩa khi lớp chứa nó được gán vai trò
   * `wall`; `null` cho mọi vai trò khác.
   *
   * Vì sao trường này tồn tại (bổ sung 30-08-2026, coordinator duyệt): năm trên
   * bảy vai trò lấy màu từ hàm không tham số của `materialMap`, nhưng
   * `wallStrokeToken(thickness: WallThickness)` bắt buộc phải nhận một mức độ
   * dày. Chọn cứng một mức cho mọi tường thì chú giải độ dày tường — thứ đã nằm
   * trong hợp đồng này — sẽ nói dối về cái đang được vẽ.
   */
  readonly thicknessMm: WallThickness | null;
}

/**
 * Khung bao của toàn bộ thực thể, đơn vị milimét.
 *
 * Tính sẵn ở viewmodel để canvas không phải tự tính khung bao — R-61 giữ mọi phép
 * tính ra ngoài thư mục màn, và A15 giữ phép tính ra ngoài view.
 */
export interface CadPreviewExtent {
  readonly minXMm: number;
  readonly minYMm: number;
  readonly maxXMm: number;
  readonly maxYMm: number;
}

/** Mọi thứ canvas xem trước bên phải vẽ. Cập nhật TRỰC TIẾP khi đổi ánh xạ. */
export interface CadLayerPreviewCanvasViewModel {
  readonly layers: readonly CadLayer[];
  readonly hoveredLayerId: string | null;
  /** Thực thể đang được rê chuột qua trên canvas, đồng bộ ngược lại bảng lớp. `null` khi rời. */
  readonly hoveredEntityId: string | null;
  /** Hình học thật để vẽ. Rỗng khi chưa đọc xong tệp. */
  readonly entities: readonly CadPreviewEntity[];
  /** Khung bao đã tính sẵn của `entities`. */
  readonly extentMm: CadPreviewExtent;
  readonly wallThicknessLegend: readonly CadWallThicknessLegendEntry[];
  readonly isLoading: boolean;
}

/** Props của canvas xem trước — worker L2-C viết view theo kiểu này. */
export interface CadLayerPreviewCanvasProps {
  readonly model: CadLayerPreviewCanvasViewModel;
  readonly actions: Pick<CadBranchConfirmActions, 'onHoverEntity' | 'onHoverLayer'>;
}

/**
 * Tóm tắt số lớp đã ánh xạ / tổng số lớp, và tổng số đối tượng sẽ nhập.
 *
 * Đây là chỗ A15 đã xong: `mappedCountLabel` là "4/9 lớp" hoàn chỉnh,
 * `objectCountLabel` là "312 đối tượng sẽ được nhập" hoàn chỉnh — view chỉ
 * hiển thị, không tự đếm hay ghép số.
 */
export interface CadMappingSummary {
  readonly mappedLayerCount: number;
  readonly totalLayerCount: number;
  readonly objectCount: number;
  /** Chuỗi đã ghép — ví dụ "Đã ánh xạ 4/9 lớp". */
  readonly mappedCountLabel: string;
  /** Chuỗi đã ghép — ví dụ "312 đối tượng sẽ được nhập". */
  readonly objectCountLabel: string;
}

/* -------------------------------------------------------------------------- */
/* Thực thể không hỗ trợ — gọi tên, không gộp.                                 */
/* -------------------------------------------------------------------------- */

/**
 * Một loại thực thể CAD không hỗ trợ, kèm số lượng.
 *
 * Mảng {@link CadBranchConfirmViewModel.unsupportedEntityKinds} liệt kê ĐÍCH
 * DANH từng loại — cấm mọi trường tổng hợp kiểu "một số lỗi" thay thế mảng
 * này (xem ghi chú đầu file).
 */
export interface UnsupportedEntityKind {
  readonly id: string;
  /** Tên loại thực thể CAD, giữ nguyên dạng kỹ thuật — ví dụ "3DSOLID", "SPLINE". */
  readonly kind: string;
  readonly count: number;
}

/* -------------------------------------------------------------------------- */
/* Toàn màn.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Mọi thứ view vẽ, cho cả hai giai đoạn.
 *
 * Bất biến đi kèm, cùng khuôn `ScaleCalibrationViewModel`:
 *
 * 1. `errorMessage !== null` ⟺ `state === 'error'`, và `errorCode` /
 *    `errorFileFormatVersion` đi cùng nó.
 * 2. `state === 'loading'` ⟺ `dialog.diagnostics.hasNamedLayers` chưa xác định
 *    được (đang đọc tệp) — hook quyết định, view chỉ đọc `state`.
 * 3. `state === 'empty'` ⟺ tệp không có lớp đặt tên
 *    (`dialog.diagnostics.hasNamedLayers === false`).
 * 4. `state === 'partial'` ⟺ có tầng thiếu CAD trong
 *    `dialog.floorAvailability` HOẶC `unsupportedEntityKinds.length > 0`.
 * 5. `state === 'forbidden'` ⟺ `isCadChoiceDisabled` không áp dụng (không có
 *    quyền thì không thao tác được ở cả hai giai đoạn).
 * 6. `state === 'collapsed'` ⟺ `isMappingPanelCollapsed === true`.
 * 7. `state === 'success'` ⟺ đã bấm "Nhập hình học" và hoàn tất.
 *
 * Hai giai đoạn cùng tồn tại trong MỘT viewmodel: `stage` nói giai đoạn nào
 * đang mở; `dialog` luôn có mặt (kể cả khi đã đóng — `dialog.isOpen === false`
 * ở giai đoạn 2); `mapping`/`preview`/`importOptions` là `null` cho tới khi
 * người dùng chọn nhánh CAD.
 */
export type CadBranchConfirmStage = 'branchDialog' | 'layerMapping';

export interface CadBranchConfirmViewModel {
  readonly state: CadBranchConfirmState;
  readonly stage: CadBranchConfirmStage;
  readonly dialog: CadBranchConfirmDialogViewModel;
  /** `null` cho tới khi người dùng chọn nhánh CAD và giai đoạn 2 mở ra. */
  readonly mapping: CadLayerMappingPanelViewModel | null;
  readonly preview: CadLayerPreviewCanvasViewModel | null;
  readonly importOptions: CadImportOptionsViewModel | null;
  readonly summary: CadMappingSummary | null;
  readonly unsupportedEntityKinds: readonly UnsupportedEntityKind[];
  readonly isMappingPanelCollapsed: boolean;
  /** `false` khi chưa đủ điều kiện bấm "Nhập hình học" (chưa ánh xạ lớp nào). */
  readonly canImportGeometry: boolean;
  readonly isImporting: boolean;
  /** Có thì bỏ chạy số, đổi giá trị tức thì (mục B). */
  readonly prefersReducedMotion: boolean;
  /** Lỗi tệp CAD hỏng hoặc phiên bản không hỗ trợ. `null` ngoài trạng thái `error`. */
  readonly errorMessage: string | null;
  /** Mã máy đọc, giữ nguyên dạng (A6). Không bao giờ đứng một mình. */
  readonly errorCode: string | null;
  /** Số phiên bản tệp gây lỗi, nêu rõ trong thông báo lỗi. `null` ngoài trạng thái `error`. */
  readonly errorFileFormatVersion: string | null;
  /** Câu của trạng thái `'empty'`. `null` ở trạng thái khác. */
  readonly emptyNotice: string | null;
  /** Câu của trạng thái `'partial'`. `null` ở trạng thái khác. */
  readonly partialNotice: string | null;
  /** Câu của trạng thái `'forbidden'`. `null` ở trạng thái khác. */
  readonly forbiddenNotice: string | null;
  /** Câu của trạng thái `'success'`. `null` ở trạng thái khác. */
  readonly successNotice: string | null;
}

/* -------------------------------------------------------------------------- */
/* Hành động.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Mọi hàm view gọi. Không hàm nào trả về gì: view bắn sự kiện, hook quyết
 * định. View KHÔNG chạm store, KHÔNG chạm mạng, KHÔNG tự đọc tệp CAD.
 *
 * `onChooseBranch('ai')` PHẢI luôn dùng được ở mọi trạng thái mà hộp thoại còn
 * mở — người dùng luôn phải quay về nhánh AI được (cấm tuyệt đối của đặc tả).
 */
export interface CadBranchConfirmActions {
  /* -- Giai đoạn 1: hộp thoại chốt nhánh ------------------------------------ */
  readonly onChooseBranch: (choice: CadBranchChoice) => void;
  readonly onToggleRemember: (isChecked: boolean) => void;
  /** Nút mờ "Huỷ" — đóng hộp thoại mà không chốt nhánh nào. */
  readonly onDismiss: () => void;

  /* -- Giai đoạn 2: bảng ánh xạ lớp ------------------------------------------ */
  readonly onAssignRole: (layerId: string, role: CadLayerRole) => void;
  /** Rê chuột qua một lớp ở bảng hoặc trên canvas. `null` khi rời. */
  readonly onHoverLayer: (layerId: string | null) => void;
  /** Rê chuột qua một thực thể trên canvas. `null` khi rời. */
  readonly onHoverEntity: (entityId: string | null) => void;

  /* -- Giai đoạn 2: khối gấp "Tuỳ chọn nhập" --------------------------------- */
  readonly onChangeUnit: (unit: CadDrawingUnit) => void;
  readonly onChangeOrigin: (origin: CadOriginMode) => void;
  readonly onToggleImportOptions: (isExpanded: boolean) => void;

  /* -- Chân giai đoạn 2 -------------------------------------------------------- */
  readonly onImportGeometry: () => void;

  /* -- Vỏ màn ------------------------------------------------------------------ */
  readonly onToggleMappingPanelCollapsed: () => void;
  /** Tải lại tệp sau lỗi, hoặc thử lại truy vấn quyền. */
  readonly onRetry: () => void;
}

/* -------------------------------------------------------------------------- */
/* Props của view chính.                                                       */
/* -------------------------------------------------------------------------- */

/** Mọi prop `CadBranchConfirm.tsx` nhận — mô hình cộng hành động (mục D). */
export interface CadBranchConfirmProps {
  readonly model: CadBranchConfirmViewModel;
  readonly actions: CadBranchConfirmActions;
}

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Tham số của `useCadBranchConfirm`.
 *
 * Cổng dữ liệu **không** nằm ở đây, vì `cadBranchConfirmGateway.ts` chưa tồn
 * tại lúc file này đóng băng. Người viết hook (L2-A) MỞ RỘNG kiểu này trong
 * file của mình:
 *
 * ```ts
 * interface UseCadBranchConfirmHookOptions extends UseCadBranchConfirmOptions {
 *   readonly gateway?: CadBranchConfirmGateway;
 * }
 * ```
 *
 * Đó là cách hợp lệ duy nhất để thêm tham số — đúng khuôn
 * `UseScaleCalibrationHookOptions` của `ScaleCalibration`.
 */
export interface UseCadBranchConfirmOptions {
  readonly projectId: string;
  readonly floorId: string;
  readonly roles?: readonly string[];
  /** Điều hướng ra khỏi màn. */
  readonly onNavigate?: (path: string) => void;
  /** Ép panel ánh xạ thu gọn — cho story và test muốn một câu trả lời cố định. */
  readonly forceMappingPanelCollapsed?: boolean;
}

/** Kiểu trả về của `useCadBranchConfirm` — worker L2-A trả đúng kiểu này. */
export interface UseCadBranchConfirmResult extends CadBranchConfirmProps {
  /** Nhánh cuối cùng người dùng đã chốt. `null` cho tới khi hộp thoại đóng. */
  readonly resolvedBranch: CadBranchChoice | null;
}
