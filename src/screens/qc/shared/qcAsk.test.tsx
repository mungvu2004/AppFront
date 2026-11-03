import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { QcAskAnchor, QcAskCard, QcQueueAskCard } from './QcAskCard';
import { QcInspectorEmpty, QcInspectorSection } from './QcInspectorSection';
import { askNavOf, rectInFrame } from './qcAsk';
import { focusBoundsOf, focusFrameOf } from './qcViewMode';

const FRAME = { width: 1400, height: 900 };

describe('focusFrameOf / focusBoundsOf (Từng việc)', () => {
  it('panel chi tiết neo ngoài bản vẽ: không chừa dải nào, trả nguyên khung', () => {
    expect(focusFrameOf(FRAME)).toEqual(FRAME);
  });

  it('đoạn ngắn: nới mỗi phía 10 % cạnh dài của tầng', () => {
    const box = focusBoundsOf({ x: 500, y: 500, width: 10, height: 4 }, { x: 0, y: 0, width: 1000, height: 800 });
    expect(box).toEqual({ x: 400, y: 400, width: 210, height: 204 });
  });

  it('đoạn dài: nới mỗi phía nửa chiều dài của nó', () => {
    const box = focusBoundsOf({ x: 100, y: 300, width: 600, height: 20 }, { x: 0, y: 0, width: 1000, height: 800 });
    expect(box).toEqual({ x: -200, y: 0, width: 1200, height: 620 });
  });
});

describe('askNavOf ("k trong N", ‹ K / › J)', () => {
  const items = [
    { id: 'a', pending: false },
    { id: 'b', pending: true },
    { id: 'c', pending: true },
    { id: 'd', pending: true },
  ];

  it('đếm và hai mục kề trong số mục còn cần xem', () => {
    expect(askNavOf(items, 'c')).toEqual({ position: 2, total: 3, prevId: 'b', nextId: 'd' });
  });

  it('mục đã duyệt: không có vị trí, J sang mục cần xem đầu tiên', () => {
    expect(askNavOf(items, 'a')).toEqual({ position: null, total: 3, prevId: null, nextId: 'b' });
  });
});

describe('QcAskCard', () => {
  it('đầu panel: mã + huy hiệu, dòng mờ vị trí; ‹ K / › J gọi đúng hàm, tắt khi không có mục kề', () => {
    const onNext = vi.fn();
    render(
      <QcAskCard
        badge={<span>Cần xem</span>}
        code="#W-004"
        display={<button type="button">Hiển thị</button>}
        eyebrow="Đoạn 1 trong 7 cần xem"
        footer={<button type="button">Duyệt</button>}
        onNext={onNext}
      >
        <div>Thanh tra</div>
      </QcAskCard>,
    );

    const card = screen.getByRole('region', { name: 'Chi tiết mục đang chọn' });
    expect(card).toHaveTextContent('Hiển thị#W-004Cần xemĐoạn 1 trong 7 cần xemThanh traDuyệt');
    expect(screen.getByText('Duyệt').closest('footer')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Mục kế tiếp' })).toHaveAttribute('aria-keyshortcuts', 'J');
    expect(screen.getByRole('button', { name: 'Mục trước' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Mục kế tiếp' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('dòng lý do chỉ có khi có lý do', () => {
    const { rerender } = render(
      <QcAskCard eyebrow="Mục 1 trong 3 cần xem">
        <div>Thanh tra</div>
      </QcAskCard>,
    );
    expect(screen.queryByText('Ngắn hơn bề dày tường')).toBeNull();
    rerender(
      <QcAskCard eyebrow="Mục 1 trong 3 cần xem" reason="Ngắn hơn bề dày tường">
        <div>Thanh tra</div>
      </QcAskCard>,
    );
    expect(screen.getByText('Ngắn hơn bề dày tường')).toBeInTheDocument();
  });
});

describe('rectInFrame (thẻ đứng ngoài lớp phóng)', () => {
  it('đổi hộp ở lớp `translate(offset) scale(s)` quanh tâm khung ra toạ độ khung', () => {
    const view = { scale: 2, offset: { x: 10, y: -20 }, width: 1000, height: 600 };
    expect(rectInFrame({ x: 600, y: 300, width: 40, height: 20 }, view)).toEqual({ x: 710, y: 280, width: 80, height: 40 });
  });
});

describe('QcAskCard: nút đóng', () => {
  it('có `onClose` thì hiện nút "Bỏ chọn" (Esc) và bấm gọi đúng hàm', () => {
    const onClose = vi.fn();
    render(<QcAskCard eyebrow="Mục 1 trong 2 cần xem" onClose={onClose}>thân</QcAskCard>);
    expect(screen.getByRole('button', { name: 'Bỏ chọn' })).toHaveAttribute('aria-keyshortcuts', 'Escape');
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ chọn' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('QcAskAnchor (shim chuyển tiếp)', () => {
  it('không vẽ gì trên bản vẽ nữa: panel đã neo ở QcWorkspace', () => {
    const { container } = render(<QcAskAnchor rect={{ x: 0, y: 0, width: 1, height: 1 }}>thẻ</QcAskAnchor>);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('QcQueueAskCard', () => {
  it('giữ "k trong N" và nhận thêm mã/chân', () => {
    render(
      <QcQueueAskCard
        code="#W-002"
        footer={<span>chân</span>}
        items={[{ id: 'a', pending: true }, { id: 'b', pending: true }]}
        onSelect={() => {}}
        selectedId="b"
        unit="Đoạn"
      >
        thân
      </QcQueueAskCard>,
    );
    expect(screen.getByRole('region', { name: 'Chi tiết mục đang chọn' })).toHaveTextContent('#W-002Đoạn 2 trong 2 cần xemthânchân');
  });
});

describe('QcInspectorEmpty / QcInspectorSection', () => {
  it('chưa chọn: tiêu đề là tên vùng, có gợi ý và mục', () => {
    render(
      <QcInspectorEmpty hint="Chọn một đoạn tường để duyệt." title="Tầng này">
        <QcInspectorSection title="Chú giải">dòng</QcInspectorSection>
      </QcInspectorEmpty>,
    );
    expect(screen.getByRole('region', { name: 'Tầng này' })).toHaveTextContent('Tầng nàyChọn một đoạn tường để duyệt.Chú giảidòng');
  });

  it('mục gập được: defaultOpen=false thì thân ẩn tới khi bấm tiêu đề; action ở cuối dòng tiêu đề', () => {
    render(
      <QcInspectorSection action={<button type="button">Thêm</button>} collapsible defaultOpen={false} title="Thông số nâng cao">
        <div>thân mục</div>
      </QcInspectorSection>,
    );
    const toggle = screen.getByRole('button', { name: 'Thông số nâng cao' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('thân mục')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByText('thân mục')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm' })).toBeInTheDocument();
  });
});
