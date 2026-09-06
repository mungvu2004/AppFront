/**
 * Bảy kịch bản của S-34 "HistoryPanel", một cho mỗi trạng thái của A11.
 *
 * File này CHỈ phụ thuộc `historyPanelTypes.ts` (hợp đồng) và `SevenState` của
 * `src/lib/testing/sevenStateScenarios` — không phụ thuộc view, hook, hay bất
 * cứ thứ gì khác trong thư mục màn. Đó là lý do nó typecheck sạch trước khi
 * `HistoryPanel.tsx`/`useHistoryPanel.ts` tồn tại, và là lý do bộ test viết
 * được SONG SONG với bản hiện thực.
 *
 * ## Vì sao không dùng thẳng `createSevenStateScenarios()` làm nền dữ liệu
 *
 * `SevenStateScenario` (`sevenStateScenarios.ts`) mang hình dạng bảng chung —
 * `rows`, `totalCount`, `isLoading`, `canView` — dựng cho một màn kiểu
 * danh sách phẳng. `HistoryPanelProps` có hình dạng khác hẳn: cây ngày → phiên
 * → mục, mục đơn/mục lô, bộ lọc, danh sách người. Ép hai hình dạng vào nhau sẽ
 * mất thông tin (không có chỗ cho `groups`, `filters`, `people`...), nên file
 * này dùng thẳng `HistoryPanelProps` và chỉ MƯỢN `SevenState` làm khoá bảy
 * trạng thái — đúng như hợp đồng gợi ý (`historyPanelTypes.ts:241`,
 * `HistoryPanelState = SevenState`). Bài kiểm vẫn lấy DANH SÁCH bảy trạng thái
 * từ `createSevenStateScenarios()` (nguồn dùng chung, không tự đếm lại), chỉ
 * tra cứu props của từng trạng thái vào bảng ở đây.
 *
 * ## Dữ liệu kịch bản `success` — vì sao đúng những mục này
 *
 * - `dien-tuong-014` có `diff` (khẳng định `beforeText`/`afterText` cùng hiện).
 * - `duyet-lo-tuong` là `kind: 'batch'` có hai `children` (khẳng định mở lô).
 * - Ba mục cuối (`lo-undone`, `sua-cua-undone`, `duyet-san-undone`) mang
 *   `position: 'undone'` — lùi ba bước thì đúng ba mục này chuyển độ mờ, không
 *   mục nào biến mất khỏi cây (luật cốt lõi).
 * - Ba người khác nhau đứng sau các mục (`Lan Trần`, `Minh Nguyễn`, `Trợ lý AI`)
 *   để `Select` lọc theo người có ít nhất hai lựa chọn thật để lọc.
 *
 * ## Kịch bản `partial` — cả hai `HistoryPartialReason`
 *
 * Trường `partialReason` của hợp đồng chỉ mang MỘT giá trị mỗi lần, nên bảy
 * kịch bản (một mỗi `SevenState`) chỉ dùng được một lý do cho trạng thái
 * `partial`. Hai hàm dựng riêng — {@link createPartialAtStepLimitProps} và
 * {@link createPartialArchivedProps} — được xuất RIÊNG để bài kiểm khẳng định
 * cả hai lý do render đúng; kịch bản trong {@link createHistoryPanelScenarios}
 * dùng lý do `at-step-limit` làm đại diện.
 */

import type {
  HistoryActor,
  HistoryBatchItem,
  HistoryDayGroup,
  HistoryPanelProps,
  HistoryPartialReason,
  HistorySingleItem,
  HistoryTimelineItem,
} from './historyPanelTypes';
import { HISTORY_ANONYMOUS_ACTOR_LABEL } from './historyPanelTypes';

import type { SevenState } from '@/lib/testing/sevenStateScenarios';

/* -------------------------------------------------------------------------- */
/* Người thực hiện dùng chung giữa các kịch bản.                               */
/* -------------------------------------------------------------------------- */

const ACTOR_LAN: HistoryActor = {
  id: 'u-lan-tran',
  initials: 'LT',
  label: 'Lan Trần',
  isAnonymised: false,
};

const ACTOR_MINH: HistoryActor = {
  id: 'u-minh-nguyen',
  initials: 'MN',
  label: 'Minh Nguyễn',
  isAnonymised: false,
};

const ACTOR_AI: HistoryActor = {
  id: 'ai-system',
  initials: 'AI',
  label: 'Trợ lý AI',
  isAnonymised: false,
};

