import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { QcAskAnchor, QcAskCard } from './QcAskCard';
import { ASK_CARD_WIDTH, ASK_CARD_WIDTH_NARROW, askCardPlacement, askCardWidthFor, askNavOf, rectInFrame } from './qcAsk';
import { focusBoundsOf, focusFrameOf } from './qcViewMode';

const FRAME = { width: 1400, height: 900 };

describe('askCardPlacement (thẻ hỏi neo mép phải khung)', () => {
  it('sát mép phải, dưới nút Hiển thị; cao tới trên cụm thu phóng', () => {
    expect(askCardPlacement(FRAME)).toEqual({ left: 1400 - 12 - ASK_CARD_WIDTH, top: 60, maxHeight: 900 - 60 - 72 });
  });

  it('khung thấp: vẫn chừa tối thiểu 160 px cho thẻ', () => {
    expect(askCardPlacement({ width: 600, height: 200 }).maxHeight).toBe(160);
  });

  it('khung hẹp (768 px): thẻ hẹp lại', () => {
    expect(askCardWidthFor(700)).toBe(ASK_CARD_WIDTH_NARROW);
    expect(askCardWidthFor(1400)).toBe(ASK_CARD_WIDTH);
  });
});

describe('focusFrameOf / focusBoundsOf (Từng việc canh mục ngoài dải thẻ)', () => {
  it('dải chừa = rộng thẻ thật + hai lề: thẻ nằm gọn trong dải, không che vùng nhìn', () => {
    const frame = focusFrameOf(FRAME);
    expect(frame.width).toBe(1400 - ASK_CARD_WIDTH - 24);
    expect(frame.width).toBeLessThanOrEqual(askCardPlacement(FRAME).left);
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
  it('đầu thẻ ghi vị trí + mã; ‹ K / › J gọi đúng hàm, tắt khi không có mục kề', () => {
    const onNext = vi.fn();
    render(
      <QcAskCard code="#W-004" eyebrow="Đoạn 1 trong 7 cần xem" onNext={onNext}>
        <div>Thanh tra</div>
      </QcAskCard>,
    );

    const card = screen.getByRole('region', { name: 'Thẻ hỏi của mục đang chọn' });
    expect(card).toHaveTextContent('Đoạn 1 trong 7 cần xem#W-004');
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
  it('có `onClose` thì hiện nút "Đóng thẻ" và bấm gọi đúng hàm', () => {
    const onClose = vi.fn();
    render(<QcAskCard eyebrow="Mục 1 trong 2 cần xem" onClose={onClose}>thân</QcAskCard>);
    fireEvent.click(screen.getByRole('button', { name: 'Đóng thẻ' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('QcAskAnchor', () => {
  it('U20: dưới 1024 px thẻ thành tấm đáy (rộng hết khung, cao tối đa 45 %), không nổi che nửa phải', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(750);
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(800);
    try {
      render(
        <QcAskAnchor rect={{ x: 100, y: 100, width: 40, height: 40 }}>
          <div>Thẻ</div>
        </QcAskAnchor>,
      );
      expect(screen.getByTestId('qc-ask-anchor')).toHaveClass('max-lg:inset-x-2!', 'max-lg:top-auto!', 'max-lg:bottom-2!', 'max-lg:w-auto!', 'max-lg:max-h-[45%]!');
    } finally {
      width.mockRestore();
      height.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
