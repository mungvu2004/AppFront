/**
 * Lượt kiểm của PANEL THƯ VIỆN NỘI THẤT, đã ráp ba nhánh (hợp đồng T4, view T6,
 * hook T5) cộng container của lượt tích hợp này.
 *
 * Ba bộ khẳng định dùng chung của repo cộng ba phép nghiệm thu mà chỉ panel đã
 * ráp mới trả lời được:
 *
 * | mã | đo cái gì | ngưỡng |
 * |---|---|---|
 * | `[N1]` | `expectSevenStates` | 7/7, không trạng thái nào ra màn trắng |
 * | `[N2]` | `expectAccessible` cả bảy trạng thái + hộp xem trước | 8/8 lượt dựng |
 * | `[N3]` | `expectVietnamese` cả bảy trạng thái + hộp xem trước, soát cả `aria-label` và `alt` | 8/8 lượt dựng |
 * | `[N4]` | "Thay thế tất cả" lớp sofa: danh sách xem trước, và số thay đổi TRƯỚC khi xác nhận | 4 mục, 0 thay đổi |
 * | `[N5]` | chỉ SAU khi xác nhận mới áp: bốn món được thay | 4 món mới, 0 mã cũ còn lại |
 * | `[N5b]` | xoá + thêm chạy trong MỘT `runTransaction` | 8 lệnh → 1 bước hoàn tác ở tầng lệnh |
 * | `[N6]` | không có quyền: nút tải lên, thẻ xem được, thẻ kéo được | 0 nút, 16 thẻ, 0 thẻ kéo được |
 * | `[N6b]` | R-73: container gắn bằng ĐÚNG một thẻ hai prop | 16 thẻ, 0 nút tải lên |
 *
 * Mọi con số ấy được **in ra** khi chạy: một bản nghiệm thu cần con số thật chứ
 * không chỉ một lời khẳng định đã xanh (E.10).
 *
 * ## Hai lối dựng, mỗi lối cho một loại câu hỏi
 *
 * - **Từ props** (`scenarioFor` của `FurnitureLibraryPanel.stories.tsx`) cho ba
 *   bộ khẳng định và cho `[N1]`: view là hàm thuần của `state` và hợp đồng nói
 *   rõ nó phải kiểm được CHỈ từ props (mục D). Bảy kịch bản ấy LÀ bảy story —
 *   hai nơi kể một câu chuyện thì phải kể từ cùng một nguồn (R-70), nên không
 *   một dữ liệu mẫu nào được gõ lại ở file này.
 * - **Đã nối dây** ({@link WiredFurnitureLibraryPanel}) cho `[N4]`–`[N6b]`: bốn
 *   câu hỏi đó nói về LỆNH, về ngăn xếp hoàn tác và về phân quyền — dựng props
 *   bằng tay ở đó nghĩa là tự gõ lại đúng thứ đang cần chứng minh, và một bài
 *   kiểm như vậy không kiểm gì cả (R-70).
 *
 * Đồ thị luôn là bộ mẫu chuẩn của A14 (`@/lib/testing/fixtures` — 4 tầng, 48
 * tường, 21 món đồ đạc, 14 phòng, 248,60 m²), danh mục model luôn là
 * `src/api/__mocks__/client.ts` (16 mục, 2 mục thiếu ảnh xem trước), và bốn món
 * đồ đạc của `[N4]` được đặt vào bằng ĐÚNG đường lệnh `createAddFurnitureCommand`
 * chứ không phải bằng một đồ thị bịa tại chỗ (R-70).
 *
 * ## "Lớp sofa" trong mã tên là gì
 *
 * Đặc tả gọi lớp YOLO ấy là "sofa (4)". Trong mã KHÔNG có `FurnitureKind` nào
 * tên `sofa`: `FURNITURE_KIND_BY_LIBRARY_GROUP` (`src/api/schemas/library.ts`)
 * ánh xạ nhóm thư viện `sofa` sang `furnitureKind: 'chair'`, và
 * `FURNITURE_KIND_LABELS['chair']` là `"ghế"` — nên nhóm đã phát hiện của bốn
 * chiếc sofa hiện trên màn là `"ghế (4)"`. Bài kiểm bám vào ánh xạ THẬT ấy chứ
 * không gõ một nhãn `"sofa (4)"` mà sản phẩm không bao giờ sinh ra.
 *
 * ## Vì sao `ignoreSelector: '[role="dialog"]'`
 *
 * Hộp xem trước mượn `components/overlay/Modal`, và `Modal.Root` đặt
 * `tabIndex={-1}` lên chính khung hộp thoại để bẫy tiêu điểm nhận được tiêu
 * điểm lập trình. `expectAccessible` đọc đó là "điều khiển bàn phím không tới
 * được", nên lượt soát bỏ qua đúng phần tử ấy — khuôn đã chốt ở
 * `CreateProjectModal.test.tsx:202`. Mọi thứ BÊN TRONG hộp thoại vẫn được soát.
 */

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockApiClient } from '@/api/__mocks__/client';
import type { LibraryItem } from '@/api/client';
import { normalizeSpatial, type NormalizedSpatial } from '@/domain/spatial/normalize';
import { sampleLevelId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import type { Furniture } from '@/domain/spatial/types';
import { createAddFurnitureCommand } from '@/lib/commands/business/openingCommands';
import { FURNITURE_KIND_LABELS } from '@/lib/commands/business/shared';
import { createHistoryStack } from '@/lib/commands/history';
import { MERGE_WINDOW_MS } from '@/lib/commands/mergeCommands';
import { boxAround } from '@/lib/input/dragDrop';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese, LABEL_ATTRIBUTES } from '@/lib/testing/expectVietnamese';
import { createCleanBuildingScenario } from '@/lib/testing/fixtures';
import { renderWithProviders } from '@/lib/testing/render';
import {
  createSevenStateScenarios,
  SEVEN_STATES,
  SEVEN_STATE_LABELS,
  type SevenState,
} from '@/lib/testing/sevenStateScenarios';
import { useStore } from '@/store';

