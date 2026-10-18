import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { projectUnitsQueryKey, useProjectUnits, type ProjectUnitsApi } from './useProjectUnits';

function fakeApi(read: () => Promise<unknown>): ProjectUnitsApi {
  return { projectSettings: { read: vi.fn(read), replace: vi.fn() } } as unknown as ProjectUnitsApi;
}

const serverSays = (lengthUnit: string) => fakeApi(async () => ({ ok: true, data: { lengthUnit } }));

function setup(projectId: string | undefined, api: ProjectUnitsApi) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return { client, ...renderHook(() => useProjectUnits(projectId, api), { wrapper }) };
}

describe('useProjectUnits', () => {
  it('loads the unit from the server when Project settings were never opened', async () => {
    const api = serverSays('m');
    const { result } = setup('project-1', api);
    expect(result.current.lengthUnit).toBe('mm');
    await waitFor(() => expect(result.current.lengthUnit).toBe('m'));
    expect(api.projectSettings.read).toHaveBeenCalledWith({ projectId: 'project-1' });
  });

  it('stays on millimetres when the server read fails', async () => {
    const api = fakeApi(async () => ({ ok: false, error: {} }));
    const { result } = setup('project-1', api);
    await waitFor(() => expect(api.projectSettings.read).toHaveBeenCalled());
    expect(result.current.lengthUnit).toBe('mm');
  });

  it('prefers the snapshot Project settings wrote, including later changes', async () => {
    const { client, result } = setup('project-1', serverSays('mm'));
    act(() => {
      client.setQueryData(projectUnitsQueryKey('project-1'), { lengthUnit: 'm' });
    });
    await waitFor(() => expect(result.current.lengthUnit).toBe('m'));
    act(() => {
      client.setQueryData(projectUnitsQueryKey('project-1'), { lengthUnit: 'mm' });
    });
    await waitFor(() => expect(result.current.lengthUnit).toBe('mm'));
  });

  it('ignores an unknown unit and a missing project id', async () => {
    const { result } = setup('project-1', serverSays('ft'));
    await waitFor(() => expect(result.current.lengthUnit).toBe('mm'));
    const missing = fakeApi(async () => ({ ok: true, data: { lengthUnit: 'm' } }));
    expect(setup(undefined, missing).result.current.lengthUnit).toBe('mm');
    expect(missing.projectSettings.read).not.toHaveBeenCalled();
  });
});
