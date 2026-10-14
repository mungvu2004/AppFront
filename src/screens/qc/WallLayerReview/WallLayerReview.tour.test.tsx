/**
 * Hướng dẫn trình soạn (BUG-622): không tự mở đè lên màn lỗi đọc lớp tường — màn đó không có ray
 * công cụ hay canvas để dạy.
 */

import { cleanup, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/lib/testing/render';

import { WallLayerReviewContainer } from './WallLayerReview.container';
import { scenarioArgsFor } from './WallLayerReview.stories';

vi.mock('@/screens/system/EditorTour', () => ({
  EditorTourContainer: () => <div data-testid="editor-tour" />,
}));

afterEach(cleanup);

describe('WallLayerReview — hướng dẫn trình soạn', () => {
  it('[BUG-622] màn lỗi đọc không gắn hướng dẫn; màn có dữ liệu thì có', async () => {
    const failed = renderWithProviders(
      <MemoryRouter>
        <WallLayerReviewContainer {...scenarioArgsFor('error')} />
      </MemoryRouter>,
    );

    await screen.findByRole('button', { name: /Thử lại/u });
    expect(screen.queryByTestId('editor-tour')).toBeNull();
    failed.unmount();

    renderWithProviders(
      <MemoryRouter>
        <WallLayerReviewContainer {...scenarioArgsFor('partial')} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('editor-tour')).toBeInTheDocument());
  });
});
