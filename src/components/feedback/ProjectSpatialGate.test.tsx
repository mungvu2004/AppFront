import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MOCK_MISSING_PROJECT_ID, __resetMockLayerState, createMockApiClient } from '@/api/__mocks__/client';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { createTestQueryClient, renderWithProviders } from '@/lib/testing/render';
import { useStore } from '@/store';

import { ProjectSpatialGate } from './ProjectSpatialGate';

/**
 * B-V12-01 — cổng nạp kho dự án. Trước cổng, bốn màn luật/xuất/dữ liệu (và 3D,
 * điện thoại) đọc một kho không ai nạp nên luôn ở `empty`.
 */

const CHILD = 'màn con';
const NETWORK = { kind: 'network', raw: undefined, requestId: 'req-n15', retryable: true } as const;

const apiWithSpy = () => {
  const api = createMockApiClient();
  const read = vi.spyOn(api.projects, 'read');
  const readGraph = vi.spyOn(api.spatial, 'readGraph');

  return { api, read, readGraph };
};

const renderGate = (
  api: ReturnType<typeof createMockApiClient>,
  projectId: string,
  keepStore = false,
  queryClient = createTestQueryClient(),
) =>
  renderWithProviders(
    <ProjectSpatialGate api={api} projectId={projectId}>
      <p>{CHILD}</p>
    </ProjectSpatialGate>,
    { keepStore, queryClient },
  );

beforeEach(() => {
  __resetMockLayerState();
});

const loadedProjectId = (): string | undefined => useStore.getState().project?.id;

afterEach(() => {
  act(() => {
    useStore.getState().setSpatial(null, null);
    useStore.getState().setProject(null);
  });
});

