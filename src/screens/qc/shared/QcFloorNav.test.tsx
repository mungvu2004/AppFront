import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
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

describe('QcFloorNav (UX-R1 K25, UX-R2 K04)', () => {
  it('một hàng: tầng ▾, bốn bước đánh số từ 1, không còn menu Nâng cao', () => {
    const steps = renderNav();

    expect(screen.queryByText('Nhà A')).toBeNull();
    expect(screen.getByLabelText('Đổi tầng: đang ở Tầng 1').closest('div.h-8')).toBe(steps.parentElement);
    expect(steps.textContent).toContain('1Tỷ lệ2Tường3Cửa và nội thất4Phòng');
    expect(within(steps).queryByText(/Nâng cao/u)).toBeNull();
    expect(within(steps).getByRole('link', { name: /Tường/u })).toHaveAttribute('aria-current', 'page');
    expect(within(steps).queryByRole('link', { name: 'Trục' })).toBeNull();
  });

  it('bước Tỷ lệ có link Kích thước và So với bản vẽ; đứng ở mục con thì bước Tỷ lệ sáng', () => {
    const steps = renderNav('dimensions');

    expect(within(steps).getByRole('link', { name: 'Kích thước' })).toHaveAttribute('aria-current', 'page');
    expect(within(steps).getByRole('link', { name: 'So với bản vẽ' })).toBeInTheDocument();
    expect(within(steps).getByRole('link', { name: /Tỷ lệ/u })).toHaveAttribute('aria-current', 'step');
    expect(within(steps).queryByRole('link', { name: 'Độ dày tường' })).toBeNull();
  });

  it('Độ dày tường thuộc bước Tường: chỉ hiện khi đang đứng ở đó', () => {
    const steps = renderNav('thickness');

    expect(within(steps).getByRole('link', { name: /Tường/u, current: 'step' })).toBeInTheDocument();
    expect(within(steps).getByRole('link', { name: 'Độ dày tường' })).toHaveAttribute('aria-current', 'page');
    expect(within(steps).queryByRole('link', { name: 'Kích thước' })).toBeNull();
  });

  it('Trục không thuộc bước nào: không bước nào sáng', () => {
    const steps = renderNav('grids');

    expect(within(steps).queryAllByRole('link', { current: true })).toHaveLength(0);
  });

  it('menu tầng có các tầng và "Tất cả tầng"', () => {
    renderNav();
    const menu = screen.getByLabelText('Đổi tầng: đang ở Tầng 1').closest('details')!;

    expect(within(menu).getByRole('link', { name: 'Tầng 2' })).toHaveAttribute('href', expect.stringContaining('f2'));
    expect(within(menu).getByRole('link', { name: 'Tất cả tầng' })).toBeInTheDocument();
  });

  it('chưa có tỷ lệ: bước 1 mang tên "Chưa có tỷ lệ" (đỏ), các bước sau khoá kèm lý do', () => {
    review.scale = 'missing';
    const steps = renderNav('scale');
    const scaleStep = within(steps).getByRole('link', { name: /Chưa có tỷ lệ/u });

    expect(within(scaleStep).getByText('Chưa có tỷ lệ')).toHaveClass('text-state-violation-text');
    expect(within(steps).queryByRole('link', { name: /Tường/u })).toBeNull();
    expect(within(steps).getAllByTitle(SCALE_LOCK_REASON)).toHaveLength(3);
    expect(within(steps).getByRole('link', { name: 'Kích thước' })).toBeInTheDocument();
  });

  it('tỷ lệ cần kiểm: không khoá, bước 1 mang tên "Tỷ lệ cần kiểm" (vàng)', () => {
    review.scale = 'check';
    const steps = renderNav();
    const scaleStep = within(steps).getByRole('link', { name: /Tỷ lệ cần kiểm/u });

    expect(within(scaleStep).getByText('Tỷ lệ cần kiểm')).toHaveClass('text-state-attention-text');
    expect(within(steps).getByRole('link', { name: /Tường/u })).toBeInTheDocument();
    expect(within(steps).queryAllByTitle(SCALE_LOCK_REASON)).toHaveLength(0);
  });

  it('tỷ lệ đã xác nhận: bước 1 là "Tỷ lệ", báo đã xong', () => {
    review.scale = 'confirmed';
    const steps = renderNav();

    expect(within(steps).getByRole('link', { name: /^Tỷ lệ.*đã xong$/u })).toBeInTheDocument();
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

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

describe('QcFloorNav: phím đổi bước và tầng trống', () => {
  it('U19: phím ] sang bước sau, [ về bước trước', () => {
    review.scale = 'confirmed';
    render(
      <MemoryRouter initialEntries={[ROUTES.project.walls('p1', 'f1')]}>
        <QcFloorNav floorId="f1" layer="walls" projectId="p1" />
        <Where />
      </MemoryRouter>,
    );

    fireEvent.keyDown(window, { key: ']' });
    expect(screen.getByTestId('where')).toHaveTextContent(ROUTES.project.objects('p1', 'f1'));
  });

  it('U19: thiếu tỷ lệ thì ] không mở bước bị khoá', () => {
    review.scale = 'missing';
    render(
      <MemoryRouter initialEntries={[ROUTES.project.scale('p1', 'f1')]}>
        <QcFloorNav floorId="f1" layer="scale" projectId="p1" />
        <Where />
      </MemoryRouter>,
    );

    fireEvent.keyDown(window, { key: ']' });
    expect(screen.getByTestId('where')).toHaveTextContent(ROUTES.project.scale('p1', 'f1'));
  });

  it('U52: tầng chưa có bản vẽ có nhãn trong menu đổi tầng', () => {
    review.scale = 'confirmed';
    render(
      <MemoryRouter>
        <QcFloorNav
          floorId="f1"
          floors={[
            { id: 'f1', label: 'Tầng trệt', hasDrawing: true },
            { id: 'f2', label: 'Tầng 1', hasDrawing: false },
          ]}
          layer="walls"
          projectId="p1"
        />
      </MemoryRouter>,
    );
    const menu = screen.getByLabelText('Đổi tầng: đang ở Tầng trệt').closest('details')!;

    expect(within(menu).getByRole('link', { name: /^Tầng 1\s+chưa có bản vẽ$/u })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Tầng trệt' })).toBeInTheDocument();
  });
});
