/**
 * Hợp đồng kiểu của `PropertyInspector` — mọi thứ view, hook và container dùng
 * chung, viết ra một lần ở đây.
 *
 * File `.ts` thuần: không JSX, không logic, không import từ `@/api`, `@/store`,
 * `@/domain` hay `@/lib/http` — cùng khuôn `viewerShellTypes.ts` và
 * `viewer3dTypes.ts` của hai màn 3D khác trong `src/screens/viewer`. Panel này
 * không cần biết `Wall`/`Opening`/`Room`/`Furniture` của domain là gì: mọi con
 * số người dùng đọc đã được định dạng thành CHUỖI ở tầng viewmodel trước khi
 * tới đây (bất biến A15), nên props của view chỉ còn lại chuỗi, hằng số bố cục
 * và callback thuần — không có gì trong file này phụ thuộc vào hình dạng thật
 * của đồ thị không gian.
 *
 * ## Vì sao BẢY TRẠNG THÁI là một discriminated union lồng, không phải một cờ
 * `state: string` cộng một mớ trường `| null`
 *
 * `ViewerScreenState` (vỏ 3D) là một union bảy chuỗi dùng CHUNG cho rất nhiều
 * trường độc lập — hợp lý ở đó vì vỏ luôn hiện đủ khung nhìn bất kể trạng thái.
 * `PropertyInspector` thì khác: bảy trạng thái của nó có hình dạng dữ liệu THẬT
 * SỰ khác nhau — `empty` chỉ có một câu và một gợi ý phím, `loading` không có gì
 * ngoài chính nó, còn `partial`/`error`/`success`/`forbidden` đều cần đủ
 * header + dải ảnh + các nhóm + chân panel. Gộp cả bảy vào một interface phẳng
 * với các trường `| null` sẽ cho phép một trạng thái `empty` vẫn "có" một mảng
 * `groups` rỗng nhưng hợp lệ về kiểu — sai mà trình biên dịch không bắt được.
 * Discriminated union theo đúng nghĩa (bảy interface riêng, hợp nhất bằng `|`,
 * phân biệt bằng trường `kind`) khiến việc đó thành LỖI BIÊN DỊCH: state
 * `empty` không có trường `groups` để đọc nhầm. `PropertyInspectorStateKind`
 * (suy ra từ `PropertyInspectorState['kind']`, không gõ lại bảy chuỗi) phải
 * khớp đúng bảng chữ của `SEVEN_STATES` trong
 * `src/lib/testing/sevenStateScenarios.ts` — xem đối chiếu ở cuối file.
 *
 * ## Vì sao "giá trị khác nhau" là một kiểu, không phải một cờ boolean
 *
 * {@link PropertyValue} là chỗ CẤM TUYỆT ĐỐI số 4 ("chọn nhiều không bao giờ
 * hiện một giá trị đơn gây hiểu nhầm") trở thành thật: trường `value` của một
 * dòng không bao giờ là `string` trần. Nó là `PropertyValueSingle |
 * PropertyValueMixed | PropertyValueUnavailable`, phân biệt bằng `kind`. Một
 * nơi gọi lỡ gán một chuỗi thẳng vào `row.value` là lỗi biên dịch, không phải
 * một quy ước phải nhớ.
 */

/* -------------------------------------------------------------------------- */
/* P2 — Bốn loại đối tượng.                                                    */
/* -------------------------------------------------------------------------- */

/** Bốn loại đối tượng panel này thanh tra được. */
export type ObjectKind = 'wall' | 'opening' | 'furniture' | 'room';

/** Nhãn tiếng Việt của từng loại, viết thường kiểu câu (A6) — hook viết hoa khi cần đặt đầu câu/tiêu đề. */
export const OBJECT_KIND_LABELS: Readonly<Record<ObjectKind, string>> = {
  wall: 'tường',
  opening: 'ô mở',
  furniture: 'nội thất',
  room: 'phòng',
};

/* -------------------------------------------------------------------------- */
/* P4 — Năm nhóm cố định.                                                      */
/* -------------------------------------------------------------------------- */

/** Năm nhóm cố định của panel, đúng thứ tự hiển thị từ trên xuống. */
export const PROPERTY_GROUP_IDS = [
  'geometry',
  'material',
  'relations',
  'inspection',
  'advanced',
] as const;

export type PropertyGroupId = (typeof PROPERTY_GROUP_IDS)[number];

