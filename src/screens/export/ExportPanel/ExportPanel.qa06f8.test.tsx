/** QA-06b F8 — hồi quy 30-G-008, 30-B-026, 30-C-029, 30-C-026 (sửa ở F3, chưa có test). */
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { createTestQueryClient } from '@/lib/testing/render';
import { useStore } from '@/store';

import * as GatewayModule from './exportPanelGateway';
import { createExportPanelGateway } from './exportPanelGateway';
import { useExportPanel } from './useExportPanel';

const PROJECT_ID = 'P-000000001';

afterEach(() => {
  vi.restoreAllMocks();
});

function seed(): ReturnType<typeof createSampleBuilding> {
  const graph = createSampleBuilding();
  const store = useStore.getState();
  store.setUserRoles(['engineer']);
  store.setFloors(graph.levels);
  store.setSpatial(normalizeSpatial(graph), 'v-test');
  return graph;
}

function mount(gateway?: GatewayModule.ExportPanelGateway) {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useExportPanel({ projectId: PROJECT_ID, ...(gateway ? { gateway } : {}) }), { wrapper });
}

describe('QA-06b F8 — màn Xuất', () => {
  it('30-G-008: cổng mặc định được dựng với bộ gửi đo đạc thật', () => {
    seed();
    const spy = vi.spyOn(GatewayModule, 'createExportPanelGateway');
    mount();
    expect(spy).toHaveBeenCalled();
    expect(typeof spy.mock.calls[0]?.[0]?.telemetry?.track).toBe('function');
  });

  it('30-B-026: lỗi worker (kind processing) hiện câu về việc xuất, không phải câu của pipeline AI', async () => {
    seed();
    const gateway: GatewayModule.ExportPanelGateway = {
      ...createExportPanelGateway({ deliver: vi.fn() }),
      startGlbExport: () => Promise.reject(new Error('worker thread crashed')),
    };
    const { result } = mount(gateway);
    act(() => result.current.onSelectFormat('glb'));
    act(() => result.current.onExport());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe('Không xuất được tệp lần này.');
  });

  it('30-C-029: nhấp đôi "Xuất" chỉ bắt đầu một lượt xuất', async () => {
    seed();
    const startGlbExport = vi.fn(() => new Promise<never>(() => undefined));
    const gateway = { ...createExportPanelGateway({ deliver: vi.fn() }), startGlbExport };
    const { result } = mount(gateway);
    act(() => result.current.onSelectFormat('glb'));
    act(() => result.current.onExport());
    await waitFor(() => expect(startGlbExport).toHaveBeenCalledTimes(1));
    act(() => result.current.onExport());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(startGlbExport).toHaveBeenCalledTimes(1);
  });

  it('30-C-026: "Góc nhìn hiện tại" theo tên tầng đang mở và đổi khi đổi tầng', () => {
    const graph = seed();
    const [a, b] = graph.levels;
    const { result } = mount();
    act(() => useStore.getState().setActiveFloor(a!.id));
    expect(result.current.options.image.viewId).toBe(a!.name);
    act(() => useStore.getState().setActiveFloor(b!.id));
    expect(result.current.options.image.viewId).toBe(b!.name);
    expect(a!.name).not.toBe(b!.name);
  });
});
