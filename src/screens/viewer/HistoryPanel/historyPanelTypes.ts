/**
 * Hợp đồng hình dạng của S-34 "HistoryPanel" — panel lịch sử 100 bước của viewer.
 *
 * File này là thứ DUY NHẤT mà view, hook, test và story đều nhập. Nó tồn tại để
 * bốn nửa ấy đồng ý với nhau mà không nửa nào phải đọc mã của nửa kia — đó là
 * lý do bộ test dựng được song song với bản hiện thực chứ không phải sau nó.
 *
 * Không một dòng logic nào ở đây: chỉ kiểu, hằng, và nhãn.
 *
 * ## Bốn phán quyết đã chốt trước khi viết, kèm bằng chứng
 *
 * 1. **Nhảy về một bước = gọi lặp `undo()` của chính `HistoryStack` (S-06).**
 *    `src/lib/commands/history.ts` KHÔNG có `jumpTo`/`goToStep`/`seek` — chỉ có
 *    `undo()` và `redo()` đi từng bước một. Gọi lặp N lần là hợp lệ và trả về N
 *    `HistoryTransition` liên tiếp. Việc này KHÔNG phạm điều cấm "không tự quản
 *    lý ngăn xếp hoàn tác": màn không giữ ngăn xếp nào của riêng nó, nó chỉ bấm
 *    nút của ngăn xếp có sẵn nhiều lần.
 *
 * 2. **Ba chip loại, không phải bốn.** Đặc tả đòi `Chỉnh sửa · Duyệt · AI ·
 *    Nhập xuất`. Ba cái đầu dựng được thật từ `ReviewMetadata`
 *    (`src/domain/spatial/types.ts:50-66`): `source: 'ai' | 'human'` và cờ
 *    `reviewed`. Cái thứ tư thì KHÔNG: `ACTION_LABELS`
 *    (`src/lib/commands/history.ts:135-147`) không có mục `import`/`export`, và
 *    không `CommandType` nào trong repo mang dạng ấy. Một chip bấm vào là rỗng
 *    vĩnh viễn thì nói dối người dùng, nên nó không được dựng. Đây là phần thiếu
 *    đã báo cáo, không phải phần bị quên.
 *
 * 3. **`HISTORY_SESSION_GAP_MS` khai tại đây, không mượn chỗ khác.** P-02 có
 *    thật (`src/lib/format/datetime.ts`), nhưng **P-03 gộp theo phiên làm việc
 *    KHÔNG tồn tại**: grep `groupBySession|sessionGroup|sessionGap|SESSION_|
 *    groupByDay|bucketBy|IDLE_|GAP_MS` trên `src/lib/**` và `src/domain/**` ra
 *    rỗng, và không hằng số nào trong repo mang nghĩa "khoảng nghỉ giữa hai
 *    phiên". Ứng viên gần nhất là `CACHE_POLICY.default.gcTime`, nhưng buộc cách
 *    gộp lịch sử vào một núm chỉnh cache là đúng kiểu trôi lệch mà R-71 sinh ra
 *    để chặn. R-68 lại cấm thêm file vào `src/lib` trong lúc dựng màn, nên hằng
 *    số sống tại đây — đúng tiền lệ `axisGridManagerGateway.ts`, nơi lệnh trục
 *    được dựng trong thư mục màn vì `src/lib` thiếu và R-68 cấm bổ sung.
 *
 * 4. **Không đăng ký `Mod+Z`.** `Ctrl+Z`/`Ctrl+Shift+Z` đã có chủ ở tầng chung
 *    (`src/lib/input/shortcutRegistry.ts`) và ở bốn màn QC bắt riêng theo phạm
 *    vi canvas. Panel này chỉ ĐỌC vị trí hiện tại rồi cuộn mục đang hoạt động
 *    vào tầm nhìn — nó phản ứng, không giành phím. `Ctrl+H` thì còn trống và là
 *    của panel này.
 */