/** Nhãn tiếng Việt của từng nhóm, theo đúng đặc tả. */
export const PROPERTY_GROUP_LABELS: Readonly<Record<PropertyGroupId, string>> = {
  geometry: 'Kích thước hình học',
  material: 'Vật liệu',
  relations: 'Quan hệ',
  inspection: 'Kiểm tra',
  advanced: 'Thông số nâng cao',
};

/**
 * Nhóm DUY NHẤT là khối gập, mặc định đóng.
 *
 * Bốn nhóm còn lại luôn giãn — view không cần đọc trường nào để biết điều đó,
 * chỉ cần so `group.id === COLLAPSIBLE_GROUP_ID`.
 */
export const COLLAPSIBLE_GROUP_ID: PropertyGroupId = 'advanced';

/* -------------------------------------------------------------------------- */
/* P3 — Ngân sách năm trường và số đo bố cục cố định.                          */
/* -------------------------------------------------------------------------- */

/**
 * CẤM TUYỆT ĐỐI số 1: không quá NĂM trường hiện ra trước khi mở khối gập.
 *
 * Xem danh sách năm trường mặc định của từng loại đối tượng ngay dưới các hằng
 * số `DEFAULT_*_FIELD_IDS`.
 */
export const DEFAULT_VISIBLE_FIELD_COUNT = 5;

/**
 * Số đo bố cục cố định của panel, bằng pixel hoặc phần trăm.
 *
 * Tập trung ở đây để CẤM TUYỆT ĐỐI số 3 ("không nhảy bố cục khi đổi loại đối
 * tượng") có một nguồn số duy nhất — view không viết số thô (`local/no-raw-number`
 * canh tầng giao diện, không canh hằng số đặt tên ở đây, cùng cách
 * `VIEWER_LAYOUT` của `viewerShellTypes.ts` đã làm).
 */
export const PROPERTY_INSPECTOR_LAYOUT = Object.freeze({
  /** Chiều cao MỖI dòng thuộc tính — cố định bất kể loại đối tượng hay control. */
  rowHeightPx: 36,
  /** Phần trăm bề rộng dành cho nhãn của một dòng — cố định, không nhảy theo control. */
  rowLabelWidthPercent: 40,
  /** Phần trăm bề rộng dành cho điều khiển của một dòng. */
  rowControlWidthPercent: 60,
  /** Dải ảnh thu nhỏ ngay dưới header, nền `--bg-sunken`. */
  thumbnailStripHeightPx: 64,
  /** Biểu tượng nét của trạng thái `empty`. */
  emptyIconPx: 32,
  /** Chiều cao mỗi thanh khung xương của trạng thái `loading` — bằng `rowHeightPx`. */
  loadingSkeletonRowHeightPx: 36,
  /** Dưới bề rộng khung nhìn này, panel co thành thẻ phụ (`collapsed` biến thể `chip`). */
  collapsedBreakpointPx: 1280,
  /** Trên di động, panel là tấm trượt từ dưới lên, cao bằng phần trăm này của màn hình. */
  collapsedSheetHeightPercent: 60,
});

/* -------------------------------------------------------------------------- */
/* P3 — Một dòng thuộc tính, kiểu chung cho mọi loại đối tượng.                */
/* -------------------------------------------------------------------------- */

/** Tám loại điều khiển một dòng có thể mang. */
export type PropertyControlType =
  | 'numeric'
  | 'select'
  | 'segmented'
  | 'toggle'
  | 'slider'
  | 'text'
  | 'readonly'
  | 'link';

/**
 * Giá trị của một dòng — KHÔNG BAO GIỜ là `string` trần.
 *
 * `single` là giá trị đã định dạng bình thường (A15). `mixed` là sentinel bắt
 * buộc khi chọn nhiều đối tượng và các mục có giá trị khác nhau — CẤM TUYỆT ĐỐI
 * số 4. `unavailable` là caption thay cho dòng trống khi một thuộc tính không
 * tồn tại ở một đối tượng (spec trạng thái `partial`), để dòng đó hiện một câu
 * giải thích thay vì một điều khiển trống không ai hiểu vì sao.
 */
export type PropertyValue =
  | { readonly kind: 'single'; readonly formatted: string }
  | { readonly kind: 'mixed' }
  | { readonly kind: 'unavailable'; readonly caption: string };