import { FurnitureLibraryPanel } from './FurnitureLibraryPanel';
import { FurnitureLibraryPanelContainer } from './FurnitureLibraryPanel.container';
import {
  REPLACE_ALL_PREVIEW_SCENARIO,
  scenarioFor,
} from './FurnitureLibraryPanel.stories';
import {
  buildReplaceAllCommands,
  commandContextOf,
  createFurnitureLibraryDispatchDeps,
  detectedGroupLabel,
  floorFurniture,
  FURNITURE_LIBRARY_PANEL_ACTOR_ID,
  levelIdOf,
  mintFurnitureId,
  replaceAllDialogLabel,
  runFurnitureLibraryCommands,
} from './furnitureLibraryPanelGateway';
import { useFurnitureLibraryPanel } from './useFurnitureLibraryPanel';
import type { UseFurnitureLibraryPanelOptions } from './furnitureLibraryPanelTypes';

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

/** Tầng đang mở trong mọi lượt kiểm đã nối dây — tầng trệt của bộ mẫu A14. */
const FLOOR_ID = sampleLevelId(0);

/** Bao nhiêu chiếc sofa được đặt vào tầng trước khi `[N4]` bắt đầu. */
const SOFA_COUNT = 4;

/** Mục thư viện nhóm `sofa` mà `[N4]`/`[N5]` thay thế bằng. */
const SOFA_LIBRARY_ITEM_ID = 'library-sofa-1';

/** Nhãn khung panel, dùng để khoanh vùng lượt truy vấn. */
const REGION_LABEL = 'Thư viện nội thất';

/** Nhãn nút tải lên — "mô hình", KHÔNG phải "model" (không có trong từ điển). */
const UPLOAD_LABEL = 'Tải lên mô hình';

/** Nhãn của hành động chìm và của nút xác nhận trong hộp xem trước. */
const REPLACE_ALL_LABEL = 'Thay thế tất cả';

/** Nhãn danh sách bên trong hộp xem trước. */
const PREVIEW_LIST_LABEL = 'Danh sách mô hình sẽ được thay thế';

/** Nhãn lưới thẻ, để đếm số thẻ đang hiện. */
const GRID_LABEL = 'Lưới mô hình nội thất';