import type { SevenState } from '@/lib/testing/sevenStateScenarios';

/* -------------------------------------------------------------------------- */
/* Hằng số                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Hai thao tác cách nhau quá chừng này thì thuộc hai phiên làm việc khác nhau.
 *
 * Ba mươi phút: đủ dài để một lần đi họp không cắt đôi buổi làm, đủ ngắn để
 * sáng và chiều không dính thành một khối. Xem phán quyết 3 ở đầu file để biết
 * vì sao con số này ở đây chứ không ở `src/lib`.
 */
export const HISTORY_SESSION_GAP_MS = 30 * 60 * 1000;

/** Lịch sử giữ đúng chừng này bước; quá thì bước cũ nhất rơi khỏi đáy (S-06). */
export const HISTORY_MAX_STEPS = 100;

/**
 * Lớp Tailwind cho mục đã hoàn tác.
 *
 * Đặt ở đây chứ không viết thẳng trong view, để test khẳng định đúng cái chuỗi
 * mà view thật sự gắn — nghiệm thu đòi đếm được số mục còn nhìn thấy ở độ mờ
 * thấp, mà một mục "biến mất" và một mục "mờ đi" khác nhau đúng ở lớp này.
 */
export const HISTORY_UNDONE_ITEM_CLASS = 'opacity-40';

/* -------------------------------------------------------------------------- */
/* Phân loại                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Loại việc của một mục lịch sử.
 *
 * Ba giá trị, không phải bốn — xem phán quyết 2 ở đầu file.
 */
export type HistoryCategory = 'edit' | 'review' | 'ai';

/** Giá trị của hàng chip lọc; `'all'` là chip "Tất cả". */
export type HistoryCategoryFilter = HistoryCategory | 'all';

/** Nhãn tiếng Việt của từng chip. Viết thường, kiểu câu (A6). */
export const HISTORY_CATEGORY_LABELS: Readonly<Record<HistoryCategoryFilter, string>> = {
  all: 'tất cả',
  edit: 'chỉnh sửa',
  review: 'duyệt',
  ai: 'AI',
};

/** Thứ tự chip trên hàng lọc, trái sang phải. */
export const HISTORY_CATEGORY_ORDER: readonly HistoryCategoryFilter[] = [
  'all',
  'edit',
  'review',
  'ai',
];

/* -------------------------------------------------------------------------- */
/* Người thực hiện                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Người đứng sau một mục lịch sử.
 *
 * `Command.actorId` là một chuỗi thô và **không có chỗ nào trong repo đổi nó
 * thành tên người hay ảnh đại diện** — đã tìm ở `src/lib/auth`, `useSession`,
 * `AccountSettings`. `AuthUser.name` chỉ trả lời được "tôi là ai"; không bảng
 * tra nào đổi `actorId` của NGƯỜI KHÁC thành một cái tên.
 *
 * ## `initials` không được view dùng — và không thể dùng
 *
 * Bản hợp đồng đầu tiên đoán rằng chữ tắt VIẾT HOA đi qua được
 * `expectVietnamese` vì A6 miễn trừ chữ hoa cho mã. **Điều đó SAI, và một lần
 * chạy thật đã bác bỏ nó**: `expectVietnamese` bỏ hoa/thường TRƯỚC khi so, nên
 * `initials="AN"` trượt y hệt `"An"` — `→ từ "AN" — tiếng Việt thiếu dấu; đúng
 * ra là "án hoặc ẩn hoặc ăn"`. `Avatar` VẼ chữ tắt ra màn hình chứ không chỉ
 * đọc nó, nên không có cách viết nào của chữ tắt sống sót được phép kiểm.
 *
 * Vì vậy `HistoryPanel.rows.tsx` **không truyền `initials` vào `Avatar`**:
 * vòng tròn để trống và `alt` — một câu tiếng Việt — là thứ duy nhất mang danh
 * tính người thực hiện. Trường vẫn nằm trong hợp đồng và vẫn được tầng model
 * điền, nhưng hôm nay không nơi nào hiển thị nó.
 *
 * ## `label` là thứ phân biệt người này với người kia
 *
 * `label` luôn là tiếng Việt và luôn có mặt, vì nó là thứ đi vào `alt` của
 * `Avatar` (mặc định của `Avatar` là chuỗi tiếng Anh `'Avatar'`, không dùng
 * được) VÀ là thứ đổ vào `Select` lọc theo người. Chữ tắt đã bị bỏ, nên `label`
 * gánh cả việc phân biệt: hai người khác nhau phải ra hai `label` khác nhau,
 * nếu không bộ lọc hiện ra một danh sách mơ hồ. Xem
 * {@link HISTORY_ANONYMOUS_ACTOR_LABEL}.
 */
