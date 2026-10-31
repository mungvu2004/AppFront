import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PascalTour } from '../PascalTour';
import {
  HINT_BOTTOM_PX,
  HINT_TEXT,
  isSceneReady,
  markDone,
  placeCard,
  requestTour,
  shouldAutoOpen,
  TOUR_KEY,
  TOUR_STEPS,
} from '../tourLogic';

/** Canvas đã có cỡ thật (jsdom đo mọi phần tử 0×0). */
const addCanvas = (width = 1200, height = 800) => {
  const canvas = document.createElement('canvas');
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ width, height } as DOMRect);
  document.body.appendChild(canvas);
  return canvas;
};
const addLoader = () => {
  const loader = document.createElement('div');
  loader.className = 'pascal-loader-2 text-foreground';
  document.body.appendChild(loader);
  return loader;
};
const findHint = () => screen.findByRole('complementary', { name: 'Gợi ý thao tác 3D' });
/** Mở trang khi cảnh đã vẽ xong, rồi mở tour từ nút "Xem hướng dẫn" của gợi ý lần đầu. */
const renderReady = async () => {
  addCanvas();
  render(<PascalTour />);
  fireEvent.click(within(await findHint()).getByRole('button', { name: 'Xem hướng dẫn' }));
  await screen.findByRole('dialog');
};

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  document.querySelectorAll('canvas, [class*="pascal-loader-"]').forEach((el) => el.remove());
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

describe('isSceneReady', () => {
  it('chỉ sẵn sàng khi hết màn chờ và canvas đã có cỡ thật', () => {
    expect(isSceneReady()).toBe(false);
    addCanvas(300, 150);
    expect(isSceneReady()).toBe(false);
    addCanvas();
    const loader = addLoader();
    expect(isSceneReady()).toBe(false);
    loader.remove();
    expect(isSceneReady()).toBe(true);
    // UX-R3 U10: hết màn chờ mà kho cảnh chưa có mô hình thì chưa sẵn sàng.
    expect(isSceneReady(document, () => false)).toBe(false);
  });

  it('UX-R3 U10: màn chờ bị ẩn còn sót trong DOM không tính là đang tải', () => {
    addCanvas();
    const loader = addLoader();
    Object.defineProperty(loader, 'checkVisibility', { value: () => false });
    expect(isSceneReady()).toBe(true);
  });
});



describe('PascalTour', () => {
  it('K47: chưa có cảnh thì chỉ hiện chữ tiến độ; có cảnh thì hiện gợi ý nhỏ, không tự mở tour', async () => {
    const loader = addLoader();
    render(<PascalTour />);
    expect(screen.getByRole('status').textContent).toBe('Đang dựng mô hình 3D…');
    expect(screen.queryByRole('dialog')).toBeNull();
    loader.remove();
    addCanvas();
    const hint = await findHint();
    expect(hint.textContent).toContain(HINT_TEXT);
    // UX-R2 K38: đứng ở cạnh dưới (trên thanh công cụ dưới), không đè mô hình ở đầu cảnh.
    expect(hint.style.bottom).toBe(`${HINT_BOTTOM_PX}px`);
    expect(hint.style.top).toBe('');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.querySelector('[data-pascal-tour]')).toBeNull(); // không phủ tối (<html> chỉ mang cờ 'closed')
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('UX-R3 U10: không có màn chờ Pascal nhưng chưa có mô hình thì vẫn báo đang dựng', async () => {
    addCanvas();
    let model = false;
    const hasModel = () => model;
    render(<PascalTour hasModel={hasModel} />);
    expect(screen.getByRole('status').textContent).toBe('Đang dựng mô hình 3D…');
    model = true;
    await findHint();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('K47: đóng gợi ý thì nhớ, lần sau không hiện lại', async () => {
    addCanvas();
    const { unmount } = render(<PascalTour />);
    fireEvent.click(within(await findHint()).getByRole('button', { name: 'Đóng gợi ý' }));
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(window.localStorage.getItem(TOUR_KEY)).toBe('done');
    unmount();
    render(<PascalTour />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lần đầu hiện bước 1/5 với nhãn đúng, focus vào nút chính', async () => {
    await renderReady();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('false');
    expect(screen.getByText(`1 / ${TOUR_STEPS.length}`)).toBeTruthy();
    expect(screen.getByRole('heading', { name: TOUR_STEPS[0]?.title })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tiếp theo' }));
  });

  it('Tiếp theo / Quay lại đổi bước; bước cuối là Xong và ghi done', async () => {
    await renderReady();
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

  it('Esc đóng, ghi done và không chặn sự kiện Esc của nơi khác', async () => {
    const other = vi.fn();
    window.addEventListener('keydown', other);
    await renderReady();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.localStorage.getItem(TOUR_KEY)).toBe('done');
    expect(other).toHaveBeenCalled();
    window.removeEventListener('keydown', other);
  });

  it('đã xem thì không hiện gợi ý; yêu cầu xem lại mở từ bước 1', async () => {
    window.localStorage.setItem(TOUR_KEY, 'done');
    addCanvas();
    render(<PascalTour />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('complementary')).toBeNull();
    act(() => requestTour());
    expect(screen.getByText(`1 / ${TOUR_STEPS.length}`)).toBeTruthy();
  });
});

describe('T-11 — thẻ tour 3D cùng hình thức thẻ QC', () => {
  it('bỏ qua là nút ghost (không link gạch chân), có gợi ý Esc, chấm hiện tại dài hơn', async () => {
    await renderReady();
    const skip = screen.getByRole('button', { name: 'Bỏ qua hướng dẫn' });
    expect(skip.className).toContain('pascal-tour-ghost');
    expect(screen.getByText('Bấm Esc để đóng hướng dẫn.')).toBeTruthy();
    const current = screen.getByRole('dialog').querySelector('[data-current="true"]') as HTMLElement | null;
    expect(current?.style.width).toBe('16px');
  });
});
