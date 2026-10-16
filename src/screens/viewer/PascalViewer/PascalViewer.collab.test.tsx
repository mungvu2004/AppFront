/**
 * Lớp cộng tác trên cây thật của màn Pascal.
 *
 * - 23-D-008 / BUG-642: vai xem phải đọc được "Bạn đang xem, không sửa được".
 *   Màn từng gắn `CollaborationLayerContainer` mà không truyền `canWrite`, nên
 *   lớp phủ mặc định `canWrite = true` và chỉ còn "Chỉ mình bạn đang xem".
 */

import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { renderWithProviders } from '@/lib/testing/render';

import { PascalViewerContainer } from './PascalViewer.container';

const loadMount = vi.fn(() => Promise.resolve({ mount: () => ({ dispose: vi.fn() }) })) as unknown as never;
const READ_ONLY = 'Bạn đang xem, không sửa được';

const renderViewer = (readOnly: boolean) =>
  renderWithProviders(
    <MemoryRouter>
      <PascalViewerContainer graph={createSampleBuilding()} loadMount={loadMount} readOnly={readOnly} />
    </MemoryRouter>,
  );

describe('[23-D-008] vai xem thấy chú thích chỉ xem', () => {
  it('readOnly → lớp cộng tác nói "Bạn đang xem, không sửa được"', async () => {
    renderViewer(true);
    expect(await screen.findByText(READ_ONLY, undefined, { timeout: 5_000 })).toBeInTheDocument();
  });

  it('được sửa → không có chú thích chỉ xem', async () => {
    renderViewer(false);
    await screen.findByText('Chỉ mình bạn đang xem', undefined, { timeout: 5_000 });
    expect(screen.queryByText(READ_ONLY)).not.toBeInTheDocument();
  });
});
