/**
 * Bộ kiểm của L2-4 cho màn `ModelLibrary` — bốn nhóm của mục 2 đặc tả brief, viết CHỈ từ
 * hợp đồng (`types.ts`), không đợi mã hiện thực (R-60/mục D).
 *
 * ## Vì sao view đi qua `import()` thay vì `import … from …`
 *
 * `./ModelLibrary` (view) là việc của một worker khác, viết SONG SONG trên nhánh riêng; tại
 * thời điểm file này được viết nó CHƯA TỒN TẠI trong worktree này. Một `import` TĨNH của một
 * đường dẫn không tồn tại làm Vite sập lúc transform và không một test nào trong cả file chạy
 * được (đã đo ở `VersionHistory.test.tsx`/`ShareDialog.test.tsx`). Giấu đường dẫn sau một
 * biến, kèm chú thích vite-ignore ngay trước lời gọi `import()`, hoãn việc phân giải sang
 * đúng lúc CHẠY, nên một import hỏng chỉ làm hỏng ĐÚNG một `it` — và vì tham số là một biến
 * (không phải chuỗi literal), TypeScript
 * không cố phân giải module tại lúc typecheck, nên `pnpm typecheck` không đỏ vì việc này.
 *
 * Vì thế mọi bài dưới đây HỎNG RIÊNG LẺ với "Failed to resolve" cho tới khi lớp gộp ghép view
 * thật vào — đó là DỰ KIẾN (R-70: không sửa test cho khớp code chưa tồn tại), không phải thất
 * bại. **Bộ này chưa chạy trọn vẹn ở lớp L2 — nó sẽ chạy thật ở lớp gộp** (E.10: không báo
 * "đạt" cho một bước chưa chạy).
 *
 * ## Dữ liệu KHÔNG nhập từ `ModelLibrary.stories.tsx` — đo thật, không phải chép nhầm
 *
 * `ModelLibrary.stories.tsx` nhập TĨNH `./ModelLibrary` (component, cho `Meta<typeof …>` của
 * Storybook — đúng khuôn `VersionHistory.stories.tsx`). Một `import … from …` TĨNH của một
 * đường dẫn không tồn tại làm Vite sập lúc transform CẢ MODULE — khác `import()` động, nó
 * không dừng ở một `it`. Nếu file này `import { buildModelLibraryProps } from
 * './ModelLibrary.stories'`, lỗi transform của `stories.tsx` lan ngược lên đây và **không một
 * `it` nào trong cả file chạy được** (đã đo trực tiếp: `npx vitest run` báo "0 test" thay vì
 * một số `it` đỏ như dự kiến). Vì phạm vi sửa của L2-4 chỉ có đúng hai file (không có
 * `versionHistoryFixtures.ts`-kiểu file thứ ba như L2-D của `VersionHistory`), các hàm dựng dữ
 * liệu bên dưới là bản SONG SONG, tự chứa, không nhập từ `stories.tsx` — cùng công thức (cùng
 * hai `LibraryItem` thật, cùng `formatLength`/`formatNumber`/`formatFileSize`/`checkBudget`
 * thật), chỉ khác chỗ định nghĩa vì ràng buộc "chỉ hai file" không cho phép một module dùng
 * chung an toàn với `stories.tsx` ở đây.
 */

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { ComponentType } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockApiClient } from '@/api/__mocks__/client';
import type { LibraryFilterId, LibraryGroup, LibraryItem } from '@/api/client';
import { LIBRARY_FILTER_IDS, matchesLibraryFilter } from '@/api/contracts';
import { formatFileSize } from '@/lib/format/bytes';
import { formatLength } from '@/lib/format/measure';
import { formatNumber } from '@/lib/format/number';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';
import { createSevenStateScenarios, SEVEN_STATES } from '@/lib/testing/sevenStateScenarios';
import { checkBudget, SCENE_BUDGET } from '@/lib/three/perf/budget';

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
 * Dữ liệu mẫu — bản tự chứa, cùng công thức với `ModelLibrary.stories.tsx` (xem docblock).
 * ========================================================================== */

