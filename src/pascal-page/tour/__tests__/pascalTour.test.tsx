import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PascalTour } from '../PascalTour';
import { markDone, placeCard, requestTour, shouldAutoOpen, TOUR_KEY, TOUR_STEPS } from '../tourLogic';

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
});

describe('tourLogic', () => {
  it('lần đầu bật, sau khi đánh dấu thì không', () => {
    expect(shouldAutoOpen()).toBe(true);
    markDone();
    expect(window.localStorage.getItem(TOUR_KEY)).toBe('done');
    expect(shouldAutoOpen()).toBe(false);
  });

  it('bộ nhớ bị chặn: không bật và không ném lỗi', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(shouldAutoOpen(blocked)).toBe(false);
    expect(shouldAutoOpen(null)).toBe(false);
    expect(() => markDone(blocked)).not.toThrow();
  });

  it('không có neo thì thẻ nằm giữa dưới, trong khung nhìn', () => {
    const p = placeCard(null, 200, 1000, 700);
    expect(p.left).toBe(340);
    expect(p.top + 200).toBeLessThanOrEqual(700);
  });

  it('neo là cả canvas thì thẻ về góc phải, chừa dải dưới cho dock', () => {
    const p = placeCard({ left: 0, top: 0, width: 768, height: 1024 }, 200, 768, 1024);
    expect(p.top + 200).toBeLessThanOrEqual(1024 - 96);
  });
});

describe('PascalTour', () => {
  it('lần đầu hiện bước 1/5 với nhãn đúng, focus vào nút chính', () => {
    render(<PascalTour />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('false');
    expect(screen.getByText(`1 / ${TOUR_STEPS.length}`)).toBeTruthy();
    expect(screen.getByRole('heading', { name: TOUR_STEPS[0]?.title })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tiếp theo' }));
  });

  it('Tiếp theo / Quay lại đổi bước; bước cuối là Xong và ghi done', () => {
    render(<PascalTour />);
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp theo' }));
    expect(screen.getByText(`2 / ${TOUR_STEPS.length}`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
    expect(screen.getByText(`1 / ${TOUR_STEPS.length}`)).toBeTruthy();
    for (let i = 1; i < TOUR_STEPS.length; i++) fireEvent.click(screen.getByRole('button', { name: 'Tiếp theo' }));
    expect(screen.queryByRole('button', { name: 'Bỏ qua hướng dẫn' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Xong' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.localStorage.getItem(TOUR_KEY)).toBe('done');
  });

  it('Esc đóng, ghi done và không chặn sự kiện Esc của nơi khác', () => {
    const other = vi.fn();
    window.addEventListener('keydown', other);
    render(<PascalTour />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.localStorage.getItem(TOUR_KEY)).toBe('done');
    expect(other).toHaveBeenCalled();
    window.removeEventListener('keydown', other);
  });

  it('đã xem thì không tự bật; yêu cầu xem lại mở từ bước 1', () => {
    window.localStorage.setItem(TOUR_KEY, 'done');
    render(<PascalTour />);
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => requestTour());
    expect(screen.getByText(`1 / ${TOUR_STEPS.length}`)).toBeTruthy();
  });
});

describe('T-11 — thẻ tour 3D cùng hình thức thẻ QC', () => {
  it('bỏ qua là nút ghost (không link gạch chân), có gợi ý Esc, chấm hiện tại dài hơn', () => {
    render(<PascalTour />);
    const skip = screen.getByRole('button', { name: 'Bỏ qua hướng dẫn' });
    expect(skip.className).toContain('pascal-tour-ghost');
    expect(screen.getByText('Bấm Esc để đóng hướng dẫn.')).toBeTruthy();
    const current = screen.getByRole('dialog').querySelector('[data-current="true"]') as HTMLElement | null;
    expect(current?.style.width).toBe('16px');
  });
});
