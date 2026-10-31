/**
 * Chỗ thông báo được VẼ RA trên cây route thật.
 *
 * Trước file này, `src/lib/mutations/notificationBus.ts` có đủ luật của thông
 * báo và có test đầy đủ, nhưng không một nơi nào trong `src` gọi tới; còn
 * `Toast.tsx` chỉ được `src/App.tsx` — bảng chọn màn demo — gắn. Mà `src/main.tsx`
 * dựng `<RouterProvider>` chứ không dựng `<App />`, nên trên cây route thật
 * KHÔNG có chỗ nào hiện được một thông báo. Đây là chỗ đó.
 *
 * ## Nó dùng lại, không tự chế
 *
 * - Trạng thái: {@link useNotifications} bọc quanh `notificationBus` đã có. Không
 *   bus thứ hai (R-64).
 * - Hình hài: `Toast.Item` của `Toast.tsx` ngay cạnh đây — đúng ô 320px, đúng
 *   thanh đếm ngược 2px, đúng `role="status"` + `aria-live="polite"` để trình đọc
 *   màn hình đọc được (R-72). Không dựng một cái toast thứ hai.
 *
 * `Toast.Provider` KHÔNG dùng được ở đây: nó là một provider bọc `children` và
 * mang thêm cầu nối riêng tới `useUndoableToast`. Cái cần ở `main.tsx` là một
 * phần tử đứng cạnh `<RouterProvider>`, không bọc nó.
 *
 * ## Hai quyết định cần nói rõ
 *
 * **Vì sao có danh sách `dismissedIds` cục bộ.** `NotificationBus` khai đúng ba
 * việc — `list`, `publish`, `subscribe` — và không có đường gỡ một thông báo:
 * bus chỉ tự gỡ khi vé hoàn tác hết hạn, nên một thông báo KHÔNG có vé sẽ nằm lại
 * trong danh sách. `Toast.Item` tự đếm ngược rồi gọi `onRemove`, và câu trả lời
 * cho lời gọi đó là việc của nơi trình bày. `dismissedIds` là trạng thái của
 * riêng khung nhìn, không phải một bus thứ hai: nó không giữ nội dung thông báo
 * nào, và nó được tỉa lại theo đúng những gì bus còn giữ.
 *
 * **Vì sao mọi thông báo đều là `attention`.** A5: xanh "đã xác minh" CHỈ đánh
 * dấu việc người duyệt, và không thứ gì máy tự làm được phép đặt nó — mà mặc
 * định của `Toast.Item` khi `state` bỏ trống lại đúng là xanh đó. Còn
 * `NotificationInput` không mang trường mức độ nào, và `notificationBus.ts` nằm
 * ngoài phạm vi được sửa, nên nơi này KHÔNG có cách biết một thông báo là hỏng
 * hay xong. Cả ba màu trạng thái đều chỉ có ba (A4); chọn `attention` là câu trả
 * lời trung thực duy nhất: "có việc cần bạn ngó tới". Mức độ thật nằm trong CÂU
 * của thông báo.
 */

import { useCallback, useEffect, useState } from 'react';

import { useNotifications } from '@/hooks/useNotifications';
import type { Notification, NotificationBus } from '@/lib/mutations/notificationBus';

import { OFFLINE_NOTICE } from './offlineNotice';
import { Toast, type ToastMessage } from './Toast';

/** Tiêu đề và câu mô tả ghép thành một dòng, vì `ToastMessage` chỉ có một ô chữ. */
const JOINER = ' — ';

function toToastMessage(notification: Notification): ToastMessage {
  const hasExtraSentence =
    notification.description.length > 0 && notification.description !== notification.title;
  const ticket = notification.undoTicket;

  return {
    id: notification.id,
    message: hasExtraSentence
      ? `${notification.title}${JOINER}${notification.description}`
      : notification.title,
    state: 'attention',
    ...(notification.action !== undefined ? { action: notification.action } : {}),
    ...(ticket !== undefined
      ? {
          onUndo: (): void => {
            ticket.undo();
          },
          ...(ticket.ttlMs === undefined ? {} : { windowMs: ticket.ttlMs }),
        }
      : {}),
  };
}


const keyOf = (item: Notification): string => `${item.id}\u0000${item.title}\u0000${item.description}`;

export interface NotificationHostProps {
  /** Bus cần vẽ. Bỏ trống là bus của cả phiên — xem `useNotifications`. */
  readonly bus?: NotificationBus;
}

/** `<NotificationHost />` — đặt một lần, cạnh `<RouterProvider>`. */
export function NotificationHost({ bus }: NotificationHostProps) {
  const { notifications, publish } = useNotifications(bus);

  useEffect(() => {
    const onOffline = (): void => {
      publish({ ...OFFLINE_NOTICE, type: 'network-offline' });
    };

    window.addEventListener('offline', onOffline);

    return () => window.removeEventListener('offline', onOffline);
  }, [publish]);
  // Khoá theo id + chữ: bus gộp lượt cùng loại vào thông báo cũ (cùng id, chữ mới).
  // Nếu chỉ nhớ id, một lỗi mới gộp vào thông báo ĐÃ tắt sẽ vô hình (FL-11F-03).
  const [dismissedKeys, setDismissedKeys] = useState<readonly string[]>([]);

  // Tỉa: một khoá đã tắt mà bus cũng không còn giữ thì không cần nhớ nữa. Trả về
  // đúng mảng cũ khi không có gì đổi, nên không có vòng cập nhật nào.
  useEffect(() => {
    setDismissedKeys((previous) => {
      const live = previous.filter((key) => notifications.some((item) => keyOf(item) === key));
      return live.length === previous.length ? previous : live;
    });
  }, [notifications]);

  const dismiss = useCallback(
    (id: string) => {
      const target = notifications.find((item) => item.id === id);
      if (target === undefined) return;
      const key = keyOf(target);
      setDismissedKeys((previous) => (previous.includes(key) ? previous : [...previous, key]));
    },
    [notifications],
  );

  // Mới nhất lên trước: `Toast.Item` vẽ đầy đủ ô đầu tiên và thu các ô sau thành
  // vạch hé, còn bus giữ danh sách cũ-trước-mới-sau.
  const visible = notifications.filter((item) => !dismissedKeys.includes(keyOf(item))).reverse();

  return (
    // `Toast.Viewport` tránh ngăn đang mở, nơi có "Xem tất cả" (BUG-227).
    <Toast.Viewport>
      {visible.map((notification, index) => (
        <Toast.Item
          index={index}
          key={keyOf(notification)}
          onRemove={dismiss}
          toast={toToastMessage(notification)}
        />
      ))}
    </Toast.Viewport>
  );
}

NotificationHost.displayName = 'NotificationHost';
