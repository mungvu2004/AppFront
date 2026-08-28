/**
 * Hợp đồng props của màn tải bản vẽ — nửa "view" của mục D, viết bằng kiểu.
 *
 * File này là API công khai giữa hai người: người viết hook (`useFloorUploadScreen.ts`)
 * dựng ra đúng những giá trị dưới đây, và người viết view (`FloorUploadScreen.tsx`)
 * chỉ đọc chúng. View không được nhập `src/api`, `src/store`, `src/domain` hay
 * `src/lib/http` (R-60, ép bằng `local/no-data-layer-in-view`), nên mọi thứ ở
 * đây đã **được quyết xong và viết xong**:
 *
 * - Không con số nào còn phải làm tròn hay quy đổi trong view. Cao độ, chiều cao,
 *   dung lượng tệp, phần trăm — tất cả đã là chuỗi tiếng Việt với dấu phẩy thập
 *   phân (A15). Con số thô chỉ còn lại ở đúng hai chỗ view **không thể** dùng
 *   chuỗi: {@link FloorUploadRowModel.percent} cho chiều rộng thanh 2px, và
 *   {@link FloorUploadRowModel.revealDelayMs}/`revealDurationMs` cho chuyển động.
 * - Không nhánh nghiệp vụ nào còn phải tính trong view. "Có bật nút chính không",
 *   "tệp này thuộc nhánh CAD không", "ghép tự động hay người chọn" đều là cờ.
 * - Không câu tiếng Việt nào còn phải ghép trong view. Lỗi của một tệp đã là một
 *   câu hoàn chỉnh trong {@link FloorUploadInlineError.sentence}.
 *
 * Chuỗi hiển thị đi kèm khoá `vi.json` của nó (`…LabelKey`) để `expectVietnamese`
 * có từ điển đối chiếu (R-67); view dùng chuỗi đã dựng sẵn, khoá chỉ để tra cứu.
 */

import type { SelectOption } from '@/components/ui/Select';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';
import type { ViewStatusCode } from '@/lib/viewmodel/types';

/* -------------------------------------------------------------------------- */
/* Một tệp gắn vào một tầng.                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Bốn trạng thái một hàng tầng có thể ở.
 *
 * Đây là trạng thái của **một tầng**, không phải của cả màn — bảy trạng thái
 * của A11 nằm ở {@link FloorUploadModel.state}. Lỗi của một tệp dừng lại ở
 * `'error'` của chính hàng nó và không bao giờ leo lên trạng thái màn.
 */
export type FloorUploadStatus = 'waiting' | 'uploading' | 'attached' | 'error';

/**
 * Vì sao một tệp không dùng được, đã phân loại.
 *
 * Bốn loại đầu đến từ `validateUploadFile` (`src/lib/upload`), loại cuối đến từ
 * lượt truyền tải hỏng giữa chừng. View không đọc `kind` để dựng câu — câu đã
 * nằm trong `sentence`; `kind` để view chọn biểu tượng và để test bám vào một
 * thứ ổn định hơn chuỗi.
 */
export type FloorUploadErrorKind =
  | 'tooLarge'
  | 'unsupportedFormat'
  | 'tooManyPages'
  | 'unreadable'
  | 'transfer';

/** Một lời từ chối, đã thành câu. Hiện trong đúng thẻ của tệp, không bao giờ là hộp thoại. */
export interface FloorUploadInlineError {
  readonly kind: FloorUploadErrorKind;
  /** Câu tiếng Việt hoàn chỉnh, đã có số đã định dạng. */
  readonly sentence: string;
  /** Bấm "thử lại" có nghĩa hay không. `false` với 413/422 và với mọi lỗi kiểm tra tệp. */
  readonly isRetryable: boolean;
  /** Khoá `vi.json` của tiêu đề nhóm lỗi, cho `expectVietnamese`. */
  readonly titleKey: string;
}

