import { fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useRegisteredScreenCommands } from '@/hooks/useScreenCommands';

import type * as GateModel from './floorReviewGateModel';
import { QcDisplayPopover } from './QcDisplayPopover';
import { QcStepColumn } from './QcStepColumn';

const review = vi.hoisted(() => ({
  scale: 'check' as GateModel.FloorScaleState | null,
  counts: null as GateModel.FloorReviewCounts | null,
}));
vi.mock('./useFloorReview', () => ({
  useFloorReview: () => ({ graph: review.counts === null ? null : {}, storeSpatial: null, scale: review.scale }),
  useNextFloor: () => null,
}));
vi.mock('@/hooks/useProjectFloors', () => ({ useProjectFloors: () => [{ id: 'f1', label: 'ch-03' }] }));
vi.mock('./floorDoneModel', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  floorDoneSummaryOf: () => ({ walls: '30 đoạn, tổng dài 58,4 m.', objects: '9 cửa đi.', rooms: '2 phòng: Bếp, Kho.', area: '67,73 m²' }),
}));
vi.mock('./floorReviewGateModel', async (importOriginal) => {
  const actual = await importOriginal<typeof GateModel>();
  return { ...actual, floorReviewCountsOf: () => review.counts! };
});

function renderColumn() {
  render(
    <MemoryRouter>
      <QcStepColumn activeStep="walls" floorId="f1" gate={<button type="button">Tiếp: Cửa và nội thất</button>} projectId="p1" task="Duyệt từng đoạn tường.">
        <p>Hàng đợi tường</p>
      </QcStepColumn>
    </MemoryRouter>,
  );
  return screen.getByRole('navigation', { name: 'Việc của từng bước' });
}

beforeEach(() => {
  review.scale = 'check';
  review.counts = {
    walls: { reviewed: 23, total: 30 },
    objects: { reviewed: 0, total: 39 },
    rooms: { reviewed: 7, total: 7 },
  };
});

describe('QcStepColumn (bố cục L23, đợt 1)', () => {
  it('đầu cột: bước đang làm + câu việc là H1; thân bước và cổng nằm trong cột', () => {
    const tree = renderColumn();

    expect(screen.getByText('Bước 2 · Tường')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Duyệt từng đoạn tường.' })).toBeInTheDocument();
    const active = within(tree).getByRole('region', { name: 'Tường' });
    expect(active).toHaveAttribute('aria-current', 'step');
    expect(within(active).getByText('Hàng đợi tường')).toBeInTheDocument();
    expect(within(active).getByText('7 cần xem')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tiếp: Cửa và nội thất' })).toBeInTheDocument();
  });

  it('bước khác thu một dòng có tóm tắt và là link sang bước đó', () => {
    const tree = renderColumn();

    expect(within(tree).getByRole('link', { name: /Cửa và nội thất.*39 cần xem/u })).toHaveAttribute('href', expect.stringContaining('/layers/objects'));
    expect(within(tree).getByRole('link', { name: /Phòng.*7 phòng · đã duyệt/u })).toBeInTheDocument();
    expect(within(tree).getByRole('link', { name: /Tỷ lệ.*Tỷ lệ cần kiểm/u })).toBeInTheDocument();
  });

  it('tầng chưa có tỷ lệ: các bước sau Tỷ lệ khoá kèm lý do, không là link', () => {
    review.scale = 'missing';
    const tree = renderColumn();

    const objects = within(tree).getByText('Cửa và nội thất').closest('[aria-disabled="true"]');
    expect(objects).not.toBeNull();
    expect(objects).toHaveTextContent('chờ tỷ lệ');
    expect(within(tree).queryByRole('link', { name: /Cửa và nội thất/u })).toBeNull();
  });
});

describe('QcStepColumn: lệnh Duyệt tầng trong Ctrl K (đợt 7)', () => {
  it('đăng ký "Đi tới bước …" cho bước khác bước đang làm; bỏ bước bị khoá', () => {
    const palette = renderHook(() => useRegisteredScreenCommands());
    renderColumn();
    expect(palette.result.current.map((item) => item.label)).toEqual(['Đi tới bước Tỷ lệ', 'Đi tới bước Cửa và nội thất', 'Đi tới bước Phòng']);
  });

  it('tầng chưa có tỷ lệ: chỉ còn lệnh tới bước Tỷ lệ', () => {
    review.scale = 'missing';
    const palette = renderHook(() => useRegisteredScreenCommands());
    renderColumn();
    expect(palette.result.current.map((item) => item.label)).toEqual(['Đi tới bước Tỷ lệ']);
  });
});

describe('QcDisplayPopover', () => {
  it('một nút "Hiển thị" mở popover gom công tắc lớp; bấm công tắc gọi đúng hàm', () => {
    const onToggle = vi.fn();
    render(<QcDisplayPopover groups={[{ title: 'Lớp của bước', items: [{ key: 'w', label: 'Tim tường', checked: false, onToggle }] }]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Hiển thị' }));
    const dialog = screen.getByRole('dialog', { name: 'Hiển thị trên bản vẽ' });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Tim tường' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('không có công tắc nào thì không vẽ nút', () => {
    const { container } = render(<QcDisplayPopover groups={[{ title: 'Lớp của bước', items: [] }]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('QcStepColumn: màn Xong tầng', () => {
  it('bước Phòng của tầng đã xong: tổng kết + Dựng mô hình 3D; bấm dòng Phòng thì mở lại hàng đợi', () => {
    review.scale = 'confirmed';
    review.counts = { walls: { reviewed: 3, total: 3 }, objects: { reviewed: 0, total: 0 }, rooms: { reviewed: 2, total: 2 } };
    render(
      <MemoryRouter>
        <QcStepColumn activeStep="rooms" floorId="f1" projectId="p1" task="Đặt tên cho từng phòng.">
          <p>Hàng đợi phòng</p>
        </QcStepColumn>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tầng ch-03 đã duyệt xong cả 4 bước.');
    expect(screen.getByText('Bạn đã duyệt những gì')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Dựng mô hình 3D/u }).getAttribute('href')).toBe('/projects/p1/3d');
    expect(screen.queryByText('Hàng đợi phòng')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Phòng/u }));
    expect(screen.getByText('Hàng đợi phòng')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Đặt tên cho từng phòng.');
  });
});
