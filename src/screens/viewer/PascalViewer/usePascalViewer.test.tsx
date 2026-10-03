/**
 * Máy trạng thái và phím tắt của màn xem Pascal.
 *
 * `PascalViewer.test.tsx` canh phần view — bảy trạng thái dựng ra cái gì. Tệp
 * này canh phần quyết định: **khi nào** màn ở trạng thái nào, và bàn phím làm
 * được gì.
 *
 * Gói vách ngăn được thay bằng một hàm nạp giả. Đó không phải mock che đi việc
 * thật: gói ấy dựng gốc React thứ hai và cần WebGL, còn thứ tệp này canh là
 * logic quanh nó. Việc dựng hình đo trong trình duyệt, ghi ở
 * `docs/pascal/IMPLEMENTATION_STATUS.md` §4.9.
 */

import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import type { SpatialGraph } from '@/domain/spatial/types';
import type * as ToPascalModule from '@/lib/pascal/toPascal';
import {
  __resetFeatureFlagsForTests,
  setFeatureFlagOverride,
} from '@/lib/telemetry/flags';

import { usePascalViewer, type UsePascalViewerOptions, type UsePascalViewerResult } from './usePascalViewer';

/**
 * Bộ đổi dữ liệu THẬT, bọc một lớp đếm lượt gọi và hỏng theo yêu cầu.
 *
 * Không thay nó bằng đồ giả: mọi bài khác của tệp vẫn cần cảnh thật. Lớp bọc chỉ
 * để trả lời hai câu mà trạng thái màn không nói ra — cờ tắt thì nó có chạy
 * không (B-V10-03), và "thử lại" có chạy lại nó không (B-V10-04).
 */
const adapter = vi.hoisted(() => ({ calls: 0, failNext: 0 }));

vi.mock('@/lib/pascal/toPascal', async (importOriginal) => {
  const actual = await importOriginal<typeof ToPascalModule>();

  return {
    ...actual,
    toPascalScene: (graph: SpatialGraph) => {
      adapter.calls += 1;
      if (adapter.failNext > 0) {
        adapter.failNext -= 1;
        throw new Error('Failed to fetch dynamically imported module');
      }

      return actual.toPascalScene(graph);
    },
  };
});

/**
 * Trần chờ rộng hơn mặc định, và có lý do đo được.
 *
 * Từ khi `toPascalScene` nạp muộn bằng `import()` (để giữ cổng "chi phí thêm
 * cho một màn"), giữa lúc dựng hook và lúc gắn khung có **thêm một nhịp bất
 * đồng bộ**. Chạy riêng thư mục này thì 1 000 ms của `vi.waitFor` thừa sức;
 * chạy cả 353 tệp cùng lúc thì không — cổng tổng ngày 2026-09-29 đỏ đúng một
 * bài vì thế, trong khi chạy riêng nó xanh 49/49.
 *
 * Nâng trần chờ **không** nới một khẳng định nào: mọi `expect` giữ nguyên từng
 * dòng. Cùng cách xử lý và cùng lý do với `routes/router.test.tsx:51` và
 * `screens/admin/ModelLibrary/ModelLibrary.test.tsx:91` — phạm vi một tệp,
 * không đụng `vitest.config.ts` vì tệp ấy là cổng chung.
 */
const ASYNC_TIMEOUT_MS = 15_000;

vi.setConfig({ testTimeout: 20_000 });

/**
 * Đủ cho lượt `import()` + `then` của hook chạy xong trong jsdom.
 *
 * Một lượt chờ theo thời gian, và đó là chỗ yếu có chủ ý: không có mốc dương
 * nào cho "hook KHÔNG làm gì". Đo 2026-10-03 trên mã CHƯA sửa B-V10-03: chờ một
 * microtask hay 50 ms thì bài vẫn xanh (vitest dựng module mock qua nhiều nhịp);
 * 1 500 ms thì đỏ đúng. Nếu máy chậm hơn thế, bài chỉ có thể sai về phía XANH,
 * không bao giờ đỏ oan. Đường chặn hồi quy chắc chắn là bài e2e "cờ tắt" (đếm
 * request mạng sau `networkidle`).
 */
