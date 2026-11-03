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
  return screen.getByRole('region', { name: 'Tường' });
}

beforeEach(() => {
  review.scale = 'check';
  review.counts = {
    walls: { reviewed: 23, total: 30 },
    objects: { reviewed: 0, total: 39 },
    rooms: { reviewed: 7, total: 7 },
  };
});

describe('QcStepColumn (bố cục L23, kiểu bảng lớp Figma)', () => {
  it('đầu cột một dòng: H1 ngắn + chip "N cần xem"; câu việc là dòng phụ; thân và cổng nằm trong cột', () => {
    const active = renderColumn();

    expect(active).toHaveAttribute('aria-current', 'step');
    expect(within(active).getByRole('heading', { level: 1, name: 'Duyệt tường' })).toBeInTheDocument();
    expect(within(active).getByText('7 cần xem')).toBeInTheDocument();
    expect(within(active).getByText('Duyệt từng đoạn tường.')).toBeInTheDocument();
    expect(within(active).getByText('Hàng đợi tường')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tiếp: Cửa và nội thất' })).toBeInTheDocument();
  });

  it('không còn cây 4 bước trong cột (tiến độ các bước ở thanh bước QcFloorNav)', () => {
    renderColumn();

    expect(screen.queryByRole('navigation', { name: 'Việc của từng bước' })).toBeNull();
    expect(screen.queryByRole('link', { name: /Cửa và nội thất/u })).toBeNull();
  });

  it('H1 lấy từ `title` khi màn truyền; bước xong thì chip "N đoạn · đã duyệt"', () => {
    review.counts = { ...review.counts!, walls: { reviewed: 30, total: 30 } };
    render(
      <MemoryRouter>
        <QcStepColumn activeStep="walls" floorId="f1" projectId="p1" task="Xem từng đoạn tường." title="Xem tường">
          <p>Hàng đợi tường</p>
        </QcStepColumn>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Xem tường' })).toBeInTheDocument();
    expect(screen.getByText('30 đoạn · đã duyệt')).toBeInTheDocument();
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
  it('bước Phòng của tầng đã xong: tổng kết + Dựng mô hình 3D; nút nhỏ ở đầu cột mở lại hàng đợi', () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Mở lại bước Phòng' }));
    expect(screen.getByText('Hàng đợi phòng')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Đặt tên phòng');
    expect(screen.getByText('Đặt tên cho từng phòng.')).toBeTruthy();
  });
});

describe('QcDisplayPopover: bản "Lọc" của cột việc', () => {
  it('nhãn riêng + đếm công tắc đang bật trong tên nút', () => {
    render(
      <QcDisplayPopover
        groups={[{ title: 'Lọc danh sách', items: [{ key: 'u', label: 'Chỉ hiện chưa duyệt', checked: true, onToggle: vi.fn() }] }]}
        label="Lọc"
        popoverLabel="Lọc danh sách"
        showActiveCount
        variant="flat"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Lọc.*1 đang bật$/u }));
    expect(within(screen.getByRole('dialog', { name: 'Lọc danh sách' })).getByRole('checkbox', { name: 'Chỉ hiện chưa duyệt' })).toBeChecked();
  });
});
