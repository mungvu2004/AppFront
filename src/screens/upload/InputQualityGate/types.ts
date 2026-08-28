/**
 * Hợp đồng props của màn Cổng chất lượng đầu vào — nửa "view" của mục D.
 *
 * File này là API công khai giữa người viết hook (`useInputQualityGate.ts`) và
 * người viết view (`InputQualityGate.tsx` + ba phần con). View không được nhập
 * `src/api`, `src/store`, `src/domain` hay `src/lib/http` (R-60), nên mọi thứ ở
 * đây đã **được quyết xong và viết xong**:
 *
 * - Mọi chuỗi người đọc đã là tiếng Việt có dấu và **đã định dạng sẵn** (A15).
 *   `InputQualityMetricModel.valueText`, `InputQualityForecast.text`, mọi câu
 *   trong `InputQualityFindingModel` — không con số thô nào còn phải làm tròn
 *   hay ghép câu trong view.
 * - Mọi vùng ảnh mà một chỉ số hay một phát hiện neo vào là **tỉ lệ 0..1** của
 *   khung ảnh ({@link InputQualityRegion}), không phải toạ độ pixel — view chỉ
 *   nhân với kích thước đã render, không tính lại tỉ lệ.
 * - {@link InputQualityGateStatus} có đúng **bảy** giá trị của A11. Không nhánh
 *   thứ tám, không `null` thay cho một nhánh.
 *
 * ## Vì sao `'good'` không map sang `'verified'`
 *
 * Xanh `'verified'` của {@link ViewStatusCode} chỉ đánh dấu việc **người duyệt**
 * đã làm (A5). Mức chất lượng `'good'` ở đây là kết quả một phép đo tự động —
 * độ phân giải đủ, độ nghiêng thấp — không ai xác nhận nó cả. Vì vậy mọi chỗ
 * hook cần gắn `statusCode` cho một chỉ số hay một phát hiện ở mức `'good'` thì
 * dùng `'neutral'`, không bao giờ `'verified'`. Xem thêm ghi chú tại từng trường
 * bên dưới.
 */

import type { ViewStatusCode } from '@/lib/viewmodel/types';

/* -------------------------------------------------------------------------- */
/* Mức chất lượng và loại chỉ số.                                              */
/* -------------------------------------------------------------------------- */

/** Ba mức duy nhất một phép đo chất lượng có thể ở — Tốt / Cần chú ý / Kém. */
export type QualityLevel = 'good' | 'attention' | 'poor';

/** Bốn tầng đo được của một bản vẽ đầu vào. */
export type QualityMetricId = 'resolution' | 'skew' | 'contrast' | 'noise';

/* -------------------------------------------------------------------------- */
/* Vùng ảnh mà một phát hiện neo vào.                                          */
/* -------------------------------------------------------------------------- */

/**
 * Một vùng trên khung ảnh, theo **tỉ lệ 0..1** của chiều rộng/cao khung — không
 * phải pixel, nên vùng vẫn đúng chỗ khi khung được co giãn responsive.
 *
 * Mọi phát hiện (`InputQualityFindingModel.regionId`) và mọi chỉ số muốn chỉ
 * vào ảnh (`InputQualityMetricModel.regionId`) đều trỏ tới `id` của một vùng
 * trong `InputQualityImageModel.regions` — không phát hiện nào được phép nói
 * tới một vùng không tồn tại trong danh sách đó.
 */
export interface InputQualityRegion {
  readonly id: string;
  readonly xRatio: number;
  readonly yRatio: number;
  readonly widthRatio: number;
  readonly heightRatio: number;
  /** Góc xoay của khung vùng, độ. Vắng mặt nghĩa là vùng không xoay. */
  readonly rotationDeg?: number;
  /**
   * Mức của vấn đề vùng này khoanh — đặc tả bắt viền vẽ theo mức: viền mức vi
   * phạm quanh góc bị cắt, viền mức cần chú ý quanh vùng mờ.
   *
   * Nằm ở đây chứ không ở phát hiện vì cột trái **chỉ** nhận `image`
   * (`InputQualityImagePanelProps`): không có trường này thì panel ảnh không
   * biết tô viền màu gì, và đó là thứ duy nhất giữ lời hứa "mọi phát hiện phải
   * neo vào đúng vùng ảnh nó nói tới" ở phía hình.
   */
  readonly level: QualityLevel;
  /**
   * Câu tiếng Việt nói vùng này là vấn đề gì, cho `aria-label`.
   *
   * A12 nói bàn phím là đường đi hạng nhất: một khung màu không có tên là một
   * khung mà người dùng trình đọc màn hình không bao giờ biết tới. Hook điền
   * câu này; view chỉ in ra.
   */
  readonly label: string;
}