/** Tệp đang gắn vào một tầng, đã đọc xong và đã đo xong. */
export interface FloorUploadFileModel {
  readonly id: string;
  readonly name: string;
  /** `formatFileSize` — ví dụ `"12,5 MB"`. `"—"` khi chưa đo được. */
  readonly sizeLabel: string;
  /** Ví dụ `"3 trang"`. `null` khi không phải PDF hoặc không đọc được số trang. */
  readonly pageCountLabel: string | null;
  /** `.dwg` — thẻ hiện chip "Nhánh CAD". Không bao giờ tự đọc đuôi tệp trong view. */
  readonly isCadBranch: boolean;
  /** Một dòng gộp tên · dung lượng · số trang, đã ghép sẵn. */
  readonly summaryLine: string;
  /** Các trang chọn được của một PDF; rỗng khi không có gì để chọn. */
  readonly pageOptions: readonly SelectOption[];
  /** Trang đang chọn, cùng tập giá trị với `pageOptions`. `null` khi không áp dụng. */
  readonly selectedPage: string | null;
}

/**
 * Một hàng tầng — đơn vị mà view lặp qua.
 *
 * Mọi trường luôn có mặt (dùng `null`, không bỏ trống), nên view không phải hỏi
 * "trường này có tồn tại không" trước khi vẽ.
 */
export interface FloorUploadRowModel {
  readonly floorId: string;
  /** Tên tầng như máy chủ trả về — `"Tầng 2"`. Mã tầng giữ chữ hoa, đúng ngoại lệ A6. */
  readonly name: string;
  /** Cao độ sàn, đã định dạng — `"3,90 m"`. `"—"` khi chưa tính được. */
  readonly elevationLabel: string;
  /** Cao độ trần của chính tầng này (`ceilingElevationMm`) — chỗ tầng trên đứng lên. */
  readonly ceilingElevationLabel: string;
  /** Chiều cao thông thuỷ, đã định dạng — `"3,60 m"`. */
  readonly storeyHeightLabel: string;
  readonly file: FloorUploadFileModel | null;
  readonly status: FloorUploadStatus;
  /**
   * Màu của huy hiệu, nói bằng mã trạng thái chứ không bằng token hay mã màu (A1).
   *
   * Xanh `'verified'` chỉ dành cho tệp **người dùng tự gán** (A5): một tệp được
   * ghép tự động từ tên tệp là đầu ra của máy, nên nó nhận `'attention'` cùng
   * lời nhắc kiểm tra lại, không nhận xanh.
   */
  readonly statusVariant: ViewStatusCode;
  /** Nhãn huy hiệu, viết thường kiểu câu (A6) — `"đang tải lên"`. */
  readonly statusLabel: string;
  readonly statusLabelKey: string;
  /** Tệp này được ghép tự động từ tên tệp, chưa ai xác nhận. */
  readonly isAutoMatched: boolean;
  /** Lời nhắc "kiểm tra lại" khi `isAutoMatched`; `null` khi không. */
  readonly autoMatchHint: string | null;
  /** 0..100, số nguyên. Cho chiều rộng thanh 2px — con số thô duy nhất view được nhận. */
  readonly percent: number;
  /** Cùng con số đó, đã thành chuỗi — `"45%"`. */
  readonly percentLabel: string;
  /** Câu cho trình đọc màn hình, đã ghép sẵn (A12). */
  readonly progressAriaLabel: string;
  readonly error: FloorUploadInlineError | null;
  /** Các tầng gán lại được, kể cả tầng hiện tại. Rỗng khi màn chỉ đọc. */
  readonly reassignOptions: readonly SelectOption[];
  readonly canCancelUpload: boolean;
  readonly canRetryUpload: boolean;
  readonly canRemoveFile: boolean;
  /** Nhãn `aria-label` của nút xoá, đã có tên tệp. `null` khi không xoá được. */
  readonly removeLabel: string | null;
  /** Trễ vào của thẻ, từ `staggerDelayMs` — 0 khi người dùng xin ít chuyển động. */
  readonly revealDelayMs: number;
  /** Thời lượng vào của thẻ, từ `durationMs('standard')`. */
  readonly revealDurationMs: number;
}

/* -------------------------------------------------------------------------- */
/* Khay tệp chưa gán tầng.                                                     */
/* -------------------------------------------------------------------------- */

/** Một tệp đã nhận nhưng chưa biết thuộc tầng nào — tên tệp không nói ra tầng. */
export interface FloorUploadTrayItemModel {
  readonly id: string;
  readonly name: string;
  readonly sizeLabel: string;
  readonly isCadBranch: boolean;
  readonly summaryLine: string;
  readonly error: FloorUploadInlineError | null;
  /** Các tầng gán được. Rỗng khi màn chỉ đọc. */
  readonly assignOptions: readonly SelectOption[];
  readonly canRemoveFile: boolean;
  readonly removeLabel: string | null;
}

