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

import { Toast, type ToastMessage } from './Toast';

/** Nhãn vùng thông báo — bản sao khai báo ở `vi.json` khoá `notifications`. */
const REGION_ARIA_LABEL = 'Thông báo';

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
    ...(ticket !== undefined
      ? {
          onUndo: (): void => {
            ticket.undo();
          },
        }
      : {}),
  };
}

export interface NotificationHostProps {
  /** Bus cần vẽ. Bỏ trống là bus của cả phiên — xem `useNotifications`. */
  readonly bus?: NotificationBus;
}

/** `<NotificationHost />` — đặt một lần, cạnh `<RouterProvider>`. */
export function NotificationHost({ bus }: NotificationHostProps) {
  const { notifications } = useNotifications(bus);
  const [dismissedIds, setDismissedIds] = useState<readonly string[]>([]);

  // Tỉa: một mã đã tắt mà bus cũng không còn giữ thì không cần nhớ nữa. Trả về
  // đúng mảng cũ khi không có gì đổi, nên không có vòng cập nhật nào.
  useEffect(() => {
    setDismissedIds((previous) => {
      const live = previous.filter((id) => notifications.some((item) => item.id === id));
      return live.length === previous.length ? previous : live;
    });
  }, [notifications]);

  const dismiss = useCallback((id: string) => {
    setDismissedIds((previous) => (previous.includes(id) ? previous : [...previous, id]));
  }, []);

  // Mới nhất lên trước: `Toast.Item` vẽ đầy đủ ô đầu tiên và thu các ô sau thành
  // vạch hé, còn bus giữ danh sách cũ-trước-mới-sau.
  const visible = notifications.filter((item) => !dismissedIds.includes(item.id)).reverse();

  return (
    <div
      aria-label={REGION_ARIA_LABEL}
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col-reverse items-end gap-2"
      role="region"
    >
      {visible.map((notification, index) => (
        <Toast.Item
          index={index}
          key={notification.id}
          onRemove={dismiss}
          toast={toToastMessage(notification)}
        />
      ))}
    </div>
  );
}

NotificationHost.displayName = 'NotificationHost';
