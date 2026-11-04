import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ROUTES } from '@/routes/paths';

import type * as GateModel from './floorReviewGateModel';
import { QcStepPager, type QcStepPagerProps } from './QcStepPager';

const review = vi.hoisted(() => ({
  scale: 'confirmed' as GateModel.FloorScaleState | null,
  counts: null as GateModel.FloorReviewCounts | null,
  nextFloor: null as { id: string; label: string } | null,
}));
vi.mock('./useFloorReview', () => ({
  useFloorReview: () => ({ graph: {}, storeSpatial: null, scale: review.scale }),
  useNextFloor: () => review.nextFloor,
}));
vi.mock('./floorReviewGateModel', async (importOriginal) => {
  const actual = await importOriginal<typeof GateModel>();
  return { ...actual, floorReviewCountsOf: () => review.counts! };
});

function renderPager(props: Partial<QcStepPagerProps>) {
  render(
    <MemoryRouter>
      <QcStepPager activeStep="walls" floorId="f1" projectId="p1" remaining={null} stepDone={false} {...props} />
    </MemoryRouter>,
  );
}
const next = () => screen.getByRole('link', { name: /^Bước tiếp/u });
const previous = () => screen.getByRole('link', { name: /^Bước trước/u });
const PRIMARY = 'bg-accent';

beforeEach(() => {
  review.scale = 'confirmed';
  review.nextFloor = null;
  review.counts = {
    walls: { reviewed: 0, total: 22 },
    objects: { reviewed: 2, total: 27 },
    rooms: { reviewed: 0, total: 8 },
  };
});

describe('QcStepPager', () => {
  it('bước chưa xong: vẫn sang được, nút phụ, câu nói còn gì và bước sau là gì', () => {
    renderPager({ remaining: 'Còn 22 đoạn chưa duyệt.' });

    expect(next()).toHaveAttribute('href', ROUTES.project.objects('p1', 'f1'));
    expect(next()).not.toHaveClass(PRIMARY);
    expect(screen.getByRole('status')).toHaveTextContent('Còn 22 đoạn chưa duyệt. Bước sau: Cửa và nội thất.');
    expect(previous()).toHaveAttribute('href', ROUTES.project.scale('p1', 'f1'));
  });

  it('bước đủ điều kiện: "Bước tiếp" là nút chính; màn có nút chính khác thì không', () => {
    renderPager({ stepDone: true });
    expect(next()).toHaveClass(PRIMARY);
  });

  it('màn Xong tầng (quiet): cặp nút giữ nút phụ', () => {
    renderPager({ stepDone: true, quiet: true });
    expect(next()).not.toHaveClass(PRIMARY);
  });

  it('bước đầu: "Bước trước" về bước Xử lý của dự án', () => {
    renderPager({ activeStep: 'scale', stepDone: true });

    expect(previous()).toHaveAttribute('href', ROUTES.project.pipeline('p1'));
    expect(next()).toHaveAttribute('href', ROUTES.project.walls('p1', 'f1'));
  });

  it('bước cuối: đi đúng như cổng: tầng kế nếu còn, không thì Mô hình 3D kèm câu nhắc', () => {
    renderPager({ activeStep: 'rooms' });
    expect(next()).toHaveAttribute('href', ROUTES.project.viewer('p1'));
    expect(screen.getByRole('status').textContent).toMatch(/^Còn .* chưa duyệt/u);
  });

  it('bước cuối, còn tầng khác: sang Tường của tầng đó', () => {
    review.nextFloor = { id: 'f2', label: 'Tầng 2' };
    renderPager({ activeStep: 'rooms' });
    expect(next()).toHaveAttribute('href', ROUTES.project.walls('p1', 'f2'));
    expect(next()).toHaveAccessibleName('Bước tiếp: Tầng 2');
  });

  it('thiếu tỷ lệ ở màn Tỷ lệ: nút không chết, bấm đưa tới ô nhập, câu nói cần gì', () => {
    review.scale = 'missing';
    render(
      <MemoryRouter>
        <section aria-current="step">
          <input aria-label="Rộng" />
        </section>
        <QcStepPager activeStep="scale" floorId="f1" projectId="p1" remaining={null} stepDone={false} />
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: /^Bước tiếp/u });
    expect(button).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('Đặt tỷ lệ trước');
    fireEvent.click(button);
    expect(screen.getByRole('textbox', { name: 'Rộng' })).toHaveFocus();
  });

  it('thiếu tỷ lệ ở bước sau: cả hai nút đưa về màn Tỷ lệ', () => {
    review.scale = 'missing';
    renderPager({ activeStep: 'objects' });

    expect(next()).toHaveAttribute('href', ROUTES.project.scale('p1', 'f1'));
    expect(previous()).toHaveAttribute('href', ROUTES.project.scale('p1', 'f1'));
  });

  it('bản nổi dưới 1024: chỉ hai nút, không câu chữ', () => {
    renderPager({ compact: true });

    expect(screen.getByTestId('qc-step-pager-compact')).toContainElement(next());
    expect(screen.queryByRole('status')).toBeNull();
  });
});
