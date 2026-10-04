/**
 * Nút "quay lại" của màn 404 không bao giờ đưa người dùng ra khỏi ứng dụng (B-V1-01).
 *
 * Hai nhánh, đo bằng router thật trong bộ nhớ: có mục lịch sử của ứng dụng phía
 * trước thì lùi về đó; mở thẳng (mục đầu tiên, `location.key === 'default'`) thì về
 * danh sách dự án. Bài e2e cùng mã: `e2e/v1/not-found.spec.ts`.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { createTestQueryClient } from '@/lib/testing/render';
import { ROUTES } from '@/routes/paths';

import { useNotFound } from './useNotFound';

const DEAD_PATH = '/duong-chet';
const PREVIOUS_PATH = '/man-truoc';

function BackButton() {
  const vm = useNotFound({ gateway: { listRecentProjects: () => Promise.resolve([]) } });

  return (
    <button onClick={vm.secondaryAction.onActivate} type="button">
      {vm.secondaryAction.label}
    </button>
  );
}

function renderAt(initialEntries: string[]) {
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={initialEntries} initialIndex={initialEntries.length - 1}>
        <Routes>
          <Route path={ROUTES.dashboard} element={<p>danh sách dự án</p>} />
          <Route path={PREVIOUS_PATH} element={<p>màn trước</p>} />
          <Route path="*" element={<BackButton />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('useNotFound — "quay lại"', () => {
  it('mở thẳng đường chết (không có lịch sử của ứng dụng) thì về danh sách dự án', () => {
    renderAt([DEAD_PATH]);

    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }));

    expect(screen.getByText('danh sách dự án')).toBeInTheDocument();
  });

  it('có màn trước trong ứng dụng thì lùi về đúng màn ấy', () => {
    renderAt([PREVIOUS_PATH, DEAD_PATH]);

    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }));

    expect(screen.getByText('màn trước')).toBeInTheDocument();
  });
});
