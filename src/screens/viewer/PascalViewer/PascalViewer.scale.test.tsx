/**
 * Tầng ở tỷ lệ tạm (N16 `scaleStatus: 'unresolved'`) → chip cảnh báo trên thanh
 * trên cùng, nút của chip mở màn Hiệu chỉnh tỷ lệ của tầng đầu tiên.
 */

import { act, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetMockLayerState, createMockApiClient } from '@/api/__mocks__/client';
import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { __resetFloorLayerSavers } from '@/hooks/useAutosave';
import { renderWithProviders } from '@/lib/testing/render';
import { ROUTES } from '@/routes/paths';
import { useStore } from '@/store';

import { PascalViewerContainer } from './PascalViewer.container';
import { PASCAL_CALIBRATE_SCALE_LABEL } from './pascalViewerTypes';

const PROJECT = 'P-1';
const GRAPH = createSampleBuilding();
const SPATIAL = normalizeSpatial(GRAPH);

const loadMount = (() =>
  Promise.resolve({
    mount: (_element: HTMLElement, options: Record<string, unknown>) => {
      (options['onReadyChange'] as (ready: boolean) => void)(true);
      return { dispose: () => undefined, deleteNodes: vi.fn() };
    },
  })) as never;

function Pathname() {
  return <p data-testid="pathname">{useLocation().pathname}</p>;
}

const tick = async (): Promise<void> => {
  await act(async () => {
    await vi.dynamicImportSettled();
    await vi.advanceTimersByTimeAsync(0);
  });
};

const renderScreen = async (apiClient: ReturnType<typeof createMockApiClient>): Promise<void> => {
  renderWithProviders(
    <MemoryRouter initialEntries={['/3d']}>
      <PascalViewerContainer
        graph={GRAPH}
        projectId={PROJECT}
        apiClient={apiClient}
        readOnly={false}
        loadMount={loadMount}
      />
      <Pathname />
    </MemoryRouter>,
    { keepStore: true },
  );
  await tick();
  await tick();
};

describe('PascalViewer — chip tỷ lệ tạm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetFloorLayerSavers();
    __resetMockLayerState();
    useStore.getState().setSpatial(SPATIAL, 'v-test', {
      floorRevisions: Object.fromEntries(SPATIAL.byKind.level.map((id) => [id, 0])),
      projectId: PROJECT,
    });
  });

  afterEach(() => {
    __resetFloorLayerSavers();
    act(() => {
      useStore.getState().setSpatial(null, null);
    });
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('một tầng chưa hiệu chỉnh → chip gọi tên tầng, nút mở màn Hiệu chỉnh tỷ lệ', async () => {
    const apiClient = createMockApiClient();
    const level = GRAPH.levels[0];
    if (level === undefined) throw new Error('bộ mẫu phải có tầng');
    const readLayer = apiClient.spatial.readLayer.bind(apiClient.spatial);
    const spy = vi.spyOn(apiClient.spatial, 'readLayer').mockImplementation(async (input) => {
      const result = await readLayer(input);
      return result.ok && input.floorId === level.id
        ? { ok: true, data: { ...result.data, scaleStatus: 'unresolved' as const } }
        : result;
    });

    await renderScreen(apiClient);

    expect(spy).toHaveBeenCalledTimes(GRAPH.levels.length);
    const chip = screen.getByTestId('pascal-scale-warning');
    expect(chip).toHaveTextContent(`${level.name} chưa hiệu chỉnh tỷ lệ — kích thước 3D có thể sai`);

    fireEvent.click(screen.getByRole('button', { name: PASCAL_CALIBRATE_SCALE_LABEL }));
    expect(screen.getByTestId('pathname')).toHaveTextContent(ROUTES.project.scale(PROJECT, level.id));
  });

  it('không tầng nào ở tỷ lệ tạm → không có chip', async () => {
    const apiClient = createMockApiClient();
    const spy = vi.spyOn(apiClient.spatial, 'readLayer');

    await renderScreen(apiClient);

    expect(spy).toHaveBeenCalled();
    expect(screen.queryByTestId('pascal-scale-warning')).toBeNull();
  });
});