export interface HistoryActor {
  readonly id: string;
  /**
   * Chữ tắt VIẾT HOA, tối đa hai ký tự.
   *
   * KHÔNG hiển thị được: `expectVietnamese` bỏ hoa/thường trước khi so, nên mọi
   * chữ tắt hai ký tự đều bị đọc thành một từ tiếng Việt mất dấu. Xem ghi chú ở
   * đầu khối này.
   */
  readonly initials: string;
  /** Câu tiếng Việt mô tả người này, dùng cho `alt`/`aria-label` và cho bộ lọc. */
  readonly label: string;
  /** `true` khi người xem không được biết đây là ai (trạng thái không có quyền). */
  readonly isAnonymised: boolean;
}

/**
 * Mở đầu nhãn thay cho tên, khi không có đường nào biết người ấy tên gì.
 *
 * Tầng model ghép thêm một SỐ THỨ TỰ ổn định vào sau — `Người dùng khác 1`,
 * `Người dùng khác 2` — theo thứ tự gặp trên trục thời gian. Số ấy không nói dối
 * điều gì: nó không phải tên, không phải mã, chỉ là "người thứ mấy" để hai mục
 * của hai người khác nhau không đọc ra cùng một câu. Chữ tắt đã bị bỏ (xem
 * {@link HistoryActor}), nên nếu nhãn cũng trùng nhau thì `Select` lọc theo
 * người sẽ hiện mấy dòng giống hệt nhau và người dùng không chọn được ai.
 */
export const HISTORY_ANONYMOUS_ACTOR_LABEL = 'Người dùng khác';

/* -------------------------------------------------------------------------- */
/* Một mục trên dòng thời gian                                                 */
/* -------------------------------------------------------------------------- */

/** Đối tượng mà một mục lịch sử dẫn tới. Bấm được, đưa camera tới nó (R-07). */
export interface HistoryEntityRef {
  readonly id: string;
  /** Nhãn tiếng Việt, ví dụ `tường W-014`. */
  readonly label: string;
}

/**
 * Một dòng "giá trị cũ → giá trị mới" hiện ngay trong mục.
 *
 * Cả ba trường đều là CHUỖI ĐÃ ĐỊNH DẠNG XONG. A15 nói việc định dạng số xảy ra
 * ở viewmodel chứ không ở view, nên view chỉ việc in ra: nó không được biết
 * `110` là milimét hay mét, và không bao giờ gọi `toFixed`.
 */
export interface HistoryValueDiff {
  /** Ví dụ `Độ dày #W-014`. */
  readonly fieldLabel: string;
  /** Ví dụ `110 mm`. Hiện gạch ngang, màu `--text-muted`. */
  readonly beforeText: string;
  /** Ví dụ `220 mm`. Hiện màu `--text-primary`. */
  readonly afterText: string;
}

