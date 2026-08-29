/**
 * Lớp bọc React của `notificationBus` — và không có gì hơn thế.
 *
 * `src/lib/mutations/notificationBus.ts` đã có sẵn toàn bộ luật của thông báo:
 * gộp các lượt cùng loại trong một cửa sổ thời gian, giữ tối đa `maxVisible`, tự
 * bỏ thông báo khi vé hoàn tác hết hạn, và một cơ chế `subscribe` đúng hình dạng
 * `useSyncExternalStore` cần. Không dựng bus thứ hai ở đây (R-64): file này chỉ
 * nối cái đã có vào cây React.
 *
 * ## Vì sao `useSyncExternalStore`
 *
 * Bus là trạng thái NGOÀI React và nó thay đổi từ nơi không phải một lượt render
 * — một lượt xử lý chạy nền xong sau khi màn đã tháo vẫn đẩy thông báo vào đó.
 * `useSyncExternalStore` là cách duy nhất đọc một nguồn như vậy mà không xé đôi
 * ảnh chụp giữa hai cây con, và `bus.list()` trả về ĐÚNG mảng đang giữ (không
 * phải bản sao mới mỗi lượt gọi), nên nó thoả yêu cầu "ảnh chụp ổn định" của
 * hook đó mà không cần bộ nhớ đệm nào.
 *
 * ## Một bus cho cả ứng dụng
 *
 * {@link appNotificationBus} là bus của phiên. Một bus, vì "có thông báo nào
 * đang hiện không" là câu hỏi của cả ứng dụng chứ không của một màn — và vì một
 * lượt chạy nền phải đẩy được thông báo sau khi màn sinh ra nó đã biến mất.
 * Test và story tiêm bus riêng qua tham số để hai lượt kiểm không thấy nhau.
 *
 * Mục 0.4: file này ở `src/hooks`, nên nó KHÔNG nhập component hay screen —
 * `NotificationHost` là nơi gọi, không phải phụ thuộc.
 */

import { useCallback, useSyncExternalStore } from 'react';

import {
  createNotificationBus,
  type Notification,
  type NotificationBus,
  type NotificationInput,
} from '@/lib/mutations/notificationBus';

/** Bus của cả phiên — thứ `NotificationHost` đọc khi không ai tiêm gì khác. */
export const appNotificationBus: NotificationBus = createNotificationBus();

export interface UseNotificationsResult {
  /** Các thông báo đang hiện, cũ trước mới sau — đúng thứ tự bus giữ. */
  readonly notifications: readonly Notification[];
  /** Đẩy một thông báo mới. Danh tính ổn định, nên gọi được từ ngoài lượt render. */
  readonly publish: (input: NotificationInput) => void;
}

/**
 * `const { notifications, publish } = useNotifications()`.
 *
 * @param bus Bus cần đọc. Bỏ trống là {@link appNotificationBus}.
 */
export function useNotifications(bus: NotificationBus = appNotificationBus): UseNotificationsResult {
  const notifications = useSyncExternalStore(bus.subscribe, bus.list, bus.list);

  const publish = useCallback(
    (input: NotificationInput): void => {
      bus.publish(input);
    },
    [bus],
  );

  return { notifications, publish };
}
