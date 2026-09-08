/**
 * `S-25` — thư viện model dùng chung. **Hợp đồng đông cứng** của bốn worker viết song song.
 *
 * Cùng vai trò với `src/screens/export/VersionHistory/types.ts`: container, view, hook và bộ
 * test cùng nhập từ đây, không nơi nào chép lại hình dạng. Sửa file này là sửa hợp đồng của
 * cả bốn — nên nó được chốt TRƯỚC khi bốn worker bắt đầu, không phải trong lúc họ viết.
 *
 * ## Màn này ship ít hơn đặc tả, và đó là kết luận đo được chứ không phải cắt bớt
 *
 * Lớp khảo sát đã grep từng mục `[LOGIC ĐÃ CÓ]` của đặc tả. Kết quả: **23 mục NOT FOUND**.
 * Ba cái đắt nhất, mỗi cái đã tự kiểm lại:
 *
 * 1. **Không có đường tải model lên, ở bất kỳ tầng nào.** `LibraryApi` chỉ có `list`/`read`
 *    (`src/api/client.ts:399`); `createUploadTask` đòi `api: DrawingsApi` + `floorId` +
 *    `projectId` (`src/lib/upload/uploadTask.ts:144-150`) nên nó là đường tải BẢN VẼ lên một
 *    tầng, không nhận model thư viện; và `.glb` không nằm trong `ACCEPTED_UPLOAD_EXTENSIONS`
 *    (`src/lib/upload/validate.ts:53`).
 * 2. **`LibraryItem` không có** `uploadedBy`, `uploadedAt`, `status`, `usedByProjectCount`,
 *    `aliases` (`src/api/schemas/library.ts:124-153`). Bốn cột và hai mục của panel chi tiết
 *    mà đặc tả liệt kê không có nguồn nào.
 * 3. **`mergeByMaterial` không giảm tam giác** — đo thật, 60 → 60, chỉ gộp draw call; và áp
 *    lên một model vừa nạp qua `AssetService` (chưa `tagPart`) thì nó bỏ qua toàn bộ,
 *    `skipped=5`, lý do `noPartData`. Nút "tối ưu lưới" không có gì để gọi.
 *
 * Theo R-69, thiếu logic thì DỪNG và hỏi, không tự chế. Người duyệt đã chọn: cổng năng lực
 * báo `false`, và **affordance tương ứng RỜI KHỎI DOM** — không `disabled`, không tooltip
 * "sắp có", không cột rỗng. Khi prompt logic bổ sung endpoint, đúng một chỗ trong file này
 * đổi từ `false` sang `true`.
 *
 * ## A15: định dạng số xảy ra ở viewmodel, không ở view
 *
 * Mọi trường số mà người đọc nhìn thấy đều đã là `string` trong model dưới đây
 * (`triangleCountLabel`, `fileSizeLabel`, `boundsLabel`). View chỉ đặt chúng vào ô, không
 * `toFixed`, không `toLocaleString`, không quy đổi đơn vị — `local/no-raw-number` chặn ở mức
 * `error`. Dấu thập phân là dấu phẩy vì `src/lib/format` đã quyết định thế.
 */

import type { LibraryFilterId, LibraryItem } from '@/api/client';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';

/* ── Cột, sắp xếp, chế độ xem ─────────────────────────────────────────────────────────── */

/**
 * Năm cột sắp xếp được. Đúng bằng số cột CÓ NGUỒN THẬT trong `LibraryItem`.
 *
 * Đặc tả liệt kê mười cột; năm cái còn lại (`Số dự án đang dùng`, `Người tải lên`, `Ngày`,
 * `Trạng thái`) không có trường nào trong schema, nên chúng không có khoá sắp xếp — không
 * phải vì quên, mà vì không có gì để sắp.
 */
export type ModelLibrarySortKey = 'name' | 'group' | 'bounds' | 'triangles' | 'fileSize';

export type SortDirection = 'asc' | 'desc';

/** Bảng là mặc định. Lưới là tuỳ chọn — đây là trang quản lý dữ liệu, không phải panel kéo thả. */
export type ModelLibraryViewMode = 'table' | 'grid';

/* ── Một hàng ─────────────────────────────────────────────────────────────────────────── */

/**
 * Một model, đã định dạng sẵn cho mắt người.
 *
 * Ba nhãn `…Label` là chuỗi vì A15; ba số thô đi kèm để `Table.Root` sắp xếp mà không phải
 * phân tích ngược chuỗi đã định dạng.
 */
