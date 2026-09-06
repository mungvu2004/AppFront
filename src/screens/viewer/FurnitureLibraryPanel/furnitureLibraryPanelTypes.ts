/**
 * Hợp đồng kiểu của `FurnitureLibraryPanel` — panel thư viện nội thất bên trái Viewer3D.
 *
 * Trích nguyên văn từ hợp đồng T4 (`.notes/furniture-library/contract-ui.md`, mục 3),
 * tách ra thành file anh em theo đúng khuôn `propertyInspectorTypes.ts`: hook và view
 * là hai task viết song song, nên kiểu chung phải nằm ở một chỗ cả hai cùng nhập chứ
 * không do bên nào sở hữu.
 *
 * File `.ts` thuần, không JSX. Không nhập `@/api`, `@/store`, `@/domain`, `@/lib/http`.
 */


/* -------------------------------------------------------------------------- */
/* Layout cố định — một nguồn số duy nhất (R-71), local/no-raw-number không     */
/* canh hằng số đặt tên ở đây, chỉ canh số thô ở tầng view.                     */
/* -------------------------------------------------------------------------- */

export const FURNITURE_LIBRARY_PANEL_LAYOUT = Object.freeze({
  /** Bề rộng panel trái, cố định — khớp `SIDE_PANEL_WIDTHS_PX.compact` của
   * `@/lib/motion` (280px), không phải một số 280 viết tay thứ hai. */
  panelWidthPx: 280,
  /** Dưới ngưỡng khung nhìn này, panel đổi hẳn thành tấm trượt đáy. */
  collapsedBreakpointPx: 1024,
  /** Chiều cao tấm trượt đáy ở biến thể thu gọn. */
  collapsedSheetHeightPx: 240,
  /** Cạnh vuông của một thẻ model trong lưới hai cột. */
  cardSizePx: 128,
  /** Khe giữa các thẻ trong lưới. */
  gridGapPx: 12,
  /** Bo góc thẻ. */
  cardRadiusPx: 12,
  /** Số cột cố định của lưới — không co giãn theo bề rộng. */
  gridColumns: 2,
  /** Số thẻ khung xương ở trạng thái `loading` — đúng kích thước thẻ thật. */
  loadingSkeletonCount: 8,
} as const);

/* -------------------------------------------------------------------------- */
/* Chín nhóm chip cố định, đúng thứ tự hiển thị.                                */
/* -------------------------------------------------------------------------- */

export const FURNITURE_CATEGORY_IDS = [
  'all',
  'table',
  'chair',
  'bed',
  'sofa',
  'cabinet',
  'sanitary',
  'kitchen',
  'equipment',
  'mine',
] as const;

export type FurnitureCategoryId = (typeof FURNITURE_CATEGORY_IDS)[number];

/** Nhãn tiếng Việt của từng nhóm, viết thường kiểu câu trừ khi đầu chip (A6). */
export const FURNITURE_CATEGORY_LABELS: Readonly<Record<FurnitureCategoryId, string>> = {
  all: 'Tất cả',
  table: 'Bàn',
  chair: 'Ghế',
  bed: 'Giường',
  sofa: 'Sofa',
  cabinet: 'Tủ kệ',
  sanitary: 'Thiết bị vệ sinh',
  kitchen: 'Bếp',
  equipment: 'Thiết bị kỹ thuật',
  mine: 'Của tôi',
};

/* -------------------------------------------------------------------------- */
/* Một chip nhóm — hàng cuộn ngang, KHÔNG dùng SegmentedControl/Tabs (xem mục 4).*/
/* -------------------------------------------------------------------------- */

export interface FurnitureCategoryChip {
  readonly id: FurnitureCategoryId;
  /** Nhãn đã lấy từ `FURNITURE_CATEGORY_LABELS`, hook không để view tự tra bảng. */
  readonly label: string;
  readonly isActive: boolean;
  readonly onSelect: () => void;
}

/* -------------------------------------------------------------------------- */
/* Mục "Đã phát hiện" — ghim đầu lưới.                                          */
/* -------------------------------------------------------------------------- */

export interface DetectedFurnitureGroup {
  readonly id: string;
  /** Đã định dạng sẵn (A15), ví dụ "sofa (4)" — count đã ghép vào chuỗi ở hook. */
  readonly label: string;
  /** Hành động chìm "Thay thế tất cả" của đúng lớp YOLO này. */
  readonly onReplaceAll: () => void;
}

/* -------------------------------------------------------------------------- */
/* Một thẻ model trong lưới 2 cột.                                             */
/* -------------------------------------------------------------------------- */

