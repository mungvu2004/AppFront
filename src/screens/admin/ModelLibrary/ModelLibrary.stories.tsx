/**
 * Bảy trạng thái của {@link ModelLibrary} (A11 / R-63): rỗng, đang tải, một phần, lỗi,
 * thành công, không có quyền, thu gọn.
 *
 * Mọi story dựng view thuần — không hook, không cổng, không mạng — bằng `args` tĩnh, đúng
 * khuôn `VersionHistory.stories.tsx` (tên export ASCII, tiếng Anh — mục B/E.11 của CLAUDE.md;
 * nhãn tiếng Việt của từng trạng thái nằm trong chú thích ngay trên mỗi story).
 *
 * ## Dữ liệu: hai mẫu `LibraryItem` THẬT, chép nguyên văn — không bịa (R-70)
 *
 * `SAMPLE_TABLE_1`/`SAMPLE_TABLE_2` chép nguyên văn từ khảo sát dữ liệu L1-A, mục 2.1
 * (nguồn thật: `src/api/__mocks__/client.ts:418-438`). Mỗi hàng đi qua {@link toRowModel}:
 * cột số qua `formatLength`/`formatNumber`/`formatFileSize` thật của `src/lib/format`,
 * `isHeavy`/`heavyAdvice` đo qua `checkBudget`/`SCENE_BUDGET.maxTriangles` thật của
 * `src/lib/three/perf/budget` — không ngưỡng nào viết tay ở đây.
 *
 * ## Bốn cột không có nguồn — và ba hành động ghi không tồn tại
 *
 * `types.ts` đã ghi rõ: `canUploadModel`/`canChangeGroup`/`canDeprecate`/`canDelete`/
 * `canOptimizeMesh`/`canCountUsage`/`canListAliases`/`canShowProvenance` đều `false` trong
 * bản này — không nguồn dữ liệu nào cho "Số dự án đang dùng", "Người tải lên", "Ngày",
 * "Trạng thái". Bộ dữ liệu dưới đây không đặt các trường đó vì `ModelLibraryRowModel`
 * không có chỗ cho chúng — đúng thứ `ModelLibrary.test.tsx` khẳng định là chúng RỜI KHỎI DOM.
 *
 * ## `./ModelLibrary` (view) đang được viết SONG SONG, CHƯA TỒN TẠI trong worktree này
 *
 * Đây là seam đã biết — Storybook (và `pnpm typecheck`) sẽ báo "failed to resolve"/
 * "Cannot find module" cho tới khi lớp gộp ghép view vào, đúng cách
 * `VersionHistory.stories.tsx` từng ở lớp L2-D của nó (xem git log `1f8f3b7`).
 *
 * **Không export thứ gì khác ngoài `meta` và bảy story** mà không khai qua
 * `meta.excludeStories` — một export không phải story làm Storybook trắng cả file.
 *
 * `ModelLibrary.test.tsx` nhập lại đúng ba hàm dựng ở đây (`buildModelLibraryProps`,
 * `toRowModel`, `buildDetail`) để story và bài kiểm nhìn CÙNG một dữ liệu (R-70), đúng khuôn
 * `RoomAreaPanel.stories.tsx` ↔ `RoomAreaPanel.test.tsx`.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { LIBRARY_FILTER_IDS, matchesLibraryFilter } from '@/api/contracts';
import type { LibraryFilterId, LibraryGroup, LibraryItem } from '@/api/client';
import { formatFileSize } from '@/lib/format/bytes';
import { formatLength } from '@/lib/format/measure';
import { formatNumber } from '@/lib/format/number';
import { checkBudget, SCENE_BUDGET } from '@/lib/three/perf/budget';

import { ModelLibrary } from './ModelLibrary';
import type {
  ModelLibraryActions,
  ModelLibraryCapabilities,
  ModelLibraryDetailModel,
  ModelLibraryFieldModel,
  ModelLibraryFilterOption,
  ModelLibraryModel,
  ModelLibraryProps,
  ModelLibraryRowModel,
  ModelLibrarySummaryModel,
  ModelPreviewModel,
  SevenState,
} from './types';

/* ==========================================================================
 * 0. Hai mẫu `LibraryItem` THẬT, chép nguyên văn (không bịa — R-70).
 * ========================================================================== */

/** `library-table-1` — `src/api/__mocks__/client.ts:418-427`. */
export const SAMPLE_TABLE_1: LibraryItem = {
  depthMm: 900,
  fileSizeBytes: 412_000,
  furnitureKind: 'table',
  group: 'table',
  heightMm: 750,
  id: 'library-table-1',
  modelUrl: 'https://example.com/library/library-table-1.glb',
  name: 'bàn ăn sáu chỗ',
  previewUrl: 'https://example.com/library/library-table-1.png',
  source: 'catalogue',
  triangleCount: 8_400,
  widthMm: 1_800,
};

