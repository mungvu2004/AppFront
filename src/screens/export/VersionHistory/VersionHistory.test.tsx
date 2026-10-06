/**
 * Bộ kiểm của L2-D cho màn `VersionHistory` — chín mục của mục 2 đặc tả, viết CHỈ từ hợp đồng
 * (`types.ts`), không đợi mã hiện thực.
 *
 * ## Vì sao view và hook đi qua `import()` thay vì `import … from …`
 *
 * `./VersionHistory` (view) và hook đi kèm là việc của các worker khác, viết SONG SONG với
 * worker này trên nhánh riêng — tại thời điểm file này được viết, CẢ HAI CHƯA TỒN TẠI trong
 * worktree này. Đã đo thật ở `ShareDialog.test.tsx`/`RuleSettings.test.tsx`: một `import`
 * TĨNH của một đường dẫn không tồn tại làm Vite sập lúc transform và không một test nào
 * trong cả file chạy được. Giấu đường dẫn sau một biến, kèm `/* @vite-ignore *\/`, hoãn việc
 * phân giải sang đúng lúc CHẠY, nên một import hỏng chỉ làm hỏng ĐÚNG một `it`.
 *
 * Vì thế, ở nhánh này các bài cần view/hook thật HỎNG RIÊNG LẺ với "Failed to resolve", còn
 * các bài thuần dữ liệu (đếm, câu diff, hằng số) CHẠY VÀ XANH ngay hôm nay. **Bộ này chưa
 * chạy trọn vẹn ở lớp D — nó sẽ chạy thật ở lớp gộp** (E.10: không báo "đạt" cho bước chưa
 * chạy).
 *
 * ## Hai cách né đã đo, không phải phỏng đoán
 *
 *  1. `expectAccessible` gọi trên `document.body` với `ignoreSelector: '[role="dialog"]'` —
 *     `Modal.tsx` tự đặt `outline-none` lên vỏ `tabIndex={-1}` của nó, component dùng chung,
 *     không phải lỗi của màn. Tiền lệ: `ShareDialog.test.tsx:24`.
 *  2. `expectVietnamese` gọi kèm `ignore` cho URL/email nếu DOM có địa chỉ dạng đó, và
 *     `allowWords: ['JSON']` cho nhãn tab thứ hai — "JSON" là chữ viết tắt kỹ thuật, không
 *     phải chữ tiếng Anh sót lại (A6 cho phép mã/tên viết hoa).
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, screen, waitFor } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApiClient } from '@/api/client';
import { __resetFloorLayerSavers, flushAutosaves } from '@/hooks/useAutosave';
import { UNDO_WINDOW_MS } from '@/lib/mutations/undoTicket';
import { queryKeys } from '@/lib/query/queryKeys';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { FAKE_CLOCK_START } from '@/lib/testing/fakeClock';
import { createTestQueryClient, renderWithProviders } from '@/lib/testing/render';
import { createSevenStateScenarios, SEVEN_STATES } from '@/lib/testing/sevenStateScenarios';
import { ROUTE_PATTERNS } from '@/routes/paths';
import { useStore } from '@/store';
import * as CommitModule from '@/store/commit';
import { commit } from '@/store/commit';
import { hydrateProject } from '@/store/projectHydration';
import type { Project } from '@/types/project';

import { DIFF_TINT_OPACITY, DIFF_TONE_TOKENS } from './types';
import type {
  DiffTone,
  VersionHistoryGateway,
  VersionHistoryProps,
  VersionHistoryResult,
} from './types';
import {
  buildVersionHistoryProps,
  createVersionsServerFake,
  WIRE_CURRENT_WALLS,
  WIRE_FLOOR_ID,
  WIRE_LEVEL,
  WIRE_PROJECT_ID,
  WIRE_VERSION_IDS,
  wireError,
  wireLayer,
  wireSummaries,
  type VersionsServerFake,
} from './versionHistoryFixtures';
import * as UseVersionHistoryModule from './useVersionHistory';
import { snapshotQueryKey, useVersionHistory } from './useVersionHistory';
import * as VersionHistoryModule from './VersionHistory';
import { VersionHistory } from './VersionHistory';
import { VersionHistoryRoute } from './VersionHistory.container';
import { NO_COMPARE_PAIR_REASON, NOT_ENOUGH_CONTENT_SENTENCE, SNAPSHOT_LOADING_SENTENCE } from './versionHistoryCompare';
import {
  CONFLICT_TITLE,
  createVersionHistoryGateway,
  UNDO_EXPIRED_NOTICE,
  UNDO_USED_NOTICE,
  VERSION_LIST_FAILED_REASON,
} from './versionHistoryGateway';
import * as ModelModule from './versionHistoryModel';
import { SNAPSHOT_FAILED_NOTICE, SNAPSHOT_RETRY_LABEL, UNDO_RETRY_TOAST } from './versionHistoryModel';

afterEach(() => {
  cleanup();
});

/* ==========================================================================
 * 0. Hạ tầng: nhập file cùng thư mục qua biến, không qua chuỗi tĩnh.
 * ========================================================================== */

/** Xem lời giải thích ở đầu file. */

/*
 * Nhập TĨNH, tra qua map — trước đây là một lượt `import()` động có `@vite-ignore`.
 *
 * Giàn giáo động ấy có lý do thật lúc nó được viết: các tệp anh em trong thư mục CHƯA tồn tại, và
 * một lượt nhập tĩnh làm Vite sập lúc transform, kéo sập cả tệp. Nay cả thư mục đã đủ tệp và
 * không bài nào trong tệp này dùng `vi.mock`, nên giàn giáo hết việc — còn cái giá thì vẫn trả:
 * `@vite-ignore` làm Vite bỏ phân tích import, nên cả cây module của màn mới được
 * resolve/transform/nạp BÊN TRONG bài kiểm đầu tiên gọi tới, và bài đó đếm luôn lượt biên dịch
 * vào 5 000 ms của nó (`testTimeout` mặc định của vitest — `vitest.config.ts` không khai nó).
 *
 * Nhập tĩnh chuyển việc ấy sang pha `collect`, pha không bị `testTimeout` chặn. Chữ ký của
 * `importFromScreen` và mọi chỗ gọi giữ nguyên, nên diff chỉ nằm ở đây.
 */
const MODULE_MAN: Record<string, unknown> = {
  './VersionHistory': VersionHistoryModule,
  './useVersionHistory': UseVersionHistoryModule,
};

async function importFromScreen<T>(specifier: string): Promise<T> {
  return MODULE_MAN[specifier] as T;
}

async function loadVersionHistoryView(): Promise<ComponentType<VersionHistoryProps>> {
  const mod = await importFromScreen<{ VersionHistory: ComponentType<VersionHistoryProps> }>(
    './VersionHistory',
  );

  return mod.VersionHistory;
}