/**
 * `expectVietnamese` chấp nhận thêm hai từ mượn mà cả sản phẩm lẫn hợp đồng T4
 * viết nguyên dạng.
 *
 * `sofa` là nhãn chip nhóm của `FURNITURE_CATEGORY_LABELS` và `l` là chữ cái
 * trong tên mẫu "Sofa góc chữ L". Đây đúng là cửa thoát mà chính
 * `expectVietnamese` mở ra cho một dương tính giả ("product names, file
 * formats, a unit this module has not heard of"), không phải một lượt tắt kiểm:
 * mọi chuỗi khác vẫn bị soát đủ, kể cả `aria-label` và `alt`.
 */
const ALLOWED_LOAN_WORDS: readonly string[] = ['sofa'];

/** Ba bộ khẳng định soát đúng những thuộc tính người dùng đọc hoặc nghe. */
const VIETNAMESE_OPTIONS = {
  allowWords: ALLOWED_LOAN_WORDS,
  attributes: LABEL_ATTRIBUTES,
} as const;

/** Panel dựng từ props — đúng thứ story dựng, không store và không cổng nào. */
function renderFromProps(state: SevenState) {
  return render(<FurnitureLibraryPanel {...scenarioFor(state)} />);
}

/** Hộp xem trước "Thay thế tất cả", cũng dựng thẳng từ props. */
function renderPreviewFromProps() {
  return render(<FurnitureLibraryPanel state={REPLACE_ALL_PREVIEW_SCENARIO} />);
}

/** Đồ thị đang nằm trong store, đã hẹp kiểu cho tầng lệnh. */
function currentGraph(): NormalizedSpatial {
  const graph = useStore.getState().spatial;

  if (graph === null) {
    throw new Error('Store chưa có lớp không gian nào — bộ dựng của bài kiểm hỏng.');
  }

  return graph;
}

/** Đồ đạc của tầng đang mở, đọc qua đúng cổng mà panel đọc. */
function floorPieces(): readonly Furniture[] {
  return floorFurniture(useStore.getState().spatial, FLOOR_ID);
}

/** Bộ mẫu chuẩn A14 vào store, ngăn xếp hoàn tác sạch. */
function seedStore(): void {
  const store = useStore.getState();

  useStore.temporal.getState().clear();
  store.setActiveFloor(FLOOR_ID);
  store.setSpatial(normalizeSpatial(createCleanBuildingScenario().graph), 'v-test');
}

/**
 * Đặt `SOFA_COUNT` chiếc sofa lên tầng đang mở, qua ĐÚNG đường lệnh S-07.
 *
 * Không một toạ độ nào bịa ra: tâm và góc xoay mượn của bốn món đồ đạc mà bộ
 * mẫu A14 đã đặt sẵn trên tầng này, khung bao lấy kích thước thật của mục thư
 * viện qua `boxAround` — cùng hàm `buildReplaceAllCommands` gọi.
 */
async function seedSofas(item: LibraryItem): Promise<void> {
  const graph = currentGraph();
  const context = commandContextOf(graph, FURNITURE_LIBRARY_PANEL_ACTOR_ID);
  const donors = floorPieces().slice(0, SOFA_COUNT);

  const commands = donors.map((donor) => {
    const result = createAddFurnitureCommand(
      {
        id: mintFurnitureId(),
        levelId: levelIdOf(FLOOR_ID),
        kind: item.furnitureKind,
        centre: donor.centre,
        boundingBox: boxAround(donor.centre, item.widthMm, item.depthMm),
        rotationDeg: donor.rotationDeg,
      },
      context,
    );

    if (!result.ok) {
      throw new Error(`Tầng lệnh từ chối đặt sofa: ${result.error.reasons.join('; ')}`);
    }

    return result.data;
  });

  const bundle = createFurnitureLibraryDispatchDeps({
    graph: { read: () => useStore.getState().spatial },
    selection: () => ({ selectedIds: useStore.getState().selectedIds }),
  });

  const outcome = await runFurnitureLibraryCommands(commands, bundle, 'Đặt sofa cho bài kiểm');

  if (!outcome.ok) {
    throw new Error(`Không đặt được sofa cho bài kiểm: ${outcome.error.reasons.join('; ')}`);
  }

  useStore.temporal.getState().clear();
}

