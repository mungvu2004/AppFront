import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { QcAskCard } from './QcAskCard';
import { ASK_CARD_WIDTH, askCardPlacement, askNavOf } from './qcAsk';

const FRAME = { width: 1400, height: 900 };

describe('askCardPlacement (thẻ hỏi neo cạnh đối tượng)', () => {
  it('đủ chỗ bên phải: đặt sát phải hộp chọn', () => {
    expect(askCardPlacement({ x: 200, y: 300, width: 60, height: 40 }, FRAME).left).toBe(276);
  });

  it('bên phải hết chỗ: lật sang trái', () => {
    const place = askCardPlacement({ x: 1200, y: 300, width: 60, height: 40 }, FRAME);
    expect(place.left).toBe(1200 - 16 - ASK_CARD_WIDTH);
  });

  it('không bên nào đủ: sát mép phải, không tràn khung; đỉnh nằm trong khung', () => {
    const place = askCardPlacement({ x: 100, y: -500, width: 300, height: 40 }, { width: 600, height: 500 });
    expect(place.left).toBe(600 - 12 - ASK_CARD_WIDTH);
    expect(place.top).toBe(60);
    expect(place.maxHeight).toBeLessThanOrEqual(500 - 60 - 72);
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
});
