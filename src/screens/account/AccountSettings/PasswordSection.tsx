/**
 * Khối "mật khẩu" của màn `/tai-khoan`. **Khung xương do T2 dựng — phần
 * thân thuộc về T3.**
 *
 * Trạng thái 4 (lỗi) và trạng thái 6 (không có quyền) thuộc khối này: mật khẩu cũ sai thì lỗi buộc vào đúng ô đó, còn tài khoản đăng nhập bằng SSO thì cả khối chỉ đọc kèm câu "Do quản trị viên công ty quản lý.". **Mật khẩu không bao giờ đi qua bộ tự lưu** — vì thế `useAccountAuth` không nhận `AccountDraftPort`. `PasswordSchema` chỉ ràng buộc độ dài tối thiểu 8; không có luật chữ-cộng-số nào trong `src/api/schemas`.
 *
 * ## Luật của mối nối
 *
 * - Hai tên xuất — `PasswordSection` và `PasswordSectionProps` — đã có nơi nhập
 *   theo, nên **không đổi tên**. Mọi thứ khác trong file này là của T3:
 *   mở rộng `PasswordSectionProps` thoải mái, thêm bao nhiêu trường cũng được, không
 *   phải xin phép ai và không phải sửa file nào của T2.
 * - Khung thẻ — nền `--bg-surface`, bo 12, đệm 20, tiêu đề `<h2>` —
 *   do `AccountSettings.tsx` vẽ sẵn. File này chỉ vẽ **ruột** của thẻ.
 * - Đây là `.tsx` trong `src/screens`, nên `local/no-data-layer-in-view`
 *   cấm nhập `src/api`, `src/store`, `src/domain`, `src/lib/http`
 *   (trừ `import type`). Việc đọc dữ liệu nằm ở hook đi kèm.
 */

export interface PasswordSectionProps {
  /**
   * Câu giữ chỗ của khung xương. T3 xoá trường này khi dựng khối thật —
   * cả file này lẫn hook dựng nó đều thuộc T3, nên không ai khác phải
   * sửa theo.
   */
  readonly stubNote: string;
}

export function PasswordSection({ stubNote }: PasswordSectionProps) {
  return <p className="text-[13px] text-text-secondary">{stubNote}</p>;
}
