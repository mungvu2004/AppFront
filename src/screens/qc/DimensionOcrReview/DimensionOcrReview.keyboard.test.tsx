/** Cửa vào duyệt bàn phím (BUG-630): không mời lúc đang tải hay lúc đọc lỗi — chưa có gì để duyệt. */

import { cleanup, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/lib/testing/render';
import { resetSelectorCaches } from '@/store/selectors';
import { useStore } from '@/store';

import { DimensionOcrReviewContainer } from './DimensionOcrReview.container';
import { scenarioArgsFor } from './DimensionOcrReview.stories';
import { keyboardModeToggleLabel } from './dimensionOcrText';

function renderState(state: Parameters<typeof scenarioArgsFor>[0]) {
  const store = useStore.getState();

  store.setSpatial(null, null);
  store.clearSelection();
  resetSelectorCaches();

  return renderWithProviders(
    <MemoryRouter>
      <DimensionOcrReviewContainer {...scenarioArgsFor(state)} />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('DimensionOcrReview — cửa vào duyệt bàn phím', () => {
  it('[BUG-630] đang tải: không có nút bật duyệt bàn phím', () => {
    renderState('loading');

    expect(screen.queryByText(new RegExp(keyboardModeToggleLabel, 'u'))).toBeNull();
  });

  it('[BUG-630] có hàng để duyệt: nút vẫn ở đó', async () => {
    renderState('partial');

    await waitFor(() => expect(screen.getAllByText(new RegExp(keyboardModeToggleLabel, 'u')).length).toBeGreaterThan(0));
  });
});
