/** QA-06b F8 — hồi quy 32-A-006, 32-E-014, 32-C-046 (sửa ở F4, chưa có test). */
import { act, cleanup, fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiClient } from '@/api/client';
import { createTestQueryClient, renderWithProviders } from '@/lib/testing/render';
import { ROUTE_PATTERNS } from '@/routes/paths';
import { useStore } from '@/store';

import * as UseVersionHistoryModule from './useVersionHistory';
import { useVersionHistory } from './useVersionHistory';
import { VersionHistory } from './VersionHistory';
import { VersionHistoryRoute } from './VersionHistory.container';
import {
  buildVersionHistoryProps,
  createVersionsServerFake,
  WIRE_FLOOR_ID,
  WIRE_PROJECT_ID,
  WIRE_VERSION_IDS,
} from './versionHistoryFixtures';
import { createVersionHistoryGateway } from './versionHistoryGateway';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function Probe() {
  return <output data-testid="search">{useLocation().search}</output>;
}

function mountRoute(entry: string) {
  vi.stubEnv('VITE_USE_MOCK_API', 'true');
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
  const real = UseVersionHistoryModule.useVersionHistory;
  const seen: { options: Parameters<typeof real>[0] | null } = { options: null };
  vi.spyOn(UseVersionHistoryModule, 'useVersionHistory').mockImplementation((options) => {
    seen.options = options;
    return real(options);
  });
  act(() => {
    useStore.getState().setProject(null);
  });
  renderWithProviders(
    <MemoryRouter initialEntries={[entry]}>
      <Probe />
      <Routes>
        <Route path={ROUTE_PATTERNS.projectVersions} element={<VersionHistoryRoute />} />
      </Routes>
    </MemoryRouter>,
  );
  return seen;
}

