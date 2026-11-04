import { screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { useEditorChrome } from '@/components/shell/EditorChromeContext';
import { renderWithProviders } from '@/lib/testing/render';

import { AppLayout } from './AppLayout';
import { ROUTES } from './paths';

vi.mock('@/screens/system/NotificationCenter', () => ({
  NotificationBellContainer: () => (
    <button type="button" aria-label="Thông báo">
      chuông
    </button>
  ),
}));

/** Màn giả: đặt hai mảnh vỏ biên tập nếu có, như QcFloorNav. */
function Screen() {
  const chrome = useEditorChrome();
  return (
    <main>
      <h1>Màn</h1>
      {chrome === null ? (
        <p>không có vỏ biên tập</p>
      ) : (
        <div data-testid="editor-bar">
          {chrome.fileMenu(<li>Tầng 1</li>)}
        </div>
      )}
    </main>
  );
}

function renderAt(path: string) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="*" element={<Screen />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppLayout: chế độ biên tập', () => {
  it('màn duyệt tường: không header chung; menu tệp gom tầng, sáu bước, chuông (ẩn, chỉ đếm) và lối Thông báo', async () => {
    renderAt(ROUTES.project.walls('p1', 'f1'));
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.getByRole('link', { name: 'Bỏ qua tới nội dung' })).toBeInTheDocument();
    const bar = screen.getByTestId('editor-bar');
    /* Menu tệp nạp lười (ngoài chunk vào): đợi chunk về rồi mới soát. */
    expect(await within(bar).findByRole('navigation', { name: 'Các bước của dự án' })).toBeInTheDocument();
    expect(within(bar).getByRole('list', { name: 'Tầng' })).toHaveTextContent('Tầng 1');
    expect(within(bar).getByRole('link', { name: /^Thông báo/u })).toHaveAttribute('href', ROUTES.notifications);
    /* Chuông vẫn gắn (đếm chưa đọc cho chấm trên tên dự án) nhưng không còn là nút thấy được. */
    expect((await screen.findByRole('button', { name: 'Thông báo', hidden: true })).closest('[data-editor-bell]')).toHaveClass('hidden');
  });

  it.each([
    ['danh sách tầng', ROUTES.project.floors('p1')],
    ['trục', ROUTES.project.grids('p1', 'f1')],
  ])('%s: giữ header chung, không có vỏ biên tập', (_name, path) => {
    renderAt(path);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByText('không có vỏ biên tập')).toBeInTheDocument();
  });
});
