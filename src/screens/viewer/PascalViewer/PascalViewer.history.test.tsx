/**
 * Bảng "Lịch sử thao tác" trên cây thật của màn Pascal (QA-05c vòng 2).
 *
 * - 23H-A-009 / 23-A-012: `Ctrl+H` mở rồi ĐÓNG bảng. Bảng từng tự đăng ký
 *   `mod+h` ở phạm vi `sidePanel`, thắng binding `canvas` của màn, nên lần bấm
 *   thứ hai chỉ gập nội dung còn bảng vẫn mở.
 * - 23H-A-016: bảng đọc đúng ngăn lịch sử mà lượt sửa Pascal đẩy bước vào
 *   (bài của hook ở `usePascalEdits.test.ts`; ở đây chỉ khẳng định bảng có mặt).
 */

import { act, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { renderWithProviders } from '@/lib/testing/render';

import { PascalViewerContainer } from './PascalViewer.container';
import { PASCAL_SIDE_PANEL_LABELS } from './pascalViewerTypes';

const loadMount = vi.fn(() => Promise.resolve({ mount: () => ({ dispose: vi.fn() }) })) as unknown as never;

const pressCtrlH = (): void => {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', ctrlKey: true, bubbles: true }));
  });
};

describe('[23H-A-009] Ctrl+H có đúng một chủ', () => {
  it('Ctrl+H mở bảng, Ctrl+H lần nữa đóng hẳn bảng (không chỉ gập nội dung)', async () => {
    renderWithProviders(
      <MemoryRouter>
        <PascalViewerContainer graph={createSampleBuilding()} loadMount={loadMount} />
      </MemoryRouter>,
    );
    const tab = screen.getByRole('button', { name: PASCAL_SIDE_PANEL_LABELS.history });

    pressCtrlH();
    // Đợi bảng nạp muộn đứng hẳn — đúng lúc đăng ký `sidePanel` cũ của nó từng có mặt.
    await screen.findByTestId('history-panel', undefined, { timeout: 5_000 });
    expect(tab).toHaveAttribute('aria-expanded', 'true');

    pressCtrlH();

    await waitFor(() => {
      expect(tab).toHaveAttribute('aria-expanded', 'false');
    });
    expect(screen.queryByRole('region', { name: PASCAL_SIDE_PANEL_LABELS.history })).not.toBeInTheDocument();
  });
});
