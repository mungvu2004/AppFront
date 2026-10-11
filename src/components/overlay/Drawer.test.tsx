import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Drawer } from './Drawer';

/** Bề ngang điện thoại: `Drawer` đọc `(max-width: 1023px)` để chọn tấm trượt. */
function emulatePhone(): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(max-width: 1023px)',
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

beforeEach(emulatePhone);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Drawer — tấm trượt điện thoại (B-V1-46)', () => {
  it('ba nút chọn mức nằm trong cây truy cập: một nhóm có tên, aria-pressed, bấm thì đổi mức', () => {
    render(
      <Drawer.Root isOpen label="Bộ lọc" onClose={() => undefined}>
        <p>Nội dung</p>
      </Drawer.Root>,
    );

    const group = screen.getByRole('group', { name: 'Chiều cao tấm trượt' });
    const levels = within(group).getAllByRole('button');

    expect(levels.map((button) => button.getAttribute('aria-label'))).toEqual(['Mức 1', 'Mức 2', 'Mức 3']);
    // Mở mặc định ở mức cao nhất.
    expect(within(group).getByRole('button', { name: 'Mức 3', pressed: true })).toBeInTheDocument();

    fireEvent.click(within(group).getByRole('button', { name: 'Mức 1' }));

    expect(within(group).getByRole('button', { name: 'Mức 1', pressed: true })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Mức 3', pressed: false })).toBeInTheDocument();
  });

  it('mỗi chấm nói việc của nó cho trình đọc màn hình, tên vẫn là "Mức N" (nợ C ND-C2)', () => {
    render(
      <Drawer.Root isOpen label="Bộ lọc" onClose={() => undefined}>
        <p>Nội dung</p>
      </Drawer.Root>,
    );

    const group = screen.getByRole('group', { name: 'Chiều cao tấm trượt' });
    expect(within(group).getByRole('button', { name: 'Mức 1' })).toHaveAccessibleDescription('Thu gọn');
    expect(within(group).getByRole('button', { name: 'Mức 2' })).toHaveAccessibleDescription('Nửa màn hình');
    expect(within(group).getByRole('button', { name: 'Mức 3' })).toHaveAccessibleDescription('Gần toàn màn hình');
  });

  it('không nút nào bị rút khỏi thứ tự Tab — đó là đường bàn phím duy nhất để đổi mức (A12)', () => {
    render(
      <Drawer.Root isOpen label="Bộ lọc" onClose={() => undefined}>
        <p>Nội dung</p>
      </Drawer.Root>,
    );

    for (const button of within(screen.getByRole('group', { name: 'Chiều cao tấm trượt' })).getAllByRole('button')) {
      expect(button).not.toHaveAttribute('tabindex', '-1');
    }
  });
});