/** `library-table-1` — `src/api/__mocks__/client.ts:418-427`, chép nguyên văn (R-70). */
const SAMPLE_TABLE_1: LibraryItem = {
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

/** `library-table-2` — `src/api/__mocks__/client.ts:428-438`, chép nguyên văn (R-70). */
const SAMPLE_TABLE_2: LibraryItem = {
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

const GROUP_LABEL_VI: Readonly<Record<LibraryGroup, string>> = {
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

const READ_ONLY_REASON = 'Bạn chỉ có quyền xem thư viện model, không thể quản lý.';
const ERROR_MESSAGE = 'Không tải được thư viện model. Kiểm tra kết nối rồi thử lại.';
const AUTO_SPIN_NOTE = 'Chưa hỗ trợ tự quay; bạn vẫn quay được bằng tay.';

const METRE_SUFFIX = ' m';

function withoutMetreSuffix(text: string): string {
  return text.endsWith(METRE_SUFFIX) ? text.slice(0, -METRE_SUFFIX.length) : text;
}

/** `"1,80 × 0,90 × 0,75 m"` — ba chiều qua `formatLength` thật (A15, `types.ts:70`). */
function buildBoundsLabel(item: LibraryItem): string {
  const width = withoutMetreSuffix(formatLength(item.widthMm, { unit: 'm' }));
  const depth = withoutMetreSuffix(formatLength(item.depthMm, { unit: 'm' }));
  const height = formatLength(item.heightMm, { unit: 'm' });

  return `${width} × ${depth} × ${height}`;
}

/** Đo `isHeavy`/`heavyAdvice` qua `checkBudget`/`SCENE_BUDGET` thật — không viết tay 900.000. */
function measureHeaviness(triangleCount: number): { isHeavy: boolean; heavyAdvice: string | null } {
  const warnings = checkBudget({ drawCalls: 0, triangles: triangleCount, materials: 0, graphicsMemoryMb: 0 });
  const triangleWarning = warnings.find((warning) => warning.metric === 'triangles') ?? null;

  return {
    isHeavy: triangleCount > SCENE_BUDGET.maxTriangles,
    heavyAdvice: triangleWarning?.message ?? null,
  };
}

/** `LibraryItem` (hợp đồng dữ liệu) → `ModelLibraryRowModel` (hợp đồng màn), tường minh. */
function toRowModel(item: LibraryItem, overrides: Partial<ModelLibraryRowModel> = {}): ModelLibraryRowModel {
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

function buildFilterOptions(items: readonly LibraryItem[]): readonly ModelLibraryFilterOption[] {
  return LIBRARY_FILTER_IDS.map((id) => ({
    id,
    label: FILTER_LABEL_VI[id],
    count: items.filter((item) => matchesLibraryFilter(item, id)).length,
  }));
}

const CAPABILITIES_BASE: ModelLibraryCapabilities = {
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
function buildDetail(row: ModelLibraryRowModel, overrides: Partial<ModelLibraryDetailModel> = {}): ModelLibraryDetailModel {
  return {
    item: row,
    fields: buildFields(row),
    preview: buildPreview(),
    ...overrides,
  };
}

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

function buildNoopActions(): ModelLibraryActions {
  const noop = (): void => {
    /* Bộ dựng props mặc định không hành động; từng `it` tự thay bằng `buildActions()` khi cần theo dõi lời gọi. */
  };

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

function buildModelLibraryProps(state: SevenState, overrides: Partial<ModelLibraryModel> = {}): ModelLibraryProps {
  return {
    model: { ...buildBaseModel(state), ...overrides },
    actions: buildNoopActions(),
  };
}

afterEach(() => {
  cleanup();
});

/* ==========================================================================
 * 0. Hạ tầng: nhập file cùng thư mục qua biến, không qua chuỗi tĩnh (xem đầu file).
 * ========================================================================== */

async function importFromScreen<T>(specifier: string): Promise<T> {
  return import(/* @vite-ignore */ specifier) as Promise<T>;
}

async function loadModelLibraryView(): Promise<ComponentType<ModelLibraryProps>> {
  const mod = await importFromScreen<{ ModelLibrary: ComponentType<ModelLibraryProps> }>('./ModelLibrary');

  return mod.ModelLibrary;
}

/** Actions với `vi.fn()` — mỗi lời gọi tạo bộ MỚI, không rò số lần gọi giữa các `it`. */
function buildActions(overrides: Partial<ModelLibraryActions> = {}): ModelLibraryActions {
  return {
    setSearchText: vi.fn(),
    setFilter: vi.fn(),
    setViewMode: vi.fn(),
    sortBy: vi.fn(),
    openDetail: vi.fn(),
    closeDetail: vi.fn(),
    attachPreviewCanvas: vi.fn(),
    retryPreviewImage: vi.fn(),
    retryLoad: vi.fn(),
    ...overrides,
  };
}

/** Ô bảng (`td`/`role=cell`/`role=gridcell`) chứa đúng chuỗi đã cho — không giả định đánh dấu cụ thể hơn thế. */
function findNumericCell(text: string): HTMLElement {
  const matches = screen.getAllByText(text);
  const cell = matches
    .map((node) => node.closest<HTMLElement>('td, [role="cell"], [role="gridcell"]'))
    .find((candidate): candidate is HTMLElement => candidate !== null);

  if (cell === undefined) {
    throw new Error(`findNumericCell: không tìm thấy ô bảng chứa "${text}".`);
  }

  return cell;
}

function firstRowOf(props: ModelLibraryProps): ModelLibraryRowModel {
  const [row] = props.model.rows;

  if (row === undefined) {
    throw new Error('firstRowOf: kịch bản này cần ít nhất một hàng.');
  }

  return row;
}

/* ==========================================================================
 * 1. `expectSevenStates` — 7/7 (R-63).
 * ========================================================================== */

describe('A11 — bảy trạng thái của ModelLibrary', () => {
  it('dựng đủ bảy, không trạng thái nào ra màn trắng', async () => {
    const ModelLibraryView = await loadModelLibraryView();
    const covered: string[] = [];

    expectSevenStates((scenario) => {
      covered.push(scenario.label);

      return renderWithProviders(<ModelLibraryView {...buildModelLibraryProps(scenario.state)} />);
    }, createSevenStateScenarios());

    expect(covered).toHaveLength(SEVEN_STATES.length);
  });
});

/* ==========================================================================
 * 2. Tiếp cận được (R-72) — ít nhất "thành công" và "thu gọn", theo brief mục 2.
 * ========================================================================== */

describe('R-72 — expectAccessible trên cây render thật', () => {
  it('trạng thái "thành công" tiếp cận được', async () => {
    const ModelLibraryView = await loadModelLibraryView();

    renderWithProviders(<ModelLibraryView {...buildModelLibraryProps('success')} />);

    expectAccessible(document.body, { ignoreSelector: '[role="dialog"]' });
  });

  it('trạng thái "thu gọn" tiếp cận được', async () => {
    const ModelLibraryView = await loadModelLibraryView();

    renderWithProviders(<ModelLibraryView {...buildModelLibraryProps('collapsed')} />);

    expectAccessible(document.body, { ignoreSelector: '[role="dialog"]' });
  });
});

/* ==========================================================================
 * 3. Toàn chữ tiếng Việt có dấu (R-67). "sofa" là từ mượn không dấu, cho qua qua allowWords
 *    thay vì Việt hoá gượng ép — xem `ModelLibrary.stories.tsx` mục 1.
 * ========================================================================== */

describe('R-67 — expectVietnamese trên cây render thật', () => {
  it('trạng thái "thành công": toàn chữ tiếng Việt có dấu, trừ từ mượn "sofa"', async () => {
    const ModelLibraryView = await loadModelLibraryView();
    const { container } = renderWithProviders(<ModelLibraryView {...buildModelLibraryProps('success')} />);

    expectVietnamese(container, {
      allowWords: ['sofa'],
      ignore: [/^https?:\/\//u, /^[\w.+-]+@[\w-]+\.[\w.-]+$/u],
    });
  });
});

/* ==========================================================================
 * 4. Khẳng định riêng của màn này (brief mục 2, nhóm 4).
 * ========================================================================== */

describe('ba cột số mang font-mono tabular-nums và luôn nhìn thấy', () => {
  it('boundsLabel, triangleCountLabel, fileSizeLabel đều mang cả hai class, không bị ẩn', async () => {
    const ModelLibraryView = await loadModelLibraryView();
    const props = buildModelLibraryProps('success');
    const row = firstRowOf(props);

    renderWithProviders(<ModelLibraryView {...props} />);

    for (const label of [row.boundsLabel, row.triangleCountLabel, row.fileSizeLabel]) {
      const cell = findNumericCell(label);

      expect(cell.className, `ô "${label}"`).toMatch(/(?:^|\s)font-mono(?:\s|$)/u);
      expect(cell.className, `ô "${label}"`).toMatch(/(?:^|\s)tabular-nums(?:\s|$)/u);
      expect(cell, `ô "${label}"`).toBeVisible();
    }
  });
});

describe('row.isHeavy: đúng MỘT badge "Nặng", không có mức thứ hai', () => {
  /*
   * `types.ts` ghi rõ: đặc tả đòi ngưỡng mềm và ngưỡng cứng, nhưng `SCENE_BUDGET` chỉ có MỘT
   * ngưỡng tam giác (900.000, `src/lib/three/perf/budget.ts:92`) và repo không có
   * `maxTrianglesPerModel`. Bài này khẳng định đúng một mức để nó không lặng lẽ mọc lại sau
   * (R-71 cấm bịa ngưỡng mềm). Hàng nặng lấy từ mock THẬT, không gán tay `isHeavy: true`.
   */
  it('hàng vượt SCENE_BUDGET.maxTriangles hiện đúng 1 "Nặng"; hàng nhẹ không hiện; không có mức "rất nặng"', async () => {
    const ModelLibraryView = await loadModelLibraryView();

    const listing = await mockApiClient.library.list();

    expect(listing.ok, 'mockApiClient.library.list() phải luôn ok trong mock').toBe(true);
    if (!listing.ok) {
      return;
    }

    const heavySource = listing.data.find((item) => item.id === 'library-technical-2');

    expect(heavySource, 'thiếu library-technical-2 trong mock — mục nặng để đối chiếu').toBeDefined();
    if (heavySource === undefined) {
      return;
    }

    const heavyRow = toRowModel(heavySource);

    expect(heavyRow.isHeavy, 'library-technical-2 (1.240.000 tam giác) phải vượt SCENE_BUDGET').toBe(true);
    expect(heavyRow.heavyAdvice).not.toBeNull();

    const lightProps = buildModelLibraryProps('success');
    const lightRow = firstRowOf(lightProps);

    expect(lightRow.isHeavy, 'hai mẫu bàn (6.100/8.400 tam giác) phải dưới SCENE_BUDGET').toBe(false);

    const props = buildModelLibraryProps('success', { rows: [lightRow, heavyRow] });

    renderWithProviders(<ModelLibraryView {...props} />);

    expect(screen.getAllByText(/^nặng$/iu)).toHaveLength(1);
    expect(screen.queryByText(/rất nặng|nghiêm trọng|mức 2/iu)).toBeNull();
  });
});

describe('bốn cột không có nguồn KHÔNG xuất hiện trong DOM (chặn R-69 bị lách bằng cột rỗng)', () => {
  it('Số dự án đang dùng · Người tải lên · Ngày · Trạng thái: vắng mặt hoàn toàn', async () => {
    const ModelLibraryView = await loadModelLibraryView();

    renderWithProviders(<ModelLibraryView {...buildModelLibraryProps('success')} />);

    for (const label of ['Số dự án đang dùng', 'Người tải lên', 'Ngày', 'Trạng thái']) {
      expect(screen.queryByText(label, { exact: true }), `cột "${label}"`).toBeNull();
      expect(
        screen.queryByRole('columnheader', { name: new RegExp(`^${label}$`, 'iu') }),
        `tiêu đề cột "${label}"`,
      ).toBeNull();
    }
  });
});

describe('mọi hành động ghi RỜI KHỎI DOM (không phải disabled) — capabilities tương ứng đều false', () => {
  it('không nút "Tải lên model", không dải hành động lô, không nút tối ưu lưới, không hộp thoại xoá', async () => {
    const ModelLibraryView = await loadModelLibraryView();
    const props = buildModelLibraryProps('success', { detail: null });

    renderWithProviders(<ModelLibraryView {...props} />);

    expect(screen.queryByRole('button', { name: /tải lên model/iu })).toBeNull();
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(screen.queryByRole('button', { name: /tối ưu lưới/iu })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: /xoá/iu })).toBeNull();
  });
});

describe('sắp xếp: bấm Table.Head gọi actions.sortBy đúng khoá', () => {
  /*
   * `types.ts:239` ghi rõ: "Bấm lại cùng cột thì đảo chiều — logic ở HOOK, view chỉ báo cột
   * nào bị bấm." Nên view chỉ có nghĩa vụ gọi `sortBy(key)` — CÙNG khoá cả hai lần bấm; việc
   * đảo `sortDirection` là của hook (L2-2, ngoài phạm vi file này). Phần "bấm lại đảo chiều"
   * mà brief nêu được kiểm ở khía cạnh view THẬT SỰ sở hữu: `aria-sort` phản chiếu đúng
   * `model.sortDirection` khi prop đổi (đo bằng rerender, không cần hook).
   */
  it('bấm cột "Số tam giác": actions.sortBy("triangles") được gọi, CÙNG khoá ở lần bấm thứ hai', async () => {
    const ModelLibraryView = await loadModelLibraryView();
    const actions = buildActions();
    const props = { model: buildModelLibraryProps('success').model, actions };

    renderWithProviders(<ModelLibraryView {...props} />);

    const header = screen.getByRole('columnheader', { name: /số tam giác/iu });

    fireEvent.click(header);
    fireEvent.click(header);

    expect(actions.sortBy).toHaveBeenCalledTimes(2);
    expect(actions.sortBy).toHaveBeenNthCalledWith(1, 'triangles');
    expect(actions.sortBy).toHaveBeenNthCalledWith(2, 'triangles');
  });

  it('đổi model.sortDirection (do hook điều khiển) phản ánh đúng aria-sort trên cột đang sắp xếp', async () => {
    const ModelLibraryView = await loadModelLibraryView();
    const ascending = buildModelLibraryProps('success', { sortKey: 'triangles', sortDirection: 'asc' });

    const { rerender } = renderWithProviders(<ModelLibraryView {...ascending} />);

    expect(screen.getByRole('columnheader', { name: /số tam giác/iu })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    const descending = buildModelLibraryProps('success', { sortKey: 'triangles', sortDirection: 'desc' });

    rerender(<ModelLibraryView {...descending} />);

    expect(screen.getByRole('columnheader', { name: /số tam giác/iu })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });
});

describe('Esc gọi actions.closeDetail khi panel chi tiết đang mở', () => {
  it('bấm Esc: closeDetail được gọi', async () => {
    const ModelLibraryView = await loadModelLibraryView();
    const actions = buildActions();
    const base = buildModelLibraryProps('success');
    const row = firstRowOf(base);
    const props = { model: { ...base.model, detail: buildDetail(row) }, actions };

    renderWithProviders(<ModelLibraryView {...props} />);

    // Bẫy tiêu điểm/phím tắt có thể gắn listener sau một `requestAnimationFrame` (khuôn
    // `ShareDialog.test.tsx`), nên phép bấm được thử lại tới khi listener có mặt.
    await waitFor(() => {
      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(actions.closeDetail).toHaveBeenCalled();
    });
  });
});

describe('trạng thái 6: capabilities.canManage === false thì hiện readOnlyReason', () => {
  it('trạng thái "không có quyền": readOnlyReason có mặt trong DOM', async () => {
    const ModelLibraryView = await loadModelLibraryView();
    const props = buildModelLibraryProps('forbidden');

    expect(props.model.capabilities.canManage).toBe(false);
    expect(props.model.readOnlyReason).not.toBeNull();

    renderWithProviders(<ModelLibraryView {...props} />);

    expect(screen.getByText(props.model.readOnlyReason as string)).toBeTruthy();
  });

  it('trạng thái "thành công": canManage true, readOnlyReason null', () => {
    const props = buildModelLibraryProps('success');

    expect(props.model.capabilities.canManage).toBe(true);
    expect(props.model.readOnlyReason).toBeNull();
  });
});
