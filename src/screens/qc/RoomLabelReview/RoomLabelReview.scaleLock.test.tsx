/**
 * Khoá tỷ lệ (UX-R1 r3): tầng thiếu tỷ lệ thì màn Phòng vẫn xem được, nhưng không còn nút sửa nào,
 * và nút chính của panel chi tiết là lối sang bước Tỷ lệ kèm lý do.
 */

import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/lib/testing/render';
import { ROUTES } from '@/routes/paths';
import { useStore } from '@/store';
import { resetSelectorCaches } from '@/store/selectors';

import { RoomLabelReviewContainer } from './RoomLabelReview.container';
import { scenarioArgsFor } from './RoomLabelReview.stories';

/* Cùng câu với bản giả của `useScaleLock` ở dưới (vi.mock được kéo lên đầu file, không đọc được hằng này). */
const LOCK_REASON = 'Đặt tỷ lệ trước: máy không đo được tỷ lệ tầng này';

vi.mock('../shared/useScaleLock', () => ({
  useScaleLock: () => ({ locked: true, reason: 'Đặt tỷ lệ trước: máy không đo được tỷ lệ tầng này' }),
}));

beforeEach(() => {
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
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: class {
      observe(): void {
        /* Khung không đổi kích thước trong bài kiểm. */
      }
      unobserve(): void {
        /* Không có gì để bỏ theo dõi. */
      }
      disconnect(): void {
        /* Không có gì để ngắt. */
      }
    },
  });
});

afterEach(() => {
  cleanup();
  const store = useStore.getState();

  store.setSpatial(null, null);
  store.clearSelection();
  store.setHovered(null);
  resetSelectorCaches();
  vi.restoreAllMocks();
});

describe('khoá tỷ lệ — màn Phòng', () => {
  it('xem được danh sách và chi tiết; không nút duyệt/gộp; nút chính đi tới bước Tỷ lệ', async () => {
    const onNavigate = vi.fn();
    const args = scenarioArgsFor('success');
    const rendered = renderWithProviders(<RoomLabelReviewContainer {...args} onNavigate={onNavigate} />);

    await waitFor(() => {
      expect(rendered.container.querySelectorAll('polygon').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('option')[0] as HTMLElement);

    const reason = await screen.findByText(LOCK_REASON);
    expect(screen.queryByRole('button', { name: /^Duyệt #R-/u })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Gộp phòng' })).toBeNull();

    /* Một việc một nút (UX-R2): dải đỏ đầu màn không có nút riêng; nút chính đi cùng lý do ở đáy panel chi tiết. */
    expect(screen.getAllByRole('button', { name: 'Đặt tỷ lệ' })).toHaveLength(1);
    fireEvent.click(within(reason.parentElement as HTMLElement).getByRole('button', { name: 'Đặt tỷ lệ' }));

    expect(onNavigate).toHaveBeenCalledWith(ROUTES.project.scale(args.projectId, args.floorId));
  });
});
