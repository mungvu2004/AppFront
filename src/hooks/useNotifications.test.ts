/**
 * Lớp bọc React của bus thông báo.
 *
 * Test colocated cạnh hook, cùng khuôn `useTransition.test.ts` — `src/hooks`
 * không có thư mục `__tests__`, và dựng một thư mục riêng cho đúng một file là
 * dựng khuôn thứ hai.
 *
 * Điều phải đúng: hook KHÔNG dựng bus thứ hai. Một thông báo đẩy vào bus từ bên
 * ngoài React — đúng cách một lượt chạy nền xong sẽ đẩy — vẫn tới được cây.
 */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { createNotificationBus } from '@/lib/mutations/notificationBus';

import { appNotificationBus, useNotifications } from './useNotifications';

afterEach(() => {
  cleanup();
});

describe('useNotifications', () => {
  it('đọc bus được tiêm, và thấy thông báo đẩy từ NGOÀI React', () => {
    const bus = createNotificationBus();
    const rendered = renderHook(() => useNotifications(bus));

    expect(rendered.result.current.notifications).toEqual([]);

    act(() => {
      bus.publish({ type: 'thu-nghiem', title: 'Đã xong', description: 'Xử lý đã hoàn tất.' });
    });

    expect(rendered.result.current.notifications).toHaveLength(1);
    expect(rendered.result.current.notifications[0]?.title).toBe('Đã xong');
  });

  it('publish của hook đẩy vào ĐÚNG bus đã tiêm, không phải một bus mới', () => {
    const bus = createNotificationBus();
    const rendered = renderHook(() => useNotifications(bus));

    act(() => {
      rendered.result.current.publish({
        type: 'thu-nghiem',
        title: 'Sẽ báo cho bạn khi xử lý xong',
        description: 'Xử lý vẫn chạy khi bạn rời màn này.',
      });
    });

    expect(bus.list()).toHaveLength(1);
    expect(rendered.result.current.notifications).toHaveLength(1);
  });

  it('ngừng nghe khi tháo: thông báo sau đó không làm hook cập nhật nữa', () => {
    const bus = createNotificationBus();
    const rendered = renderHook(() => useNotifications(bus));

    rendered.unmount();

    act(() => {
      bus.publish({ type: 'thu-nghiem', title: 'Muộn', description: 'Đẩy sau khi đã tháo.' });
    });

    // Bus vẫn nhận — nó sống ngoài React; chỉ cây đã tháo là không đọc nữa.
    expect(bus.list()).toHaveLength(1);
  });

  it('không tiêm gì thì đọc bus của cả ứng dụng', () => {
    const rendered = renderHook(() => useNotifications());

    act(() => {
      appNotificationBus.publish({
        type: 'thu-nghiem-ung-dung',
        title: 'Thông báo chung',
        description: 'Đẩy vào bus của phiên.',
      });
    });

    expect(rendered.result.current.notifications.map((item) => item.title)).toContain(
      'Thông báo chung',
    );
  });
});