describe('QA-06b F8 — màn Phiên bản', () => {
  it('32-A-006: chọn tầng ghi ?floorId= và mount lại đọc nó', async () => {
    const seen = mountRoute('/projects/project-1/versions');
    await screen.findByRole('navigation', { name: 'Danh sách phiên bản' }, { timeout: 5_000 });
    const ids = (seen.options?.floorOptions ?? []).map((option) => option.id);
    expect(ids.length).toBeGreaterThan(1);
    const second = ids[1] as string;

    act(() => {
      seen.options?.onSelectFloor?.(second);
    });
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe(`?floorId=${second}`));
    cleanup();

    const again = mountRoute(`/projects/project-1/versions?floorId=${second}`);
    await screen.findByRole('navigation', { name: 'Danh sách phiên bản' }, { timeout: 5_000 });
    expect(again.options?.floorId).toBe(second);
  });

  it('32-E-014: sau xác nhận phục hồi, focus không rơi về body', () => {
    const open = {
      isOpen: true,
      title: 'Phục hồi phiên bản này?',
      reassurance: 'Giữ lại trạng thái hiện tại.',
      confirmLabel: 'Phục hồi',
      cancelLabel: 'Huỷ',
      targetVersionLabel: 'v1',
    };
    const confirmRestore = vi.fn();
    const first = buildVersionHistoryProps('success', { restoreConfirm: open }, { confirmRestore });
    const view = renderWithProviders(<VersionHistory {...first} />);
    const confirm = screen.getByRole('button', { name: 'Phục hồi' });
    confirm.focus();
    fireEvent.click(confirm);
    expect(confirmRestore).toHaveBeenCalledTimes(1);
    // Hộp đóng, nút rời DOM: tiêu điểm mất về body.
    (document.activeElement as HTMLElement | null)?.blur();
    const closed = buildVersionHistoryProps('success', { restoreConfirm: { ...open, isOpen: false } }, { confirmRestore });
    view.rerender(<VersionHistory {...closed} />);

    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement?.closest('.sticky')).not.toBeNull();
  });

  it('32-A-012: chọn "Phiên bản đối chiếu" đổi bản bên phải HIỂN THỊ, dù cặp được tích theo thứ tự ngược', async () => {
    const server = createVersionsServerFake();
    const api = createApiClient(server.http);
    const gateway = createVersionHistoryGateway({ apiClient: api, floorId: WIRE_FLOOR_ID, projectId: WIRE_PROJECT_ID });
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useVersionHistory({ apiClient: api, canRestore: true, floorId: WIRE_FLOOR_ID, gateway, projectId: WIRE_PROJECT_ID }),
      { wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> },
    );
    await waitFor(() => expect(result.current[0].compare.rightVersionId).toBe(WIRE_VERSION_IDS.v3));
    const toggle = (id: string) => act(() => result.current[1].toggleCompareSelection(id));
    toggle(WIRE_VERSION_IDS.v2);
    toggle(WIRE_VERSION_IDS.v3);
    toggle(WIRE_VERSION_IDS.v3); // bản mới tích TRƯỚC, bản cũ tích sau: cặp lưu ngược thứ tự
    toggle(WIRE_VERSION_IDS.v1);
    await waitFor(() => expect(result.current[0].compare.leftVersionId).toBe(WIRE_VERSION_IDS.v1));

    act(() => result.current[1].selectRightVersion(WIRE_VERSION_IDS.v2));

    expect(result.current[0].compare.leftVersionId).toBe(WIRE_VERSION_IDS.v1);
    expect(result.current[0].compare.rightVersionId).toBe(WIRE_VERSION_IDS.v2);
  });

  it('32-A-011: chọn ở "Phiên bản gốc" bản mới hơn bản đối chiếu thì hoán đổi, bản cũ vẫn ở bên trái', async () => {
    const server = createVersionsServerFake();
    const api = createApiClient(server.http);
    const gateway = createVersionHistoryGateway({ apiClient: api, floorId: WIRE_FLOOR_ID, projectId: WIRE_PROJECT_ID });
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useVersionHistory({ apiClient: api, canRestore: true, floorId: WIRE_FLOOR_ID, gateway, projectId: WIRE_PROJECT_ID }),
      { wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> },
    );
    await waitFor(() => expect(result.current[0].compare.rightVersionId).toBe(WIRE_VERSION_IDS.v3));
    const toggle = (id: string) => act(() => result.current[1].toggleCompareSelection(id));
    toggle(WIRE_VERSION_IDS.v2);
    toggle(WIRE_VERSION_IDS.v3);
    toggle(WIRE_VERSION_IDS.v3);
    toggle(WIRE_VERSION_IDS.v1);
    await waitFor(() => expect(result.current[0].compare.leftVersionId).toBe(WIRE_VERSION_IDS.v1));
    expect(result.current[0].compare.rightVersionId).toBe(WIRE_VERSION_IDS.v3);

    act(() => result.current[1].selectLeftVersion(WIRE_VERSION_IDS.v3)); // v3 đã ở bên phải: hoán đổi, không thành {v3, v3}

    expect(result.current[0].compare.leftVersionId).toBe(WIRE_VERSION_IDS.v1);
    expect(result.current[0].compare.rightVersionId).toBe(WIRE_VERSION_IDS.v3);
    expect(result.current[0].rows.filter((row) => row.isSelectedForCompare)).toHaveLength(2);
  });

  it('32-C-046: gỡ nhãn ở bản chưa có nhãn không bật toast "Đã gỡ nhãn"; bản có nhãn thì có', async () => {
    const server = createVersionsServerFake();
    const api = createApiClient(server.http);
    const gateway = createVersionHistoryGateway({ apiClient: api, floorId: WIRE_FLOOR_ID, projectId: WIRE_PROJECT_ID });
    const onToast = vi.fn();
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useVersionHistory({ apiClient: api, canRestore: true, floorId: WIRE_FLOOR_ID, gateway, onToast, projectId: WIRE_PROJECT_ID }),
      { wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> },
    );
    await waitFor(() => expect(result.current[0].canTagVersion).toBe(true));
    await waitFor(() => expect(result.current[0].rows.length).toBeGreaterThan(0));

    act(() => result.current[1].tagVersion(WIRE_VERSION_IDS.v3, ''));
    await waitFor(() => expect(server.calls.some((call) => call.path.endsWith('/label'))).toBe(true));
    await act(async () => {
      await vi.dynamicImportSettled();
    });
    expect(onToast).not.toHaveBeenCalled();

    act(() => result.current[1].tagVersion(WIRE_VERSION_IDS.v2, ''));
    await waitFor(() => expect(onToast).toHaveBeenCalledWith(expect.objectContaining({ message: 'Đã gỡ nhãn' })));
  });
});