export interface ModelLibraryRowModel {
  readonly id: string;
  readonly name: string;
  /** Nhãn tiếng Việt của `LibraryItem.group`, không phải mã nhóm. */
  readonly groupLabel: string;
  /** "1,20 × 0,80 × 0,45 m" — qua `formatLength`, không tự quy đổi mm→m. */
  readonly boundsLabel: string;
  /** Chữ đều. Qua `formatNumber`. */
  readonly triangleCountLabel: string;
  /** Chữ đều. Qua `formatFileSize`. */
  readonly fileSizeLabel: string;
  /** Số thô, chỉ để sắp xếp. Không bao giờ render thẳng. */
  readonly triangleCount: number;
  /** Số thô, chỉ để sắp xếp. Không bao giờ render thẳng. */
  readonly fileSizeBytes: number;
  /** Số thô, chỉ để sắp xếp. Không bao giờ render thẳng. */
  readonly boundsVolumeMm3: number;
  readonly previewUrl: string | null;
  /**
   * Ảnh xem trước 32px đã hỏng ⇒ hiện biểu tượng thay thế trung tính + nút thử lại
   * (trạng thái 3), **không phải ảnh vỡ**.
   */
  readonly isPreviewBroken: boolean;
  /**
   * Vượt ngân sách tam giác ⇒ chấm "cần chú ý" + badge "Nặng". Cảnh báo, KHÔNG chặn.
   *
   * **Chỉ có MỘT mức, không phải hai.** Đặc tả đòi ngưỡng mềm và ngưỡng cứng, nhưng
   * `SCENE_BUDGET.maxTriangles = 900_000` là hằng duy nhất và `checkBudget` không phân
   * nhánh theo `DeviceProfile` cho tam giác (chỉ sàn khung hình mới phân nhánh) — đo tại
   * `src/lib/three/perf/budget.ts:92,219-247`. Repo không có `maxTrianglesPerModel`. Bịa
   * một ngưỡng mềm là đúng thứ R-71 cấm, nên chấm thứ hai không tồn tại.
   */
  readonly isHeavy: boolean;
  /** Câu khuyến nghị khi `isHeavy`, lấy từ `BudgetWarning.message`. Không tự viết số vào câu. */
  readonly heavyAdvice: string | null;
}

/* ── Dải tóm tắt ──────────────────────────────────────────────────────────────────────── */

/** Ba con số trên đầu bảng. Tất cả đã định dạng (A15). */
export interface ModelLibrarySummaryModel {
  readonly totalCountLabel: string;
  readonly totalSizeLabel: string;
  readonly heavyCountLabel: string;
  /** `true` khi không model nào vượt ngưỡng — dải vẫn hiện, chỉ đổi giọng. */
  readonly isAllWithinBudget: boolean;
}

/* ── Panel chi tiết + xem trước 3D ────────────────────────────────────────────────────── */

/** Vòng đời khung xem trước. `idle` là lúc panel đóng — KHÔNG nạp gì. */
export type ModelPreviewState = 'idle' | 'loading' | 'ready' | 'failed';

/**
 * Khung xem trước 3D của MỘT model.
 *
 * Hai luật cứng của đặc tả, cả hai nằm ở hook chứ không ở view:
 * - **Không nạp xem trước cho mọi hàng cùng lúc.** Chỉ nạp khi panel chi tiết mở.
 * - **Dọn bằng R-05 khi đóng** (`disposeFloor` + `ResourceLedger`), nếu không thì mở/đóng
 *   mười model là mười lần rò bộ nhớ GPU.
 */
export interface ModelPreviewModel {
  readonly state: ModelPreviewState;
  /**
   * Số tam giác ĐO LẠI bằng `measureScene` sau khi model nạp xong, chữ đều.
   *
   * Khác `ModelLibraryRowModel.triangleCountLabel`, vốn là con số server khai. Hai số lệch
   * nhau là thông tin thật đáng hiện, không phải lỗi.
   */
  readonly measuredTriangleCountLabel: string | null;
  readonly errorMessage: string | null;
  /** Câu giải thích vì sao khung không tự quay — xem `ModelLibraryCapabilities.canAutoSpin`. */
  readonly autoSpinNote: string | null;
}