/** Một góc kéo được của chế độ "chọn bốn góc" (`onDragCorner`). */
export interface InputQualityCorner {
  readonly id: string;
  readonly xRatio: number;
  readonly yRatio: number;
}

/** Đường thẳng vẽ độ nghiêng đo được lên ảnh, hai đầu mút theo tỉ lệ khung. */
export interface InputQualitySkewLine {
  readonly startXRatio: number;
  readonly startYRatio: number;
  readonly endXRatio: number;
  readonly endYRatio: number;
  /** Góc nghiêng, đã định dạng — ví dụ `"1,8°"`. */
  readonly angleLabel: string;
}

/** Thanh trượt "trước / sau" khi đã có một lượt chỉnh (làm thẳng, cắt góc). */
export interface InputQualityComparisonModel {
  readonly isVisible: boolean;
  /** 0..1 — phần ảnh "sau" lộ ra tính từ mép trái. */
  readonly revealRatio: number;
}

/* -------------------------------------------------------------------------- */
/* Một chỉ số đo được.                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Một trong bốn tầng đo — độ phân giải, độ nghiêng, độ tương phản, nhiễu.
 *
 * `statusCode` chỉ chọn token màu (A1); nó **không** được là `'verified'` khi
 * `level === 'good'` — xem ghi chú đầu file. `regionId` là `null` khi chỉ số
 * không neo vào một vùng ảnh cụ thể (ví dụ độ phân giải là thuộc tính của cả
 * tấm ảnh, không của một góc).
 */
export interface InputQualityMetricModel {
  readonly id: QualityMetricId;
  /** Tiếng Việt, viết thường kiểu câu (A6) — `"độ phân giải"`. */
  readonly label: string;
  /** Đã định dạng sẵn — `"312 dpi"`, `"1,8°"`. View không tính lại. */
  readonly valueText: string;
  readonly level: QualityLevel;
  readonly statusCode: ViewStatusCode;
  /** Lời khuyên đi kèm khi mức không phải `'good'`. `null` khi không có gì để nói thêm. */
  readonly recommendation: string | null;
  readonly regionId: string | null;
}

/* -------------------------------------------------------------------------- */
/* Một phát hiện.                                                             */
/* -------------------------------------------------------------------------- */

/** Hành động sửa nhanh mà một phát hiện có thể đề nghị. `null` khi chỉ để đọc. */
export interface InputQualityFindingAction {
  readonly label: string;
  readonly kind: 'straighten' | 'pickCorners';
}

/**
 * Một phát hiện cần người dùng để mắt tới — luôn kèm câu giải thích hậu quả,
 * không bao giờ chỉ là một mã lỗi đứng một mình (mục [CẤM TUYỆT ĐỐI]).
 *
 * `regionId` không phải optional: một phát hiện luôn neo vào đúng một vùng ảnh
 * nó nói tới. `isResolved` bật lên sau khi người dùng đã làm theo `action`
 * (hoặc tự thấy không cần) — phát hiện không biến mất khỏi `findings`, nó chỉ
 * được đánh dấu, để `remainingFindingCount` của {@link InputQualityGateModel}
 * đếm đúng số còn lại.
 */
export interface InputQualityFindingModel {
  readonly id: string;
  readonly level: QualityLevel;
  readonly statusCode: ViewStatusCode;
  readonly title: string;
  /** Câu nói rõ hậu quả nếu bỏ qua — không bao giờ vắng mặt cạnh một mã lỗi. */
  readonly consequence: string;
  readonly action: InputQualityFindingAction | null;
  readonly regionId: string;
  readonly isResolved: boolean;
}