/** Một lựa chọn của điều khiển `select` hoặc `segmented`. */
export interface PropertyRowOption {
  readonly value: string;
  /** Nhãn tiếng Việt của lựa chọn, ví dụ "110 mm". */
  readonly label: string;
  /** Ô màu đi kèm lựa chọn (SegmentedControl độ dày tường) — tên biến CSS, không bao giờ mã màu (A1). */
  readonly colorToken?: string | undefined;
}

/** Mức độ của một cảnh báo tại dòng. */
export type PropertyRowWarningLevel = 'attention' | 'blocking';

/**
 * Cảnh báo hiện NGAY TẠI DÒNG mang nó.
 *
 * `blocking` là hình dạng của trạng thái `error` (P1 mục 4): giá trị bị bộ máy
 * hình học từ chối, `message` là lý do, `onRetry` là nút thử lại của đúng dòng
 * đó. `attention` là cảnh báo nhẹ hơn, không chặn gì (ví dụ giá trị gần chạm
 * giới hạn), không có `onRetry`.
 */
export interface PropertyRowWarning {
  readonly level: PropertyRowWarningLevel;
  readonly message: string;
  readonly onRetry?: (() => void) | undefined;
}

/**
 * Một dòng thuộc tính — hình dạng DUY NHẤT dùng cho cả bốn loại đối tượng.
 *
 * Các trường dành riêng cho một `controlType` (`options` cho `select`/
 * `segmented`, `isChecked` cho `toggle`, bốn trường `slider*` cho `slider`,
 * `linkedEntityId`/`onNavigate` cho `link`) đều tuỳ chọn: một dòng `numeric`
 * hay `readonly` không mang chúng.
 */
export interface PropertyRow {
  /** Ổn định qua các lần render — view dùng làm key, hook dùng làm mã lệnh. */
  readonly id: string;
  /** Nhãn tiếng Việt, viết thường kiểu câu (A6). */
  readonly label: string;
  readonly controlType: PropertyControlType;
  readonly value: PropertyValue;
  /** Đơn vị hiện sau giá trị: `mm`, `m`, `m²`, `độ`. Vắng mặt khi không có gì để viết sau giá trị. */
  readonly unit?: string | undefined;
  /** Bị khoá — không sửa được (vai chỉ xem, hoặc trạng thái `forbidden`). */
  readonly isLocked: boolean;
  readonly warning?: PropertyRowWarning | undefined;
  /** `select` | `segmented`. */
  readonly options?: readonly PropertyRowOption[] | undefined;
  /** `toggle`. */
  readonly isChecked?: boolean | undefined;
  /** `slider` — bốn trường luôn đi cùng nhau. */
  readonly sliderMin?: number | undefined;
  readonly sliderMax?: number | undefined;
  readonly sliderStep?: number | undefined;
  readonly sliderValue?: number | undefined;
  /** `link` — mã đối tượng liên kết, để hook bay camera tới (P7). */
  readonly linkedEntityId?: string | undefined;
  /** `link` — bấm liên kết quan hệ. Callback thuần; view không biết lệnh là gì (P8). */
  readonly onNavigate?: (() => void) | undefined;
  /** Mọi control sửa được (trừ `readonly`/`link`) gọi cái này khi người dùng đổi giá trị. */
  readonly onChange?: ((nextValue: string) => void) | undefined;
}

/** Một nhóm thuộc tính (một trong năm nhóm cố định của P4). */
export interface PropertyGroup {
  readonly id: PropertyGroupId;
  readonly label: string;
  readonly rows: readonly PropertyRow[];
  /** Chỉ có ý nghĩa ở nhóm `COLLAPSIBLE_GROUP_ID`; bốn nhóm còn lại bỏ qua hai trường này. */
  readonly isExpanded?: boolean | undefined;
  readonly onToggleExpanded?: (() => void) | undefined;
}

/* -------------------------------------------------------------------------- */
/* P5 — Năm trường mặc định của từng loại đối tượng.                          */
/* -------------------------------------------------------------------------- */

/**
 * Tường — đúng năm trường theo đặc tả:
 * 1. `thickness` — SegmentedControl 110/220/330, kèm ô màu (`options[].colorToken`).
 * 2. `length` — ví dụ "4.250,00 mm".
 * 3. `height` — ví dụ "3.000,00 mm".
 * 4. `wallType` — loại tường (chịu lực / ngăn / bao che).
 * 5. `isInterior` — tường nội thất hay tường bao (toggle).
 *
 * Số lượng ô mở của tường thuộc nhóm "Quan hệ", KHÔNG nằm trong năm trường này.
 */