const ACTOR_ANONYMOUS: HistoryActor = {
  id: 'u-khac',
  initials: '?',
  label: HISTORY_ANONYMOUS_ACTOR_LABEL,
  isAnonymised: true,
};

const noop = (): void => {
  /* Chỗ nối có mặt để view gắn được; bài kiểm tự thay bằng bộ đếm khi cần đo. */
};

const noopWithId = (): void => {
  /* Cùng lý do như noop — chữ ký nhận một tham số. */
};

const NOOP_CALLBACKS: Pick<
  HistoryPanelProps,
  | 'onActorChange'
  | 'onCategoryChange'
  | 'onHoverItem'
  | 'onJumpTo'
  | 'onLoadMore'
  | 'onRetry'
  | 'onSelectEntity'
  | 'onToggleBatch'
  | 'onToggleCollapse'
> = {
  onActorChange: noopWithId,
  onCategoryChange: noopWithId,
  onHoverItem: noopWithId,
  onJumpTo: noopWithId,
  onLoadMore: noop,
  onRetry: noop,
  onSelectEntity: noopWithId,
  onToggleBatch: noopWithId,
  onToggleCollapse: noop,
};

/* -------------------------------------------------------------------------- */
/* Kịch bản `success` — cây ngày → phiên → mục đầy đủ mọi hình dạng.          */
/* -------------------------------------------------------------------------- */

const SUCCESS_DIFF_ITEM_ID = 'dien-tuong-014';
const SUCCESS_BATCH_ITEM_ID = 'duyet-lo-tuong';
const SUCCESS_CURRENT_ITEM_ID = 'them-cua-so';

function createSuccessGroups(): readonly HistoryDayGroup[] {
  const pastDiff: HistorySingleItem = {
    id: SUCCESS_DIFF_ITEM_ID,
    label: 'Đổi độ dày tường W-014',
    category: 'edit',
    actor: ACTOR_LAN,
    timestampIso: '2026-09-07T07:00:00+07:00',
    relativeLabel: '2 giờ trước',
    position: 'past',
    entityRefs: [{ id: 'wall-014', label: 'tường W-014' }],
    kind: 'single',
    diff: { fieldLabel: 'Độ dày #W-014', beforeText: '110 mm', afterText: '220 mm' },
  };

  const pastReview: HistorySingleItem = {
    id: 'duyet-phong-khach',
    label: 'Duyệt phòng khách',
    category: 'review',
    actor: ACTOR_MINH,
    timestampIso: '2026-09-07T07:20:00+07:00',
    relativeLabel: '1 giờ 40 phút trước',
    position: 'past',
    entityRefs: [{ id: 'room-p02', label: 'phòng P-02' }],
    kind: 'single',
    diff: null,
  };

  const current: HistorySingleItem = {
    id: SUCCESS_CURRENT_ITEM_ID,
    label: 'Thêm ô cửa sổ',
    category: 'edit',
    actor: ACTOR_LAN,
    timestampIso: '2026-09-07T08:05:00+07:00',
    relativeLabel: '55 phút trước',
    position: 'current',
    entityRefs: [{ id: 'window-021', label: 'ô cửa sổ WD-021' }],
    kind: 'single',
    diff: null,
  };

  const batchChildOne: HistorySingleItem = {
    id: 'duyet-lo-tuong-con-1',
    label: 'Duyệt tường W-030',
    category: 'review',
    actor: ACTOR_MINH,
    timestampIso: '2026-09-07T08:10:00+07:00',
    relativeLabel: '50 phút trước',
    position: 'undone',
    entityRefs: [{ id: 'wall-030', label: 'tường W-030' }],
    kind: 'single',
    diff: null,
  };

  const batchChildTwo: HistorySingleItem = {
    id: 'duyet-lo-tuong-con-2',
    label: 'Duyệt tường W-031',
    category: 'review',
    actor: ACTOR_MINH,
    timestampIso: '2026-09-07T08:11:00+07:00',
    relativeLabel: '49 phút trước',
    position: 'undone',
    entityRefs: [{ id: 'wall-031', label: 'tường W-031' }],
    kind: 'single',
    diff: null,
  };

  const batch: HistoryBatchItem = {
    id: SUCCESS_BATCH_ITEM_ID,
    label: 'Duyệt 2 đoạn tường',
    category: 'review',
    actor: ACTOR_MINH,
    timestampIso: '2026-09-07T08:11:30+07:00',
    relativeLabel: '49 phút trước',
    position: 'undone',
    entityRefs: [
      { id: 'wall-030', label: 'tường W-030' },
      { id: 'wall-031', label: 'tường W-031' },
    ],
    kind: 'batch',
    isExpanded: false,
    children: [batchChildOne, batchChildTwo],
  };

  const undoneEdit: HistorySingleItem = {
    id: 'sua-cua-undone',
    label: 'Đổi vị trí cửa chính',
    category: 'edit',
    actor: ACTOR_AI,
    timestampIso: '2026-09-07T08:15:00+07:00',
    relativeLabel: '45 phút trước',
    position: 'undone',
    entityRefs: [{ id: 'door-001', label: 'cửa D-001' }],
    kind: 'single',
    diff: null,
  };

  const undoneReview: HistorySingleItem = {
    id: 'duyet-san-undone',
    label: 'Duyệt sân vườn',
    category: 'review',
    actor: ACTOR_LAN,
    timestampIso: '2026-09-07T08:20:00+07:00',
    relativeLabel: '40 phút trước',
    position: 'undone',
    entityRefs: [{ id: 'room-garden', label: 'sân vườn' }],
    kind: 'single',
    diff: { fieldLabel: 'Loại nền #sân vườn', beforeText: 'cỏ tự nhiên', afterText: 'gạch lát' },
  };

  const items: readonly HistoryTimelineItem[] = [
    pastDiff,
    pastReview,
    current,
    batch,
    undoneEdit,
    undoneReview,
  ];

  return [
    {
      id: 'ngay-hom-nay',
      label: 'hôm nay',
      sessions: [
        {
          id: 'phien-sang',
          label: 'phiên sáng',
          items,
        },
      ],
    },
  ];
}