/** `library-table-2` — `src/api/__mocks__/client.ts:428-438`. */
export const SAMPLE_TABLE_2: LibraryItem = {
  depthMm: 600,
  fileSizeBytes: 268_000,
  furnitureKind: 'table',
  group: 'table',
  heightMm: 750,
  id: 'library-table-2',
  modelUrl: 'https://example.com/library/library-table-2.glb',
  name: 'bàn làm việc chữ l',
  previewUrl: 'https://example.com/library/library-table-2.png',
  source: 'mine',
  triangleCount: 6_100,
  widthMm: 1_400,
};

const ALL_ITEMS: readonly LibraryItem[] = [SAMPLE_TABLE_1, SAMPLE_TABLE_2];

/* ==========================================================================
 * 1. Nhãn tiếng Việt của màn — không có nguồn nào khác trong repo để chép (khảo sát L1-A/L1-C
 *    không tìm thấy bản dịch nhóm thư viện đã có sẵn). "sofa" là từ mượn, không có dấu — bài
 *    kiểm truyền `allowWords: ['sofa']` cho `expectVietnamese` thay vì Việt hoá gượng ép.
 * ========================================================================== */

export const GROUP_LABEL_VI: Readonly<Record<LibraryGroup, string>> = {
  table: 'bàn',
  chair: 'ghế',
  bed: 'giường',
  sofa: 'ghế sofa',
  storage: 'tủ lưu trữ',
  sanitary: 'thiết bị vệ sinh',
  kitchen: 'bếp',
  technical: 'kỹ thuật',
};

const FILTER_LABEL_VI: Readonly<Record<LibraryFilterId, string>> = {
  all: 'tất cả',
  ...GROUP_LABEL_VI,
  mine: 'của tôi',
};

/** Trạng thái 6 (A11): câu nói vì sao chỉ xem được. */
export const READ_ONLY_REASON = 'Bạn chỉ có quyền xem thư viện model, không thể quản lý.';

/** Trạng thái 4 (A11). */
export const ERROR_MESSAGE = 'Không tải được thư viện model. Kiểm tra kết nối rồi thử lại.';

const AUTO_SPIN_NOTE = 'Chưa hỗ trợ tự quay; bạn vẫn quay được bằng tay.';

/* ==========================================================================
 * 2. `LibraryItem` → `ModelLibraryRowModel` — cột số qua `src/lib/format` thật,
 *    `isHeavy`/`heavyAdvice` qua `checkBudget`/`SCENE_BUDGET` thật (R-70, A15).
 * ========================================================================== */

const METRE_SUFFIX = ' m';

/** Bỏ hậu tố "m" để nối ba chiều lại thành MỘT đơn vị cuối câu — khuôn ở `types.ts:70`. */
function withoutMetreSuffix(text: string): string {
  return text.endsWith(METRE_SUFFIX) ? text.slice(0, -METRE_SUFFIX.length) : text;
}

/** `"1,80 × 0,90 × 0,75 m"` — cả ba chiều qua `formatLength` thật, không tự quy đổi mm→m. */
function buildBoundsLabel(item: LibraryItem): string {
  const width = withoutMetreSuffix(formatLength(item.widthMm, { unit: 'm' }));
  const depth = withoutMetreSuffix(formatLength(item.depthMm, { unit: 'm' }));
  const height = formatLength(item.heightMm, { unit: 'm' });

  return `${width} × ${depth} × ${height}`;
}

/**
 * Đo `isHeavy`/`heavyAdvice` bằng đúng hàm ngân sách cảnh 3D thật — không viết tay ngưỡng
 * 900.000 ở đây (xem cảnh báo dài trong `types.ts` về `SCENE_BUDGET.maxTriangles`).
 */
function measureHeaviness(triangleCount: number): { isHeavy: boolean; heavyAdvice: string | null } {
  const warnings = checkBudget({ drawCalls: 0, triangles: triangleCount, materials: 0, graphicsMemoryMb: 0 });
  const triangleWarning = warnings.find((warning) => warning.metric === 'triangles') ?? null;

  return {
    isHeavy: triangleCount > SCENE_BUDGET.maxTriangles,
    heavyAdvice: triangleWarning?.message ?? null,
  };
}