export const DEFAULT_WALL_FIELD_IDS = [
  'thickness',
  'length',
  'height',
  'wallType',
  'isInterior',
] as const;

/**
 * Ô mở — đúng năm trường theo đặc tả:
 * 1. `width` — ví dụ "900 mm".
 * 2. `height` — ví dụ "2.200 mm".
 * 3. `sillHeight` — cao độ bậu.
 * 4. `swingDirection` — chiều mở.
 * 5. `hostWallId` — tường chủ (control `link`, xem P7).
 */
export const DEFAULT_OPENING_FIELD_IDS = [
  'width',
  'height',
  'sillHeight',
  'swingDirection',
  'hostWallId',
] as const;

/**
 * Nội thất — hai trường cố định, tối đa ba trường nữa tuỳ hạng mục để đủ
 * NĂM (`DEFAULT_VISIBLE_FIELD_COUNT`):
 * 1. `boundingSize` — kích thước bao.
 * 2. `rotation` — góc xoay.
 * 3-5. tuỳ hạng mục nội thất — hook chọn, id không cố định ở đây.
 */
export const DEFAULT_FURNITURE_FIELD_IDS = ['boundingSize', 'rotation'] as const;

/**
 * Phòng — đúng năm trường theo đặc tả:
 * 1. `name` — tên.
 * 2. `function` — công năng.
 * 3. `area` — diện tích.
 * 4. `doorCount` — số cửa.
 * 5. `windowCount` — số cửa sổ.
 */
export const DEFAULT_ROOM_FIELD_IDS = ['name', 'function', 'area', 'doorCount', 'windowCount'] as const;

/**
 * Bốn trường của khối gập "Thông số nâng cao" — giống nhau ở cả bốn loại
 * đối tượng, theo P6: lệch Z, toạ độ đầu/cuối, mã đối tượng gốc, độ tin cậy.
 */
export const ADVANCED_FIELD_IDS = [
  'zOffset',
  'startPoint',
  'endPoint',
  'sourceEntityId',
  'confidence',
] as const;

/* -------------------------------------------------------------------------- */
/* P6 — Header, dải ảnh, chân panel.                                          */
/* -------------------------------------------------------------------------- */

/** Bốn sắc thái Badge trạng thái ở header — đúng bộ ba màu trạng thái A4, cộng `neutral` cho "không có trạng thái gì". */
export type PropertyStatusBadgeTone = 'verified' | 'attention' | 'violation' | 'neutral';

/** Badge trạng thái ở header. `verified` chỉ được đặt bởi hành động "Duyệt" của người dùng (A5), không bao giờ bởi AI. */
export interface PropertyStatusBadge {
  readonly label: string;
  readonly tone: PropertyStatusBadgeTone;
}

/** Đầu panel: h3 loại đối tượng, mã mono-lg, Badge trạng thái, nút khuôn, nút đóng. */
export interface PropertyInspectorHeader {
  readonly objectKind: ObjectKind;
  /** Tiêu đề h3, ví dụ "Tường" hoặc "3 tường" khi chọn nhiều — đã định dạng, số nhiều tính sẵn. */
  readonly objectKindLabel: string;
  /** Mã đối tượng, font mono cỡ lớn, ví dụ "W-014". */
  readonly objectCode: string;
  readonly statusBadge: PropertyStatusBadge;
  /** Số đối tượng đang chọn — 1 ở trạng thái `success`/`error`/`forbidden`, ≥ 1 ở `partial`. */
  readonly selectionCount: number;
  /** Nút khuôn — sao chép bộ thuộc tính này làm khuôn mẫu. */
  readonly onCopyAsTemplate: () => void;
  /** Nút đóng panel. */
  readonly onClose: () => void;
}

/** Một ảnh trong dải ảnh thu nhỏ dưới header. */
export interface PropertyThumbnail {
  readonly id: string;
  readonly imageUrl: string;
  /** Tiếng Việt, cho `alt` — bắt buộc vì `expectVietnamese` soát cả thuộc tính `alt`. */
  readonly altText: string;
}

/** Chân panel: nút chính "Duyệt", nút chìm "Bỏ qua", caption ai sửa lần cuối. */
export interface PropertyInspectorFooter {
  readonly onApprove: () => void;
  readonly onSkip: () => void;
  /** Đã định dạng sẵn (A15), ví dụ "Đã sửa lúc 14:32 bởi Minh Anh". */
  readonly lastEditedCaption: string;
}

