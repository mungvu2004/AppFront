import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { __resetMockLayerState, createMockApiClient } from '@/api/__mocks__/client';
import { createTestQueryClient } from '@/lib/testing/render';
import { useProjectSpatial } from '@/hooks/useProjectSpatial';

/* BUG-727 / FL-31-09 [31-B-015]: leaving the data screen and coming back remounts the gate -> N15 is read again (staleTime 0). */
describe('SpatialJsonViewer gate hop back', () => {
  it('[31-B-015] remount with a cached graph refetches N15', async () => {
    __resetMockLayerState();
    const api = createMockApiClient();
    const readGraph = vi.spyOn(api.spatial, 'readGraph');
    const client = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);

    const first = renderHook(() => useProjectSpatial({ api, projectId: 'project-1' }), { wrapper });
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    const before = readGraph.mock.calls.length;
    first.unmount();

    renderHook(() => useProjectSpatial({ api, projectId: 'project-1' }), { wrapper });
    await waitFor(() => expect(readGraph.mock.calls.length).toBeGreaterThan(before));
  });
});
