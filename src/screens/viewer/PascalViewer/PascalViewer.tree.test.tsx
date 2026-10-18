/**
 * Màn Pascal chạy qua **cây component thật**: container → view → hook.
 *
 * ## Vì sao tệp này tồn tại
 *
 * Một vòng chết đã sống sót qua **41 bài kiểm đơn vị**:
 *
 * - `PascalViewer.tsx` chỉ dựng hộp `data-testid="pascal-canvas"` ở `success`
 *   và `partial`;
 * - `usePascalViewer.ts` chỉ nạp gói khi `canvasRef.current !== null`;
 * - mà muốn tới `success` thì phải nạp xong.
 *
 * Kết quả: màn kẹt ở `loading` **vĩnh viễn**, và không lượt gọi nào tới
 * `/assets/pascal/pascal-mount.js` được gửi đi. Người dùng thấy một khung xương
 * không bao giờ dừng.
 *
 * Bốn mươi mốt bài kia không bắt được vì bộ dựng thử của hook
 * (`usePascalViewer.test.tsx`) gắn `canvasRef` vào một `div` **vô điều kiện** —
 * đi vòng qua đúng nhánh điều kiện gây ra lỗi. Bài e2e là thứ đầu tiên chạm tới
 * cây thật, và nó chạy mất vài phút.
 *
 * Tệp này là cùng phép kiểm ấy, chạy trong một giây, không cần WebGL: nó dựng
 * đúng `PascalViewerContainer` như router dựng, và chỉ thay **một** thứ — cửa
 * nạp gói.
 *
 * Quy tắc rút ra, đáng ghi vì nó không chỉ đúng cho màn này: **một bộ dựng thử
 * đơn giản hoá mất nhánh điều kiện thì nó cũng đơn giản hoá mất lỗi nằm trong
 * nhánh ấy.**
 */

import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { renderWithProviders } from '@/lib/testing/render';
import { useStore } from '@/store';

import { PascalViewerContainer, PascalViewerRoute } from './PascalViewer.container';
import { PASCAL_LEAVE_LABEL } from './pascalViewerTypes';

/** Lời trạng thái của màn; lớp cộng tác (S5) có `status` riêng, đứng sau trong DOM. */
const screenStatus = (): HTMLElement => {
  // Bỏ qua chú thích của thanh hiện diện ở khe đầu màn (23R-F-002): nó đứng trước dòng trạng thái.
  const first = screen
    .getAllByRole('status')
    .find((el) => el.closest('[data-testid="pascal-header-slot"]') === null);
  if (first === undefined) throw new Error('Màn không có vùng trạng thái.');
  return first;
};

const GRAPH = createSampleBuilding();

/** Gói vách ngăn giả, đủ đúng hợp đồng `mount(el, options)`. */
const stubMount = () => {
  const dispose = vi.fn();
  const mounted: { element: HTMLElement | null } = { element: null };
  let announceReady: ((ready: boolean) => void) | undefined;

  const loadMount = vi.fn(() =>
    Promise.resolve({
      mount: (element: HTMLElement, options: Record<string, unknown>) => {
        mounted.element = element;
        announceReady = options['onReadyChange'] as (ready: boolean) => void;

        return { dispose };
      },
    }),
  );

  return {
    dispose,
    mounted,
    loadMount: loadMount as unknown as never,
    calls: () => loadMount.mock.calls.length,
    ready: () => announceReady?.(true),
  };
};

