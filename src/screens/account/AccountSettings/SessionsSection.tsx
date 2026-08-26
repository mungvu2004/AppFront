/**
 * Khối "phiên đăng nhập" của màn `/tai-khoan`. **Khung xương do T2 dựng — phần
 * thân thuộc về T3.**
 *
 * Nửa còn lại của trạng thái 3 (một phần): đọc danh sách phiên hỏng thì dải cảnh báo nằm **trong khối này**, không bao giờ thành dải cảnh báo của cả trang. Không có điểm cuối liệt kê hay thu hồi phiên, nên T3 dựng cổng riêng trong thư mục màn theo khuôn `projectSettingsGateway.ts` (R3).
 *
 * ## Luật của mối nối
 *
 * - Hai tên xuất — `SessionsSection` và `SessionsSectionProps` — đã có nơi nhập
 *   theo, nên **không đổi tên**. Mọi thứ khác trong file này là của T3:
 *   mở rộng `SessionsSectionProps` thoải mái, thêm bao nhiêu trường cũng được, không
 *   phải xin phép ai và không phải sửa file nào của T2.
 * - Khung thẻ — nền `--bg-surface`, bo 12, đệm 20, tiêu đề `<h2>` —
 *   do `AccountSettings.tsx` vẽ sẵn. File này chỉ vẽ **ruột** của thẻ.
 * - Đây là `.tsx` trong `src/screens`, nên `local/no-data-layer-in-view`
 *   cấm nhập `src/api`, `src/store`, `src/domain`, `src/lib/http`
 *   (trừ `import type`). Việc đọc dữ liệu nằm ở hook đi kèm.
 */

export interface SessionsSectionProps {
  /**
   * Câu giữ chỗ của khung xương. T3 xoá trường này khi dựng khối thật —
   * cả file này lẫn hook dựng nó đều thuộc T3, nên không ai khác phải
   * sửa theo.
   */
  readonly stubNote: string;
}

export function SessionsSection({ stubNote }: SessionsSectionProps) {
  return <p className="text-[13px] text-text-secondary">{stubNote}</p>;
}
