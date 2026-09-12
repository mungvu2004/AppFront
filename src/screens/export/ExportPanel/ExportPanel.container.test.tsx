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

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { renderWithProviders } from '@/lib/testing/render';
import { useStore } from '@/store';

import { ExportPanelContainer } from './ExportPanel.container';

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