/**
 * Panel ĐÃ NỐI DÂY: hook thật, store thật, cổng thật, ngăn xếp hoàn tác thật.
 *
 * Cùng khuôn `WiredInspector` của `PropertyInspector.test.tsx`: `canUploadModel`
 * đi vào thẳng để bài kiểm điều khiển được trục phân quyền, còn việc TÍNH ra nó
 * từ `useSession().roles` là của container và được kiểm riêng ở `[N6b]`.
 */
function WiredFurnitureLibraryPanel(
  props: Pick<UseFurnitureLibraryPanelOptions, 'canUploadModel'> & {
    readonly onModelDropped?: UseFurnitureLibraryPanelOptions['onModelDropped'];
    readonly onUploadModel?: UseFurnitureLibraryPanelOptions['onUploadModel'];
  },
) {
  const model = useFurnitureLibraryPanel({
    floorId: FLOOR_ID,
    canUploadModel: props.canUploadModel,
    onModelDropped: props.onModelDropped ?? ((): void => undefined),
    onUploadModel: props.onUploadModel ?? ((): void => undefined),
  });

  return <FurnitureLibraryPanel {...model} />;
}

/** Chờ danh mục model về, rồi trả khung panel. */
async function waitForCatalogue(): Promise<HTMLElement> {
  return waitFor(() => {
    const region = screen.getByRole('region', { name: REGION_LABEL });

    expect(within(region).getByRole('list', { name: GRID_LABEL })).toBeInTheDocument();

    return region;
  });
}

/** Số thẻ đang hiện trong lưới. */
function cardCount(region: HTMLElement): number {
  return within(within(region).getByRole('list', { name: GRID_LABEL })).getAllByRole('listitem')
    .length;
}

/** Mục "Đã phát hiện" của lớp sofa, tức lớp `chair` sau ánh xạ thật. */
function detectedSofaRow(region: HTMLElement): HTMLElement {
  const label = detectedGroupLabel({
    kind: 'chair',
    pieces: floorPieces().filter((piece) => piece.kind === 'chair'),
  });

  return within(region).getByText(label).closest('li') as HTMLElement;
}

/** Danh mục model của bộ mẫu — đọc một lần cho cả file. */
let libraryItems: readonly LibraryItem[] = [];

/** `window.matchMedia` thật của môi trường, trả lại nguyên vẹn sau mỗi lượt. */
let originalMatchMedia: typeof window.matchMedia;

/**
 * Khung nhìn của mọi lượt kiểm đã nối dây: máy để bàn, không xin giảm chuyển động.
 *
 * jsdom KHÔNG cài `window.matchMedia`, mà `useAppShell` (qua `useBreakpoint`) và
 * `useMotionConditions` đều hỏi nó — cùng khuôn giả lập đã chốt ở
 * `ViewerShell.test.tsx:405-431`. Mọi truy vấn trả `matches: false` nghĩa là bề
 * rộng ≥ `collapsedBreakpointPx` (1024px), tức panel ở dạng cột trái chứ không
 * phải tấm trượt đáy; biến thể `collapsed` được dựng từ props ở `[N1]`-`[N3]`.
 */
function installDesktopViewport(): void {
  originalMatchMedia = window.matchMedia;

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(async () => {
  // Cùng cặp `VITE_USE_MOCK_API` mà `pnpm dev` dựng: `createAppApiClient()` bên
  // trong hook trả về `createMockApiClient()` thay vì một máy chủ.
  vi.stubEnv('VITE_USE_MOCK_API', 'true');
  installDesktopViewport();

  const result = await createMockApiClient().library.list();

  if (!result.ok) {
    throw new Error('Bộ mẫu danh mục model không trả về được danh sách.');
  }

  libraryItems = result.data;
  seedStore();
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: originalMatchMedia,
  });
});