/** `LibraryItem` (hợp đồng dữ liệu) → `ModelLibraryRowModel` (hợp đồng màn), tường minh. */
export function toRowModel(
  item: LibraryItem,
  overrides: Partial<ModelLibraryRowModel> = {},
): ModelLibraryRowModel {
  const heaviness = measureHeaviness(item.triangleCount);

  return {
    id: item.id,
    name: item.name,
    groupLabel: GROUP_LABEL_VI[item.group],
    boundsLabel: buildBoundsLabel(item),
    triangleCountLabel: formatNumber(item.triangleCount),
    fileSizeLabel: formatFileSize(item.fileSizeBytes),
    triangleCount: item.triangleCount,
    fileSizeBytes: item.fileSizeBytes,
    boundsVolumeMm3: item.widthMm * item.depthMm * item.heightMm,
    previewUrl: item.previewUrl ?? null,
    isPreviewBroken: false,
    isHeavy: heaviness.isHeavy,
    heavyAdvice: heaviness.heavyAdvice,
    ...overrides,
  };
}

const ALL_ROWS: readonly ModelLibraryRowModel[] = ALL_ITEMS.map((item) => toRowModel(item));

/* ==========================================================================
 * 3. Dải tóm tắt, chip lọc, cổng năng lực — tất cả tính từ dữ liệu thật ở trên.
 * ========================================================================== */

function buildSummary(rows: readonly ModelLibraryRowModel[]): ModelLibrarySummaryModel {
  const totalSizeBytes = rows.reduce((sum, row) => sum + row.fileSizeBytes, 0);
  const heavyCount = rows.filter((row) => row.isHeavy).length;

  return {
    totalCountLabel: formatNumber(rows.length),
    totalSizeLabel: formatFileSize(totalSizeBytes),
    heavyCountLabel: formatNumber(heavyCount),
    isAllWithinBudget: heavyCount === 0,
  };
}

/** Mười chip, đúng thứ tự `LIBRARY_FILTER_IDS` thật — không tự liệt kê lại tám nhóm. */
function buildFilterOptions(items: readonly LibraryItem[]): readonly ModelLibraryFilterOption[] {
  return LIBRARY_FILTER_IDS.map((id) => ({
    id,
    label: FILTER_LABEL_VI[id],
    count: items.filter((item) => matchesLibraryFilter(item, id)).length,
  }));
}

/**
 * Đúng các giá trị `types.ts` ghi là sự thật hôm nay: `canPreview3d`/`canFlagHeavy` thật,
 * bảy khả năng ghi còn lại đều `false` vì không có endpoint nào ở bất kỳ tầng nào.
 */
export const CAPABILITIES_BASE: ModelLibraryCapabilities = {
  canPreview3d: true,
  canFlagHeavy: true,
  canManage: true,
  canUploadModel: false,
  canChangeGroup: false,
  canDeprecate: false,
  canDelete: false,
  canOptimizeMesh: false,
  canCountUsage: false,
  canListAliases: false,
  canShowProvenance: false,
  canAutoSpin: false,
};

/* ==========================================================================
 * 4. Panel chi tiết + khung xem trước — dùng khi một story/bài kiểm cần panel đang mở.
 * ========================================================================== */

function buildPreview(overrides: Partial<ModelPreviewModel> = {}): ModelPreviewModel {
  return {
    state: 'ready',
    measuredTriangleCountLabel: null,
    errorMessage: null,
    autoSpinNote: AUTO_SPIN_NOTE,
    ...overrides,
  };
}

function buildFields(row: ModelLibraryRowModel): readonly ModelLibraryFieldModel[] {
  return [
    { label: 'kích thước bao', value: row.boundsLabel, isNumeric: true },
    { label: 'số tam giác', value: row.triangleCountLabel, isNumeric: true },
    { label: 'dung lượng', value: row.fileSizeLabel, isNumeric: true },
    { label: 'nhóm', value: row.groupLabel, isNumeric: false },
  ];
}

/** Panel chi tiết của MỘT hàng, đã mở, khung xem trước ở trạng thái "sẵn sàng". */
export function buildDetail(
  row: ModelLibraryRowModel,
  overrides: Partial<ModelLibraryDetailModel> = {},
): ModelLibraryDetailModel {
  return {
    item: row,
    fields: buildFields(row),
    preview: buildPreview(),
    ...overrides,
  };
}

/* ==========================================================================
 * 5. Bảy trạng thái → `ModelLibraryModel` đầy đủ.
 * ========================================================================== */