/**
 * Mục này nằm ở đâu so với vị trí hiện tại của lịch sử.
 *
 * `undone` là mấu chốt của luật cốt lõi: hoàn tác không bao giờ phá huỷ, nên
 * mục sau vị trí hiện tại **vẫn còn nhìn thấy**, chỉ hạ độ mờ. Nó không bao giờ
 * bị lọc khỏi danh sách.
 */
export type HistoryItemPosition = 'past' | 'current' | 'undone';

/** Phần chung của mọi mục, dù đơn hay theo lô. */
interface HistoryItemBase {
  readonly id: string;
  /**
   * Câu mô tả, LẤY TỪ `HistoryStep.label` của S-06 — do `buildHistoryLabel`
   * sinh ra. Màn KHÔNG tự viết câu nào.
   */
  readonly label: string;
  readonly category: HistoryCategory;
  readonly actor: HistoryActor;
  readonly timestampIso: string;
  /** Thời gian tương đối đã định dạng bằng P-02, ví dụ `12 phút trước`. */
  readonly relativeLabel: string;
  readonly position: HistoryItemPosition;
  /** Những đối tượng mục này chạm tới; mọi mục phải dẫn tới được đối tượng của nó. */
  readonly entityRefs: readonly HistoryEntityRef[];
}

/** Một bước đơn. Có thể kèm một dòng diff hiện ngay trong mục. */
export interface HistorySingleItem extends HistoryItemBase {
  readonly kind: 'single';
  /** `null` khi bước này không phải một lần đổi giá trị. */
  readonly diff: HistoryValueDiff | null;
}

/**
 * Một bước gộp nhiều thay đổi, ví dụ `Duyệt 12 đoạn tường`.
 *
 * Nguồn: `runTransaction` (nhiều lệnh trong một bước) hoặc `mergeCommands`
 * (một mạch kéo gộp lại). Thu gọn sẵn, mở ra được thành từng mục con.
 */
export interface HistoryBatchItem extends HistoryItemBase {
  readonly kind: 'batch';
  readonly children: readonly HistorySingleItem[];
  readonly isExpanded: boolean;
}

export type HistoryTimelineItem = HistorySingleItem | HistoryBatchItem;

/* -------------------------------------------------------------------------- */
/* Gộp nhóm: ngày → phiên → mục                                                */
/* -------------------------------------------------------------------------- */

export interface HistorySessionGroup {
  readonly id: string;
  /** Ví dụ `phiên chiều`, `phiên lúc 14:05`. */
  readonly label: string;
  readonly items: readonly HistoryTimelineItem[];
}

export interface HistoryDayGroup {
  readonly id: string;
  /** Ví dụ `hôm nay`, `hôm qua`, `12 tháng 8`. */
  readonly label: string;
  readonly sessions: readonly HistorySessionGroup[];
}

/* -------------------------------------------------------------------------- */
/* Bộ lọc                                                                      */
/* -------------------------------------------------------------------------- */

export interface HistoryFilters {
  readonly category: HistoryCategoryFilter;
  /** `null` nghĩa là mọi người. */
  readonly actorId: string | null;
}

/* -------------------------------------------------------------------------- */
/* Trạng thái màn                                                              */
/* -------------------------------------------------------------------------- */

/** Bảy trạng thái của A11, mượn nguyên bộ dùng chung. */
export type HistoryPanelState = SevenState;

/**
 * Vì sao danh sách chỉ có một phần.
 *
 * Đặc tả cho hai lối vào trạng thái "một phần", và chúng nói hai câu khác nhau
 * nên không thể trộn làm một: chạm trần 100 bước (bước cũ nhất sắp bị bỏ) và
 * lịch sử cũ đã lưu trữ (có nút "Tải thêm").
 */
export type HistoryPartialReason = 'at-step-limit' | 'archived';

/** Panel rộng 344 trong viewer, hay tấm trượt đáy dưới 1024. */
export type HistoryPanelLayout = 'panel' | 'sheet';