const ADAPTER_SETTLE_MS = 1_500;

/**
 * Hook cần một phần tử DOM thật cho `canvasRef` — nó chỉ nạp gói khi có chỗ để
 * cắm vào. `renderHook` không cho cái đó, nên đây là một component tí hon vừa
 * gọi hook vừa gắn ref, và đẩy kết quả mới nhất ra ngoài.
 */
function Probe({ onResult, ...options }: UsePascalViewerOptions & {
  readonly onResult: (result: UsePascalViewerResult) => void;
}) {
  const result = usePascalViewer(options);
  onResult(result);

  return <div ref={result.canvasRef} />;
}

/** Dựng `Probe` và trả về một hộp luôn giữ kết quả mới nhất của hook. */
const mountHook = (options: UsePascalViewerOptions) => {
  const box: { current: UsePascalViewerResult | null } = { current: null };
  const view = render(<Probe {...options} onResult={(result) => { box.current = result; }} />);

  return {
    get state() {
      return box.current?.viewModel.state ?? null;
    },
    get viewModel() {
      if (box.current === null) throw new Error('Probe chưa dựng xong.');

      return box.current.viewModel;
    },
    /**
     * Chờ khung ĐÃ GẮN rồi mới bật cờ sẵn sàng.
     *
     * Không chờ trạng thái `loading`: đó là trạng thái đầu tiên, nên nó đúng
     * ngay lập tức và lượt chờ không chờ gì cả. Từ khi bộ đổi dữ liệu nạp muộn,
     * giữa lúc dựng và lúc gắn khung có thêm một nhịp bất đồng bộ.
     */
    ready: async (bench: Harness) => {
      await vi.waitFor(() => {
        expect(bench.mounted()).toBe(true);
      }, { timeout: ASYNC_TIMEOUT_MS });
      act(() => bench.setReady(true));
    },
    expand: () => {
      act(() => box.current?.onExpand());
    },
    retry: () => {
      act(() => box.current?.onRetry());
    },
    unmount: view.unmount,
  };
};

const GRAPH = createSampleBuilding();

/** Bản vẽ rỗng: có tầng, không có tường/phòng/ô mở nào. */
const EMPTY_GRAPH: SpatialGraph = {
  ...GRAPH,
  walls: [],
  openings: [],
  rooms: [],
  furniture: [],
};

interface Harness {
  readonly dispose: ReturnType<typeof vi.fn>;
  readonly setReady: (ready: boolean) => void;
  readonly fail: (message: string) => void;
  readonly loadMount: () => Promise<never>;
  /** Đã gắn khung vào DOM chưa — mốc chờ đúng, xem `Probe.ready`. */
  readonly mounted: () => boolean;
  /** Giả lập store Pascal dọn đi mấy node, như nó vẫn làm trong im lặng. */
  readonly dropNodes: (ids: readonly string[]) => void;
}

/** Gói vách ngăn giả, đủ để chạy đúng hợp đồng `mount(el, options)`. */
const harness = (): Harness => {
  let onReadyChange: ((ready: boolean) => void) | undefined;
  let onFatal: ((error: Error) => void) | undefined;
  let onSceneLoaded: ((census: { nodeCount: number; droppedIds: readonly string[] }) => void)
    | undefined;
  const dispose = vi.fn();
  let didMount = false;

  return {
    dispose,
    mounted: () => didMount,
    setReady: (ready) => onReadyChange?.(ready),
    fail: (message) => onFatal?.(new Error(message)),
    dropNodes: (ids) => onSceneLoaded?.({ nodeCount: 0, droppedIds: ids }),
    loadMount: (() =>
      Promise.resolve({
        mount: (_element: HTMLElement, options: Record<string, unknown>) => {
          onReadyChange = options['onReadyChange'] as (ready: boolean) => void;
          onFatal = options['onFatal'] as (error: Error) => void;
          onSceneLoaded = options['onSceneLoaded'] as (census: {
            nodeCount: number;
            droppedIds: readonly string[];
          }) => void;
          didMount = true;

          return { dispose };
        },
      })) as unknown as () => Promise<never>,
  };
};

