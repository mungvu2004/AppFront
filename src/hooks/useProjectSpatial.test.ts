import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetMockLayerState, createMockApiClient } from '@/api/__mocks__/client';
import type { SpatialGraphDocument } from '@/api/schemas/spatialGraph';
import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import type { LevelId, Wall } from '@/domain/spatial/types';
import { setAuthenticatedSession } from '@/lib/auth/state';
import type { HttpError } from '@/lib/http';
import { queryKeys } from '@/lib/query/queryKeys';
import { createTestQueryClient } from '@/lib/testing/render';
import { useStore } from '@/store';
import { commit } from '@/store/commit';
import type * as ProjectHydration from '@/store/projectHydration';
import { hydrateProject, loadProjectGraph, refreshProjectGraph } from '@/store/projectHydration';

import { __resetFloorLayerSavers, flushAutosaves, useFloorLayerAutosave } from './useAutosave';

import { isProjectNotFound, useProjectSpatial } from './useProjectSpatial';

/* Bọc chuyển tiếp để đếm số lần cổng áp N15 (review-1 P2-1); hành vi giữ nguyên bản thật. */
vi.mock('@/store/projectHydration', async (importOriginal) => {
  const actual = await importOriginal<typeof ProjectHydration>();

  return { ...actual, loadProjectGraph: vi.fn(actual.loadProjectGraph) };
});

const http = (status: number, resource?: string): HttpError => ({
  kind: 'http',
  raw: resource === undefined ? undefined : { resource },
  requestId: 'req-test',
  retryable: false,
  status,
});

describe('isProjectNotFound', () => {
  it('chỉ đúng với 404 của tài nguyên `project`', () => {
    expect(isProjectNotFound(http(404, 'project'))).toBe(true);
    expect(isProjectNotFound(http(404, 'floor'))).toBe(false);
    expect(isProjectNotFound(http(404))).toBe(false);
    expect(isProjectNotFound(http(500, 'project'))).toBe(false);
    expect(isProjectNotFound(new Error('missing'))).toBe(false);
  });
});

describe('useProjectSpatial', () => {
  it('không có mã dự án → `idle`, không đọc #24 lẫn N15', () => {
    const api = createMockApiClient();
    const read = vi.spyOn(api.projects, 'read');
    const readGraph = vi.spyOn(api.spatial, 'readGraph');

    const { result } = renderHook(() => useProjectSpatial({ api, projectId: undefined }), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: createTestQueryClient() }, children),
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.refreshFailed).toBe(false);
    expect(read).not.toHaveBeenCalled();
    expect(readGraph).not.toHaveBeenCalled();
  });

  /* review-1 P2-1: #24 về (đổi tên, thêm thành viên) không áp lại N15 cũ — có thể gỡ nhầm tầng mới. */
  it('#24 đổi mà N15 không đổi → không áp lại tài liệu N15 cũ', async () => {
    __resetMockLayerState();
    const api = createMockApiClient();
    const queryClient = createTestQueryClient();
    const load = vi.mocked(loadProjectGraph);
    load.mockClear();

    renderHook(() => useProjectSpatial({ api, projectId: 'project-1' }), {
      wrapper: ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children),
    });

    await waitFor(() => expect(useStore.getState().project?.id).toBe('project-1'));
    expect(load).toHaveBeenCalledTimes(1);

    act(() => {
      queryClient.setQueryData(queryKeys.project.detail('project-1'), (old: object | undefined) => ({
        ...old,
        name: 'Tên mới',
      }));
    });
    await act(async () => {
      await vi.dynamicImportSettled();
    });

    expect(load).toHaveBeenCalledTimes(1);

    act(() => {
      useStore.getState().setSpatial(null, null);
      useStore.getState().setProject(null);
    });
  });
});

/** F-04x-2 [8].2 — refresh N15 thay hai tầng dưới bộ lưu lớp thật: không PUT nào. */
describe('refreshProjectGraph dưới bộ lưu thật', () => {
  const PROJECT_ID = 'project-1';
  const sample = createSampleBuilding();
  const base: SpatialGraphDocument = {
    floorRevisions: sample.levels.map((level) => ({ floorId: level.id, revision: 0 })),
    graph: { ...sample, notes: [] },
  };
  const [first, second] = base.graph.levels.map((level) => level.id) as [LevelId, LevelId];
  const bump = (document: SpatialGraphDocument, floorId: LevelId, revision: number): SpatialGraphDocument => ({
    floorRevisions: document.floorRevisions.map((entry) => (entry.floorId === floorId ? { ...entry, revision } : entry)),
    graph: {
      ...document.graph,
      walls: document.graph.walls.map((wall) =>
        wall.levelId === floorId ? { ...wall, thicknessMm: wall.thicknessMm + 10 } : wall,
      ),
    },
  });

  beforeEach(() => {
    vi.useFakeTimers();
    __resetFloorLayerSavers();
    __resetMockLayerState();
    setAuthenticatedSession({ accessToken: 't', expiresAt: Date.now() + 3_600_000, roles: [], user: { id: 'u' } });
  });

  afterEach(() => {
    __resetFloorLayerSavers();
    useStore.getState().setSpatial(null, null);
    useStore.getState().setProject(null);
    vi.useRealTimers();
  });

  it('refresh thay hai tầng → 0 PUT; sửa sau đó → 1 PUT trên revision mới', async () => {
    const client = createMockApiClient();
    const writeLayer = vi.spyOn(client.spatial, 'writeLayer');

    hydrateProject({
      document: base,
      project: { created_at: '2026-01-01T00:00:00Z', id: PROJECT_ID, members: [], name: 'Dự án thử', updated_at: '2026-01-01T00:00:00Z' },
      roles: [],
    });
    renderHook(() => useFloorLayerAutosave({ apiClient: client, floorId: first, projectId: PROJECT_ID }));
    await act(async () => {
      await vi.dynamicImportSettled();
      await vi.advanceTimersByTimeAsync(0);
    });

    act(() => {
      refreshProjectGraph(bump(bump(base, first, 3), second, 3));
    });
    await act(async () => {
      await flushAutosaves();
    });

    expect(writeLayer).not.toHaveBeenCalled();

    const spatial = useStore.getState().spatial;
    const wallId = spatial?.byLevel[first]?.find((id) => id.startsWith('W-')) ?? '';
    const wall = spatial?.byId[wallId] as Wall;

    act(() => {
      commit({ changes: { thicknessMm: wall.thicknessMm + 1 }, id: wall.id, kind: 'wall', op: 'update' }, 'Đổi độ dày');
    });
    await act(async () => {
      await flushAutosaves();
    });

    expect(writeLayer).toHaveBeenCalledTimes(1);
    expect(writeLayer.mock.calls[0]?.[0]).toMatchObject({ baseVersion: 3, floorId: first });
  });
});
