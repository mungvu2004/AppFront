/**
 * Hai khối của T5: thông báo và phím tắt.
 *
 * Thông báo có thứ để lưu (`port.stage('notifications', …)`); phím tắt
 * thì không — nó chỉ đọc.
 *
 * **Không viết tay danh sách phím tắt.** `ShortcutRegistry` không có API
 * liệt kê: nó chỉ có `findOverlaps()`/`reportOverlaps()`, và hai hàm
 * đó báo trùng lặp chứ không báo toàn bộ. Nguồn đếm được duy nhất là
 * `buildGlobalShortcuts(handlers)`, mỗi mục đã có sẵn `description`
 * tiếng Việt; chuỗi hiển thị của tổ hợp lấy bằng
 * `formatCombo(parseCombo(combo))`.
 *
 * Một trạng thái màn hình thuộc về T5: **7 thu gọn** — hẹp lại thì ma trận
 * thành danh sách sự việc, mỗi mục hai `Toggle`. Và [CẤM TUYỆT ĐỐI]:
 * không tô màu ô nào trong ma trận.
 *
 * ## Mối nối, và vì sao nó chỉ có một chiều
 *
 * `useAccountSettings.ts` (T2) gọi hook này đúng một lần và cắm kết quả
 * thẳng vào view. Hook này **không** nhập ngược lại `useAccountSettings`:
 * làm thế là khép một vòng import mà `pnpm cycles` từ chối. Thứ dùng chung
 * nằm ở `accountDraft.ts`, module thấp nhất của thư mục màn.
 *
 * ## Luật của mối nối
 *
 * - Hai tên xuất — `AccountTablesModel` và `useAccountTables` — cùng các khoá của
 *   `AccountTablesModel` đã có nơi nhập theo. **Không đổi tên, không đổi khoá.**
 *   Mọi thứ bên dưới các khoá đó là của T5.
 * - Thân hàm dưới đây là chỗ giữ chỗ của T2. T5 thay trọn nó, và không
 *   phải sửa file nào của T2 để làm việc đó.
 */

import type { NotificationsSectionProps } from './NotificationsSection';
import type { ShortcutsSectionProps } from './ShortcutsSection';
import type { AccountDraftPort } from './accountDraft';

export interface AccountTablesModel {
  readonly notifications: NotificationsSectionProps;
  readonly shortcuts: ShortcutsSectionProps;
}

export function useAccountTables(port: AccountDraftPort): AccountTablesModel {
  // Xem chú thích cùng chỗ trong `useAccountPreferences.ts`. T5 thay cả thân hàm.
  const isReady = port.saved !== undefined;

  return {
    notifications: { stubNote: isReady ? 'Ma trận thông báo đang được dựng.' : 'Đang đọc thông báo…' },
    shortcuts: { stubNote: 'Khối phím tắt đang được dựng.' },
  };
}
