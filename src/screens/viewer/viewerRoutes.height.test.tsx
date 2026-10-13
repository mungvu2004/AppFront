/**
 * Hai route của vỏ 3D (`/3d`, `/3d/measure`) cấp chiều cao cho
 * màn — cùng gốc BUG-373: `ViewerShell` dùng `h-full`, mà dưới router không vỏ
 * nào cấp chiều cao, nên vỏ chỉ cao bằng nội dung (529 px ở 1440×900, dải trống
 * bên dưới). jsdom không đo bố cục, nên bài khẳng định cái khung `h-dvh` bọc
 * ngoài cổng nạp kho — cùng khuôn `MobileViewer.route.test.tsx`. Cổng được thay
 * bằng một mốc để bài không gọi mạng, không dựng WebGL.
 */
import { screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/lib/testing/render';

import { MeasurementToolRoute } from './MeasurementTool';
import { Viewer3DRoute } from './Viewer3D';

import type { ComponentType } from 'react';

vi.mock('@/components/feedback/ProjectSpatialGate', () => ({
  ProjectSpatialGate: () => <div data-testid="spatial-gate" />,
}));

const ROUTES: ReadonlyArray<readonly [string, ComponentType]> = [
  ['/3d', Viewer3DRoute],
  ['/3d/measure', MeasurementToolRoute],
];

describe('route vỏ 3D — khung chiều cao (cùng gốc BUG-373)', () => {
  it.each(ROUTES)('%s bọc màn trong khung cao bằng khung nhìn', (suffix, RouteScreen) => {
    renderWithProviders(
      <MemoryRouter initialEntries={[`/projects/P-1${suffix}`]}>
        <Routes>
          <Route element={<RouteScreen />} path={`/projects/:projectId${suffix}`} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('spatial-gate').closest('.h-dvh')).not.toBeNull();
  });
});
