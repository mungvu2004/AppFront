/**
 * Khối "thông báo" của màn `/tai-khoan`. **Khung xương do T2 dựng — phần
 * thân thuộc về T5.**
 *
 * Ma trận sự việc nhân kênh. **Không tô màu ô nào trong ma trận.** Trạng thái 7 (thu gọn) thuộc khối này: hẹp lại thì ma trận thành danh sách sự việc, mỗi mục hai `Toggle`. Lựa chọn lưu qua `port.stage('notifications', …)`.
 *
 * ## Luật của mối nối
 *
 * - Hai tên xuất — `NotificationsSection` và `NotificationsSectionProps` — đã có nơi nhập
 *   theo, nên **không đổi tên**. Mọi thứ khác trong file này là của T5:
 *   mở rộng `NotificationsSectionProps` thoải mái, thêm bao nhiêu trường cũng được, không
 *   phải xin phép ai và không phải sửa file nào của T2.
 * - Khung thẻ — nền `--bg-surface`, bo 12, đệm 20, tiêu đề `<h2>` —
 *   do `AccountSettings.tsx` vẽ sẵn. File này chỉ vẽ **ruột** của thẻ.
 * - Đây là `.tsx` trong `src/screens`, nên `local/no-data-layer-in-view`
 *   cấm nhập `src/api`, `src/store`, `src/domain`, `src/lib/http`
 *   (trừ `import type`). Việc đọc dữ liệu nằm ở hook đi kèm.
 */

export interface NotificationsSectionProps {
  /**
   * Câu giữ chỗ của khung xương. T5 xoá trường này khi dựng khối thật —
   * cả file này lẫn hook dựng nó đều thuộc T5, nên không ai khác phải
   * sửa theo.
   */
  readonly stubNote: string;
}

export function NotificationsSection({ stubNote }: NotificationsSectionProps) {
  return <p className="text-[13px] text-text-secondary">{stubNote}</p>;
}
