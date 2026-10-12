/**
 * BUG-373 — vỏ route cấp chiều cao cho màn di động.
 *
 * View dùng `h-full`; dưới router không vỏ nào cấp chiều cao nên vùng mô hình
 * từng co về cao 0. jsdom không đo bố cục, nên bài khẳng định đúng cái khung
 * cấp chiều cao ấy bọc ngoài vùng màn. Cổng nạp kho và nhánh cảnh được thay để
 * bài không gọi mạng, không dựng WebGL.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { MobileViewerRoute } from './MobileViewer.container';

vi.mock('@/components/feedback/ProjectSpatialGate', () => ({
  ProjectSpatialGate: ({ children }: { readonly children: React.ReactNode }) => children,
}));

vi.mock('./MobileViewer.connected', () => ({
  ConnectedMobileViewer: () => <div aria-label="Xem mô hình 3D trên điện thoại" role="region" />,
}));

describe('MobileViewerRoute — khung chiều cao (BUG-373)', () => {
  it('bọc màn trong khung cao bằng khung nhìn, nên `h-full` của view không ra 0', async () => {
    render(
      <MemoryRouter initialEntries={['/m/du-an/P-1']}>
        <Routes>
          <Route element={<MobileViewerRoute />} path="/m/du-an/:projectId" />
        </Routes>
      </MemoryRouter>,
    );

    const region = await screen.findByRole('region', { name: 'Xem mô hình 3D trên điện thoại' });

    expect(region.closest('.h-dvh')).not.toBeNull();
  });
});