/**
 * Nội dung đầy đủ của panel — dùng chung cho bốn trạng thái `partial`,
 * `error`, `success`, `forbidden` (bốn trạng thái duy nhất có một đối tượng
 * đang chọn để hiện thuộc tính của nó).
 */
export interface PropertyInspectorPanelContent {
  readonly header: PropertyInspectorHeader;
  /** Rỗng khi không có ảnh nào để hiện — dải ảnh khi đó không vẽ gì thay vì vẽ ô trống. */
  readonly thumbnails: readonly PropertyThumbnail[];
  readonly groups: readonly PropertyGroup[];
  readonly footer: PropertyInspectorFooter;
}

/* -------------------------------------------------------------------------- */
/* P1 — Bảy trạng thái, một discriminated union đúng nghĩa.                    */
/* -------------------------------------------------------------------------- */

/** 1. Chưa chọn gì: biểu tượng nét 32, một câu đầy, gợi ý phím Tab để duyệt vòng qua các đối tượng. */
export interface PropertyInspectorEmptyState {
  readonly kind: 'empty';
  readonly message: string;
  /** Câu gợi ý nhắc phím Tab — "Tab" viết hoa là ngoại lệ A6 cho tên phím. */
  readonly tabHint: string;
}

/** 2. Đang tải: dòng khung xương cao `PROPERTY_INSPECTOR_LAYOUT.loadingSkeletonRowHeightPx`. Không cần dữ liệu nào khác. */
export interface PropertyInspectorLoadingState {
  readonly kind: 'loading';
}

/**
 * 3. Một phần: chọn nhiều đối tượng, HOẶC một số thuộc tính không tồn tại ở
 * một đối tượng cũ (những dòng đó dùng `PropertyValue` biến thể `unavailable`
 * thay vì dòng trống).
 */
export interface PropertyInspectorPartialState extends PropertyInspectorPanelContent {
  readonly kind: 'partial';
}

/**
 * 4. Lỗi: một giá trị vừa sửa bị bộ máy hình học từ chối. Lý do và nút thử lại
 * hiện NGAY TẠI DÒNG gây lỗi (`groups[].rows[].warning`, mức `blocking`);
 * `erroredRowId` chỉ để view cuộn/focus đúng dòng đó mà không phải dò cả cây
 * `groups`. Giá trị của dòng đã quay về giá trị cũ trước khi tới view.
 */
export interface PropertyInspectorErrorState extends PropertyInspectorPanelContent {
  readonly kind: 'error';
  readonly erroredRowId: string;
}

/** 5. Xong: một đối tượng, mọi trường đều có giá trị, không cảnh báo chặn. */
export interface PropertyInspectorSuccessState extends PropertyInspectorPanelContent {
  readonly kind: 'success';
}

/**
 * 6. Không có quyền: mọi dòng chỉ đọc (`isLocked: true` ở mọi `PropertyRow`),
 * không viền — nhưng vẫn sao chép được, nên không phải `disabled` thật.
 */
export interface PropertyInspectorForbiddenState extends PropertyInspectorPanelContent {
  readonly kind: 'forbidden';
}

/** Panel co lại thành gì dưới 1280px hoặc trên di động. */
export type PropertyInspectorCollapsedVariant = 'chip' | 'sheet';

/**
 * 7. Thu gọn: dưới `PROPERTY_INSPECTOR_LAYOUT.collapsedBreakpointPx` panel
 * thành thẻ phụ (`chip`); trên di động thành tấm trượt từ dưới lên, cao
 * `PROPERTY_INSPECTOR_LAYOUT.collapsedSheetHeightPercent` (`sheet`).
 */
export interface PropertyInspectorCollapsedState {
  readonly kind: 'collapsed';
  readonly variant: PropertyInspectorCollapsedVariant;
  /** Nhãn tóm tắt trên thẻ phụ / tay cầm tấm trượt, ví dụ "Tường W-014". */
  readonly summaryLabel: string;
  readonly onExpand: () => void;
}

/**
 * Bảy trạng thái, đúng một trong bảy interface trên — không trường nào của một
 * trạng thái lọt sang trạng thái khác.
 */
export type PropertyInspectorState =
  | PropertyInspectorEmptyState
  | PropertyInspectorLoadingState
  | PropertyInspectorPartialState
  | PropertyInspectorErrorState
  | PropertyInspectorSuccessState
  | PropertyInspectorForbiddenState
  | PropertyInspectorCollapsedState;