/** Panel phải 400px. Dưới 1024 nó thành lớp phủ (trạng thái 7). */
export interface ModelLibraryDetailModel {
  readonly item: ModelLibraryRowModel;
  /** FieldRow chữ đều: kích thước bao, số tam giác, dung lượng, nhóm. */
  readonly fields: readonly ModelLibraryFieldModel[];
  readonly preview: ModelPreviewModel;
}

export interface ModelLibraryFieldModel {
  readonly label: string;
  readonly value: string;
  /** `true` ⇒ ô giá trị mang `font-mono tabular-nums`. */
  readonly isNumeric: boolean;
}

/* ── Cổng năng lực ────────────────────────────────────────────────────────────────────── */

/**
 * Khả năng CÓ THẬT ở tầng logic, tính từ hợp đồng của repo hôm nay.
 *
 * Trường nào `false` thì affordance tương ứng **rời khỏi DOM** — không disable, không TODO,
 * không nút gọi vào chỗ trống (R-69). Đây là nơi DUY NHẤT giữ những phán quyết đó; view và
 * hook đọc từ đây chứ không tự hỏi lại "có endpoint chưa".
 */
export interface ModelLibraryCapabilities {
  /** Xem trước 3D một model. `true` — `createAssetService` + `measureScene` + `disposeFloor` có thật. */
  readonly canPreview3d: boolean;
  /** Cảnh báo model nặng. `true` — `checkBudget` + `SCENE_BUDGET` có thật. */
  readonly canFlagHeavy: boolean;
  /** Người dùng có `library.manage`. Trạng thái 6 đọc trường này. */
  readonly canManage: boolean;
  /**
   * Tải model `.glb` lên. **`false` trong bản này** — không có đường nào ở bất kỳ tầng nào;
   * xem mục 1 đầu file. Vùng thả tệp và hàng tiến độ không được render.
   */
  readonly canUploadModel: boolean;
  /** `false` — `LibraryApi` không có phương thức ghi. */
  readonly canChangeGroup: boolean;
  /** `false` — cùng lý do. Kèm theo: không có nguồn để "đề nghị model thay thế". */
  readonly canDeprecate: boolean;
  /** `false` — cùng lý do. Kéo theo: không hộp thoại xoá, không vé hoàn tác xoá. */
  readonly canDelete: boolean;
  /** `false` — `mergeByMaterial` không giảm tam giác VÀ không có đường lưu bản đã tối ưu. */
  readonly canOptimizeMesh: boolean;
  /** `false` — không trường nào đếm dự án đang dùng một model. */
  readonly canCountUsage: boolean;
  /** `false` — không trường `aliases` nào trong schema. */
  readonly canListAliases: boolean;
  /** `false` — không có `uploadedBy` / `uploadedAt` / `status`. Bốn cột rời khỏi bảng. */
  readonly canShowProvenance: boolean;
  /**
   * Khung xem trước tự quay rồi tự dừng. **`false` trong bản này.**
   *
   * Đặc tả nêu "khoảng 4 giây". Thang chuyển động của repo có đúng năm giá trị
   * (120/180/260/340/700 ms, `src/lib/motion/tokens.ts`) và R-71 cấm hằng số thời lượng viết
   * tay trong màn; R-68 cấm màn này thêm token vào `src/lib`. Nên tự quay bị hoãn tới khi có
   * prompt logic bổ sung token. Người dùng vẫn quay tay được — đó là vế đặc tả nói rõ.
   */
  readonly canAutoSpin: boolean;
}

/* ── Model của cả màn ─────────────────────────────────────────────────────────────────── */

export interface ModelLibraryModel {
  readonly state: SevenState;
  readonly capabilities: ModelLibraryCapabilities;
  readonly rows: readonly ModelLibraryRowModel[];
  readonly summary: ModelLibrarySummaryModel;
  readonly viewMode: ModelLibraryViewMode;
  readonly sortKey: ModelLibrarySortKey;
  readonly sortDirection: SortDirection;
  readonly searchText: string;
  readonly filterId: LibraryFilterId;
  /** Mười chip lọc dựng từ `LIBRARY_FILTER_IDS`; màn không tự liệt kê lại tám nhóm. */
  readonly filterOptions: readonly ModelLibraryFilterOption[];
  /** `null` ⇒ panel đóng ⇒ KHÔNG có model 3D nào được nạp. */
  readonly detail: ModelLibraryDetailModel | null;
  /** Trạng thái 7: dưới 1024 — bảng thành thẻ, panel thành lớp phủ. */
  readonly isNarrow: boolean;
  /** Trạng thái 4. Câu tiếng Việt lấy từ `toAppError`, không tự chế. */
  readonly errorMessage: string | null;
  /** Trạng thái 6: câu nói vì sao chỉ xem được. `null` khi có quyền. */
  readonly readOnlyReason: string | null;
  /** Trạng thái 1: thư viện rỗng thật, khác với "lọc ra rỗng". */
  readonly isLibraryEmpty: boolean;
}