/** Mục thư viện nhóm `sofa` của `[N4]`/`[N5]`. */
function sofaItem(): LibraryItem {
  const item = libraryItems.find((entry) => entry.id === SOFA_LIBRARY_ITEM_ID);

  if (item === undefined) {
    throw new Error(`Bộ mẫu không còn mục ${SOFA_LIBRARY_ITEM_ID}.`);
  }

  return item;
}

/* -------------------------------------------------------------------------- */
/* [FLP-1] Ba bộ khẳng định dùng chung.                                        */
/* -------------------------------------------------------------------------- */

describe('[FLP-1] ba bộ khẳng định dùng chung', () => {
  it('[N1] expectSevenStates — bảy trên bảy, không trạng thái nào ra màn trắng', () => {
    const rendered: SevenState[] = [];

    expectSevenStates((scenario) => {
      const state = scenario.state as SevenState;
      const { container, unmount } = renderFromProps(state);

      rendered.push(state);

      return { container, unmount };
    }, createSevenStateScenarios());

    console.log(
      `[FURNITURE-LIBRARY][N1] expectSevenStates = ${String(rendered.length)}/${String(SEVEN_STATES.length)} — ` +
        rendered.map((state) => SEVEN_STATE_LABELS[state]).join(', '),
    );

    expect(rendered).toStrictEqual([...SEVEN_STATES]);
    expect(rendered).toHaveLength(SEVEN_STATES.length);
  });

  it('[N2] expectAccessible — bảy trạng thái cộng hộp xem trước (R-72 / A12)', () => {
    let checked = 0;

    for (const state of SEVEN_STATES) {
      const { container, unmount } = renderFromProps(state);

      expect(
        () => {
          expectAccessible(container, { ignoreSelector: '[role="dialog"]' });
        },
        `trạng thái "${SEVEN_STATE_LABELS[state]}" hỏng khả năng tiếp cận`,
      ).not.toThrow();

      checked += 1;
      unmount();
    }

    const preview = renderPreviewFromProps();

    expect(() => {
      expectAccessible(preview.container, { ignoreSelector: '[role="dialog"]' });
    }, 'hộp xem trước "Thay thế tất cả" hỏng khả năng tiếp cận').not.toThrow();

    checked += 1;
    preview.unmount();

    console.log(
      `[FURNITURE-LIBRARY][N2] expectAccessible = ${String(checked)}/8 lượt dựng ` +
        '(7 trạng thái + hộp xem trước)',
    );

    expect(checked).toBe(SEVEN_STATES.length + 1);
  });

  it('[N3] expectVietnamese — soát cả aria-label và alt, không chữ Anh và không mất dấu (R-72)', () => {
    expect(VIETNAMESE_OPTIONS.attributes).toContain('aria-label');
    expect(VIETNAMESE_OPTIONS.attributes).toContain('alt');

    let checked = 0;

    for (const state of SEVEN_STATES) {
      const { container, unmount } = renderFromProps(state);

      expect(
        () => {
          expectVietnamese(container, VIETNAMESE_OPTIONS);
        },
        `trạng thái "${SEVEN_STATE_LABELS[state]}" còn chuỗi chưa phải tiếng Việt có dấu`,
      ).not.toThrow();

      checked += 1;
      unmount();
    }

    const preview = renderPreviewFromProps();

    expect(() => {
      expectVietnamese(preview.container, VIETNAMESE_OPTIONS);
    }, 'hộp xem trước "Thay thế tất cả" còn chuỗi chưa phải tiếng Việt có dấu').not.toThrow();

    checked += 1;
    preview.unmount();

    console.log(
      `[FURNITURE-LIBRARY][N3] expectVietnamese = ${String(checked)}/8 lượt dựng, ` +
        `soát ${String(VIETNAMESE_OPTIONS.attributes.length)} thuộc tính gồm aria-label và alt`,
    );

    expect(checked).toBe(SEVEN_STATES.length + 1);
  });
});

/* -------------------------------------------------------------------------- */
/* [FLP-2] "Thay thế tất cả" — xem trước rồi mới áp.                            */
/* -------------------------------------------------------------------------- */