const press = (key: string): void => {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
};

beforeEach(() => {
  __resetFeatureFlagsForTests();
  setFeatureFlagOverride('scene.pascal-viewer', true);
  adapter.calls = 0;
  adapter.failNext = 0;
});

afterEach(() => {
  __resetFeatureFlagsForTests();
  delete window.__zod_globalConfig;
  vi.unstubAllEnvs();
});

describe('máy trạng thái', () => {
  it('cờ tắt thì "forbidden", và KHÔNG nạp gói', () => {
    setFeatureFlagOverride('scene.pascal-viewer', false);
    const bench = harness();
    const loadMount = vi.fn(bench.loadMount);

    const probe = mountHook({ graph: GRAPH, loadMount });

    expect(probe.state).toBe('forbidden');
    expect(loadMount).not.toHaveBeenCalled();
  });

  it('cờ tắt thì KHÔNG chạy cả bộ đổi dữ liệu — không ai xem cảnh ấy (B-V10-03)', async () => {
    setFeatureFlagOverride('scene.pascal-viewer', false);
    mountHook({ graph: GRAPH, loadMount: harness().loadMount });

    // Xem `ADAPTER_SETTLE_MS`: không có mốc dương cho "không làm gì".
    await import('@/lib/pascal/toPascal');
    await new Promise((resolve) => {
      setTimeout(resolve, ADAPTER_SETTLE_MS);
    });

    expect(adapter.calls).toBe(0);
  });

  it('bộ đổi dữ liệu hỏng rồi "thử lại" thì CHẠY LẠI nó, không kẹt "loading" (B-V10-04)', async () => {
    adapter.failNext = 1;
    const bench = harness();
    const probe = mountHook({ graph: GRAPH, loadMount: bench.loadMount });

    await vi.waitFor(() => {
      expect(probe.viewModel.errorCode).toBe('PASCAL-01');
    }, { timeout: ASYNC_TIMEOUT_MS });

    probe.retry();
    await probe.ready(bench);

    expect(adapter.calls).toBe(2);
    expect(['success', 'partial']).toContain(probe.state);
  });

  it('gói hỏng rồi "thử lại" thì xin gói ở URL KHÁC — trình duyệt giữ lỗi theo URL (B-V10-01)', async () => {
    const mountScript = (): HTMLScriptElement | null =>
      document.head.querySelector<HTMLScriptElement>('script[src*="pascal-mount"]');
    // Không có mã băm (Storybook, Vitest): URL trần, tất định.
    vi.stubEnv('VITE_PASCAL_MOUNT_VERSION', '');
    // Không truyền `loadMount`: đây là bài duy nhất chạy bộ nạp thật.
    const probe = mountHook({ graph: GRAPH });

    await vi.waitFor(() => {
      expect(mountScript()).not.toBeNull();
    }, { timeout: ASYNC_TIMEOUT_MS });
    const first = mountScript()!;
    const firstSrc = first.src;
    expect(firstSrc.endsWith('/assets/pascal/pascal-mount.js')).toBe(true);
    // B-V10-05 — phạm vi thật của khẳng định này: cờ CÓ MẶT khi thẻ script đã vào
    // DOM. Cờ đặt đồng bộ trước `append`, còn script module luôn chạy sau.
    expect(window.__zod_globalConfig?.jitless).toBe(true);

    act(() => {
      first.dispatchEvent(new Event('error'));
    });
    await vi.waitFor(() => {
      expect(probe.viewModel.errorCode).toBe('PASCAL-01');
    }, { timeout: ASYNC_TIMEOUT_MS });
    expect(first.isConnected).toBe(false);

    // B-V10-41: mã băm nội dung (`vite.config.ts` tính lúc dựng) đi cùng `attempt`.
    vi.stubEnv('VITE_PASCAL_MOUNT_VERSION', 'abc12345');
    probe.retry();

    await vi.waitFor(() => {
      expect(mountScript()).not.toBeNull();
    }, { timeout: ASYNC_TIMEOUT_MS });
    const second = mountScript()!;

    expect(second.src).not.toBe(firstSrc);
    expect(second.src).toContain('v=abc12345');
    expect(second.src).toContain('attempt=1');

    // Dọn: lượt nạp thứ hai không bao giờ về trong jsdom.
    act(() => {
      second.dispatchEvent(new Event('error'));
    });
    probe.unmount();
  });

  it('chưa có bản vẽ thì "loading"', () => {
    const probe = mountHook({ graph: null, loadMount: harness().loadMount });

    expect(probe.state).toBe('loading');
  });

  it('bản vẽ rỗng thì "empty", và KHÔNG nạp gói — không chạy WebGL cho một cảnh trống', () => {
    const bench = harness();
    const loadMount = vi.fn(bench.loadMount);

    const probe = mountHook({ graph: EMPTY_GRAPH, loadMount });

    expect(probe.state).toBe('empty');
    expect(loadMount).not.toHaveBeenCalled();
  });

  it('thu gọn thì "collapsed", và KHÔNG nạp gói', () => {
    const bench = harness();
    const loadMount = vi.fn(bench.loadMount);

    const probe = mountHook({ graph: GRAPH, collapsed: true, loadMount });

    expect(probe.state).toBe('collapsed');
    expect(loadMount).not.toHaveBeenCalled();
  });

  it('nạp gói hỏng thì "error" mang mã PASCAL-01, KHÔNG mang thông điệp của JS', async () => {
    const probe = mountHook({
        graph: GRAPH,
        loadMount: () => Promise.reject(new Error('Failed to fetch dynamically imported module')),
      });

    await vi.waitFor(() => {
      expect(probe.state).toBe('error');
    }, { timeout: ASYNC_TIMEOUT_MS });

    expect(probe.viewModel.errorCode).toBe('PASCAL-01');
  });

  it('khung chết giữa chừng thì "error" mang mã PASCAL-02', async () => {
    const bench = harness();
    const probe = mountHook({ graph: GRAPH, loadMount: bench.loadMount });

    // Chờ khung GẮN XONG: `onFatal` chỉ tồn tại sau lượt `mount`, và trước đó
    // `fail()` không có ai nghe.
    await vi.waitFor(() => {
      expect(bench.mounted()).toBe(true);
    }, { timeout: ASYNC_TIMEOUT_MS });

    act(() => {
      bench.fail('WebGL context lost');
    });

    await vi.waitFor(() => {
      expect(probe.viewModel.errorCode).toBe('PASCAL-02');
    }, { timeout: ASYNC_TIMEOUT_MS });
  });

  it('dựng xong mà có thứ bị bỏ qua thì "partial", kèm số đếm đã định dạng', async () => {
    const bench = harness();
    const probe = mountHook({ graph: GRAPH, loadMount: bench.loadMount });

    await probe.ready(bench);

    await vi.waitFor(() => {
      expect(probe.state).toBe('partial');
    }, { timeout: ASYNC_TIMEOUT_MS });

    // Bộ mẫu chuẩn có 4 trục và 34 kích thước không sang Pascal được (A14).
    const kinds = probe.viewModel.skipped.map((item) => item.kind);
    expect(kinds).toContain('trục định vị');
    expect(probe.viewModel.summary).toMatchObject({ wallLabel: '48' });
  });
});