/* -------------------------------------------------------------------------- */
/* Props của view thuần                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Mọi thứ view cần, và không gì hơn.
 *
 * View là view thuần theo mục D và R-60: nó không chạm store, không chạm mạng,
 * không tính toán. Test dựng được nó chỉ từ khối props này.
 */
export interface HistoryPanelProps {
  readonly state: HistoryPanelState;
  readonly layout: HistoryPanelLayout;
  readonly groups: readonly HistoryDayGroup[];
  /** Tổng số mục còn nhìn thấy được, kể cả mục đã hoàn tác. */
  readonly visibleCount: number;
  readonly filters: HistoryFilters;
  /** Danh sách người để đổ vào `Select` lọc theo người. */
  readonly people: readonly HistoryActor[];
  /** Mục ứng với vị trí hiện tại; `null` khi lịch sử rỗng. */
  readonly currentItemId: string | null;
  /** `false` ở trạng thái không có quyền: xem được nhưng không nhảy trạng thái. */
  readonly canJump: boolean;
  readonly partialReason: HistoryPartialReason | null;
  readonly isCollapsed: boolean;
  readonly error: unknown;

  readonly onCategoryChange: (category: HistoryCategoryFilter) => void;
  readonly onActorChange: (actorId: string | null) => void;
  /** Nhảy về một trạng thái. Hoạt cảnh, không bao giờ tức thì. */
  readonly onJumpTo: (itemId: string) => void;
  /** Trỏ vào: tô sáng đối tượng trong 3D và hiện bóng ma trạng thái trước. */
  readonly onHoverItem: (itemId: string | null) => void;
  /** Bấm vào một đối tượng liên quan: chọn nó và khuôn camera vào nó (R-07). */
  readonly onSelectEntity: (entityId: string) => void;
  readonly onToggleBatch: (itemId: string) => void;
  readonly onToggleCollapse: () => void;
  readonly onLoadMore: () => void;
  readonly onRetry: () => void;
}

/* -------------------------------------------------------------------------- */
/* Kết quả của hook                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Hook trả về đúng những gì view cần, không hơn.
 *
 * Giữ hai nửa khớp nhau bằng `Omit`: thêm một prop vào view mà quên nối trong
 * hook thì hỏng ở bước typecheck chứ không hỏng lúc chạy.
 */
export type UseHistoryPanelResult = Omit<HistoryPanelProps, 'layout'>;

/* -------------------------------------------------------------------------- */
/* Mã kiểm thử — view và test cùng đọc từ đây                                  */
/* -------------------------------------------------------------------------- */

/**
 * Định danh dùng cho test.
 *
 * Đây là mảnh ghép khiến bộ test viết được SONG SONG với view thay vì phải chờ
 * view xong: cả hai bên nhập cùng một hằng, nên không bên nào phải đoán chuỗi
 * của bên kia.
 */
export const HISTORY_PANEL_TEST_IDS = {
  root: 'history-panel',
  categoryChips: 'history-panel-category-chips',
  actorSelect: 'history-panel-actor-select',
  timeline: 'history-panel-timeline',
  dayGroup: 'history-panel-day-group',
  sessionGroup: 'history-panel-session-group',
  item: 'history-panel-item',
  itemDot: 'history-panel-item-dot',
  itemDiff: 'history-panel-item-diff',
  batchToggle: 'history-panel-batch-toggle',
  batchChild: 'history-panel-batch-child',
  jumpButton: 'history-panel-jump-button',
  entityLink: 'history-panel-entity-link',
  loadMore: 'history-panel-load-more',
  skeleton: 'history-panel-skeleton',
  emptyState: 'history-panel-empty',
  errorState: 'history-panel-error',
  stepLimitNotice: 'history-panel-step-limit-notice',
} as const;

/** Phím mở panel. `Ctrl+H` còn trống — đã kiểm cả registry lẫn bốn màn QC. */
export const HISTORY_PANEL_SHORTCUT = 'mod+h';
