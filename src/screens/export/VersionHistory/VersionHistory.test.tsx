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
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UNDO_WINDOW_MS } from '@/lib/mutations/undoTicket';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { installFakeClock, type FakeClock } from '@/lib/testing/fakeClock';
import { createTestQueryClient, renderWithProviders } from '@/lib/testing/render';
import { createSevenStateScenarios, SEVEN_STATES } from '@/lib/testing/sevenStateScenarios';

import { DIFF_TINT_OPACITY, DIFF_TONE_TOKENS } from './types';
import type {
  DiffTone,
  UseVersionHistoryOptions,
  VersionHistoryProps,
  VersionHistoryResult,
} from './types';
import {
  buildVersionHistoryProps,
  createFakeVersionHistoryGateway,
  SAMPLE_CONFLICT,
  SAMPLE_FLOOR_ID,
  SAMPLE_PROJECT_ID,
} from './versionHistoryFixtures';

afterEach(() => {
  cleanup();
});

/* ==========================================================================
 * 0. Hạ tầng: nhập file cùng thư mục qua biến, không qua chuỗi tĩnh.
 * ========================================================================== */

/** Xem lời giải thích ở đầu file. */
async function importFromScreen<T>(specifier: string): Promise<T> {
  return import(/* @vite-ignore */ specifier) as Promise<T>;
}

async function loadVersionHistoryView(): Promise<ComponentType<VersionHistoryProps>> {
  const mod = await importFromScreen<{ VersionHistory: ComponentType<VersionHistoryProps> }>(
    './VersionHistory',
  );

  return mod.VersionHistory;
}

async function loadUseVersionHistory(): Promise<
  (options: UseVersionHistoryOptions) => VersionHistoryResult
> {
  const mod = await importFromScreen<{
    useVersionHistory: (options: UseVersionHistoryOptions) => VersionHistoryResult;
  }>('./useVersionHistory');

  return mod.useVersionHistory;
}