export interface ModelLibraryFilterOption {
  readonly id: LibraryFilterId;
  readonly label: string;
  readonly count: number;
}

/* ── Hành động ────────────────────────────────────────────────────────────────────────── */

export interface ModelLibraryActions {
  readonly setSearchText: (text: string) => void;
  readonly setFilter: (filterId: LibraryFilterId) => void;
  readonly setViewMode: (mode: ModelLibraryViewMode) => void;
  /** Bấm lại cùng cột thì đảo chiều — logic ở hook, view chỉ báo cột nào bị bấm. */
  readonly sortBy: (key: ModelLibrarySortKey) => void;
  readonly openDetail: (modelId: string) => void;
  /** Đóng panel ⇒ hook PHẢI dọn cảnh 3D ngay tại đây (R-05). */
  readonly closeDetail: () => void;
  /**
   * View gắn thẻ canvas vào đây; hook sở hữu toàn bộ vòng đời nạp và dọn.
   *
   * Đây là đường ranh giữa L2-2/L2-3 và L2-1: view không bao giờ nhập `three`, nên
   * `local/no-data-layer-in-view` và ngân sách gói 280 KiB của route đều yên.
   */
  readonly attachPreviewCanvas: (canvas: HTMLCanvasElement | null) => void;
  readonly retryPreviewImage: (modelId: string) => void;
  readonly retryLoad: () => void;
}

/** View thuần: test được CHỈ từ props, không chạm store, không chạm mạng (mục D, R-60). */
export interface ModelLibraryProps {
  readonly model: ModelLibraryModel;
  readonly actions: ModelLibraryActions;
}

/* ── Cổng dữ liệu ─────────────────────────────────────────────────────────────────────── */

/** Một phiên xem trước đang sống. `dispose` là thứ chứng minh không rò rỉ. */
export interface ModelPreviewSession {
  readonly measuredTriangleCount: number;
  readonly dispose: () => void;
}

export interface ModelLibraryGateway {
  readonly capabilities: ModelLibraryCapabilities;
  readonly listModels: (signal?: AbortSignal) => Promise<readonly LibraryItem[]>;
  readonly readModel: (modelId: string, signal?: AbortSignal) => Promise<LibraryItem>;
  /**
   * Nạp một model vào canvas, trả về phiên để đóng lại sau.
   *
   * `undefined` khi `capabilities.canPreview3d === false` — cùng khuôn
   * `VersionHistoryGateway.tagVersion?`: khả năng vắng mặt thì phương thức cũng vắng mặt,
   * chứ không phải một hàm ném lỗi.
   */
  readonly openPreview?: (
    canvas: HTMLCanvasElement,
    modelUrl: string,
    signal?: AbortSignal,
  ) => Promise<ModelPreviewSession>;
}

export interface UseModelLibraryOptions {
  readonly gateway: ModelLibraryGateway;
  readonly isNarrow?: boolean;
  readonly onToast?: (toast: ModelLibraryToast) => void;
}

/** Hoàn tác đi qua đây (A8). Cửa sổ là `UNDO_WINDOW_MS`, không viết lại số. */
export interface ModelLibraryToast {
  readonly message: string;
  readonly onUndo?: () => void;
}

export type ModelLibraryResult = readonly [ModelLibraryModel, ModelLibraryActions];

/** R-73: container nhận đủ props để màn khác mở được, kể cả khi chưa có nơi gọi thật. */
export interface ModelLibraryContainerProps {
  /** Bơm vào để test và story không chạm mạng; mặc định là gateway thật. */
  readonly gateway?: ModelLibraryGateway;
  readonly onToast?: (toast: ModelLibraryToast) => void;
  /** Ép trạng thái 7 trong story mà không phải giả `matchMedia`. */
  readonly forceCompact?: boolean;
}

export type { LibraryFilterId, LibraryItem, SevenState };
