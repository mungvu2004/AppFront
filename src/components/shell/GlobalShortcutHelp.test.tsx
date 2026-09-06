/**
 * `GlobalShortcutHelp` đọc registry sống — không danh sách viết tay nào để
 * lệch (K1). Bài kiểm đăng ký fixture thẳng vào `appShortcutRegistry` rồi mở
 * bảng, thay vì dựng lại `UndoShortcuts`: `router.test.tsx` đã kiểm mạch nối
 * '?'/Escape đi qua đúng vỏ ứng dụng bằng cú gõ phím thật; file này kiểm
 * riêng phần dựng của component — nhóm theo phạm vi, bỏ qua `dialog`, và
 * đóng bằng Esc thật.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { appShortcutRegistry } from '@/lib/input/shortcutRegistry';

import { GlobalShortcutHelp } from './GlobalShortcutHelp';

afterEach(() => {
  cleanup();
});

describe('[GlobalShortcutHelp] không mở', () => {
  it('không vẽ gì — không lớp phủ nào đứng chắn màn', () => {
    const { container } = render(<GlobalShortcutHelp isOpen={false} onClose={() => {}} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('[GlobalShortcutHelp] đang mở', () => {
  it('nhóm phím tắt theo phạm vi, bỏ qua phạm vi dialog, bỏ qua binding không có mô tả', () => {
    const disposers = [
      appShortcutRegistry.register({
        id: 'fixture.global',
        combo: 'G',
        scope: 'global',
        description: 'ví dụ phím toàn cục',
        onTrigger: () => {},
      }),
      appShortcutRegistry.register({
        id: 'fixture.canvas',
        combo: 'C',
        scope: 'canvas',
        description: 'ví dụ phím khung nhìn',
        onTrigger: () => {},
      }),
      appShortcutRegistry.register({
        id: 'fixture.dialog',
        combo: 'D',
        scope: 'dialog',
        description: 'không bao giờ được hiện ra',
        onTrigger: () => {},
      }),
      appShortcutRegistry.register({
        id: 'fixture.noDescription',
        combo: 'N',
        scope: 'global',
        onTrigger: () => {},
      }),
    ];

    try {
      render(<GlobalShortcutHelp isOpen onClose={() => {}} />);

      expect(screen.getByText('Toàn cục')).toBeInTheDocument();
      expect(screen.getByText('Khung nhìn 3D')).toBeInTheDocument();
      expect(screen.getByText('ví dụ phím toàn cục')).toBeInTheDocument();
      expect(screen.getByText('ví dụ phím khung nhìn')).toBeInTheDocument();
      expect(screen.queryByText('không bao giờ được hiện ra')).not.toBeInTheDocument();
    } finally {
      for (const dispose of disposers) {
        dispose();
      }
    }
  });

  it('đóng bằng một cú Esc thật, nổi bọt lên registry dùng chung', () => {
    const onClose = vi.fn();

    render(<GlobalShortcutHelp isOpen onClose={onClose} />);

    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('qua được expectAccessible và expectVietnamese', () => {
    const rendered = render(<GlobalShortcutHelp isOpen onClose={() => {}} />);

    expectAccessible(rendered);
    expectVietnamese(rendered);
  });
});