/* -------------------------------------------------------------------------- */
/* Danh sách tầng và dự báo.                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Một hàng trong danh sách tầng của báo cáo.
 *
 * `level` là `null` khi `isMeasured` là `false` — chưa đo thì chưa có mức để
 * nói, và view không được tự suy ra một mức mặc định.
 */
export interface InputQualityFloorRow {
  readonly id: string;
  readonly label: string;
  readonly isActive: boolean;
  readonly isMeasured: boolean;
  readonly level: QualityLevel | null;
  /** Đã định dạng sẵn — `"2 phát hiện cần chú ý"`, `"chưa đo"`. */
  readonly summaryText: string;
}

/** Câu dự báo độ tin cậy, đã ghép số sẵn — `"Dự kiến độ tin cậy trung bình 0,82"`. */
export interface InputQualityForecast {
  readonly text: string;
}

/* -------------------------------------------------------------------------- */
/* Khung ảnh.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Mọi thứ panel ảnh cần để vẽ — ảnh, đường nghiêng, các vùng, và trạng thái
 * tương tác (vùng đang tô sáng, góc đang kéo, thanh so sánh).
 *
 * `corners` là `null` ngoài chế độ "chọn bốn góc"; khi khác `null` thì luôn có
 * đúng bốn phần tử — hook chịu trách nhiệm giữ bất biến đó, view chỉ vẽ.
 */
export interface InputQualityImageModel {
  readonly src: string;
  readonly altText: string;
  readonly skewLine: InputQualitySkewLine | null;
  readonly regions: readonly InputQualityRegion[];
  /** Vùng đang được tô sáng — đến từ hover trên chỉ số, phát hiện, hoặc chính ảnh. */
  readonly highlightedRegionId: string | null;
  readonly rotationDeg: number;
  readonly corners: readonly InputQualityCorner[] | null;
  readonly comparison: InputQualityComparisonModel | null;
}

/* -------------------------------------------------------------------------- */
/* Chân trang.                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Mọi chữ và mọi cờ của chân trang.
 *
 * Cùng lý lẽ với `FloorUploadFooterModel.canSubmit` (mục [CẤM TUYỆT ĐỐI]:
 * "Không chặn cứng người dùng"): `canContinue === false` **không** có nghĩa
 * view vô hiệu hoá nút chính. Nút vẫn bấm được; bấm lúc `false` là lúc
 * `requiresAcknowledgement`/`isAcknowledged` (hoặc phát hiện còn treo) cần
 * được cảnh báo có ý thức, không phải bị khoá âm thầm.
 *
 * `areActionsHidden` đúng khi và chỉ khi màn ở trạng thái thứ sáu —
 * `'forbidden'`: không quyền thì hai nút hành động (chính và phụ) biến mất
 * hoàn toàn khỏi chân trang, không phải chỉ mờ đi.
 */
export interface InputQualityFooterModel {
  readonly canContinue: boolean;
  readonly requiresAcknowledgement: boolean;
  readonly isAcknowledged: boolean;
  readonly acknowledgementLabel: string;
  readonly primaryLabel: string;
  readonly secondaryLabel: string;
  readonly areActionsHidden: boolean;
}

/* -------------------------------------------------------------------------- */
/* Toàn màn.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Đúng bảy trạng thái của A11 — màn trắng là thất bại duy nhất nó tồn tại để
 * chặn. `'ready'` đứng ở vị trí "thành công" của bậc thang bảy trạng thái.
 */
export type InputQualityGateStatus =
  | 'empty'
  | 'loading'
  | 'partial'
  | 'error'
  | 'ready'
  | 'forbidden'
  | 'collapsed';

/**
 * Mọi thứ view vẽ.
 *
 * Bất biến đi kèm, cùng khuôn `FloorUploadModel`:
 *
 * 1. `errorMessage !== null` ⟺ `status === 'error'`.
 * 2. `status === 'loading'` ⇒ `metrics`, `findings`, `floors` đều rỗng.
 * 3. `status === 'empty'` ⟺ không phát hiện nào tồn tại (`findings` rỗng) —
 *    view vẽ đúng một thẻ đạt duy nhất, câu của nó nằm ở `passNotice`.
 * 4. `status === 'partial'` ⟺ chưa đủ bốn tầng đo (`metrics.length < 4`) hoặc
 *    còn tầng đang đo; câu báo còn thiếu bao nhiêu nằm ở `partialNotice`.
 * 5. `remainingFindingCount` đếm phần tử `findings` có `isResolved === false`.
 * 6. `passNotice !== null` chỉ khi `status === 'empty'`; `partialNotice !==
 *    null` chỉ khi `status === 'partial'`.
 */