describe('[A12] bàn phím', () => {
  it('Esc thu khung xem lại — lời hứa "Esc đóng lớp trên cùng"', async () => {
    const bench = harness();
    const probe = mountHook({ graph: GRAPH, loadMount: bench.loadMount });

    await probe.ready(bench);
    await vi.waitFor(() => {
      expect(probe.state).not.toBe('loading');
    }, { timeout: ASYNC_TIMEOUT_MS });

    press('Escape');

    await vi.waitFor(() => {
      expect(probe.state).toBe('collapsed');
    }, { timeout: ASYNC_TIMEOUT_MS });
  });

  it('E mở lại khung xem sau khi Esc thu nó lại', async () => {
    const bench = harness();
    const probe = mountHook({ graph: GRAPH, loadMount: bench.loadMount });

    await probe.ready(bench);
    await vi.waitFor(() => {
      expect(probe.state).not.toBe('loading');
    }, { timeout: ASYNC_TIMEOUT_MS });

    press('Escape');
    await vi.waitFor(() => {
      expect(probe.state).toBe('collapsed');
    }, { timeout: ASYNC_TIMEOUT_MS });

    press('e');
    await vi.waitFor(() => {
      expect(probe.state).not.toBe('collapsed');
    }, { timeout: ASYNC_TIMEOUT_MS });
  });

  it('nút chuột làm được đúng việc phím làm — phím không phải đường duy nhất', async () => {
    const bench = harness();
    const probe = mountHook({ graph: GRAPH, collapsed: true, loadMount: bench.loadMount });

    expect(probe.state).toBe('collapsed');

    probe.expand();

    await vi.waitFor(() => {
      expect(probe.state).not.toBe('collapsed');
    }, { timeout: ASYNC_TIMEOUT_MS });
  });
});