export type ModelThumbnailStatus = 'ready' | 'unavailable';

export interface FurnitureModelCard {
  readonly id: string;
  readonly name: string;
  /** Đơn sắc, nền `--bg-sunken` — view không tự khử màu, ảnh ĐÃ được xử lý trước khi
   * tới props (CẤM TUYỆT ĐỐI: không ảnh thật nhiều màu, không nền ca rô). */
  readonly thumbnailUrl: string | null;
  /** `unavailable` khi ảnh xem trước không dựng được — view vẽ biểu tượng thay thế
   * trung tính, KHÔNG ảnh vỡ, và bỏ qua `thumbnailUrl`. */
  readonly thumbnailStatus: ModelThumbnailStatus;
  /** Tiếng Việt, cho `alt` — `expectVietnamese` soát cả `alt`. */
  readonly thumbnailAltText: string;
  /** Đã định dạng sẵn (A15), ví dụ "1.200 × 600 × 750 mm" — CHỮ ĐỀU (tabular). */
  readonly dimensionsLabel: string;
  /** Đã định dạng sẵn qua `formatFileSize` (A15), ví dụ "4,2 MB". */
  readonly fileSizeCaption: string;
  /** Model này đã được dùng ở đâu đó trong dự án hiện tại — viên thuốc nhỏ đánh dấu. */
  readonly isUsedInProject: boolean;
  /** Model nặng hơn ngưỡng hiệu năng cho phép — xem mục 4 (R-04 KHÔNG tìm thấy). */
  readonly isHeavy: boolean;
  /** Không có quyền / trạng thái `forbidden`: thẻ vẫn xem được nhưng không kéo được. */
  readonly isLocked: boolean;
  /** `undefined` khi `isLocked` — kéo-thả không phải một callback theo nghĩa click,
   * nhưng view cần biết CÓ ĐƯỢC bắt đầu kéo hay không trước khi gắn trình xử lý kéo
   * thật (thư viện/API kéo-thả là quyết định của Lớp 2 viết view, không khai kiểu ở
   * đây — hợp đồng chỉ nói ĐƯỢC PHÉP hay KHÔNG). */
  readonly onDragStart?: (() => void) | undefined;
  /** Bấm thẻ để xem chi tiết / chèn nhanh — luôn có, kể cả khi `isLocked`. */
  readonly onSelect: () => void;
}

/* -------------------------------------------------------------------------- */
/* Hộp xem trước "Thay thế tất cả" — luôn hiện TRƯỚC khi áp bất cứ thay đổi nào. */
/* -------------------------------------------------------------------------- */

export interface ReplaceAllPreviewItem {
  readonly id: string;
  /** Ví dụ "sofa hiện tại → Sofa góc chữ L (Của tôi)" — đã định dạng sẵn. */
  readonly description: string;
}