function createSuccessProps(): HistoryPanelProps {
  return {
    state: 'success',
    layout: 'panel',
    groups: createSuccessGroups(),
    visibleCount: 6,
    filters: { category: 'all', actorId: null },
    people: [ACTOR_LAN, ACTOR_MINH, ACTOR_AI],
    currentItemId: SUCCESS_CURRENT_ITEM_ID,
    canJump: true,
    partialReason: null,
    isCollapsed: false,
    error: null,
    ...NOOP_CALLBACKS,
  };
}

/* -------------------------------------------------------------------------- */
/* Kịch bản `empty`.                                                           */
/* -------------------------------------------------------------------------- */

function createEmptyProps(): HistoryPanelProps {
  return {
    state: 'empty',
    layout: 'panel',
    groups: [],
    visibleCount: 0,
    filters: { category: 'all', actorId: null },
    people: [],
    currentItemId: null,
    canJump: true,
    partialReason: null,
    isCollapsed: false,
    error: null,
    ...NOOP_CALLBACKS,
  };
}

/* -------------------------------------------------------------------------- */
/* Kịch bản `loading`.                                                         */
/* -------------------------------------------------------------------------- */

function createLoadingProps(): HistoryPanelProps {
  return {
    state: 'loading',
    layout: 'panel',
    groups: [],
    visibleCount: 0,
    filters: { category: 'all', actorId: null },
    people: [],
    currentItemId: null,
    canJump: false,
    partialReason: null,
    isCollapsed: false,
    error: null,
    ...NOOP_CALLBACKS,
  };
}

/* -------------------------------------------------------------------------- */
/* Kịch bản `partial` — hai lý do, xuất riêng để bài kiểm khẳng định cả hai.  */
/* -------------------------------------------------------------------------- */

function createPartialSingleItem(): HistorySingleItem {
  return {
    id: 'sua-mai-partial',
    label: 'Đổi độ dốc mái',
    category: 'edit',
    actor: ACTOR_LAN,
    timestampIso: '2026-09-06T09:00:00+07:00',
    relativeLabel: 'hôm qua',
    position: 'past',
    entityRefs: [{ id: 'roof-001', label: 'mái nhà' }],
    kind: 'single',
    diff: null,
  };
}

function createPartialGroups(): readonly HistoryDayGroup[] {
  return [
    {
      id: 'ngay-hom-qua',
      label: 'hôm qua',
      sessions: [
        {
          id: 'phien-hom-qua',
          label: 'phiên chiều',
          items: [createPartialSingleItem()],
        },
      ],
    },
  ];
}