/** Khay tệp chưa gán tầng. `items` rỗng nghĩa là view không vẽ khay. */
export interface FloorUploadTrayModel {
  readonly title: string;
  readonly titleKey: string;
  readonly items: readonly FloorUploadTrayItemModel[];
  /** `"2 tệp"` — đã định dạng. */
  readonly countLabel: string;
}

/* -------------------------------------------------------------------------- */
/* Vùng kéo thả.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Mọi chữ của vùng kéo thả, đã dựng sẵn.
 *
 * `formatsLine` đã chứa danh sách định dạng và trần dung lượng lấy từ hằng của
 * `src/lib/upload` — view **không** viết lại con số nào, và cả thư mục màn không
 * chứa một trần dung lượng nào dưới dạng byte hay dạng chữ.
 */
export interface FloorUploadDropZoneModel {
  readonly title: string;
  readonly titleKey: string;
  readonly selectFileLabel: string;
  readonly formatsLine: string;
  /** Chuỗi cho thuộc tính `accept` của `<input type="file">` — `".png,.jpg,.pdf,.dwg"`. */
  readonly acceptAttribute: string;
  /** Kéo thả đang bật hay không: tắt khi màn chỉ đọc. */
  readonly isEnabled: boolean;
}

/* -------------------------------------------------------------------------- */
/* Chân trang và lý do chặn.                                                   */
/* -------------------------------------------------------------------------- */

/** Bốn lý do một lượt xử lý chưa bắt đầu được. Mỗi lý do luôn nêu đúng một tầng. */
export type FloorUploadBlockReasonKind =
  | 'missingFile'
  | 'missingElevation'
  | 'duplicateElevation'
  | 'uploading';

/**
 * Một lý do, đã nêu tên tầng và mang theo mã tầng.
 *
 * `floorId` là thứ cho view cuộn tới đúng thẻ đang thiếu — nút chính **không**
 * bao giờ bị vô hiệu hoá âm thầm, nó bấm được và trả về danh sách này.
 */
export interface FloorUploadBlockReason {
  readonly floorId: string;
  readonly floorName: string;
  readonly kind: FloorUploadBlockReasonKind;
  readonly sentence: string;
}

/**
 * Lời cuộn tới một thẻ.
 *
 * `requestId` tăng sau **mỗi** lượt bấm bị chặn, kể cả khi vẫn là tầng cũ, nên
 * một `useEffect` bám vào nó chạy lại đúng một lần cho mỗi lượt bấm.
 */
export interface FloorUploadScrollRequest {
  readonly floorId: string;
  readonly requestId: number;
}

export interface FloorUploadFooterModel {
  readonly doneCount: number;
  readonly totalCount: number;
  /** `"3 / 4 tầng đã có bản vẽ"` — đã định dạng. */
  readonly counterLabel: string;
  readonly counterLabelKey: string;
  readonly submitLabel: string;
  readonly submitLabelKey: string;
  /**
   * Bấm nút chính có bắt đầu xử lý được không.
   *
   * `false` **không** có nghĩa là view vô hiệu hoá nút. Nút vẫn bấm được; bấm
   * lúc `false` làm {@link FloorUploadModel.blockNotice} hiện ra.
   */
  readonly canSubmit: boolean;
  /** Lý do đang có, đọc được cả trước khi bấm. Rỗng ⟺ `canSubmit === true`. */
  readonly blockReasons: readonly FloorUploadBlockReason[];
  readonly isSubmitting: boolean;
}

/** Danh sách lý do sau một lượt bấm bị chặn. `null` cho tới lúc người dùng bấm. */
export interface FloorUploadBlockNotice {
  readonly title: string;
  readonly titleKey: string;
  readonly reasons: readonly FloorUploadBlockReason[];
  readonly scrollTo: FloorUploadScrollRequest;
}