export interface InputQualityGateModel {
  readonly status: InputQualityGateStatus;
  readonly image: InputQualityImageModel;
  readonly metrics: readonly InputQualityMetricModel[];
  readonly forecast: InputQualityForecast;
  readonly findings: readonly InputQualityFindingModel[];
  readonly floors: readonly InputQualityFloorRow[];
  readonly footer: InputQualityFooterModel;
  /** Lỗi đọc phép đo chất lượng. `null` ở mọi trạng thái khác `'error'`. */
  readonly errorMessage: string | null;
  readonly partialNotice: string | null;
  readonly remainingFindingCount: number;
  readonly passNotice: string | null;
}

/* -------------------------------------------------------------------------- */
/* Hành động.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Mọi hàm view gọi. Không hàm nào trả về gì: view bắn sự kiện, hook quyết
 * định — cùng lý lẽ với `FloorUploadActions`.
 */
export interface InputQualityGateActions {
  /** Tô sáng vùng ảnh tương ứng khi rê chuột qua một chỉ số hoặc một phát hiện. */
  readonly onHoverRegion: (regionId: string | null) => void;
  readonly onHoverFinding: (findingId: string | null) => void;
  readonly onSelectFloor: (floorId: string) => void;
  /** Bấm nút "làm thẳng" — từ một thẻ chỉ số hoặc từ `action.kind === 'straighten'`. */
  readonly onStraighten: () => void;
  /** Vào chế độ chọn bốn góc — `action.kind === 'pickCorners'`. */
  readonly onPickCorners: () => void;
  readonly onDragCorner: (cornerId: string, xRatio: number, yRatio: number) => void;
  /** Kéo thanh so sánh trước/sau. */
  readonly onChangeReveal: (ratio: number) => void;
  readonly onToggleAcknowledgement: (next: boolean) => void;
  readonly onContinue: () => void;
  readonly onUploadAnother: () => void;
}

/** Mọi prop view nhận — mô hình cộng hành động (mục D). */
export interface InputQualityGateViewProps {
  readonly model: InputQualityGateModel;
  readonly actions: InputQualityGateActions;
}

/* -------------------------------------------------------------------------- */
/* Props của ba phần con. Mỗi phần chỉ nhận đúng lát cắt nó cần.               */
/* -------------------------------------------------------------------------- */

/** Props của `InputQualityGateImagePanel` — cột trái, vẽ ảnh và các vùng. */
export interface InputQualityImagePanelProps {
  readonly image: InputQualityImageModel;
  readonly actions: Pick<
    InputQualityGateActions,
    'onChangeReveal' | 'onDragCorner' | 'onHoverRegion'
  >;
}

/** Props của `InputQualityGateReportPanel` — cột phải, chỉ số + dự báo + phát hiện + tầng. */
export interface InputQualityReportPanelProps {
  readonly metrics: readonly InputQualityMetricModel[];
  readonly forecast: InputQualityForecast;
  readonly findings: readonly InputQualityFindingModel[];
  readonly floors: readonly InputQualityFloorRow[];
  readonly remainingFindingCount: number;
  readonly partialNotice: string | null;
  readonly passNotice: string | null;
  readonly actions: Pick<
    InputQualityGateActions,
    'onHoverFinding' | 'onHoverRegion' | 'onPickCorners' | 'onSelectFloor' | 'onStraighten'
  >;
}

/** Props của `InputQualityGateFooter` — chân trang, xác nhận + hai nút hành động. */
export interface InputQualityFooterProps {
  readonly footer: InputQualityFooterModel;
  readonly actions: Pick<InputQualityGateActions, 'onContinue' | 'onToggleAcknowledgement' | 'onUploadAnother'>;
}