/**
 * Suy ra từ chính bảy interface trên, không gõ lại bảy chuỗi — không có cách
 * nào để bảng này trôi khỏi `PropertyInspectorState`.
 *
 * PHẢI khớp đúng bảy chuỗi của `SEVEN_STATES`
 * (`src/lib/testing/sevenStateScenarios.ts`): `'empty' | 'loading' | 'partial'
 * | 'error' | 'success' | 'forbidden' | 'collapsed'`. Bài kiểm của T8 đối
 * chiếu hai bảng bằng `expectSevenStates`.
 */
export type PropertyInspectorStateKind = PropertyInspectorState['kind'];

/* -------------------------------------------------------------------------- */
/* P8 — Props chính: view, hook, tuỳ chọn hook, container.                     */
/* -------------------------------------------------------------------------- */

/**
 * Toàn bộ props của `PropertyInspector.tsx`.
 *
 * Đúng MỘT trường: mọi dữ liệu và callback của cả bảy trạng thái đã nằm trong
 * chính `state` (xem lý do ở docblock đầu file). View không nhận đối tượng
 * domain, không nhận store — chỉ đọc `state.kind` rồi vẽ đúng nhánh.
 */
export interface PropertyInspectorProps {
  readonly state: PropertyInspectorState;
  /**
   * Dòng vừa được ghi nhận, để view nháy nền đúng dòng đó; `null` khi không có.
   *
   * Nâng lên đây ở bước ráp (T8) đúng như docblock của
   * {@link UsePropertyInspectorResult} đã lường trước: hook sinh ra tín hiệu
   * này, `FieldRow` có sẵn `flash` để tiêu thụ nó, và trước khi nâng thì hai
   * đầu không nối được với nhau — hook trả một trường mà view không có chỗ
   * nhận. Thời lượng nháy KHÔNG đi kèm: `FieldRow` đã nháy đúng nhịp `slow`
   * (340 ms) của thang chuyển động, nên một con số thứ hai chạy dọc props chỉ
   * là một chỗ nữa để hai bên trôi khỏi nhau (mục B).
   */
  readonly recentlyCommittedRowId?: string | null | undefined;
}

/**
 * Đúng những gì `usePropertyInspector` trả về.
 *
 * Bằng `PropertyInspectorProps` — cả `state` lẫn `recentlyCommittedRowId` — nên
 * `<PropertyInspector {...usePropertyInspector(options)} />` là một dòng đúng
 * kiểu, không dư trường nào. Tách thành alias riêng (thay vì dùng thẳng
 * `PropertyInspectorProps` ở chữ ký hook) để chỗ hook thêm một trường
 * chỉ-hook-cần sau này không phải đổi tên kiểu tại mọi nơi gọi.
 */
export type UsePropertyInspectorResult = PropertyInspectorProps;

/** Tuỳ chọn container truyền vào `usePropertyInspector`. */
export interface UsePropertyInspectorOptions {
  /** `null` khi chưa chọn gì — hook trả `kind: 'empty'`. */
  readonly selectedEntityId: string | null;
  /** Rỗng hoặc `[selectedEntityId]` khi chọn một; nhiều phần tử khi chọn nhiều. */
  readonly selectedEntityIds: readonly string[];
  /** Vai hiện tại có sửa được không — `false` buộc hook trả `kind: 'forbidden'` khi có chọn. */
  readonly canEdit: boolean;
  /** Callback ra ngoài — hook gọi khi người dùng bấm một liên kết quan hệ (P7). */
  readonly onNavigateToObject: (entityId: string) => void;
  /** Callback ra ngoài — hook gọi khi người dùng bấm nút sang màn luật. */
  readonly onOpenRuleScreen: (entityId: string) => void;
  /** Callback ra ngoài — hook gọi khi panel cần đóng (nút đóng, Esc, A12). */
  readonly onDismiss: () => void;
}

/**
 * Props của `PropertyInspectorContainer` — thứ MỘT MÀN KHÁC truyền vào để mở
 * panel này mà không phải viết thêm logic (R-73).
 *
 * Không có `canEdit`: container tự đọc vai người xem, màn gọi nó không cần
 * biết chuyện đó.
 */
export interface PropertyInspectorContainerProps {
  readonly selectedEntityId: string | null;
  readonly selectedEntityIds: readonly string[];
  readonly onDismiss: () => void;
  readonly onNavigateToObject: (entityId: string) => void;
  readonly onOpenRuleScreen: (entityId: string) => void;
}