function withQueryClient(): ({ children }: { readonly children: ReactNode }) => React.JSX.Element {
  const client = createTestQueryClient();

  return function QueryWrapper({ children }: { readonly children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

/* ==========================================================================
 * 1. `expectSevenStates` — 7/7 (R-63).
 * ========================================================================== */

describe('A11 — bảy trạng thái của VersionHistory', () => {
  it('dựng đủ bảy, không trạng thái nào ra màn trắng', async () => {
    const VersionHistoryView = await loadVersionHistoryView();
    const covered: string[] = [];

    expectSevenStates((scenario) => {
      covered.push(scenario.label);

      return renderWithProviders(<VersionHistoryView {...buildVersionHistoryProps(scenario.state)} />);
    }, createSevenStateScenarios());

    expect(covered).toHaveLength(SEVEN_STATES.length);
  });
});

/* ==========================================================================
 * 2 và 3. Tiếp cận được, toàn chữ tiếng Việt có dấu (R-72, R-67).
 * ========================================================================== */

describe('R-72 — expectAccessible trên cây render thật', () => {
  it('trạng thái "thành công" tiếp cận được', async () => {
    const VersionHistoryView = await loadVersionHistoryView();
    renderWithProviders(<VersionHistoryView {...buildVersionHistoryProps('success')} />);

    expectAccessible(document.body, { ignoreSelector: '[role="dialog"]' });
  });

  it('hộp thoại xác nhận phục hồi đang mở vẫn tiếp cận được, kể cả vỏ `role="dialog"` bị bỏ qua', async () => {
    const VersionHistoryView = await loadVersionHistoryView();
    const props = buildVersionHistoryProps('success', {
      restoreConfirm: {
        isOpen: true,
        title: 'Phục hồi phiên bản này?',
        reassurance: 'Phục hồi giữ lại trạng thái hiện tại thành một phiên bản riêng; không có gì bị xoá.',
        confirmLabel: 'Phục hồi',
        cancelLabel: 'Huỷ',
        targetVersionLabel: 'v13',
      },
    });

    renderWithProviders(<VersionHistoryView {...props} />);

    const dialog = await screen.findByRole('dialog');

    expect(dialog).toBeTruthy();
    expectAccessible(document.body, { ignoreSelector: '[role="dialog"]' });
  });

  it('cả bảy trạng thái đều tiếp cận được', async () => {
    const VersionHistoryView = await loadVersionHistoryView();

    for (const state of SEVEN_STATES) {
      const { unmount } = renderWithProviders(<VersionHistoryView {...buildVersionHistoryProps(state)} />);

      expect(() => {
        expectAccessible(document.body, { ignoreSelector: '[role="dialog"]' });
      }, `trạng thái: ${state}`).not.toThrow();
      unmount();
    }
  });
});

describe('R-67 — expectVietnamese trên cây render thật', () => {
  it('trạng thái "thành công": toàn chữ tiếng Việt có dấu, trừ nhãn tab "JSON"', async () => {
    const VersionHistoryView = await loadVersionHistoryView();
    const { container } = renderWithProviders(<VersionHistoryView {...buildVersionHistoryProps('success')} />);

    expectVietnamese(container, {
      allowWords: ['JSON'],
      ignore: [/^https?:\/\//u, /^[\w.+-]+@[\w-]+\.[\w.-]+$/u],
    });
  });
});

/* ==========================================================================
 * 4. Nền diff luôn ở 8% — đo `getComputedStyle(el).opacity` trên lớp `aria-hidden`,
 *    khẳng định đối chiếu `DIFF_TINT_OPACITY` nhập từ `./types` (không viết lại 0.08).
 * ========================================================================== */

describe('nền diff luôn ở 8%, không bao giờ đặc', () => {
  it('cả ba loại thêm/bớt/đổi đều tô nền đúng DIFF_TINT_OPACITY', async () => {
    const VersionHistoryView = await loadVersionHistoryView();
    const { container } = renderWithProviders(<VersionHistoryView {...buildVersionHistoryProps('success')} />);

    const tones: readonly DiffTone[] = ['added', 'removed', 'changed'];

    for (const tone of tones) {
      const token = DIFF_TONE_TOKENS[tone];
      const layers = Array.from(container.querySelectorAll<HTMLElement>('[aria-hidden="true"][style]')).filter(
        (element) => element.style.backgroundColor === token,
      );

      expect(layers.length, `không tìm thấy lớp nền cho loại: ${tone}`).toBeGreaterThan(0);

      for (const layer of layers) {
        expect(Number(getComputedStyle(layer).opacity), `loại: ${tone}`).toBeCloseTo(DIFF_TINT_OPACITY);
      }
    }
  });
});

/* ==========================================================================
 * 5–7. Hook trên cổng THẬT + máy chủ giả (dữ liệu dây), bộ lưu lớp tầng THẬT (F-04x-1).
 * ========================================================================== */

const PROJECT: Project = {
  created_at: '2026-09-01T00:00:00.000Z',
  id: WIRE_PROJECT_ID,
  members: [],
  name: 'Dự án mẫu',
  updated_at: '2026-09-01T00:00:00.000Z',
};
const FLOOR_OPTIONS = [
  { id: WIRE_FLOOR_ID, label: 'Tầng 1' },
  { id: 'L-LEVEL000002', label: 'Tầng 2' },
] as const;

/** Nạp dự án như cổng nạp làm: N15 dây → giải mã → `hydrateProject`. */
async function hydrateFrom(server: VersionsServerFake): Promise<void> {
  const graph = await createApiClient(server.http).spatial.readGraph({ projectId: WIRE_PROJECT_ID });

  if (!graph.ok) throw new Error('fixture: N15 không giải mã được');

  act(() => {
    hydrateProject({ document: graph.data, project: PROJECT, roles: ['engineer'] });
  });
}

interface HookSetup {
  readonly server: VersionsServerFake;
  readonly onToast: ReturnType<typeof vi.fn>;
  readonly queryClient: ReturnType<typeof createTestQueryClient>;
  readonly result: { readonly current: VersionHistoryResult };
  readonly rerender: (props: { floorId: string }) => void;
}

async function renderVersionHistoryHook(
  options: { server?: VersionsServerFake; canRestore?: boolean; now?: () => Date } = {},
): Promise<HookSetup> {
  const server = options.server ?? createVersionsServerFake();
  const api = createApiClient(server.http);
  const gateways = new Map<string, VersionHistoryGateway>();
  const gatewayFor = (floorId: string): VersionHistoryGateway => {
    const known =
      gateways.get(floorId) ??
      createVersionHistoryGateway({
        apiClient: api,
        floorId,
        projectId: WIRE_PROJECT_ID,
        ...(options.now !== undefined ? { now: options.now } : {}),
      });

    gateways.set(floorId, known);

    return known;
  };
  const onToast = vi.fn();
  const queryClient = createTestQueryClient();

  await hydrateFrom(server);

  const { rerender, result } = renderHook(
    ({ floorId }: { floorId: string }) =>
      useVersionHistory({
        apiClient: api,
        canRestore: options.canRestore ?? true,
        floorId,
        floorOptions: FLOOR_OPTIONS,
        gateway: gatewayFor(floorId),
        onToast,
        projectId: WIRE_PROJECT_ID,
        ...(options.now !== undefined ? { now: options.now } : {}),
      }),
    {
      initialProps: { floorId: WIRE_FLOOR_ID },
      wrapper: ({ children }: { readonly children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    },
  );

  await waitFor(() => {
    expect(result.current[0].rows.length).toBe(3);
  });

  return { onToast, queryClient, rerender, result, server };
}

const restoreCalls = (server: VersionsServerFake) => server.calls.filter((call) => call.path.endsWith('/restore'));
const firstWallThickness = (): number | undefined => {
  const spatial = useStore.getState().spatial;
  const wall = spatial?.byId['W-WALL000001'];

  return wall !== undefined && 'thicknessMm' in wall ? wall.thicknessMm : undefined;
};
const thickenFirstWall = (): void => {
  act(() => {
    commit({ changes: { thicknessMm: 260 }, id: 'W-WALL000001', kind: 'wall', op: 'update' }, 'Đổi độ dày');
  });
};

async function requestAndConfirm(setup: HookSetup, versionId: string): Promise<void> {
  act(() => {
    setup.result.current[1].requestRestore(versionId);
    setup.result.current[1].confirmRestore();
  });
  await act(async () => {
    await vi.dynamicImportSettled();
  });
}

describe('F-08 — phục hồi qua bộ lưu theo tầng và replaceFloorLayer', () => {
  beforeEach(() => {
    __resetFloorLayerSavers();
  });

  afterEach(() => {
    __resetFloorLayerSavers();
    vi.restoreAllMocks();
  });

  it('isCurrent đúng một hàng theo floorRevision; bản hiện tại của "hệ thống AI" không mang state-verified; tác giả là creatorName', async () => {
    const setup = await renderVersionHistoryHook();
    const [model, actions] = setup.result.current;

    expect(model.rows.filter((row) => row.isCurrent).map((row) => row.id)).toEqual([WIRE_VERSION_IDS.v3]);
    expect(model.rows.map((row) => row.authorName)).toEqual(['hệ thống AI', 'Nguyễn Bình', 'Phạm An']);
    expect(model.rows[1]?.tagLabel).toBe('Duyệt với chủ đầu tư');
    expect(model.savedAtLabel).toBeNull();

    const { container } = renderWithProviders(<VersionHistory model={model} actions={actions} />);
    const list = container.querySelector('nav[aria-label="Danh sách phiên bản"]');

    expect(list?.textContent).toContain('Hiện tại');
    expect(list?.querySelector('[class*="state-verified"]')).toBeNull();
  });

  it('ống có tầng bẩn → PUT của tầng đó đi trước N19; sau phục hồi: N16, replaceFloorLayer external, Ctrl+Z trống, serverReplaceSeq tăng, restoreVersion bị vô hiệu', async () => {
    const replaceSpy = vi.spyOn(CommitModule, 'replaceFloorLayer');
    const setup = await renderVersionHistoryHook();
    const invalidate = vi.spyOn(setup.queryClient, 'invalidateQueries');

    thickenFirstWall();
    expect(useStore.temporal.getState().pastStates.length).toBeGreaterThan(0);
    const seqBefore = useStore.getState().serverReplaceSeq;

    await requestAndConfirm(setup, WIRE_VERSION_IDS.v2);
    await waitFor(() => {
      expect(setup.onToast).toHaveBeenCalled();
    });

    const order = setup.server.calls.map((call) => `${call.method} ${call.path.split('/').slice(-1)[0] ?? ''}`);
    const putIndex = order.indexOf('PUT layer');
    const postIndex = order.indexOf('POST restore');

    expect(putIndex).toBeGreaterThanOrEqual(0);
    expect(putIndex).toBeLessThan(postIndex);
    // Lượt PUT đưa tầng lên 6, nên N19 gửi base 6 — revision của tầng, không phải sequence 2.
    expect(restoreCalls(setup.server)[0]?.body).toEqual({ baseVersion: 6, body: { floorId: WIRE_FLOOR_ID } });
    expect(order.slice(postIndex)).toContain('GET layer');

    const external = replaceSpy.mock.calls.filter(([, , options]) => options?.external === true);

    expect(external).toHaveLength(1);
    expect(external[0]?.[0]).toBe(WIRE_FLOOR_ID);
    expect(Object.keys(external[0]?.[1] ?? {}).sort()).toEqual(['dimensions', 'layer', 'level', 'revision']);
    // Kích thước đi bằng trường riêng, không nhét trong `layer` (NO-374).
    expect(Object.keys(external[0]?.[1].layer ?? {})).not.toContain('dimensions');
    expect(external[0]?.[1].revision).toBe(7);
    expect(useStore.getState().floorMeta[WIRE_FLOOR_ID]?.revision).toBe(7);
    expect(firstWallThickness()).toBe(200);
    expect(useStore.temporal.getState().pastStates).toHaveLength(0);
    expect(useStore.getState().serverReplaceSeq).toBe(seqBefore + 1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.layer.byFloor(WIRE_PROJECT_ID, WIRE_FLOOR_ID) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.version.byFloor(WIRE_FLOOR_ID) });

    // Số phiên bản TĂNG thêm một sau lượt đọc lại N17.
    await waitFor(() => {
      expect(setup.result.current[0].versionCount).toBe(4);
    });
    expect(setup.result.current[0].rows.filter((row) => row.isCurrent).map((row) => row.id)).toEqual([WIRE_VERSION_IDS.v4]);
  });

  it('còn bẩn sau xả → A9: huỷ thì không N19; đồng ý thì discardFloor rồi N19; N19 422 sau khi bỏ → lớp trong kho là lớp N16', async () => {
    const setup = await renderVersionHistoryHook();

    setup.server.override('PUT layer', () => ({ error: wireError(409, 'VERSION_CONFLICT', { currentVersion: 9, remoteChanges: [] }), ok: false }));
    thickenFirstWall();

    await requestAndConfirm(setup, WIRE_VERSION_IDS.v2);
    await waitFor(() => {
      expect(setup.result.current[0].restoreConfirm.isOpen).toBe(true);
    });
    expect(setup.result.current[0].restoreConfirm.title).toBe('Tầng 1 còn thay đổi chưa lưu được; tiếp tục sẽ bỏ chúng');

    act(() => {
      setup.result.current[1].cancelRestore();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(restoreCalls(setup.server)).toHaveLength(0);
    expect(firstWallThickness()).toBe(260);

    setup.server.override('POST restore', () => ({ error: wireError(422, 'VALIDATION'), ok: false }));
    await requestAndConfirm(setup, WIRE_VERSION_IDS.v2);
    await waitFor(() => {
      expect(setup.result.current[0].restoreConfirm.isOpen).toBe(true);
    });
    act(() => {
      setup.result.current[1].confirmRestore();
    });

    await waitFor(() => {
      expect(setup.result.current[0].conflict?.message).toBe('Không phục hồi được bản này.');
    });
    expect(restoreCalls(setup.server)).toHaveLength(1);
    expect(useStore.getState().unsavedFloorIds).not.toContain(WIRE_FLOOR_ID);
    // Lớp N16 của máy chủ (dày 220), không phải bản sửa đã bỏ (260).
    await waitFor(() => {
      expect(firstWallThickness()).toBe(220);
    });
    expect(setup.result.current[0].conflict?.dismissLabel).toBe('Đã hiểu');
  });

  it('N19 trả floorRevision = baseVersion (bản "trước" vừa sinh, id mới) → không phiếu hoàn tác, không N19 thứ hai, không nạp lại', async () => {
    const replaceSpy = vi.spyOn(CommitModule, 'replaceFloorLayer');
    const setup = await renderVersionHistoryHook();

    setup.server.override('POST restore', () => ({
      data: { ...wireSummaries()[0], floorRevision: 5, id: WIRE_VERSION_IDS.v4, sequence: 4 },
      ok: true,
    }));
    await requestAndConfirm(setup, WIRE_VERSION_IDS.v2);
    await waitFor(() => {
      expect(setup.onToast).toHaveBeenCalledWith({ message: 'Phiên bản này trùng với hiện trạng' });
    });

    expect(restoreCalls(setup.server)).toHaveLength(1);
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('bỏ thay đổi (A9) rồi N19 trùng hiện trạng → kho về bản N16; lượt sửa sau không PUT phần đã bỏ', async () => {
    const setup = await renderVersionHistoryHook();
    let failPut = true;

    setup.server.override('PUT layer', ({ body }) => {
      if (failPut) return { error: wireError(503, 'UNAVAILABLE'), ok: false };
      setup.server.revision += 1;

      return { data: { layer: (body as { body: { layer: unknown } }).body.layer, revision: setup.server.revision }, ok: true };
    });
    setup.server.override('POST restore', () => ({
      data: { ...wireSummaries()[0], floorRevision: 5, id: WIRE_VERSION_IDS.v4, sequence: 4 },
      ok: true,
    }));
    thickenFirstWall();

    await requestAndConfirm(setup, WIRE_VERSION_IDS.v2);
    await waitFor(() => {
      expect(setup.result.current[0].restoreConfirm.isOpen).toBe(true);
    });
    act(() => {
      setup.result.current[1].confirmRestore();
    });
    await waitFor(() => {
      expect(setup.onToast).toHaveBeenCalledWith({ message: 'Phiên bản này trùng với hiện trạng' });
    });
    // Bản máy chủ (220), không phải bản sửa vừa bỏ (260).
    await waitFor(() => {
      expect(firstWallThickness()).toBe(220);
    });

    failPut = false;
    act(() => {
      commit({ changes: { thicknessMm: 160 }, id: 'W-WALL000002', kind: 'wall', op: 'update' }, 'Đổi độ dày');
    });
    await act(async () => {
      await flushAutosaves();
    });

    const puts = setup.server.calls.filter((call) => call.method === 'PUT');
    const walls = (puts.at(-1)?.body as { body: { layer: { walls: { id: string; thicknessMm: number }[] } } } | undefined)?.body
      .layer.walls;

    expect(walls?.find((wall) => wall.id === 'W-WALL000002')?.thicknessMm).toBe(160);
    expect(walls?.find((wall) => wall.id === 'W-WALL000001')?.thicknessMm).toBe(220);
  });

  it('N16 hỏng → revision trong kho không đổi, dải "Tải lại" hiện', async () => {
    const setup = await renderVersionHistoryHook();

    setup.server.override('GET layer', () => ({ error: wireError(500, 'INTERNAL'), ok: false }));
    await requestAndConfirm(setup, WIRE_VERSION_IDS.v2);
    await waitFor(() => {
      expect(setup.result.current[0].conflict?.dismissLabel).toBe('Tải lại');
    });

    expect(useStore.getState().floorMeta[WIRE_FLOOR_ID]?.revision).toBe(5);
    expect(firstWallThickness()).toBe(220);
  });

  it('409 → dải "Tải lại" nêu tên người đã sửa; bấm thì nạp lại N16; N19 chỉ gửi một lần', async () => {
    const setup = await renderVersionHistoryHook();

    setup.server.override('POST restore', () => ({
      error: wireError(409, 'VERSION_CONFLICT', {
        currentVersion: 6,
        remoteChanges: [
          {
            changedAt: '2026-09-08T09:00:00.000Z',
            changedBy: 'usr_01J9ZQK7X4N2M8P6R3T5V7W9Y1',
            changedByName: 'Trần Minh',
            entityId: 'W-WALL000001',
            entityType: 'wall',
            field: 'thickness_mm',
            value: 240,
          },
        ],
      }),
      ok: false,
    }));
    await requestAndConfirm(setup, WIRE_VERSION_IDS.v2);
    await waitFor(() => {
      expect(setup.result.current[0].conflict?.actorName).toBe(CONFLICT_TITLE);
    });
    expect(setup.result.current[0].conflict?.message).toContain('Trần Minh');
    expect(restoreCalls(setup.server)).toHaveLength(1);

    const [model, actions] = setup.result.current;

    renderWithProviders(<VersionHistory model={model} actions={actions} />);
    expect(document.body.textContent).toContain('Tầng vừa đổi ở nơi khác');
    expect(document.body.textContent).toContain('Trần Minh');

    setup.server.revision = 6;
    act(() => {
      setup.result.current[1].dismissConflict();
    });
    await waitFor(() => {
      expect(useStore.getState().floorMeta[WIRE_FLOOR_ID]?.revision).toBe(6);
    });
    expect(setup.result.current[0].conflict).toBeNull();
  });

  it('hoàn tác TRƯỚC khi hết UNDO_WINDOW_MS gửi N19 ngược; SAU thì không gửi', async () => {
    let offset = 0;
    const now = (): Date => new Date(FAKE_CLOCK_START.getTime() + offset);
    const setup = await renderVersionHistoryHook({ now });

    await requestAndConfirm(setup, WIRE_VERSION_IDS.v2);
    await waitFor(() => {
      expect(setup.onToast).toHaveBeenCalled();
    });

    const toast = setup.onToast.mock.calls.at(-1)?.[0] as { onUndo?: () => void };

    offset = UNDO_WINDOW_MS - 1;
    act(() => {
      toast.onUndo?.();
    });
    await waitFor(() => {
      expect(restoreCalls(setup.server)).toHaveLength(2);
    });
    expect(restoreCalls(setup.server)[1]?.path).toContain(WIRE_VERSION_IDS.v3);
    expect(restoreCalls(setup.server)[1]?.body).toEqual({ baseVersion: 6, body: { floorId: WIRE_FLOOR_ID } });

    // Lượt phục hồi thứ hai, rồi để hết hạn.
    await waitFor(() => {
      expect(setup.onToast).toHaveBeenCalledWith({ message: 'Đã hoàn tác lượt phục hồi' });
    });
    await requestAndConfirm(setup, WIRE_VERSION_IDS.v2);
    await waitFor(() => {
      expect(restoreCalls(setup.server)).toHaveLength(3);
    });
    await waitFor(() => {
      expect(setup.onToast.mock.calls.at(-1)?.[0]).toHaveProperty('onUndo');
    });

    const late = setup.onToast.mock.calls.at(-1)?.[0] as { onUndo?: () => void };

    offset = 2 * UNDO_WINDOW_MS + 1;
    act(() => {
      late.onUndo?.();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(restoreCalls(setup.server)).toHaveLength(3);
  });

  it('NO-365: bấm đúp "Hoàn tác" chỉ một N19 ngược bay; N19 ngược hỏng → phiếu còn dùng, thử lại gửi được; xong thì phiếu hết dùng', async () => {
    const setup = await renderVersionHistoryHook();

    await requestAndConfirm(setup, WIRE_VERSION_IDS.v2);
    await waitFor(() => {
      expect(setup.onToast.mock.calls.at(-1)?.[0]).toHaveProperty('onUndo');
    });

    const toast = setup.onToast.mock.calls.at(-1)?.[0] as { onUndo: () => void };

    setup.server.override('POST restore', () => ({ error: wireError(503, 'UNAVAILABLE'), ok: false }));
    act(() => {
      toast.onUndo();
    });
    await waitFor(() => {
      expect(setup.result.current[0].conflict).not.toBeNull();
    });
    expect(restoreCalls(setup.server)).toHaveLength(2);
    // Toast cũ đã đóng: một toast mới mời bấm lại, gắn cùng phiếu.
    await waitFor(() => {
      expect(setup.onToast.mock.calls.at(-1)?.[0]).toMatchObject({ message: UNDO_RETRY_TOAST });
    });

    const retry = setup.onToast.mock.calls.at(-1)?.[0] as { onUndo: () => void };

    setup.server.override('POST restore', () => {
      setup.server.revision += 1;

      return { data: { ...wireSummaries()[0], floorRevision: setup.server.revision, id: WIRE_VERSION_IDS.v5, sequence: 5 }, ok: true };
    });
    act(() => {
      retry.onUndo();
      retry.onUndo();
      toast.onUndo();
    });
    await waitFor(() => {
      expect(setup.onToast).toHaveBeenCalledWith({ message: 'Đã hoàn tác lượt phục hồi' });
    });
    expect(restoreCalls(setup.server)).toHaveLength(3);
    // Chốt của hook chặn lượt bấm thứ hai trước khi tới gateway: không có dải "đã được hoàn tác".
    expect(setup.result.current[0].conflict?.message).not.toBe(UNDO_USED_NOTICE.message);

    act(() => {
      toast.onUndo();
    });
    await act(async () => {
      await vi.dynamicImportSettled();
    });
    expect(restoreCalls(setup.server)).toHaveLength(3);
  });

  it('NO-369: sau N19, kích thước của tầng trong kho là kích thước N16 trả, không phải bản cũ', async () => {
    const setup = await renderVersionHistoryHook();
    const dimension = {
      confidence: 1,
      id: 'M-DIMN000001',
      kind: 'linear',
      levelId: WIRE_FLOOR_ID,
      line: { end: { x: 4800, y: -500 }, start: { x: 0, y: -500 } },
      referenceIds: ['W-WALL000001'],
      reviewed: true,
      source: 'human',
      valueMm: 4800,
    };

    setup.server.override('GET layer', () => ({
      data: { axes: [], dimensions: [dimension], layer: wireLayer(WIRE_CURRENT_WALLS), level: WIRE_LEVEL, revision: setup.server.revision },
      ok: true,
    }));
    await requestAndConfirm(setup, WIRE_VERSION_IDS.v2);
    await waitFor(() => {
      expect(setup.onToast).toHaveBeenCalled();
    });

    expect(useStore.getState().spatial?.byId['M-DIMN000001']).toMatchObject({ valueMm: 4800 });
  });

  it('P3-7: toast "thử lại" bấm sau hạn của phiếu → dải "Đã hết thời gian hoàn tác", không N19', async () => {
    let offset = 0;
    const now = (): Date => new Date(FAKE_CLOCK_START.getTime() + offset);
    const setup = await renderVersionHistoryHook({ now });

    await requestAndConfirm(setup, WIRE_VERSION_IDS.v2);
    await waitFor(() => {
      expect(setup.onToast.mock.calls.at(-1)?.[0]).toHaveProperty('onUndo');
    });

    const toast = setup.onToast.mock.calls.at(-1)?.[0] as { onUndo: () => void };

    setup.server.override('POST restore', () => ({ error: wireError(503, 'UNAVAILABLE'), ok: false }));
    act(() => {
      toast.onUndo();
    });
    await waitFor(() => {
      expect(setup.onToast.mock.calls.at(-1)?.[0]).toMatchObject({ message: UNDO_RETRY_TOAST });
    });

    const retry = setup.onToast.mock.calls.at(-1)?.[0] as { onUndo: () => void };

    offset = UNDO_WINDOW_MS + 1;
    act(() => {
      retry.onUndo();
    });
    await waitFor(() => {
      expect(setup.result.current[0].conflict?.message).toBe(UNDO_EXPIRED_NOTICE.message);
    });
    expect(restoreCalls(setup.server)).toHaveLength(2);
  });

  it('P3-9: nạp lại N16 sau N19 mang cả Level và scaleStatus của tầng', async () => {
    const setup = await renderVersionHistoryHook();
    const level = { ...WIRE_LEVEL, scaleMillimetresPerPixel: 7 };

    setup.server.override('GET layer', () => ({
      data: {
        axes: [],
        dimensions: [],
        layer: wireLayer(WIRE_CURRENT_WALLS),
        level,
        revision: setup.server.revision,
        scaleStatus: 'unresolved',
      },
      ok: true,
    }));
    await requestAndConfirm(setup, WIRE_VERSION_IDS.v2);
    await waitFor(() => {
      expect(setup.onToast).toHaveBeenCalled();
    });

    expect(useStore.getState().spatial?.byId[WIRE_FLOOR_ID]).toMatchObject({ scaleMillimetresPerPixel: 7 });
    expect(useStore.getState().floorMeta[WIRE_FLOOR_ID]?.scaleStatus).toBe('unresolved');
  });

  it('đổi tầng → N17 gửi đúng floorId, activeFloorId của kho không đổi, cặp so bỏ', async () => {
    const setup = await renderVersionHistoryHook();
    const activeBefore = useStore.getState().activeFloorId;

    setup.rerender({ floorId: 'L-LEVEL000002' });
    await waitFor(() => {
      expect(setup.server.calls.some((call) => call.path.endsWith('/versions') && call.query.floorId === 'L-LEVEL000002')).toBe(true);
    });

    expect(useStore.getState().activeFloorId).toBe(activeBefore);
    expect(setup.result.current[0].floorSelect?.selectedId).toBe('L-LEVEL000002');
  });

  it('đổi tầng khi hộp A9 đang chờ → câu đang chờ nhận "huỷ", hộp đóng, lượt phục hồi của tầng cũ không gửi N19', async () => {
    const createReal = ModelModule.createPendingAnswer;
    const asks: Promise<boolean>[] = [];

    vi.spyOn(ModelModule, 'createPendingAnswer').mockImplementation(() => {
      const real = createReal();

      return {
        ...real,
        ask: () => {
          const question = real.ask();

          asks.push(question);

          return question;
        },
      };
    });

    const setup = await renderVersionHistoryHook();

    setup.server.override('PUT layer', () => ({ error: wireError(503, 'UNAVAILABLE'), ok: false }));
    thickenFirstWall();
    await requestAndConfirm(setup, WIRE_VERSION_IDS.v2);
    await waitFor(() => {
      expect(setup.result.current[0].restoreConfirm.isOpen).toBe(true);
    });
    expect(asks).toHaveLength(1);

    setup.rerender({ floorId: 'L-LEVEL000002' });

    const stillPending = new Promise<'pending'>((resolve) => {
      setTimeout(() => resolve('pending'), 50);
    });

    await expect(Promise.race([asks[0], stillPending])).resolves.toBe(false);
    expect(setup.result.current[0].restoreConfirm.isOpen).toBe(false);
    await act(async () => {
      await Promise.resolve();
    });
    expect(restoreCalls(setup.server)).toHaveLength(0);
    // Không đồng ý bỏ nên tầng cũ vẫn còn bản sửa.
    expect(useStore.getState().unsavedFloorIds).toContain(WIRE_FLOOR_ID);
  });

  it('viewer: không forbidden, không nút phục hồi/gắn nhãn; requestRestore bỏ qua', async () => {
    const setup = await renderVersionHistoryHook({ canRestore: false });
    const [model, actions] = setup.result.current;

    expect(model.state).not.toBe('forbidden');
    expect(model.canTagVersion).toBe(false);

    renderWithProviders(<VersionHistory model={model} actions={actions} />);
    expect(screen.queryByRole('button', { name: /phục hồi/iu })).toBeNull();
    expect(screen.queryByRole('button', { name: /gắn nhãn/iu })).toBeNull();

    act(() => {
      actions.requestRestore(WIRE_VERSION_IDS.v2);
    });
    expect(setup.result.current[0].restoreConfirm.isOpen).toBe(false);
  });

  it('bản isCurrent không phục hồi được: requestRestore bỏ qua', async () => {
    const setup = await renderVersionHistoryHook();

    act(() => {
      setup.result.current[1].requestRestore(WIRE_VERSION_IDS.v3);
    });
    expect(setup.result.current[0].restoreConfirm.isOpen).toBe(false);
  });

  it('N18 đồng thời ≤ 2, kể cả sau một lượt phục hồi thật; hàng chưa nạp không chọn được; PURGED → hàng hết nội dung, màn không error', async () => {
    const server = createVersionsServerFake();
    let active = 0;
    let peak = 0;
    const many = Array.from({ length: 12 }, (_, index) => ({
      ...wireSummaries()[1],
      floorRevision: 100 + index,
      id: `ver_01J9ZV8Q3M7X5B2N4K6P8R0${'ABCDEFGHJKMN'.charAt(index).repeat(3)}`,
      label: undefined,
      sequence: 20 - index,
    }));

    let items: Record<string, unknown>[] = many;
    const restoredId = 'ver_01J9ZV8Q3M7X5B2N4K6P8R0ZZZ';

    server.override('GET list', () => ({ data: { items }, ok: true }));
    server.override('POST restore', () => {
      const created = { ...wireSummaries()[1], floorRevision: 6, id: restoredId, label: undefined, sequence: 21 };

      server.revision = 6;
      items = [created, ...items];

      return { data: created, ok: true };
    });
    server.override('GET snapshot', async ({ path }) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;

      return path.includes(many[1]?.id ?? '-')
        ? { error: wireError(422, 'VERSION_SNAPSHOT_PURGED'), ok: false }
        : { data: { dimensions: [], layer: wireLayer(WIRE_CURRENT_WALLS), versionId: path.split('/')[4] }, ok: true };
    });

    const api = createApiClient(server.http);
    const gateway = createVersionHistoryGateway({ apiClient: api, floorId: WIRE_FLOOR_ID, projectId: WIRE_PROJECT_ID });

    await hydrateFrom(server);
    const { result } = renderHook(
      () => useVersionHistory({ apiClient: api, floorId: WIRE_FLOOR_ID, gateway, projectId: WIRE_PROJECT_ID }),
      { wrapper: withQueryClient() },
    );

    await waitFor(() => {
      expect(server.calls.filter((call) => call.path.endsWith('/snapshot'))).toHaveLength(10);
      expect(active).toBe(0);
      expect(result.current[0].rows[1]?.isMetadataOnly).toBe(true);
    });

    const rows = result.current[0].rows;

    expect(peak).toBeLessThanOrEqual(2);
    expect(rows[1]?.isMetadataOnly).toBe(true);
    expect(rows[1]?.retentionNotice).not.toBeNull();
    expect(rows[11]?.isPickable).toBe(false);
    expect(rows[11]?.isMetadataOnly).toBe(false);
    // Một bản hết nội dung → `partial`, không `error`.
    expect(result.current[0].state).toBe('partial');

    act(() => {
      result.current[1].selectRightVersion(many[11]?.id ?? '');
    });
    await waitFor(() => {
      expect(server.calls.filter((call) => call.path.endsWith('/snapshot'))).toHaveLength(11);
    });
    expect(peak).toBeLessThanOrEqual(2);

    // Sau một lượt phục hồi thật: chỉ bản mới được nạp N18 (bản cũ bất biến, nằm sẵn trong bộ đệm), vẫn ≤ 2.
    peak = 0;
    act(() => {
      result.current[1].requestRestore(many[2]?.id ?? '');
      result.current[1].confirmRestore();
    });
    await waitFor(() => {
      expect(result.current[0].rows[0]?.id).toBe(restoredId);
      expect(server.calls.filter((call) => call.path.endsWith('/snapshot'))).toHaveLength(12);
      expect(active).toBe(0);
    });
    expect(server.calls.filter((call) => call.path.endsWith('/restore'))).toHaveLength(1);
    expect(server.calls.filter((call) => call.path.endsWith('/snapshot')).at(-1)?.path).toContain(restoredId);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('NO-368: N18 hỏng tạm thời → hàng nêu câu lỗi, nút "Thử lại" nạp lại đúng bản đó (vẫn ≤ 2), tiêu điểm về hàng, aria-live báo', async () => {
    const setup = await renderVersionHistoryHook();
    let failing = true;
    let active = 0;
    let peak = 0;
    const rowOf = (id: string) => setup.result.current[0].rows.find((row) => row.id === id);
    // Hai bản có nội dung thêm vào đầu danh sách: bốn N18 cùng nạp, nên trần 2 mới thấy được.
    const extras = ['AAA', 'BBB'].map((suffix, index) => ({
      ...wireSummaries()[0],
      floorRevision: 50 + index,
      id: `ver_01J9ZV8Q3M7X5B2N4K6P8R0${suffix}`,
      label: undefined,
      sequence: 10 + index,
    }));

    setup.server.override('GET snapshot', async ({ path }) => {
      active += 1;
      peak = Math.max(peak, active);
      // Sống qua vài nhịp đồng hồ để các lượt N18 chồng lên nhau thật — không giới hạn thì `peak` là 4.
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;

      return failing && path.includes(WIRE_VERSION_IDS.v2)
        ? { error: wireError(503, 'UNAVAILABLE'), ok: false }
        : { data: { dimensions: [], layer: wireLayer(WIRE_CURRENT_WALLS), versionId: path.split('/')[4] }, ok: true };
    });
    setup.server.override('GET list', () => ({ data: { items: [...extras, ...wireSummaries()] }, ok: true }));
    await act(async () => {
      await setup.queryClient.resetQueries();
    });
    await waitFor(() => {
      expect(setup.result.current[0].rows).toHaveLength(5);
      expect(rowOf(WIRE_VERSION_IDS.v2)?.snapshotError).toBe(SNAPSHOT_FAILED_NOTICE);
      expect(active).toBe(0);
    });
    // Bốn bản cùng nạp: trần chạm đúng 2, không hơn.
    expect(peak).toBe(2);

    const failed = rowOf(WIRE_VERSION_IDS.v2);

    // Lỗi tạm thời không phải "hết nội dung".
    expect(failed?.isMetadataOnly).toBe(false);
    expect(rowOf(WIRE_VERSION_IDS.v3)?.snapshotError).toBeUndefined();

    const [model, actions] = setup.result.current;
    const view = renderWithProviders(<VersionHistory model={model} actions={actions} />);

    expect(screen.getByRole('status', { name: 'Trạng thái nạp nội dung phiên bản' }).textContent).toContain(SNAPSHOT_FAILED_NOTICE);

    const retry = screen.getByRole('button', { name: `${SNAPSHOT_RETRY_LABEL} tải nội dung ${failed?.label ?? ''}` });
    const before = setup.server.calls.filter((call) => call.path.includes(`${WIRE_VERSION_IDS.v2}/snapshot`)).length;

    failing = false;
    retry.focus();
    act(() => {
      retry.click();
    });
    expect(document.activeElement?.closest('li')).not.toBeNull();
    expect(document.activeElement?.tagName).not.toBe('BUTTON');
    await waitFor(() => {
      expect(rowOf(WIRE_VERSION_IDS.v2)?.snapshotError).toBeUndefined();
    });
    expect(setup.server.calls.filter((call) => call.path.includes(`${WIRE_VERSION_IDS.v2}/snapshot`))).toHaveLength(before + 1);
    expect(peak).toBeLessThanOrEqual(2);
    view.unmount();
  });

  it('NO-376: huỷ một N18 đang bay → nhả chỗ trong trần ≤ 2, lượt đang xếp hàng chạy tiếp', async () => {
    const server = createVersionsServerFake();
    const many = Array.from({ length: 4 }, (_, index) => ({
      ...wireSummaries()[1],
      floorRevision: 100 + index,
      id: `ver_01J9ZV8Q3M7X5B2N4K6P8R0${'ABCD'.charAt(index).repeat(3)}`,
      label: undefined,
      sequence: 20 - index,
    }));

    server.override('GET list', () => ({ data: { items: many }, ok: true }));
    // Máy chủ không bao giờ trả: chỉ huỷ mới nhả được chỗ.
    server.override('GET snapshot', () => new Promise(() => undefined));

    const api = createApiClient(server.http);
    const gateway = createVersionHistoryGateway({ apiClient: api, floorId: WIRE_FLOOR_ID, projectId: WIRE_PROJECT_ID });
    const queryClient = createTestQueryClient();
    const snapshotCalls = () => server.calls.filter((call) => call.path.endsWith('/snapshot'));

    await hydrateFrom(server);
    renderHook(() => useVersionHistory({ apiClient: api, floorId: WIRE_FLOOR_ID, gateway, projectId: WIRE_PROJECT_ID }), {
      wrapper: ({ children }: { readonly children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => {
      expect(snapshotCalls()).toHaveLength(2);
    });

    const first = snapshotCalls()[0]?.path.split('/')[4] ?? '';

    await act(async () => {
      await queryClient.cancelQueries({ queryKey: snapshotQueryKey(WIRE_FLOOR_ID, first) });
    });
    await waitFor(() => {
      expect(snapshotCalls()).toHaveLength(3);
    });
  });

  it('tầng mặc định rỗng → empty, ô "Tầng" vẫn hiện', async () => {
    const server = createVersionsServerFake();

    server.override('GET list', () => ({ data: { items: [] }, ok: true }));
    await hydrateFrom(server);

    const api = createApiClient(server.http);
    const gateway = createVersionHistoryGateway({ apiClient: api, floorId: WIRE_FLOOR_ID, projectId: WIRE_PROJECT_ID });
    const { result } = renderHook(
      () =>
        useVersionHistory({ apiClient: api, floorId: WIRE_FLOOR_ID, floorOptions: FLOOR_OPTIONS, gateway, projectId: WIRE_PROJECT_ID }),
      { wrapper: withQueryClient() },
    );

    await waitFor(() => {
      expect(result.current[0].state).toBe('empty');
    });

    const [model, actions] = result.current;

    renderWithProviders(<VersionHistory model={model} actions={actions} />);
    expect(screen.getByText('Tầng 1 chưa có phiên bản nào')).toBeTruthy();
    expect(screen.getByRole('combobox')).toBeTruthy();
  });

  it('N18 chưa về → câu "đang nạp", không "Không có khác biệt"', async () => {
    const server = createVersionsServerFake();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    server.override('GET snapshot', async ({ path }) => {
      await gate;

      return { data: { dimensions: [], layer: wireLayer(WIRE_CURRENT_WALLS), versionId: path.split('/')[4] }, ok: true };
    });
    await hydrateFrom(server);

    const api = createApiClient(server.http);
    const gateway = createVersionHistoryGateway({ apiClient: api, floorId: WIRE_FLOOR_ID, projectId: WIRE_PROJECT_ID });
    const { result } = renderHook(
      () => useVersionHistory({ apiClient: api, floorId: WIRE_FLOOR_ID, gateway, projectId: WIRE_PROJECT_ID }),
      { wrapper: withQueryClient() },
    );

    await waitFor(() => {
      expect(result.current[0].rows).toHaveLength(3);
    });
    expect(result.current[0].state).toBe('partial');
    expect(result.current[0].compare.teachingSentence).toBe(SNAPSHOT_LOADING_SENTENCE);

    const [model, actions] = result.current;

    renderWithProviders(<VersionHistory model={model} actions={actions} />);
    expect(document.body.textContent).not.toContain('Không có khác biệt');
    expect(document.body.textContent).toContain(SNAPSHOT_LOADING_SENTENCE);

    await act(async () => {
      release();
      await gate;
    });
    await waitFor(() => {
      expect(result.current[0].compare.teachingSentence).toBeNull();
    });
  });

  it('nhiều bản mà chưa đủ hai bản còn nội dung → câu riêng, không "giống nhau"', async () => {
    const server = createVersionsServerFake();

    server.override('GET list', () => ({
      data: { items: [wireSummaries()[0], { ...wireSummaries()[1], hasSnapshot: false }] },
      ok: true,
    }));
    await hydrateFrom(server);

    const api = createApiClient(server.http);
    const gateway = createVersionHistoryGateway({ apiClient: api, floorId: WIRE_FLOOR_ID, projectId: WIRE_PROJECT_ID });
    const { result } = renderHook(
      () => useVersionHistory({ apiClient: api, floorId: WIRE_FLOOR_ID, gateway, projectId: WIRE_PROJECT_ID }),
      { wrapper: withQueryClient() },
    );

    await waitFor(() => {
      expect(result.current[0].rows).toHaveLength(2);
      expect(result.current[0].state).toBe('partial');
      expect(result.current[0].compare.teachingSentence).not.toBe(SNAPSHOT_LOADING_SENTENCE);
    });
    expect(result.current[0].compare.teachingSentence).toBe(NOT_ENOUGH_CONTENT_SENTENCE);
  });

  it('bỏ tick một bản → câu "chưa chọn đủ", không "giống nhau"', async () => {
    const server = createVersionsServerFake();

    await hydrateFrom(server);

    const api = createApiClient(server.http);
    const gateway = createVersionHistoryGateway({ apiClient: api, floorId: WIRE_FLOOR_ID, projectId: WIRE_PROJECT_ID });
    const { result } = renderHook(
      () => useVersionHistory({ apiClient: api, floorId: WIRE_FLOOR_ID, gateway, projectId: WIRE_PROJECT_ID }),
      { wrapper: withQueryClient() },
    );

    await waitFor(() => {
      expect(result.current[0].compare.teachingSentence).toBeNull();
    });

    const left = result.current[0].compare.leftVersionId;

    if (left === null) throw new Error('thiếu bản trái');
    act(() => {
      result.current[1].toggleCompareSelection(left);
    });

    expect(result.current[0].compare.leftVersionId).toBeNull();
    expect(result.current[0].compare.teachingSentence).toBe(NO_COMPARE_PAIR_REASON);

    const [model, actions] = result.current;

    renderWithProviders(<VersionHistory model={model} actions={actions} />);
    expect(document.body.textContent).not.toContain('Không có khác biệt');
  });

  it.each([
    ['403 FORBIDDEN', wireError(403, 'FORBIDDEN'), 'forbidden', null],
    ['404 resource:"project"', wireError(404, 'NOT_FOUND', { resource: 'project' }), 'forbidden', null],
    ['500', wireError(500, 'INTERNAL'), 'error', VERSION_LIST_FAILED_REASON],
  ] as const)('N17 %s → %s', async (_name, error, state, message) => {
    const server = createVersionsServerFake();

    server.override('GET list', () => ({ error, ok: false }));
    await hydrateFrom(server);

    const api = createApiClient(server.http);
    const gateway = createVersionHistoryGateway({ apiClient: api, floorId: WIRE_FLOOR_ID, projectId: WIRE_PROJECT_ID });
    const { result } = renderHook(
      () => useVersionHistory({ apiClient: api, floorId: WIRE_FLOOR_ID, gateway, projectId: WIRE_PROJECT_ID }),
      { wrapper: withQueryClient() },
    );

    await waitFor(() => {
      expect(result.current[0].state).toBe(state);
    });
    expect(result.current[0].errorMessage).toBe(message);
  });

  it('toast hoàn tác của nhãn gửi N20 với nhãn cũ', async () => {
    const setup = await renderVersionHistoryHook();

    act(() => {
      setup.result.current[1].tagVersion(WIRE_VERSION_IDS.v2, 'Mốc mới');
    });
    await waitFor(() => {
      expect(setup.onToast).toHaveBeenCalledWith(expect.objectContaining({ message: 'Đã gắn nhãn' }));
    });

    const toast = setup.onToast.mock.calls.at(-1)?.[0] as { onUndo?: () => void };

    act(() => {
      toast.onUndo?.();
    });
    await waitFor(() => {
      expect(setup.server.calls.filter((call) => call.path.endsWith('/label')).map((call) => call.body)).toEqual([
        { label: 'Mốc mới' },
        { label: 'Duyệt với chủ đầu tư' },
      ]);
    });
  });
});

describe('route — chọn tầng, không setActiveFloor', () => {
  it('cổng nạp kho điền dự án → mở tầng order nhỏ nhất, có ô "Tầng"', async () => {
    vi.stubEnv('VITE_USE_MOCK_API', 'true');
    vi.stubGlobal(
      'matchMedia',
      (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }),
    );

    try {
      act(() => {
        useStore.getState().setProject(null);
      });
      renderWithProviders(
        <MemoryRouter initialEntries={['/projects/project-1/versions']}>
          <Routes>
            <Route path={ROUTE_PATTERNS.projectVersions} element={<VersionHistoryRoute />} />
          </Routes>
        </MemoryRouter>,
      );

      // Cổng nạp kho mock điền dự án rồi màn mở danh sách phiên bản của tầng đầu tiên.
      expect(await screen.findByRole('navigation', { name: 'Danh sách phiên bản' }, { timeout: 5_000 })).toBeTruthy();
      expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
    } finally {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    }
  });
});

/* ==========================================================================
 * 8. Đổi tab giữ nguyên vị trí cuộn — Tabs.Panel THẬT unmount tab ẩn (bẫy đã ghi
 *    nhận trong types.ts), nên màn tự dựng ba panel, cả ba nằm trong DOM cùng lúc.
 * ========================================================================== */

describe('đổi tab giữ nguyên vị trí cuộn', () => {
  it('đặt scrollTop, đổi tab, đổi lại: cùng một phần tử, cùng vị trí cuộn', async () => {
    const VersionHistoryView = await loadVersionHistoryView();
    const props = buildVersionHistoryProps('success');
    const anchorText = props.model.compare.groups[0]?.rows[0]?.sentence;

    expect(anchorText).toBeTruthy();

    const { rerender } = renderWithProviders(<VersionHistoryView {...props} />);

    const anchor = screen.getByText(anchorText as string, { exact: false });

    anchor.scrollTop = 120;

    rerender(
      <VersionHistoryView
        {...props}
        model={{ ...props.model, compare: { ...props.model.compare, activeTab: 'json' } }}
      />,
    );
    rerender(
      <VersionHistoryView
        {...props}
        model={{ ...props.model, compare: { ...props.model.compare, activeTab: 'changes' } }}
      />,
    );

    const anchorAgain = screen.getByText(anchorText as string, { exact: false });

    expect(anchorAgain).toBe(anchor);
    expect(anchorAgain.scrollTop).toBe(120);
  });
});

/* ==========================================================================
 * 9. Nút phục hồi RA KHỎI DOM khi `canRestore` false (trạng thái 6) — `queryBy… === null`,
 *    không phải `toBeDisabled`.
 * ========================================================================== */

describe('nút phục hồi rời khỏi DOM khi canRestore false', () => {
  it('trạng thái "không có quyền": không có nút nào tên "phục hồi"', async () => {
    const VersionHistoryView = await loadVersionHistoryView();
    const props = buildVersionHistoryProps('forbidden');

    expect(props.model.canRestore).toBe(false);

    renderWithProviders(<VersionHistoryView {...props} />);

    expect(screen.queryByRole('button', { name: /phục hồi/iu })).toBeNull();
  });

  it('trạng thái "thành công": nút phục hồi CÓ mặt', async () => {
    const VersionHistoryView = await loadVersionHistoryView();
    const props = buildVersionHistoryProps('success');

    expect(props.model.canRestore).toBe(true);

    renderWithProviders(<VersionHistoryView {...props} />);

    expect(screen.queryByRole('button', { name: /phục hồi/iu })).not.toBeNull();
  });
});
