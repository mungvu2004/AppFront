/**
 * BUG-114 — tooltip phải neo theo vị trí của anchor LÚC HIỆN, không phải lúc bắt đầu chờ:
 * bánh răng của ngăn thông báo nhận focus khi ngăn còn đang trượt vào.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Tooltip } from './Tooltip';

function rect(left: number, top: number): DOMRect {
  return { left, top, right: left + 36, bottom: top + 36, width: 36, height: 36, x: left, y: top, toJSON: () => ({}) };
}

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom đo mọi thứ bằng 0: cho khung nhìn một bề ngang thật để phép đẩy-vào-trong không ép về mép.
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1440);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('đọc lại toạ độ anchor khi hiện (anchor đã trượt tới chỗ cuối)', () => {
    render(
      <Tooltip label="Mở cài đặt">
        <button type="button">gear</button>
      </Tooltip>,
    );
    const anchor = screen.getByRole('button', { name: 'gear' }).parentElement as HTMLElement;
    const spy = vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue(rect(1700, 100));

    fireEvent.focus(screen.getByRole('button', { name: 'gear' }));
    spy.mockReturnValue(rect(500, 100)); // ngăn trượt xong trong lúc chờ 400 ms
    act(() => {
      vi.advanceTimersByTime(400);
    });

    const tip = screen.getByRole('tooltip').parentElement as HTMLElement;
    expect(tip.style.left).toBe('518px'); // 500 + 36 / 2
  });
});