describe('[FLP-2] thao tác hàng loạt luôn xem trước trước khi áp', () => {
  it('[N4]/[N5] lớp sofa (4): xem trước đúng 4 mục, 0 thay đổi trước khi xác nhận, 1 bước hoàn tác sau', async () => {
    const target = sofaItem();

    await seedSofas(target);

    const before = floorPieces();
    const sofasBefore = before.filter((piece) => piece.kind === target.furnitureKind);

    expect(sofasBefore).toHaveLength(SOFA_COUNT);

    renderWithProviders(<WiredFurnitureLibraryPanel canUploadModel />, { keepStore: true });

    const region = await waitForCatalogue();

    // Thay thế thì phải biết thay bằng gì: chọn mục thư viện đích TRƯỚC.
    fireEvent.click(within(region).getByRole('button', { name: new RegExp(target.name, 'i') }));

    const labelBefore = useStore.getState().lastCommitLabel;
    const pastBefore = useStore.temporal.getState().pastStates.length;
    const idsBefore = before.map((piece) => piece.id);

    // Hành động CHÌM: bấm nó KHÔNG đổi gì, nó chỉ mở hộp xem trước.
    fireEvent.click(
      within(detectedSofaRow(region)).getByRole('button', { name: REPLACE_ALL_LABEL }),
    );

    const dialog = await screen.findByRole('dialog');
    const previewItems = within(
      within(dialog).getByRole('list', { name: PREVIEW_LIST_LABEL }),
    ).getAllByRole('listitem');

    const idsAtPreview = floorPieces().map((piece) => piece.id);

    console.log(
      `[FURNITURE-LIBRARY][N4] danh sách xem trước = ${String(previewItems.length)} mục; ` +
        `thay đổi đã áp trước khi xác nhận = ${String(
          idsAtPreview.length === idsBefore.length &&
            idsAtPreview.every((id, index) => id === idsBefore[index])
            ? 0
            : 1,
        )}`,
    );

    expect(previewItems).toHaveLength(SOFA_COUNT);
    expect(idsAtPreview).toStrictEqual(idsBefore);
    expect(useStore.getState().lastCommitLabel).toBe(labelBefore);
    expect(useStore.temporal.getState().pastStates).toHaveLength(pastBefore);

    // Chỉ SAU khi xác nhận mới áp — và cả loạt xoá + thêm là MỘT bước hoàn tác.
    fireEvent.click(within(dialog).getByRole('button', { name: REPLACE_ALL_LABEL }));

    await waitFor(() => {
      expect(useStore.getState().lastCommitLabel).not.toBe(labelBefore);
    });

    const after = floorPieces();
    const sofasAfter = after.filter((piece) => piece.kind === target.furnitureKind);
    const survivingOldIds = sofasAfter.filter((piece) =>
      sofasBefore.some((old) => old.id === piece.id),
    );
    const zundoSteps = useStore.temporal.getState().pastStates.length - pastBefore;

    console.log(
      `[FURNITURE-LIBRARY][N5] sau khi xác nhận: ${String(sofasAfter.length)} món lớp ` +
        `"${FURNITURE_KIND_LABELS[target.furnitureKind]}", ${String(survivingOldIds.length)} mã cũ còn lại, ` +
        `${String(zundoSteps)} trạng thái zundo (${String(SOFA_COUNT * 2)} lệnh xoá+thêm, ` +
        'một lệnh một lượt `applyPatches` — xem [N5b] cho số bước hoàn tác của tầng lệnh)',
    );

    expect(sofasAfter).toHaveLength(SOFA_COUNT);
    expect(survivingOldIds).toHaveLength(0);
  });

  /**
   * `[N5b]` — MỘT bước hoàn tác, đo ở đúng chỗ nó tồn tại.
   *
   * `runCommandPipeline` gọi `applyPatches` MỘT LƯỢT MỖI LỆNH (`dispatch.ts:584-591`)
   * nhưng đẩy ĐÚNG MỘT `UndoEntry` cho cả loạt (`dispatch.ts:603-611`). Nên
   * `useStore.temporal` — vốn mở một trạng thái cho mỗi lượt `commit` — đếm được
   * tám, còn ngăn xếp hoàn tác của tầng lệnh đếm được một. Con số nghiệm thu là
   * con số thứ hai, và nó là con số bài kiểm này khẳng định; con số thứ nhất
   * được IN RA ở `[N5]` thay vì bị giấu (E.10). Đây là hành vi chung của
   * `runTransaction`, không phải điều panel này quyết định.
   */
  it('[N5b] xoá + thêm chạy trong MỘT runTransaction — đúng một bước hoàn tác ở tầng lệnh', async () => {
    const target = sofaItem();

    await seedSofas(target);

    const group = {
      kind: target.furnitureKind,
      pieces: floorPieces().filter((piece) => piece.kind === target.furnitureKind),
    };

    expect(group.pieces).toHaveLength(SOFA_COUNT);

    const history = createHistoryStack({ mergeWindowMs: MERGE_WINDOW_MS });
    const bundle = createFurnitureLibraryDispatchDeps({
      graph: { read: () => useStore.getState().spatial },
      selection: () => ({ selectedIds: useStore.getState().selectedIds }),
      history,
    });

    const commands = buildReplaceAllCommands(
      group,
      target,
      currentGraph(),
      levelIdOf(FLOOR_ID),
      FURNITURE_LIBRARY_PANEL_ACTOR_ID,
    );

    const outcome = await runFurnitureLibraryCommands(
      commands,
      bundle,
      replaceAllDialogLabel(group),
    );

    console.log(
      `[FURNITURE-LIBRARY][N5b] ${String(commands.length)} lệnh (xoá + thêm cho ${String(SOFA_COUNT)} món) → ` +
        `${String(history.undoSteps().length)} bước hoàn tác, nhãn "${history.undoSteps()[0]?.label ?? ''}"`,
    );

    expect(outcome.ok).toBe(true);
    expect(commands).toHaveLength(SOFA_COUNT * 2);
    expect(history.undoSteps()).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------------- */
/* [FLP-3] Không có quyền.                                                     */
/* -------------------------------------------------------------------------- */

describe('[FLP-3] không có quyền quản lý thư viện', () => {
  it('[N6] nút tải lên biến mất, thẻ vẫn xem được, thẻ không kéo được', async () => {
    renderWithProviders(<WiredFurnitureLibraryPanel canUploadModel={false} />, {
      keepStore: true,
    });

    const region = await waitForCatalogue();
    const cards = within(within(region).getByRole('list', { name: GRID_LABEL })).getAllByRole(
      'button',
    );
    const draggable = cards.filter((card) => card.getAttribute('draggable') === 'true');
    const uploadButtons = within(region).queryAllByRole('button', { name: UPLOAD_LABEL });

    console.log(
      `[FURNITURE-LIBRARY][N6] nút "${UPLOAD_LABEL}" = ${String(uploadButtons.length)}; ` +
        `thẻ xem được = ${String(cardCount(region))}; thẻ kéo được = ${String(draggable.length)}`,
    );

    expect(uploadButtons).toHaveLength(0);
    expect(cardCount(region)).toBe(libraryItems.length);
    expect(draggable).toHaveLength(0);

    for (const card of cards) {
      expect(card).toHaveAttribute('aria-disabled', 'true');
      expect(card).toBeVisible();
    }
  });

  it('[N6b] R-73 — container gắn được bằng ĐÚNG một thẻ, và mặc định đóng quyền', async () => {
    renderWithProviders(
      <FurnitureLibraryPanelContainer floorId={FLOOR_ID} onModelDropped={(): void => undefined} />,
      { keepStore: true },
    );

    const region = await waitForCatalogue();

    // Phiên chưa đăng nhập: `can('manage', 'library', { roles: [] })` là `false`,
    // nên panel đóng quyền mà không cần nơi gọi truyền thêm gì.
    console.log(
      `[FURNITURE-LIBRARY][N6b] container hai prop: thẻ = ${String(cardCount(region))}, ` +
        `nút "${UPLOAD_LABEL}" = ${String(
          within(region).queryAllByRole('button', { name: UPLOAD_LABEL }).length,
        )}`,
    );

    expect(cardCount(region)).toBe(libraryItems.length);
    expect(within(region).queryAllByRole('button', { name: UPLOAD_LABEL })).toHaveLength(0);
  });
});
