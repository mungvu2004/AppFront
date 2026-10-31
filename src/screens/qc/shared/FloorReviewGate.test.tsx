import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ROUTES } from '@/routes/paths';

import { FloorReviewGate } from './FloorReviewGate.container';
import { SCALE_LOCK_REASON, type FloorScaleState } from './floorReviewGateModel';
import { stepAfter } from './stepAfter';

const review = vi.hoisted(() => ({ scale: null as FloorScaleState | null }));
vi.mock('./useFloorReview', () => ({
  graphOfDocument: () => null,
  useFloorReview: () => ({ graph: null, storeSpatial: null, scale: review.scale }),
  useNextFloor: () => null,
}));
vi.mock('@/hooks/useProjectFloors', () => ({ useProjectFloors: () => [] }));
vi.mock('@/components/shell/FlowGate', () => ({ FlowGate: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

function renderGate(path: string, onNext?: () => void) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <FloorReviewGate floorId="f1" nextLabel="Tường kế tiếp" onNext={onNext} projectId="p1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  review.scale = null;
});

describe('FloorReviewGate (UX-R2 K22): nút luôn đi tới, chỉ tầng chưa có tỷ lệ bị khoá', () => {
  it('tỷ lệ cần kiểm, đang ở Tường: nút đi tới bước kế, không kéo về Tỷ lệ', () => {
    review.scale = 'check';
    renderGate(ROUTES.project.walls('p1', 'f1'));

    const link = screen.getByRole('link', { name: /^Tiếp: Cửa và nội thất/u });
    expect(link).toHaveAttribute('href', ROUTES.project.objects('p1', 'f1'));
    expect(screen.queryByRole('link', { name: /tỷ lệ/iu })).toBeNull();
  });

  it('Codex P2: tường còn dở, đang ở Cửa: nút đi tới Phòng, không lùi về Tường', () => {
    review.scale = 'confirmed';
    renderGate(ROUTES.project.objects('p1', 'f1'));

    expect(screen.getByRole('link', { name: /^Tiếp: Phòng/u })).toHaveAttribute('href', ROUTES.project.rooms('p1', 'f1'));
    expect(screen.queryByRole('link', { name: /Tường/u })).toBeNull();
  });

  it('đang ở Phòng (bước cuối) mà tường còn dở: sang Mô hình 3D, không lùi về Tường', () => {
    review.scale = 'confirmed';
    renderGate(ROUTES.project.rooms('p1', 'f1'));

    expect(screen.getByRole('link', { name: /^Sang Mô hình 3D/u })).toHaveAttribute('href', ROUTES.project.viewer('p1'));
  });

  it('màn phụ đi theo bước cha: Kích thước → Tường, Độ dày tường → Cửa và nội thất', () => {
    review.scale = 'confirmed';
    renderGate(ROUTES.project.dimensions('p1', 'f1'));
    expect(screen.getByRole('link', { name: /^Tiếp: Tường/u })).toHaveAttribute('href', ROUTES.project.walls('p1', 'f1'));
    cleanup();

    renderGate(ROUTES.project.thickness('p1', 'f1'));
    expect(screen.getByRole('link', { name: /^Tiếp: Cửa và nội thất/u })).toBeInTheDocument();
  });

  it('đang ở lớp chưa xong và màn có mục kế tiếp: nút mở mục kế tiếp của lớp này', () => {
    review.scale = 'confirmed';
    const onNext = vi.fn();
    renderGate(ROUTES.project.walls('p1', 'f1'), onNext);

    fireEvent.click(screen.getByRole('button', { name: 'Tường kế tiếp' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('tỷ lệ cần kiểm, đang ở Tỷ lệ: "Tiếp: Tường" bấm được', () => {
    review.scale = 'check';
    renderGate(ROUTES.project.scale('p1', 'f1'));

    expect(screen.getByRole('link', { name: /^Tiếp: Tường/u })).toHaveAttribute('href', ROUTES.project.walls('p1', 'f1'));
  });

  it('chưa có tỷ lệ, ngoài màn Tỷ lệ: nút "Đặt tỷ lệ" dẫn về Tỷ lệ', () => {
    review.scale = 'missing';
    renderGate(ROUTES.project.walls('p1', 'f1'));

    expect(screen.getByRole('link', { name: /^Đặt tỷ lệ/u })).toHaveAttribute('href', ROUTES.project.scale('p1', 'f1'));
  });

  it('chưa có tỷ lệ, ở màn Tỷ lệ: "Tiếp: Tường" khoá kèm lý do', () => {
    review.scale = 'missing';
    renderGate(ROUTES.project.scale('p1', 'f1'));

    const button = screen.getByRole('button', { name: /^Tiếp: Tường/u });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('title', SCALE_LOCK_REASON);
  });
});

describe('stepAfter (U28): gợi ý bước kế bỏ qua bước đã xong', () => {
  it('ở Tỷ lệ, tường đã duyệt hết: bước kế là Cửa và nội thất', () => {
    expect(stepAfter(ROUTES.project.scale('p1', 'f1'), 'p1', 'f1', (key) => key === 'walls')).toBe('objects');
  });

  it('mọi bước sau đều xong: không còn bước kế', () => {
    expect(stepAfter(ROUTES.project.scale('p1', 'f1'), 'p1', 'f1', () => true)).toBeUndefined();
  });

  it('chưa biết bước nào xong: bước ngay sau màn đang mở', () => {
    expect(stepAfter(ROUTES.project.walls('p1', 'f1'), 'p1', 'f1')).toBe('objects');
  });
});
