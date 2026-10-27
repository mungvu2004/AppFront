import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ROUTES } from '@/routes/paths';

import { SCALE_LOCK_REASON, type FloorScaleState } from './floorReviewGateModel';
import { QcFloorNav } from './QcFloorNav';
import type { QcLayerKey } from './qcLayers';

const review = vi.hoisted(() => ({
  scale: null as FloorScaleState | null,
  byFloor: {} as Record<string, FloorScaleState | null>,
}));
vi.mock('./useFloorReview', () => ({
  useFloorReview: (_projectId: string, floorId: string) => ({
    graph: null,
    storeSpatial: null,
    scale: floorId in review.byFloor ? review.byFloor[floorId] : review.scale,
  }),
}));

function renderNav(layer: QcLayerKey = 'walls') {
  render(
    <MemoryRouter>
      <QcFloorNav
        floorId="f1"
        floors={[
          { id: 'f1', label: 'Tầng 1' },
          { id: 'f2', label: 'Tầng 2' },
        ]}
        layer={layer}
        projectId="p1"
        projectName="Nhà A"
      />
    </MemoryRouter>,
  );
  return screen.getByRole('navigation', { name: 'Các bước duyệt tầng' });
}

beforeEach(() => {
  review.scale = null;
  review.byFloor = {};
});

describe('QcFloorNav (UX-R1 K25)', () => {
  it('một hàng: tầng ▾, bốn bước bắt đầu bằng 0 Tỷ lệ, rồi menu Nâng cao', () => {
    const steps = renderNav();

    expect(screen.queryByText('Nhà A')).toBeNull();
    expect(screen.getByLabelText('Đổi tầng: đang ở Tầng 1').closest('div.h-8')).toBe(steps.parentElement);
    expect(steps.textContent).toContain('0Tỷ lệ1Tường2Cửa và nội thất3Phòng');
    expect(steps.textContent).not.toContain('không bắt buộc');
    expect(within(steps).getByRole('link', { name: /Tường/u })).toHaveAttribute('aria-current', 'page');
  });

  it('Trục, Độ dày tường, Kích thước, So với bản vẽ nằm trong menu Nâng cao', () => {
    const steps = renderNav('grids');
    const menu = within(steps).getByLabelText('Nâng cao: đang ở Trục').closest('details')!;

    expect(within(menu).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Trục',
      'Độ dày tường',
      'Kích thước',
      'So với bản vẽ',
    ]);
  });

  it('menu tầng có các tầng và "Tất cả tầng"', () => {
    renderNav();
    const menu = screen.getByLabelText('Đổi tầng: đang ở Tầng 1').closest('details')!;

    expect(within(menu).getByRole('link', { name: 'Tầng 2' })).toHaveAttribute('href', expect.stringContaining('f2'));
    expect(within(menu).getByRole('link', { name: 'Tất cả tầng' })).toBeInTheDocument();
  });

  it('máy không đo được tỷ lệ: bước Tỷ lệ báo "chưa có", các bước sau và Độ dày khoá kèm lý do', () => {
    review.scale = 'missing';
    const steps = renderNav('scale');

    expect(within(steps).getByRole('link', { name: /Tỷ lệ/u }).textContent).toContain('chưa có');
    expect(within(steps).queryByRole('link', { name: /Tường/u })).toBeNull();
    expect(within(steps).queryByRole('link', { name: 'Độ dày tường' })).toBeNull();
    expect(within(steps).getAllByTitle(SCALE_LOCK_REASON)).toHaveLength(4);
    expect(within(steps).getByRole('link', { name: 'Trục' })).toBeInTheDocument();
  });

  it('máy đo được tỷ lệ: không khoá, bước Tỷ lệ báo "cần kiểm"', () => {
    review.scale = 'check';
    const steps = renderNav();

    expect(within(steps).getByRole('link', { name: /Tỷ lệ/u }).textContent).toContain('cần kiểm');
    expect(within(steps).getByRole('link', { name: /Tường/u })).toBeInTheDocument();
    expect(within(steps).queryAllByTitle(SCALE_LOCK_REASON)).toHaveLength(0);
  });

  it('đổi sang tầng thiếu tỷ lệ: đi tới bước Tỷ lệ của tầng đó, không tới bước đang mở (P1 #5)', () => {
    review.byFloor = { f2: 'missing' };
    renderNav('rooms');
    const menu = screen.getByLabelText('Đổi tầng: đang ở Tầng 1').closest('details')!;

    expect(within(menu).getByRole('link', { name: 'Tầng 2' }).getAttribute('href')).toBe(ROUTES.project.scale('p1', 'f2'));
    expect(within(menu).getByRole('link', { name: /Tầng 1/u }).getAttribute('href')).toBe(ROUTES.project.rooms('p1', 'f1'));
  });

  it('đổi sang tầng thiếu tỷ lệ từ bước không khoá (Trục): giữ bước đang mở', () => {
    review.byFloor = { f2: 'missing' };
    renderNav('grids');
    const menu = screen.getByLabelText('Đổi tầng: đang ở Tầng 1').closest('details')!;

    expect(within(menu).getByRole('link', { name: 'Tầng 2' }).getAttribute('href')).toBe(ROUTES.project.grids('p1', 'f2'));
  });
});