function createPartialProps(reason: HistoryPartialReason): HistoryPanelProps {
  return {
    state: 'partial',
    layout: 'panel',
    groups: createPartialGroups(),
    visibleCount: 1,
    filters: { category: 'all', actorId: null },
    people: [ACTOR_LAN],
    currentItemId: 'sua-mai-partial',
    canJump: true,
    partialReason: reason,
    isCollapsed: false,
    error: null,
    ...NOOP_CALLBACKS,
  };
}

/** Một phần vì đã chạm trần {@link HISTORY_MAX_STEPS} — bước cũ nhất sắp rơi khỏi đáy. */
export function createPartialAtStepLimitProps(): HistoryPanelProps {
  return createPartialProps('at-step-limit');
}

/** Một phần vì lịch sử cũ đã lưu trữ — có nút "Tải thêm". */
export function createPartialArchivedProps(): HistoryPanelProps {
  return createPartialProps('archived');
}

/* -------------------------------------------------------------------------- */
/* Kịch bản `error`.                                                           */
/* -------------------------------------------------------------------------- */

function createErrorProps(): HistoryPanelProps {
  return {
    state: 'error',
    layout: 'panel',
    groups: [],
    visibleCount: 0,
    filters: { category: 'all', actorId: null },
    people: [],
    currentItemId: null,
    canJump: false,
    partialReason: null,
    isCollapsed: false,
    error: new Error('Không tải được lịch sử.'),
    ...NOOP_CALLBACKS,
  };
}

/* -------------------------------------------------------------------------- */
/* Kịch bản `forbidden` — không có quyền nhảy, người khác bị ẩn danh.         */
/* -------------------------------------------------------------------------- */

function createForbiddenGroups(): readonly HistoryDayGroup[] {
  const item: HistorySingleItem = {
    id: 'sua-tuong-nguoi-khac',
    label: 'Đổi vị trí tường',
    category: 'edit',
    actor: ACTOR_ANONYMOUS,
    timestampIso: '2026-09-07T06:00:00+07:00',
    relativeLabel: '3 giờ trước',
    position: 'past',
    entityRefs: [{ id: 'wall-099', label: 'tường W-099' }],
    kind: 'single',
    diff: null,
  };

  return [
    {
      id: 'ngay-hom-nay-forbidden',
      label: 'hôm nay',
      sessions: [{ id: 'phien-sang-forbidden', label: 'phiên sáng', items: [item] }],
    },
  ];
}

function createForbiddenProps(): HistoryPanelProps {
  return {
    state: 'forbidden',
    layout: 'panel',
    groups: createForbiddenGroups(),
    visibleCount: 1,
    filters: { category: 'all', actorId: null },
    people: [ACTOR_ANONYMOUS],
    currentItemId: 'sua-tuong-nguoi-khac',
    canJump: false,
    partialReason: null,
    isCollapsed: false,
    error: null,
    ...NOOP_CALLBACKS,
  };
}

/* -------------------------------------------------------------------------- */
/* Kịch bản `collapsed`.                                                       */
/* -------------------------------------------------------------------------- */

function createCollapsedProps(): HistoryPanelProps {
  return {
    ...createSuccessProps(),
    state: 'collapsed',
    isCollapsed: true,
  };
}

/* -------------------------------------------------------------------------- */
/* Bảng tra bảy trạng thái, và hàm dựng dùng chung cho test lẫn story.        */
/* -------------------------------------------------------------------------- */

export interface HistoryPanelScenario {
  readonly state: SevenState;
  readonly label: string;
  readonly props: HistoryPanelProps;
}

/** Bảy kịch bản, đúng thứ tự `SEVEN_STATES` của `src/lib/testing`. */
export function createHistoryPanelScenarios(): readonly HistoryPanelScenario[] {
  return [
    { state: 'empty', label: 'rỗng', props: createEmptyProps() },
    { state: 'loading', label: 'đang tải', props: createLoadingProps() },
    { state: 'partial', label: 'một phần', props: createPartialAtStepLimitProps() },
    { state: 'error', label: 'lỗi', props: createErrorProps() },
    { state: 'success', label: 'thành công', props: createSuccessProps() },
    { state: 'forbidden', label: 'không có quyền', props: createForbiddenProps() },
    { state: 'collapsed', label: 'thu gọn', props: createCollapsedProps() },
  ];
}

export const SUCCESS_SCENARIO_ITEM_IDS = {
  diffItemId: SUCCESS_DIFF_ITEM_ID,
  batchItemId: SUCCESS_BATCH_ITEM_ID,
  currentItemId: SUCCESS_CURRENT_ITEM_ID,
} as const;