export interface ReplaceAllPreview {
  readonly detectedGroupId: string;
  /** Nhãn nhóm để tiêu đề hộp thoại, ví dụ "Thay thế tất cả — sofa (4)". */
  readonly groupLabel: string;
  readonly items: readonly ReplaceAllPreviewItem[];
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/* -------------------------------------------------------------------------- */
/* Stagger lưới — từng thẻ nhận độ trễ ĐÃ TÍNH SẴN (mục 2D).                    */
/* -------------------------------------------------------------------------- */

/** Một thẻ cộng lịch chuyển động của riêng nó — hook đã gọi `staggerSchedule`. */
export interface FurnitureModelCardMotion {
  readonly card: FurnitureModelCard;
  readonly delayMs: number;
  readonly durationMs: number;
}

/* -------------------------------------------------------------------------- */
/* Nội dung đầy đủ của panel — dùng chung cho partial/success/forbidden.        */
/* -------------------------------------------------------------------------- */

export interface FurnitureLibraryPanelContent {
  readonly searchQuery: string;
  readonly onSearchQueryChange: (nextValue: string) => void;
  readonly categoryChips: readonly FurnitureCategoryChip[];
  /** `null` khi tầng hiện tại YOLO không phát hiện lớp nào — dải "Đã phát hiện"
   * khi đó không vẽ gì thay vì vẽ ô trống. */
  readonly detectedGroups: readonly DetectedFurnitureGroup[] | null;
  readonly cards: readonly FurnitureModelCardMotion[];
  /** `null` khi không có hộp xem trước đang mở. */
  readonly replaceAllPreview: ReplaceAllPreview | null;
  /** Nút phụ chân panel "Tải lên model" — `null` khi không có quyền (kể cả ở
   * `success`/`partial`, không chỉ ở `forbidden`: quyền và trạng thái dữ liệu là
   * hai trục độc lập). */
  readonly onUploadModel: (() => void) | null;
}

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái — discriminated union đúng nghĩa (theo khuôn PropertyInspector).*/
/* -------------------------------------------------------------------------- */

export type FurnitureLibraryEmptyVariant = 'no-match' | 'library-empty';

/** 1. Rỗng. */
export interface FurnitureLibraryPanelEmptyState {
  readonly kind: 'empty';
  readonly variant: FurnitureLibraryEmptyVariant;
  /** Chuỗi vừa tìm, nhắc lại nguyên văn — ví dụ "sofa da". Rỗng khi không gõ gì. */
  readonly searchedFor: string;
  /** `variant: 'no-match'`: liên kết "Xoá bộ lọc". `variant: 'library-empty'`:
   * KHÔNG có trường này — điều hướng sang S-38 là việc của MÀN CHA (điều hướng route,
   * ngoài phạm vi panel), panel chỉ báo `variant` để màn cha tự quyết render gì bên
   * cạnh nó; panel không tự đổi route (R-60: view không biết route). */
  readonly onClearFilters?: (() => void) | undefined;
}

/** 2. Đang tải — N thẻ khung xương đúng `cardSizePx`. */
export interface FurnitureLibraryPanelLoadingState {
  readonly kind: 'loading';
}

/** 3. Một phần — vài ảnh xem trước không dựng được (xem `ModelThumbnailStatus`). */
export interface FurnitureLibraryPanelPartialState extends FurnitureLibraryPanelContent {
  readonly kind: 'partial';
}

/** 4. Lỗi — không tải được thư viện. */
export interface FurnitureLibraryPanelErrorState {
  readonly kind: 'error';
  readonly message: string;
  readonly onRetry: () => void;
}

/** 5. Xong. */
export interface FurnitureLibraryPanelSuccessState extends FurnitureLibraryPanelContent {
  readonly kind: 'success';
}

/** 6. Không có quyền — mọi thẻ `isLocked: true`, `onUploadModel: null`, vẫn xem được. */
export interface FurnitureLibraryPanelForbiddenState extends FurnitureLibraryPanelContent {
  readonly kind: 'forbidden';
}

/** 7. Thu gọn — tấm trượt đáy cuộn ngang, dưới `collapsedBreakpointPx`. */
export interface FurnitureLibraryPanelCollapsedState extends FurnitureLibraryPanelContent {
  readonly kind: 'collapsed';
}

export type FurnitureLibraryPanelState =
  | FurnitureLibraryPanelEmptyState
  | FurnitureLibraryPanelLoadingState
  | FurnitureLibraryPanelPartialState
  | FurnitureLibraryPanelErrorState
  | FurnitureLibraryPanelSuccessState
  | FurnitureLibraryPanelForbiddenState
  | FurnitureLibraryPanelCollapsedState;

/** PHẢI khớp đúng bảy chuỗi của `SEVEN_STATES`
 * (`src/lib/testing/sevenStateScenarios.ts:26-34`). */
export type FurnitureLibraryPanelStateKind = FurnitureLibraryPanelState['kind'];

/* -------------------------------------------------------------------------- */
/* Props chính: view, hook, container (P8, cùng khuôn PropertyInspector).       */
/* -------------------------------------------------------------------------- */

/** Toàn bộ props của `FurnitureLibraryPanel.tsx` (view thuần). */
export interface FurnitureLibraryPanelProps {
  readonly state: FurnitureLibraryPanelState;
}

/** Đúng những gì `useFurnitureLibraryPanel` trả về. */
export type UseFurnitureLibraryPanelResult = FurnitureLibraryPanelProps;

/** Tuỳ chọn container truyền vào `useFurnitureLibraryPanel`. */
export interface UseFurnitureLibraryPanelOptions {
  /** Tầng đang mở — để lọc "Đã phát hiện" theo đúng tầng (YOLO chạy theo tầng). */
  readonly floorId: string;
  /** Container tự tính qua `can('manage', 'library', { roles })` — xem mục 2. */
  readonly canUploadModel: boolean;
  readonly onModelDropped: (modelId: string, targetEntityId: string | null) => void;
  readonly onUploadModel: () => void;
}

/** Props của `FurnitureLibraryPanelContainer` — thứ MỘT MÀN KHÁC truyền vào (R-73). */
export interface FurnitureLibraryPanelContainerProps {
  readonly floorId: string;
  readonly onModelDropped: (modelId: string, targetEntityId: string | null) => void;
}
