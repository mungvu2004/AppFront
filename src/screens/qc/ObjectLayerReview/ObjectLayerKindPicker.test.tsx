/** Ô chọn loại cạnh hộp vừa vẽ (wall-review-ux): năm loại + "Khác…", Esc / bấm ngoài đóng. */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { KIND_PICKER_MORE, ObjectLayerKindPicker } from './ObjectLayerKindPicker';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* jsdom không bố trí: khung nhìn 0 × 0 thì ContextMenu kẹp mọi vị trí về 8 px. */
const stubViewport = () => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1440);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(900);
};

function renderPicker() {
  const props = { onPick: vi.fn(), onMore: vi.fn(), onClose: vi.fn() };

  render(<ObjectLayerKindPicker {...props} anchor={{ pointer: { x: 50, y: 60 }, frame: { left: 10, top: 20 } }} boxRect={{ x: 100, y: 40, width: 30 }} />);

  return props;
}

describe('ObjectLayerKindPicker', () => {
  it('liệt kê năm loại + "Khác…", neo cạnh phải hộp', () => {
    stubViewport();
    renderPicker();

    const names = screen.getAllByRole('menuitem').map((item) => item.textContent);

    expect(names).toEqual(['Giường', 'Sofa', 'Bàn ăn', 'Bồn cầu', 'Lavabo', KIND_PICKER_MORE]);
    expect(screen.getByRole('menu').style.left).toBe('148px');
    expect(screen.getByRole('menu').style.top).toBe('60px');
  });

  it('chọn một loại gọi onPick đúng kind + variant; "Khác…" gọi onMore', () => {
    const props = renderPicker();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Bồn cầu' }));
    expect(props.onPick).toHaveBeenCalledWith('sanitaryFixture', 'wc');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sofa' }));
    expect(props.onPick).toHaveBeenLastCalledWith('chair', 'sofa');
    fireEvent.click(screen.getByRole('menuitem', { name: KIND_PICKER_MORE }));
    expect(props.onMore).toHaveBeenCalledTimes(1);
  });

  it('Esc đóng ô, không chọn loại', () => {
    const props = renderPicker();

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onPick).not.toHaveBeenCalled();
  });

  it('bấm ra ngoài (sau khung hình mở) đóng ô', async () => {
    const props = renderPicker();

    await new Promise((resolve) => requestAnimationFrame(resolve));
    fireEvent.click(document.body);
    expect(props.onClose).toHaveBeenCalled();
  });
});