function withQueryClient(): ({ children }: { readonly children: ReactNode }) => JSX.Element {
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
 * 5, 6, 7. Hành vi của hook — phục hồi, hoàn tác, xung đột 409.
 * ========================================================================== */

describe('phục hồi làm số phiên bản TĂNG THÊM 1, không bao giờ giảm', () => {
  it('đếm trước, phục hồi, đếm sau: tăng đúng 1', async () => {
    const useVersionHistory = await loadUseVersionHistory();
    const gateway = createFakeVersionHistoryGateway();
    const { result } = renderHook(
      () => useVersionHistory({ gateway, projectId: SAMPLE_PROJECT_ID, floorId: SAMPLE_FLOOR_ID }),
      { wrapper: withQueryClient() },
    );

    await waitFor(() => {
      expect(result.current[0].rows.length).toBeGreaterThan(0);
    });

    const countBefore = result.current[0].versionCount;
    const targetId = result.current[0].rows[0]?.id;

    expect(targetId).toBeDefined();

    result.current[1].requestRestore(targetId as string);
    result.current[1].confirmRestore();

    await waitFor(() => {
      expect(result.current[0].versionCount).toBe(countBefore + 1);
    });
  });
});

describe('hoàn tác trong UNDO_WINDOW_MS, không dùng setTimeout thật', () => {
  it('bấm hoàn tác TRƯỚC khi hết UNDO_WINDOW_MS thì gọi gateway.undoRestore', async () => {
    /*
     * Đồng hồ đóng băng SAU khi lượt đọc đã lắng — khuôn `useObjectLayerReview.test.ts:418`.
     *
     * `waitFor` của testing-library dò đồng hồ giả bằng biến toàn cục `jest`, thứ vitest
     * không có; dưới đồng hồ giả nó vì thế đi đường "đồng hồ thật" và đặt một `setInterval`
     * ĐÃ BỊ GIẢ, nên nó kiểm đúng một lần rồi chờ mãi. Lượt tải danh sách chạy với đồng hồ
     * thật, và mọi lượt chờ SAU khi đóng băng đi qua `act` + `clock.advance`. Chỉ CÁCH CHỜ
     * đổi: không một điều kiện khẳng định nào, không một mốc thời gian nào bị đụng tới.
     *
     * `readNow` đọc đồng hồ ở thời điểm GỌI, nên phiếu hoàn tác — thứ được tạo sau khi đóng
     * băng — vẫn nằm dưới `UNDO_WINDOW_MS` của đồng hồ giả, đúng như bài này đòi.
     */
    let clock: FakeClock | null = null;
    const readNow = (): Date => clock?.now() ?? new Date();
    const gateway = createFakeVersionHistoryGateway({ now: readNow });
    const undoSpy = vi.spyOn(gateway, 'undoRestore');
    const onToast = vi.fn();
    const useVersionHistory = await loadUseVersionHistory();
    const { result } = renderHook(
      () =>
        useVersionHistory({
          gateway,
          projectId: SAMPLE_PROJECT_ID,
          floorId: SAMPLE_FLOOR_ID,
          now: readNow,
          onToast,
        }),
      { wrapper: withQueryClient() },
    );

    await waitFor(() => {
      expect(result.current[0].rows.length).toBeGreaterThan(0);
    });

    const fakeClock = installFakeClock();

    clock = fakeClock;

    /** Cho các lời hứa đang treo lắng mà KHÔNG dời đồng hồ một mili giây nào. */
    const settle = async (): Promise<void> => {
      await act(async () => {
        await fakeClock.advance(0);
        await fakeClock.flushMicrotasks();
      });
    };

    try {
      const targetId = result.current[0].rows[0]?.id as string;

      result.current[1].requestRestore(targetId);
      result.current[1].confirmRestore();

      await settle();

      expect(onToast).toHaveBeenCalled();

      const toast = onToast.mock.calls.at(-1)?.[0] as { onUndo?: () => void };

      await act(async () => {
        await fakeClock.advance(UNDO_WINDOW_MS - 1);
      });

      toast.onUndo?.();
      await settle();

      expect(undoSpy).toHaveBeenCalledTimes(1);
    } finally {
      fakeClock.restore();
      clock = null;
    }
  });

  it('bấm hoàn tác SAU khi hết UNDO_WINDOW_MS thì KHÔNG gọi gateway.undoRestore', async () => {
    /*
     * Đồng hồ đóng băng SAU khi lượt đọc đã lắng — khuôn `useObjectLayerReview.test.ts:418`.
     *
     * `waitFor` của testing-library dò đồng hồ giả bằng biến toàn cục `jest`, thứ vitest
     * không có; dưới đồng hồ giả nó vì thế đi đường "đồng hồ thật" và đặt một `setInterval`
     * ĐÃ BỊ GIẢ, nên nó kiểm đúng một lần rồi chờ mãi. Lượt tải danh sách chạy với đồng hồ
     * thật, và mọi lượt chờ SAU khi đóng băng đi qua `act` + `clock.advance`. Chỉ CÁCH CHỜ
     * đổi: không một điều kiện khẳng định nào, không một mốc thời gian nào bị đụng tới.
     *
     * `readNow` đọc đồng hồ ở thời điểm GỌI, nên phiếu hoàn tác — thứ được tạo sau khi đóng
     * băng — vẫn nằm dưới `UNDO_WINDOW_MS` của đồng hồ giả, đúng như bài này đòi.
     */
    let clock: FakeClock | null = null;
    const readNow = (): Date => clock?.now() ?? new Date();
    const gateway = createFakeVersionHistoryGateway({ now: readNow });
    const undoSpy = vi.spyOn(gateway, 'undoRestore');
    const onToast = vi.fn();
    const useVersionHistory = await loadUseVersionHistory();
    const { result } = renderHook(
      () =>
        useVersionHistory({
          gateway,
          projectId: SAMPLE_PROJECT_ID,
          floorId: SAMPLE_FLOOR_ID,
          now: readNow,
          onToast,
        }),
      { wrapper: withQueryClient() },
    );

    await waitFor(() => {
      expect(result.current[0].rows.length).toBeGreaterThan(0);
    });

    const fakeClock = installFakeClock();

    clock = fakeClock;

    /** Cho các lời hứa đang treo lắng mà KHÔNG dời đồng hồ một mili giây nào. */
    const settle = async (): Promise<void> => {
      await act(async () => {
        await fakeClock.advance(0);
        await fakeClock.flushMicrotasks();
      });
    };

    try {
      const targetId = result.current[0].rows[0]?.id as string;

      result.current[1].requestRestore(targetId);
      result.current[1].confirmRestore();

      await settle();

      expect(onToast).toHaveBeenCalled();

      const toast = onToast.mock.calls.at(-1)?.[0] as { onUndo?: () => void };

      await act(async () => {
        await fakeClock.advance(UNDO_WINDOW_MS + 1);
      });

      toast.onUndo?.();
      await settle();

      expect(undoSpy).not.toHaveBeenCalled();
    } finally {
      fakeClock.restore();
      clock = null;
    }
  });
});

describe('409: tên người đã sửa hiện ra, không có nhánh ghi đè', () => {
  it('gateway trả conflict: tên người đã sửa hiện trong DOM, restore không bị gọi lại lần hai', async () => {
    const restoreSpy = vi.fn().mockResolvedValue({ kind: 'conflict' as const, conflict: SAMPLE_CONFLICT });
    const gateway = createFakeVersionHistoryGateway({ onRestore: restoreSpy });
    const useVersionHistory = await loadUseVersionHistory();
    const { result } = renderHook(
      () => useVersionHistory({ gateway, projectId: SAMPLE_PROJECT_ID, floorId: SAMPLE_FLOOR_ID }),
      { wrapper: withQueryClient() },
    );

    await waitFor(() => {
      expect(result.current[0].rows.length).toBeGreaterThan(0);
    });

    const targetId = result.current[0].rows[0]?.id as string;

    result.current[1].requestRestore(targetId);
    result.current[1].confirmRestore();

    await waitFor(() => {
      expect(result.current[0].conflict?.actorName).toBe(SAMPLE_CONFLICT.actorName);
    });

    expect(restoreSpy).toHaveBeenCalledTimes(1);

    const VersionHistoryView = await loadVersionHistoryView();
    const [model, actions] = result.current;

    renderWithProviders(<VersionHistoryView model={model} actions={actions} />);

    expect(document.body.textContent).toContain(SAMPLE_CONFLICT.actorName);
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
