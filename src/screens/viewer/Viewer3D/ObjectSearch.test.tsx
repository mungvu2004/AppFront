/**
 * Ctrl+F thật, đi qua `shortcutRegistry` — không gọi thẳng `onOpen`.
 *
 * `registry` là chỗ tiêm của `ObjectSearchProps` (xem docblock đầu
 * `ObjectSearch.tsx`): mỗi bài kiểm dựng một `ShortcutRegistry` riêng, nên
 * không tổ hợp nào rò rỉ sang bài kiểm khác — khác `PropertyInspector.test.tsx`,
 * nơi cả bộ dùng `appShortcutRegistry` dùng chung vì đang kiểm đúng cái vỏ bọc
 * cả ứng dụng.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createShortcutRegistry } from '@/lib/input/shortcutRegistry';

import { OPEN_SEARCH_LABEL, ObjectSearch } from './ObjectSearch';
import type { ViewerRoomOption } from './roomSearch';

afterEach(() => {
  cleanup();
});

const ROOMS: readonly ViewerRoomOption[] = [
  { id: 'R-001', name: 'Phòng ngủ 1', storeyName: 'Tầng 1', areaLabel: '18,40 m²' },
];

describe('[ObjectSearch] Ctrl+F', () => {
  it('mở ô tìm bằng một cú Ctrl+F thật, nổi bọt lên registry đã tiêm', () => {
    const registry = createShortcutRegistry({ isDev: false });
    const onOpen = vi.fn();

    render(
      <ObjectSearch
        isOpen={false}
        onClose={() => {}}
        onOpen={onOpen}
        onSelectRoom={() => {}}
        registry={registry}
        rooms={ROOMS}
        selectedRoomId={null}
      />,
    );

    expect(screen.getByRole('button', { name: OPEN_SEARCH_LABEL })).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: 'f', ctrlKey: true });

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('không mở khi Ctrl+F được gõ trong một ô nhập khác — registry tắt phím tắt khi đang gõ chữ', () => {
    const registry = createShortcutRegistry({ isDev: false });
    const onOpen = vi.fn();

    render(
      <div>
        <input aria-label="tên dự án" />
        <ObjectSearch
          isOpen={false}
          onClose={() => {}}
          onOpen={onOpen}
          onSelectRoom={() => {}}
          registry={registry}
          rooms={ROOMS}
          selectedRoomId={null}
        />
      </div>,
    );

    fireEvent.keyDown(screen.getByLabelText('tên dự án'), { key: 'f', ctrlKey: true });

    expect(onOpen).not.toHaveBeenCalled();
  });

  it('gỡ đăng ký khi rời cây: Ctrl+F sau khi unmount không còn gọi onOpen', () => {
    const registry = createShortcutRegistry({ isDev: false });
    const onOpen = vi.fn();

    const { unmount } = render(
      <ObjectSearch
        isOpen={false}
        onClose={() => {}}
        onOpen={onOpen}
        onSelectRoom={() => {}}
        registry={registry}
        rooms={ROOMS}
        selectedRoomId={null}
      />,
    );

    unmount();

    fireEvent.keyDown(document.body, { key: 'f', ctrlKey: true });

    expect(onOpen).not.toHaveBeenCalled();
  });
});