describe('cây thật: container → view → hook', () => {
  it('hộp cho Pascal cắm vào CÓ MẶT ngay lúc đang nạp', () => {
    const bench = stubMount();

    renderWithProviders(
      <MemoryRouter>
        <PascalViewerContainer graph={GRAPH} loadMount={bench.loadMount} />
      </MemoryRouter>,
    );

    // Đây là dòng bắt được vòng chết: lúc này màn vẫn `loading`.
    expect(screen.getByTestId('pascal-canvas')).toBeInTheDocument();
  });

  it('gói vách ngăn ĐƯỢC nạp, và nạp vào đúng cái hộp ấy', async () => {
    const bench = stubMount();

    renderWithProviders(
      <MemoryRouter>
        <PascalViewerContainer graph={GRAPH} loadMount={bench.loadMount} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(bench.calls()).toBe(1);
    });

    expect(bench.mounted.element).toBe(screen.getByTestId('pascal-canvas'));
  });

  it('nạp xong thì màn rời khỏi "đang nạp" và nói ra số đo', async () => {
    const bench = stubMount();

    renderWithProviders(
      <MemoryRouter>
        <PascalViewerContainer graph={GRAPH} loadMount={bench.loadMount} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(bench.calls()).toBe(1);
    });

    bench.ready();

    await waitFor(() => {
      expect(screenStatus()).not.toHaveTextContent('Đang nạp');
    });

    // Bộ mẫu chuẩn A14: 48 tường.
    expect(screen.getByTestId('pascal-top-bar')).toHaveTextContent('48 tường');
  });

  it('rời màn thì gọi dispose', async () => {
    const bench = stubMount();

    const view = renderWithProviders(
      <MemoryRouter>
        <PascalViewerContainer graph={GRAPH} loadMount={bench.loadMount} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(bench.calls()).toBe(1);
    });

    view.unmount();

    await waitFor(() => {
      expect(bench.dispose).toHaveBeenCalled();
    });
  });
});

describe('route: đọc kho qua cổng nạp kho dự án (B-V12-01)', () => {
  const PROJECT = {
    created_at: '',
    id: 'project-1',
    members: [],
    name: 'Dự án mẫu',
    updated_at: '',
  };

  const renderRoute = () =>
    renderWithProviders(
      <MemoryRouter initialEntries={['/projects/project-1/3d']}>
        <Routes>
          <Route path="/projects/:projectId/3d" element={<PascalViewerRoute />} />
        </Routes>
      </MemoryRouter>,
      { keepStore: true },
    );

  afterEach(() => {
    act(() => {
      useStore.getState().setSpatial(null, null);
      useStore.getState().setProject(null);
    });
  });

  it('cổng đang nạp thì màn ở "đang nạp", không vẽ kho của dự án trước', () => {
    act(() => {
      useStore.getState().setProject(PROJECT);
      useStore.getState().setSpatial(normalizeSpatial(GRAPH), null);
      useStore.getState().setSpatialLoading(true);
    });

    renderRoute();

    expect(screenStatus()).toHaveTextContent('Đang nạp');
    expect(screen.queryByText(/48 tường/)).not.toBeInTheDocument();
  });

  it('nối BE thật, kho đã nạp mà dự án chưa có hình thì màn ở "Rỗng" — không "đang nạp" mãi', () => {
    vi.stubEnv('VITE_USE_MOCK_API', 'false');
    act(() => {
      useStore.getState().setProject(PROJECT);
      useStore
        .getState()
        .setSpatial(
          normalizeSpatial({
            ...GRAPH,
            axes: [],
            dimensions: [],
            furniture: [],
            levels: [],
            openings: [],
            rooms: [],
            walls: [],
          }),
          null,
        );
    });

    try {
      renderRoute();

      expect(screenStatus()).toHaveTextContent('Bản vẽ chưa có đối tượng nào để dựng.');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('23-A-004 (BUG-487): có lối ra về quản lý tầng của dự án', () => {
    act(() => {
      useStore.getState().setProject(PROJECT);
      useStore.getState().setSpatialLoading(true);
    });

    renderWithProviders(
      <MemoryRouter initialEntries={['/projects/project-1/3d']}>
        <Routes>
          <Route path="/projects/:projectId/3d" element={<PascalViewerRoute />} />
          <Route path="/projects/:projectId/floors" element={<p>trang tầng</p>} />
        </Routes>
      </MemoryRouter>,
      { keepStore: true },
    );

    fireEvent.click(screen.getByRole('button', { name: PASCAL_LEAVE_LABEL }));

    expect(screen.getByText('trang tầng')).toBeInTheDocument();
  });
});

