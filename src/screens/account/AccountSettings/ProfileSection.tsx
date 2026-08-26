/**
 * Khối "hồ sơ" của màn `/tai-khoan`. **Khung xương do T2 dựng — phần
 * thân thuộc về T4.**
 *
 * Trạng thái 1 (rỗng) và một nửa trạng thái 3 (một phần) thuộc khối này: chưa có ảnh đại diện thì vẽ chữ cái đầu trên nền `--bg-sunken`, chưa có chức danh thì không vẽ dòng chức danh; đang tải ảnh lên là "một phần".
 *
 * ## Luật của mối nối
 *
 * - Hai tên xuất — `ProfileSection` và `ProfileSectionProps` — đã có nơi nhập
 *   theo, nên **không đổi tên**. Mọi thứ khác trong file này là của T4:
 *   mở rộng `ProfileSectionProps` thoải mái, thêm bao nhiêu trường cũng được, không
 *   phải xin phép ai và không phải sửa file nào của T2.
 * - Khung thẻ — nền `--bg-surface`, bo 12, đệm 20, tiêu đề `<h2>` —
 *   do `AccountSettings.tsx` vẽ sẵn. File này chỉ vẽ **ruột** của thẻ.
 * - Đây là `.tsx` trong `src/screens`, nên `local/no-data-layer-in-view`
 *   cấm nhập `src/api`, `src/store`, `src/domain`, `src/lib/http`
 *   (trừ `import type`). Việc đọc dữ liệu nằm ở hook đi kèm.
 */

export interface ProfileSectionProps {
  /**
   * Câu giữ chỗ của khung xương. T4 xoá trường này khi dựng khối thật —
   * cả file này lẫn hook dựng nó đều thuộc T4, nên không ai khác phải
   * sửa theo.
   */
  readonly stubNote: string;
}

export function ProfileSection({ stubNote }: ProfileSectionProps) {
  return <p className="text-[13px] text-text-secondary">{stubNote}</p>;
}