describe('ProjectSpatialGate', () => {
  it('kho rỗng thì nạp: dự án, đồ thị, tầng vào kho; cờ đang tải bật rồi tắt', async () => {
    const { api, read } = apiWithSpy();

    renderGate(api, 'project-1');

    expect(useStore.getState().spatialLoading).toBe(true);
    await waitFor(() => expect(loadedProjectId()).toBe('project-1'));

    const state = useStore.getState();
    expect(read).toHaveBeenCalledTimes(1);
    expect(state.spatial).not.toBeNull();
    expect(state.floors.length).toBeGreaterThan(0);
    expect(state.spatialLoading).toBe(false);
    expect(screen.getByText(CHILD)).toBeInTheDocument();
  });

  /*
   * F-04x-2: hai bài `pastStates` cũ (giữ khi có lịch sử / nạp đè khi không) và bài "kho khớp
   * thì không gọi" đổi theo cổng mới: quyết định nạp đọc `spatialProjectId`, không đọc lịch sử
   * hoàn tác, và N15 luôn đọc lại khi cổng gắn ([4] bước 3).
   */
  it('cùng dự án gắn lại thì đọc N15 lại, không bật `spatialLoading`', async () => {
    const queryClient = createTestQueryClient();
    const seed = apiWithSpy();
    const first = renderGate(seed.api, 'project-1', false, queryClient);
    await waitFor(() => expect(loadedProjectId()).toBe('project-1'));
    first.unmount();
    const spatial = useStore.getState().spatial;

    const { api, readGraph } = apiWithSpy();
    renderGate(api, 'project-1', true, queryClient);

    expect(useStore.getState().spatialLoading).toBe(false);
    await waitFor(() => expect(readGraph).toHaveBeenCalledTimes(1));
    expect(useStore.getState().spatialLoading).toBe(false);
    expect(screen.getByText(CHILD)).toBeInTheDocument();
    /* Cùng revision: kho giữ nguyên tham chiếu. */
    expect(useStore.getState().spatial).toBe(spatial);
  });

  it('kho do màn QC nạp, có tầng chưa lưu → tầng đó giữ cả `floorMeta`, tầng khác thay; dự án vào kho', async () => {
    const { api } = apiWithSpy();
    const document = await api.spatial.readGraph({ projectId: 'project-1' });

    if (!document.ok) {
      throw new Error('mock readGraph phải trả đồ thị');
    }

    const [kept = '', other = ''] = document.data.graph.levels.map((level) => level.id);

    act(() => {
      useStore.getState().setSpatial(normalizeSpatial(document.data.graph), null, {
        floorRevisions: {},
        projectId: 'project-1',
      });
      useStore.getState().setUnsavedFloorIds([kept]);
    });
    const before = useStore.getState().spatial;

    renderGate(api, 'project-1', true);

    await waitFor(() => expect(loadedProjectId()).toBe('project-1'));
    const state = useStore.getState();
    expect(state.spatial?.byLevel[kept]).toBe(before?.byLevel[kept]);
    expect(state.floorMeta[kept]).toBeUndefined();
    expect(state.floorMeta[other]).toBeDefined();
    expect(state.spatial?.byLevel[other]).not.toBe(before?.byLevel[other]);
    expect(state.floors).toHaveLength(document.data.graph.levels.length);
    act(() => {
      useStore.getState().setUnsavedFloorIds([]);
    });
  });

  it('N15 hỏng khi kho đã có đồ thị → dải "Thử lại" trên màn con; bấm thì đọc lại', async () => {
    const queryClient = createTestQueryClient();
    const seed = apiWithSpy();
    const first = renderGate(seed.api, 'project-1', false, queryClient);
    await waitFor(() => expect(loadedProjectId()).toBe('project-1'));
    first.unmount();

    const { api, readGraph } = apiWithSpy();
    readGraph.mockResolvedValue({ error: NETWORK, ok: false });
    const rendered = renderGate(api, 'project-1', true, queryClient);

    expect(await screen.findByText('Không tải lại được mô hình.')).toBeInTheDocument();
    expect(screen.getByText(CHILD)).toBeInTheDocument();
    expectVietnamese(rendered);

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    await waitFor(() => expect(readGraph).toHaveBeenCalledTimes(2));
  });

  it('N15 hỏng khi kho trống → khối toàn vùng, màn con vắng', async () => {
    const { api, readGraph } = apiWithSpy();
    readGraph.mockResolvedValue({ error: NETWORK, ok: false });

    renderGate(api, 'project-1');

    await screen.findByRole('alert');
    expect(screen.queryByText(CHILD)).not.toBeInTheDocument();
    expect(screen.queryByText('Không tải lại được mô hình.')).not.toBeInTheDocument();
    expect(useStore.getState().spatialLoading).toBe(false);
  });

  it('N21: nạp cấu hình luật một lần sau khi nạp dự án', async () => {
    const { api } = apiWithSpy();
    const readRuleConfig = vi.spyOn(api.ruleConfig, 'read');

    renderGate(api, 'project-1');

    await waitFor(() => expect(useStore.getState().ruleConfigProjectId).toBe('project-1'));
    expect(readRuleConfig).toHaveBeenCalledTimes(1);
  });

  it('đổi dự án thì nạp lại', async () => {
    const { api, read } = apiWithSpy();
    const rendered = renderGate(api, 'project-1');
    await waitFor(() => expect(loadedProjectId()).toBe('project-1'));

    rendered.rerender(
      <ProjectSpatialGate api={api} projectId="project-2">
        <p>{CHILD}</p>
      </ProjectSpatialGate>,
    );

    await waitFor(() => expect(loadedProjectId()).toBe('project-2'));
    expect(read).toHaveBeenCalledTimes(2);
  });

  /* F-04x-2: #24 nay chung bộ đệm 30 s với `mobileViewerQueries.ts`, nên đếm N15 (staleTime 0). */
  it('đi A → B → A trong cửa sổ 30 s của bộ đệm vẫn nạp lại A — không kẹt trên bản đệm', async () => {
    const { api, readGraph } = apiWithSpy();
    const gate = (projectId: string) => (
      <ProjectSpatialGate api={api} projectId={projectId}>
        <p>{CHILD}</p>
      </ProjectSpatialGate>
    );
    const rendered = renderGate(api, 'project-1');
    await waitFor(() => expect(loadedProjectId()).toBe('project-1'));

    rendered.rerender(gate('project-2'));
    await waitFor(() => expect(loadedProjectId()).toBe('project-2'));
    rendered.rerender(gate('project-1'));

    await waitFor(() => expect(loadedProjectId()).toBe('project-1'));
    expect(readGraph).toHaveBeenCalledTimes(3);
  });

  it('lỗi thì màn con vắng mặt, khung `alert` nói bằng tiếng Việt và chỉ nút "thử lại" nhận tiêu điểm', async () => {
    const { api, read } = apiWithSpy();
    read.mockResolvedValue({
      error: { kind: 'network', raw: undefined, requestId: 'req-gate', retryable: true },
      ok: false,
    });

    const rendered = renderGate(api, 'project-1');

    const alert = await screen.findByRole('alert');
    expect(screen.queryByText(CHILD)).not.toBeInTheDocument();
    expect(useStore.getState().spatialLoading).toBe(false);

    const focusable = alert.querySelectorAll('button, a[href], input, select, textarea, [tabindex]');
    expect(focusable).toHaveLength(1);
    expect(focusable[0]).toBe(screen.getByRole('button', { name: /thử lại/iu }));
    expectVietnamese(rendered);
  });

  it('gỡ cổng giữa lượt nạp thì cờ đang tải về false', () => {
    const { api } = apiWithSpy();
    const rendered = renderGate(api, 'project-1');

    expect(useStore.getState().spatialLoading).toBe(true);
    rendered.unmount();

    expect(useStore.getState().spatialLoading).toBe(false);
  });

  /* B-V1-43 — 404 của dự án: một lối ra, không treo ở khung "tải lại" không có nút. */
  it('404 của dự án: khung `alert` cố định, màn con vắng, chỉ nút "Về danh sách dự án", bấm thì về "/"', async () => {
    const api = createMockApiClient();
    const rendered = renderWithProviders(
      <MemoryRouter initialEntries={['/p']}>
        <Routes>
          <Route path="/" element={<h1>danh sách dự án</h1>} />
          <Route
            path="/p"
            element={
              <ProjectSpatialGate api={api} projectId={MOCK_MISSING_PROJECT_ID}>
                <p>{CHILD}</p>
              </ProjectSpatialGate>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    const alert = await screen.findByRole('alert');
    expect(screen.getByText('Không tìm thấy dự án này')).toBeInTheDocument();
    expect(screen.queryByText(CHILD)).not.toBeInTheDocument();
    expect(alert.textContent).not.toMatch(/quyền/iu);

    const focusable = alert.querySelectorAll('button, a[href], input, select, textarea, [tabindex]');
    const button = screen.getByRole('button', { name: 'Về danh sách dự án' });
    expect(focusable).toHaveLength(1);
    expect(focusable[0]).toBe(button);
    expectVietnamese(rendered);

    fireEvent.click(button);

    expect(await screen.findByRole('heading', { name: 'danh sách dự án' })).toBeInTheDocument();
  });

  it('404 của một tầng (`resource: floor`) không mượn câu "Không tìm thấy dự án này"', async () => {
    const { api, read } = apiWithSpy();
    read.mockResolvedValue({
      error: { kind: 'http', raw: { resource: 'floor' }, requestId: 'req-floor', retryable: false, status: 404 },
      ok: false,
    });

    renderGate(api, 'project-1');

    await screen.findByRole('alert');
    expect(screen.queryByText('Không tìm thấy dự án này')).not.toBeInTheDocument();
    expect(screen.queryByText(CHILD)).not.toBeInTheDocument();
  });
});