describe('node bị store dọn đi thì màn NÓI RA', () => {
  it('store dọn node thì màn sang "partial" và liệt kê số bị dọn', async () => {
    const bench = harness();
    const probe = mountHook({ graph: GRAPH, loadMount: bench.loadMount });

    await probe.ready(bench);
    act(() => bench.dropNodes(['slab_R-ROOM0000001', 'slab_R-ROOM0000002']));

    await vi.waitFor(() => {
      expect(probe.state).toBe('partial');
    }, { timeout: ASYNC_TIMEOUT_MS });

    const entry = probe.viewModel.skipped.find((item) => item.kind === 'phần mô hình');

    expect(entry).toBeDefined();
    expect(entry?.countLabel).toBe('2');
    expect(entry?.reason.length).toBeGreaterThan(0);
  });

  it('store không dọn gì thì KHÔNG thêm dòng nào', async () => {
    const bench = harness();
    const probe = mountHook({ graph: GRAPH, loadMount: bench.loadMount });

    await probe.ready(bench);
    const before = probe.viewModel.skipped.length;

    act(() => bench.dropNodes([]));

    // Bộ mẫu chuẩn luôn có trục và kích thước nên màn vẫn `partial`; điều được
    // kiểm ở đây là lượt nạp SẠCH không thêm dòng thứ n + 1.
    expect(probe.viewModel.skipped).toHaveLength(before);
    expect(probe.viewModel.skipped.some((item) => item.kind === 'phần mô hình')).toBe(false);
  });

  it('thử lại thì dòng của lượt trước MẤT — nó nói về một lượt nạp đã chết', async () => {
    const bench = harness();
    const probe = mountHook({ graph: GRAPH, loadMount: bench.loadMount });

    await probe.ready(bench);
    act(() => bench.dropNodes(['slab_R-ROOM0000001']));

    await vi.waitFor(() => {
      expect(probe.viewModel.skipped.some((item) => item.kind === 'phần mô hình')).toBe(true);
    }, { timeout: ASYNC_TIMEOUT_MS });

    act(() => {
      probe.retry();
    });

    await vi.waitFor(() => {
      expect(probe.viewModel.skipped.some((item) => item.kind === 'phần mô hình')).toBe(false);
    }, { timeout: ASYNC_TIMEOUT_MS });
  });
});

describe('dọn dẹp', () => {
  it('rời màn thì gọi dispose — cảnh cũ không sống sang lượt sau', async () => {
    const bench = harness();
    const probe = mountHook({ graph: GRAPH, loadMount: bench.loadMount });

    // Phải chờ khung GẮN XONG rồi mới gỡ; gỡ trước thì không có gì để dọn.
    await vi.waitFor(() => {
      expect(bench.mounted()).toBe(true);
    }, { timeout: ASYNC_TIMEOUT_MS });

    probe.unmount();

    await vi.waitFor(() => {
      expect(bench.dispose).toHaveBeenCalled();
    }, { timeout: ASYNC_TIMEOUT_MS });
  });
});