/* -------------------------------------------------------------------------- */
/* Toàn màn.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Mọi thứ view vẽ.
 *
 * **Bậc thang quyết định `state`** (A11, R-63): giá trị đầu tiên khớp trong dãy
 * `collapsed → forbidden → loading → error → empty → partial → success`.
 * Hai lớp phủ `collapsed` và `forbidden` không làm dữ liệu biến mất — `floors`
 * vẫn đầy đủ, chỉ mất quyền sửa và đổi cách xếp.
 *
 * Bất biến đi kèm:
 *
 * 1. `errorMessage !== null` ⟺ `state === 'error'`, và đó luôn là lỗi **đọc
 *    danh sách tầng** — không bao giờ là lỗi của một tệp. Lỗi tệp sống trong
 *    {@link FloorUploadRowModel.error}.
 * 2. `state === 'loading'` ⇒ `floors` rỗng và view vẽ khung xương.
 * 3. `isReadOnly === true` ⟺ `canEdit === false`; khi màn không thu gọn thì cả
 *    hai ⟺ `state === 'forbidden'`.
 * 4. `state === 'empty'` ⟺ không tầng nào có tệp và khay cũng rỗng.
 * 5. `state === 'partial'` ⟺ có tệp nhưng chưa đủ mọi tầng, hoặc còn tệp đang tải.
 * 6. `isDragActive === true` chỉ khi `isReadOnly === false`.
 * 7. `blockNotice !== null` chỉ sau một lượt bấm nút chính lúc `footer.canSubmit`
 *    là `false`; nó biến mất ngay khi lý do cuối cùng được gỡ.
 */
export interface FloorUploadModel {
  readonly state: SevenState;
  readonly projectId: string;
  readonly canEdit: boolean;
  readonly isReadOnly: boolean;
  readonly isCollapsed: boolean;
  readonly isOffline: boolean;
  readonly isDragActive: boolean;
  /** Lỗi đọc danh sách tầng. `null` ở mọi trạng thái khác `'error'`. */
  readonly errorMessage: string | null;
  /** Câu "đang làm việc ngoại tuyến". `null` khi có mạng. */
  readonly offlineNotice: string | null;
  readonly offlineNoticeKey: string;
  /** Câu giải thích vì sao chỉ xem được. `null` khi có quyền tải lên. */
  readonly readOnlyNotice: string | null;
  readonly readOnlyNoticeKey: string;
  /** Câu của trạng thái rỗng. */
  readonly emptyMessage: string;
  readonly emptyMessageKey: string;
  readonly dropZone: FloorUploadDropZoneModel;
  readonly floors: readonly FloorUploadRowModel[];
  readonly tray: FloorUploadTrayModel;
  readonly footer: FloorUploadFooterModel;
  readonly blockNotice: FloorUploadBlockNotice | null;
}

/* -------------------------------------------------------------------------- */
/* Hành động.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Mọi hàm view gọi.
 *
 * Không hàm nào trả về gì: view bắn sự kiện, hook quyết định. Mọi hàm đều an
 * toàn khi màn chỉ đọc — hook bỏ qua chúng chứ không ném lỗi, nên view không
 * phải bọc điều kiện quanh từng lời gọi.
 */
export interface FloorUploadActions {
  /** Thả tệp vào vùng kéo thả. */
  readonly onFilesDropped: (files: readonly File[]) => void;
  /** Chọn tệp bằng hộp thoại của trình duyệt. */
  readonly onFilesChosen: (files: readonly File[]) => void;
  readonly onDragEnter: () => void;
  readonly onDragLeave: () => void;
  /** Gán một tệp sang tầng khác; `floorId === null` đưa nó về khay chưa gán. */
  readonly onReassign: (fileId: string, floorId: string | null) => void;
  readonly onPickPdfPage: (fileId: string, page: string) => void;
  readonly onCancelUpload: (fileId: string) => void;
  readonly onRetryUpload: (fileId: string) => void;
  /** Xoá ngay, có toast hoàn tác (A8, D-05). Không hộp thoại xác nhận. */
  readonly onRemoveFile: (fileId: string) => void;
  readonly onSubmit: () => void;
  /** Đóng lỗi trong thẻ của một tệp. Không đụng tới tệp khác. */
  readonly onDismissError: (fileId: string) => void;
}

/** Mọi prop view nhận — mô hình cộng hành động, đã gộp sẵn (mục D). */
export interface FloorUploadScreenViewProps extends FloorUploadModel, FloorUploadActions {}
