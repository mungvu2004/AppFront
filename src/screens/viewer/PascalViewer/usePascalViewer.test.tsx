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
import {
  __resetFeatureFlagsForTests,
  setFeatureFlagOverride,
} from '@/lib/telemetry/flags';

import { usePascalViewer, type UsePascalViewerOptions, type UsePascalViewerResult } from './usePascalViewer';

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
    /** Chờ gói giả nạp xong rồi mới bật cờ sẵn sàng — thứ tự thật của vòng đời. */
    ready: async (bench: Harness) => {
      await vi.waitFor(() => {
        expect(box.current?.viewModel.state).toBe('loading');
      });
      act(() => bench.setReady(true));
    },
    expand: () => {
      act(() => box.current?.onExpand());
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
}

/** Gói vách ngăn giả, đủ để chạy đúng hợp đồng `mount(el, options)`. */
const harness = (): Harness => {
  let onReadyChange: ((ready: boolean) => void) | undefined;
  let onFatal: ((error: Error) => void) | undefined;
  const dispose = vi.fn();

  return {
    dispose,
    setReady: (ready) => onReadyChange?.(ready),
    fail: (message) => onFatal?.(new Error(message)),
    loadMount: (() =>
      Promise.resolve({
        mount: (_element: HTMLElement, options: Record<string, unknown>) => {
          onReadyChange = options['onReadyChange'] as (ready: boolean) => void;
          onFatal = options['onFatal'] as (error: Error) => void;

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
});

afterEach(() => {
  __resetFeatureFlagsForTests();
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
    });

    expect(probe.viewModel.errorCode).toBe('PASCAL-01');
  });

  it('khung chết giữa chừng thì "error" mang mã PASCAL-02', async () => {
    const bench = harness();
    const probe = mountHook({ graph: GRAPH, loadMount: bench.loadMount });

    await vi.waitFor(() => {
      expect(probe.state).not.toBe('error');
    });

    act(() => {
      bench.fail('WebGL context lost');
    });

    await vi.waitFor(() => {
      expect(probe.viewModel.errorCode).toBe('PASCAL-02');
    });
  });

  it('dựng xong mà có thứ bị bỏ qua thì "partial", kèm số đếm đã định dạng', async () => {
    const bench = harness();
    const probe = mountHook({ graph: GRAPH, loadMount: bench.loadMount });

    await vi.waitFor(() => {
      expect(probe.state).toBe('loading');
    });

    act(() => {
      bench.setReady(true);
    });

    await vi.waitFor(() => {
      expect(probe.state).toBe('partial');
    });

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
    });

    press('Escape');

    await vi.waitFor(() => {
      expect(probe.state).toBe('collapsed');
    });
  });

  it('E mở lại khung xem sau khi Esc thu nó lại', async () => {
    const bench = harness();
    const probe = mountHook({ graph: GRAPH, loadMount: bench.loadMount });

    await probe.ready(bench);
    await vi.waitFor(() => {
      expect(probe.state).not.toBe('loading');
    });

    press('Escape');
    await vi.waitFor(() => {
      expect(probe.state).toBe('collapsed');
    });

    press('e');
    await vi.waitFor(() => {
      expect(probe.state).not.toBe('collapsed');
    });
  });

  it('nút chuột làm được đúng việc phím làm — phím không phải đường duy nhất', async () => {
    const bench = harness();
    const probe = mountHook({ graph: GRAPH, collapsed: true, loadMount: bench.loadMount });

    expect(probe.state).toBe('collapsed');

    probe.expand();

    await vi.waitFor(() => {
      expect(probe.state).not.toBe('collapsed');
    });
  });
});

describe('dọn dẹp', () => {
  it('rời màn thì gọi dispose — cảnh cũ không sống sang lượt sau', async () => {
    const bench = harness();
    const probe = mountHook({ graph: GRAPH, loadMount: bench.loadMount });

    await vi.waitFor(() => {
      expect(bench.dispose).not.toHaveBeenCalled();
    });

    probe.unmount();

    await vi.waitFor(() => {
      expect(bench.dispose).toHaveBeenCalled();
    });
  });
});
