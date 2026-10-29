/**
 * Khoá tỷ lệ (UX-R1 r3): tầng thiếu tỷ lệ thì màn Cửa và nội thất vẫn xem được, nhưng không còn nút
 * sửa nào, và nút chính của panel chi tiết là lối sang bước Tỷ lệ kèm lý do.
 */

import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/lib/testing/render';
import { ROUTES } from '@/routes/paths';
import { useStore } from '@/store';
import { resetSelectorCaches } from '@/store/selectors';

import { ObjectLayerReviewContainer } from './ObjectLayerReview.container';
import { scenarioArgsFor } from './ObjectLayerReview.stories';

/* Cùng câu với bản giả của `useScaleLock` ở dưới (vi.mock được kéo lên đầu file, không đọc được hằng này). */
const LOCK_REASON = 'Đặt tỷ lệ trước: máy không đo được tỷ lệ tầng này';

vi.mock('../shared/useScaleLock', () => ({
  useScaleLock: () => ({ locked: true, reason: 'Đặt tỷ lệ trước: máy không đo được tỷ lệ tầng này' }),
}));

beforeEach(() => {
  stubCanvasFrame();
  resetSelectorCaches();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

/* Thẻ hỏi (chi tiết mục chọn) neo trên bản vẽ chỉ hiện khi đo được khung: jsdom không bố trí, nên giả khổ khung. */
class StubResizeObserver {
  observe(): void {
    /* Khung không đổi kích thước trong bài kiểm. */
  }
  disconnect(): void {
    /* Không có gì để ngắt. */
  }
}

function stubCanvasFrame() {
  vi.stubGlobal('ResizeObserver', StubResizeObserver);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(800);
}

afterEach(() => {
  cleanup();
  const store = useStore.getState();

  store.setSpatial(null, null);
  store.clearSelection();
  store.setHovered(null);
  resetSelectorCaches();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('khoá tỷ lệ — màn Cửa và nội thất', () => {
  it('xem được danh sách và chi tiết; không nút duyệt/xoá; nút chính đi tới bước Tỷ lệ', async () => {
    const onNavigate = vi.fn();
    const args = scenarioArgsFor('success');

    renderWithProviders(
      <MemoryRouter>
        <ObjectLayerReviewContainer {...args} onNavigate={onNavigate} />
      </MemoryRouter>,
    );

    const list = await screen.findByRole('group', { name: 'Danh sách đối tượng' });
    fireEvent.click(within(list).getAllByRole('option')[0] as HTMLElement);

    expect(await screen.findByText(LOCK_REASON)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Duyệt #/u })).toBeNull();
    expect(screen.queryByRole('button', { name: /xoá$/u })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Vẽ cửa đi' })).toBeNull();

    /* Một việc một nút (UX-R2): dải đỏ đầu màn không còn nút riêng, chỉ nút chính ở panel chi tiết. */
    fireEvent.click(screen.getByRole('button', { name: 'Đặt tỷ lệ' }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(ROUTES.project.scale(args.projectId, args.floorId));
  });
});
