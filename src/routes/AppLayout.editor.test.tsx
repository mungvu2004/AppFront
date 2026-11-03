import { screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { useEditorChrome } from '@/components/shell/EditorChrome';
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

/** Màn giả: đặt ba mảnh vỏ biên tập nếu có, như QcFloorNav. */
function Screen() {
  const chrome = useEditorChrome();
  return (
    <main>
      <h1>Màn</h1>
      {chrome === null ? (
        <p>không có vỏ biên tập</p>
      ) : (
        <div data-testid="editor-bar">
          {chrome.fileMenu}
          {chrome.stepLabel}
          {chrome.bell}
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
  it('màn duyệt tường: không header chung, màn nhận menu tệp + chip bước + chuông', async () => {
    renderAt(ROUTES.project.walls('p1', 'f1'));
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.getByRole('link', { name: 'Bỏ qua tới nội dung' })).toBeInTheDocument();
    const bar = screen.getByTestId('editor-bar');
    expect(bar.querySelector('nav[aria-label="Các bước của dự án"]')).not.toBeNull();
    expect(await screen.findByRole('button', { name: 'Thông báo' })).toBeInTheDocument();
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
