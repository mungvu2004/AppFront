/**
 * Lớp gộp W4: "chia sẻ" của `ExportPanel` có thật sự mở `ShareDialogContainer`
 * không, hay chỉ là một hợp đồng đứng yên (kiểm toán chín màn chưa ai gắn).
 *
 * `ExportPanel`/`ShareDialog` đều có bộ kiểm bảy trạng thái riêng đã xanh —
 * file này KHÔNG lặp lại chúng. Nó chỉ chứng minh đúng một việc: bấm nút
 * "chia sẻ" trong `ExportPanelContainer` dựng ra hộp thoại THẬT của
 * `ShareDialogContainer` (không phải một bản giả), và đóng lại được.
 *
 * `VITE_USE_MOCK_API=true` — cùng cặp `FurnitureLibraryPanel.test.tsx` dùng —
 * để lượt đọc danh sách thành viên của `ShareDialogContainer` trả lời từ
 * `createMockApiClient()` thay vì chạm mạng thật; `Modal.Header`/`Modal.Footer`
 * của hộp thoại vẫn dựng ngay cả khi lượt đọc liên kết chia sẻ (đi qua
 * `ShareLinkGateway` HTTP thật, không đọc cờ này) còn đang treo hay lỗi —
 * đúng điều `ShareDialog.tsx:10-15` ghi: sáu trong bảy trạng thái đều vẽ đủ
 * khung, container không khi nào trống.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { createTestQueryClient, renderWithProviders } from '@/lib/testing/render';
import { useStore } from '@/store';

import { ExportPanelContainer } from './ExportPanel.container';
import { createExportPanelGateway } from './exportPanelGateway';
import { useExportPanel } from './useExportPanel';

const PROJECT_ID = 'P-000000001';

/** Tầng + vai để `status` là `success` (có header, có nút "chia sẻ") — không `empty`/`forbidden`. */
function seedStore(): void {
  const graph = createSampleBuilding();
  const store = useStore.getState();

  store.setUserRoles(['engineer']);
  store.setFloors(graph.levels);
  store.setSpatial(normalizeSpatial(graph), 'v-test');
}

/** `keepStore`: `renderWithProviders` xoá store về mặc định trước mỗi lượt dựng, đè lên `seedStore()`. */
function renderExportPanel() {
  return renderWithProviders(
    <MemoryRouter>
      <ExportPanelContainer projectId={PROJECT_ID} />
    </MemoryRouter>,
    { keepStore: true },
  );
}

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK_API', 'true');
  seedStore();
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('ExportPanelContainer — nút "chia sẻ" mở ShareDialogContainer (R-73)', () => {
  it('không có hộp thoại chia sẻ nào khi màn vừa mở', async () => {
    renderExportPanel();

    expect(await screen.findByRole('button', { name: /chia sẻ/i })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('bấm "chia sẻ" dựng ra ĐÚNG hộp thoại của S-ShareDialog, không phải một trang khác', async () => {
    renderExportPanel();

    fireEvent.click(await screen.findByRole('button', { name: /chia sẻ/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // Tựa đề thật của `ShareDialog.tsx:37` — không phải một khung rỗng đứng thay chỗ.
    expect(screen.getByText('chia sẻ bản vẽ')).toBeInTheDocument();
  });

  it('đóng hộp thoại trả `ExportPanel` về không còn hộp thoại nào (A12: có đường đóng)', async () => {
    renderExportPanel();

    fireEvent.click(await screen.findByRole('button', { name: /chia sẻ/i }));
    await screen.findByRole('dialog');

    fireEvent.click(screen.getByRole('button', { name: 'Đóng hộp thoại' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});

describe('B-V12-05 — xuất xong thì tệp tải về máy, đúng lời màn đã hứa', () => {
  it('một lượt xuất thành công gọi `deliver` đúng một lần với chính tệp vừa xuất', async () => {
    const deliver = vi.fn();
    const gateway = createExportPanelGateway({ deliver });
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useExportPanel({ projectId: PROJECT_ID, gateway }), { wrapper });

    act(() => {
      result.current.onSelectFormat('spatial-json');
    });
    act(() => {
      result.current.onExport();
    });

    await waitFor(() => {
      expect(deliver).toHaveBeenCalledTimes(1);
    });
    expect(deliver.mock.calls[0]?.[0]).toMatchObject({ fileName: expect.stringMatching(/\.json$/u) });
  });
});