function finishModel(state: SevenState, partial: Partial<ModelLibraryModel>): ModelLibraryModel {
  const rows = partial.rows ?? [];

  return {
    state,
    capabilities: CAPABILITIES_BASE,
    rows,
    summary: buildSummary(rows),
    viewMode: 'table',
    sortKey: 'name',
    sortDirection: 'asc',
    searchText: '',
    filterId: 'all',
    filterOptions: buildFilterOptions([]),
    detail: null,
    isNarrow: state === 'collapsed',
    errorMessage: null,
    readOnlyReason: null,
    isLibraryEmpty: false,
    ...partial,
  };
}

function buildBaseModel(state: SevenState): ModelLibraryModel {
  switch (state) {
    case 'empty':
      return finishModel(state, { rows: [], isLibraryEmpty: true, filterOptions: buildFilterOptions([]) });
    case 'loading':
      return finishModel(state, { rows: [], filterOptions: buildFilterOptions([]) });
    case 'partial':
      return finishModel(state, {
        rows: ALL_ROWS.slice(0, 1),
        filterOptions: buildFilterOptions(ALL_ITEMS.slice(0, 1)),
      });
    case 'error':
      return finishModel(state, { rows: [], errorMessage: ERROR_MESSAGE, filterOptions: buildFilterOptions([]) });
    case 'forbidden':
      return finishModel(state, {
        rows: ALL_ROWS,
        capabilities: { ...CAPABILITIES_BASE, canManage: false },
        readOnlyReason: READ_ONLY_REASON,
        filterOptions: buildFilterOptions(ALL_ITEMS),
      });
    case 'success':
      return finishModel(state, { rows: ALL_ROWS, filterOptions: buildFilterOptions(ALL_ITEMS) });
    case 'collapsed':
      return finishModel(state, { rows: ALL_ROWS, filterOptions: buildFilterOptions(ALL_ITEMS) });
  }
}

/** Story là ảnh tĩnh của một trạng thái; các hành động rời màn không làm gì (khuôn `RoomAreaPanel.stories.tsx`). */
const noop = (): void => {
  /* Story không hook, không cổng — chỗ nối có mặt để component gắn được. */
};

function buildNoopActions(): ModelLibraryActions {
  return {
    setSearchText: noop,
    setFilter: noop,
    setViewMode: noop,
    sortBy: noop,
    openDetail: noop,
    closeDetail: noop,
    attachPreviewCanvas: noop,
    retryPreviewImage: noop,
    retryLoad: noop,
  };
}

/** Props của một trạng thái, cho cả story và bài kiểm — một nguồn dữ liệu (R-70). */
export function buildModelLibraryProps(
  state: SevenState,
  overrides: Partial<ModelLibraryModel> = {},
): ModelLibraryProps {
  return {
    model: { ...buildBaseModel(state), ...overrides },
    actions: buildNoopActions(),
  };
}

/* ==========================================================================
 * 6. Bảy story.
 * ========================================================================== */

const meta = {
  title: 'Screens/Admin/ModelLibrary',
  component: ModelLibrary,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  /* Chín export trên đây không phải story — thiếu dòng này Storybook nhận nhầm và cả file
     ra trắng. */
  excludeStories: [
    'CAPABILITIES_BASE',
    'ERROR_MESSAGE',
    'GROUP_LABEL_VI',
    'READ_ONLY_REASON',
    'SAMPLE_TABLE_1',
    'SAMPLE_TABLE_2',
    'buildDetail',
    'buildModelLibraryProps',
    'toRowModel',
  ],
} satisfies Meta<typeof ModelLibrary>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 1 · rỗng — thư viện chưa có model nào (khác "lọc ra rỗng"). */
export const Empty: Story = { args: buildModelLibraryProps('empty') };

/** 2 · đang tải — chưa có hàng nào hiện, đang chờ máy chủ. */
export const Loading: Story = { args: buildModelLibraryProps('loading') };

/** 3 · một phần — mới tải được một trong hai model. */
export const Partial: Story = { args: buildModelLibraryProps('partial') };

/** 4 · lỗi — không tải được thư viện, kèm lời báo hỏng. */
export const ErrorState: Story = { args: buildModelLibraryProps('error') };

/** 5 · thành công — hai model thật, cả hai đều dưới ngân sách tam giác. */
export const Success: Story = { args: buildModelLibraryProps('success') };

/** 6 · không có quyền — bảng vẫn xem được, mọi hành động ghi rời khỏi DOM kèm lý do. */
export const Forbidden: Story = { args: buildModelLibraryProps('forbidden') };

/** 7 · thu gọn — dưới 1024: bảng thành thẻ, panel chi tiết thành lớp phủ. */
export const Collapsed: Story = { args: buildModelLibraryProps('collapsed') };
