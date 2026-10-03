import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMockApiClient } from '@/api/__mocks__/client';
import { SAMPLE_BUILDING } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { WallId } from '@/domain/spatial/types';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';
import { useStore } from '@/store';
import { commit } from '@/store/commit';

import { ProjectSpatialGate } from './ProjectSpatialGate';

/**
 * B-V12-01 — cổng nạp kho dự án. Trước cổng, bốn màn luật/xuất/dữ liệu (và 3D,
 * điện thoại) đọc một kho không ai nạp nên luôn ở `empty`.
 */

const SAMPLE = normalizeSpatial(SAMPLE_BUILDING);
const CHILD = 'màn con';

const apiWithSpy = () => {
  const api = createMockApiClient();
  const read = vi.spyOn(api.projects, 'read');

  return { api, read };
};

const renderGate = (api: ReturnType<typeof createMockApiClient>, projectId: string, keepStore = false) =>
  renderWithProviders(
    <ProjectSpatialGate api={api} projectId={projectId}>
      <p>{CHILD}</p>
    </ProjectSpatialGate>,
    { keepStore },
  );

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

  it('kho đã khớp dự án thì không gọi `projects.read`', async () => {
    const seed = apiWithSpy();
    const first = renderGate(seed.api, 'project-1');
    await waitFor(() => expect(loadedProjectId()).toBe('project-1'));
    first.unmount();

    const { api, read } = apiWithSpy();
    renderGate(api, 'project-1', true);

    expect(read).not.toHaveBeenCalled();
    expect(useStore.getState().spatialLoading).toBe(false);
  });

  it('kho do màn QC nạp và đã có bản sửa (`pastStates`) thì giữ nguyên — không đè bản sửa chưa lưu', () => {
    act(() => {
      useStore.getState().setSpatial(SAMPLE, null);
      commit(
        { changes: { reviewed: true }, id: SAMPLE.byKind.wall[0] as WallId, kind: 'wall', op: 'update' },
        'Duyệt tường',
      );
    });
    const edited = useStore.getState().spatial;
    const { api, read } = apiWithSpy();

    renderGate(api, 'project-1', true);

    expect(read).not.toHaveBeenCalled();
    expect(useStore.getState().spatial).toBe(edited);
  });

  it('kho do màn QC nạp mà chưa sửa (`pastStates` = 0) thì nạp đè bằng đồ thị cả dự án', async () => {
    act(() => {
      useStore.getState().setSpatial(SAMPLE, null);
    });
    const { api, read } = apiWithSpy();

    renderGate(api, 'project-1', true);

    await waitFor(() => expect(loadedProjectId()).toBe('project-1'));
    expect(read).toHaveBeenCalledTimes(1);
    expect(useStore.getState().spatial).not.toBe(SAMPLE);
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

  it('đi A → B → A trong cửa sổ 30 s của bộ đệm vẫn nạp lại A — không kẹt trên bản đệm', async () => {
    const { api, read } = apiWithSpy();
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
    expect(read).toHaveBeenCalledTimes(3);
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
});
