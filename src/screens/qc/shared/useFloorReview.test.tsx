import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SpatialGraphDocument } from '@/api/schemas/spatialGraph';
import type { FloorLayerDocument } from '@/api/schemas/spatialLayer';
import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { millimetresPerPixel } from '@/domain/units/scale';
import { createTestQueryClient } from '@/lib/testing/render';
import { useStore } from '@/store';
import { hydrateProject } from '@/store/projectHydration';
import type { Project } from '@/types/project';

import { useFloorReview } from './useFloorReview';

/**
 * Codex P1 #3: mở màn từ kho rỗng, đồ thị nạp bằng N15 (`hydrateProject`) — N15 không mang
 * `scaleStatus`, nên tỷ lệ phải là "chưa đọc" (`null`) tới khi N16 về, không được là "đã xác nhận".
 */

const api = vi.hoisted(() => ({ resolve: null as ((document: FloorLayerDocument) => void) | null }));
vi.mock('@/api/appClient', () => ({
  createAppApiClient: () => ({
    spatial: {
      readLayer: () =>
        new Promise((resolve) => {
          api.resolve = (data) => resolve({ ok: true, data });
        }),
    },
  }),
}));

const PROJECT: Project = {
  created_at: '2026-01-01T00:00:00Z',
  id: 'project-1',
  members: [],
  name: 'Dự án thử',
  updated_at: '2026-01-01T00:00:00Z',
};

const sample = createSampleBuilding();
const levels = sample.levels.map((level) => ({ ...level, scaleMillimetresPerPixel: millimetresPerPixel(5) }));
const floorId = levels[0]!.id;
const n15: SpatialGraphDocument = {
  floorRevisions: levels.map((level) => ({ floorId: level.id, revision: 3 })),
  graph: { ...sample, levels, notes: [] },
};

/** N16 tối thiểu: hook này chỉ đọc khoá tỷ lệ và `revision` khi kho đã giữ tầng. */
const n16 = (scale: Partial<Pick<FloorLayerDocument, 'scaleSource' | 'scaleStatus'>>): FloorLayerDocument =>
  ({ revision: 3, ...scale }) as FloorLayerDocument;

function renderReview() {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
  return renderHook(() => useFloorReview(PROJECT.id, floorId), { wrapper });
}

beforeEach(() => {
  api.resolve = null;
  hydrateProject({ document: n15, project: PROJECT, roles: ['engineer'] });
});

afterEach(() => {
  useStore.getState().setSpatial(null, null);
  useStore.getState().setProject(null);
});

describe('useFloorReview từ kho rỗng + N15', () => {
  it('chưa có N16: tỷ lệ là "chưa đọc", không phải "đã xác nhận"', async () => {
    const { result } = renderReview();

    expect(result.current.graph).not.toBeNull();
    expect(result.current.scale).toBeNull();
    await waitFor(() => expect(api.resolve).not.toBeNull());
    expect(result.current.scale).toBeNull();
  });

  it('N16 báo máy không đo được: tỷ lệ "chưa có"', async () => {
    const { result } = renderReview();
    await waitFor(() => expect(api.resolve).not.toBeNull());

    act(() => api.resolve?.(n16({ scaleSource: 'project_default', scaleStatus: 'unresolved' })));

    await waitFor(() => expect(result.current.scale).toBe('missing'));
  });

  it('N16 không mang scaleStatus: tỷ lệ đã xác nhận', async () => {
    const { result } = renderReview();
    await waitFor(() => expect(api.resolve).not.toBeNull());

    act(() => api.resolve?.(n16({})));

    await waitFor(() => expect(result.current.scale).toBe('confirmed'));
  });
});
