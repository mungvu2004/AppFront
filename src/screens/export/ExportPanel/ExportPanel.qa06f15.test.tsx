/** QA-06b F15 — hồi quy 30-C-026 (mở /export trực tiếp) và 30-C-029 (nhấp đôi "Xuất" .json). */
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { createTestQueryClient } from '@/lib/testing/render';
import { useStore } from '@/store';

import { createExportPanelGateway } from './exportPanelGateway';
import { useExportPanel } from './useExportPanel';

function seed() {
  const graph = createSampleBuilding();
  const store = useStore.getState();
  store.setUserRoles(['engineer']);
  store.setFloors(graph.levels);
  store.setSpatial(normalizeSpatial(graph), 'v-test');
  return graph;
}

function mount(deliver = vi.fn()) {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const gateway = createExportPanelGateway({ deliver });
  return renderHook(() => useExportPanel({ projectId: 'P-000000001', gateway }), { wrapper });
}

describe('QA-06b F15', () => {
  it('30-C-026: chưa có tầng đang chọn thì "Góc nhìn hiện tại" rơi về tầng đầu tiên theo thứ tự tầng', () => {
    const graph = seed();
    act(() => useStore.getState().setActiveFloor(null));
    const first = [...graph.levels].sort((a, b) => a.order - b.order)[0]!;
    const { result } = mount();
    expect(result.current.options.image.viewId).toBe(first.name);
  });

  it('30-C-029: hai lần gọi onExport cùng tick (.json xong tức thì) chỉ ra một tệp', async () => {
    seed();
    const deliver = vi.fn();
    const { result } = mount(deliver);
    act(() => result.current.onSelectFormat('spatial-json'));
    act(() => {
      result.current.onExport();
      result.current.onExport();
    });
    await waitFor(() => expect(deliver).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it('30-C-029: bấm lần hai sau khi lượt trước xong và hết khung chặn thì xuất lại được', async () => {
    seed();
    const deliver = vi.fn();
    const { result } = mount(deliver);
    act(() => result.current.onSelectFormat('spatial-json'));
    act(() => result.current.onExport());
    await waitFor(() => expect(deliver).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 400));
    act(() => result.current.onExport());
    await waitFor(() => expect(deliver).toHaveBeenCalledTimes(2));
  });
});
