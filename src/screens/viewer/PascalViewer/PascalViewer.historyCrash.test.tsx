/**
 * 23H-B-011: chunk bảng lịch sử tải hỏng thì chỉ cột bảng báo lỗi — tiêu đề màn
 * và khung dựng 3D vẫn đứng. Tệp riêng vì `vi.mock` áp cho cả tệp.
 */

import { fireEvent, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { renderWithProviders } from '@/lib/testing/render';

import { PascalViewerContainer } from './PascalViewer.container';
import { PASCAL_SIDE_PANEL_LABELS, PASCAL_VIEWER_TITLE } from './pascalViewerTypes';

vi.mock('@/screens/viewer/HistoryPanel', () => {
  throw new Error('Failed to fetch dynamically imported module');
});

const loadMount = vi.fn(() => Promise.resolve({ mount: () => ({ dispose: vi.fn() }) })) as unknown as never;

describe('[23H-B-011] bảng hỏng không kéo sập màn 3D', () => {
  it('chunk bảng hỏng: cột bảng báo lỗi, màn và khung dựng còn nguyên', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderWithProviders(
      <MemoryRouter>
        <PascalViewerContainer graph={createSampleBuilding()} loadMount={loadMount} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: PASCAL_SIDE_PANEL_LABELS.history }));

    const region = await screen.findByRole('region', { name: PASCAL_SIDE_PANEL_LABELS.history });
    // Đợi lượt nạp hỏng đi hết — chữ "Đang mở bảng…" của Suspense phải đi mất.
    await vi.waitFor(() => {
      expect(region).not.toHaveTextContent('Đang mở bảng…');
    });

    expect(screen.getByRole('heading', { name: PASCAL_VIEWER_TITLE })).toBeInTheDocument();
    expect(screen.getByTestId('pascal-canvas')).toBeInTheDocument();
    expect(region.textContent?.trim()).not.toBe('');
  });
});
