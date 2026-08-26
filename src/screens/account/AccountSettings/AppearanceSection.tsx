/**
 * Khối "giao diện" của màn `/tai-khoan`. **Khung xương do T2 dựng — phần
 * thân thuộc về T4.**
 *
 * Chủ đề sáng / tối / theo hệ thống. `useTheme()` chỉ có `{theme, toggle}` và `ThemeMode` không có `system`, nên chủ đề tường minh đi qua action `setTheme` của store — đó là action chứ không phải `set()`, nên `local/no-direct-set` không cản. "Theo hệ thống" giải ra bằng `matchMedia` ngay trong màn (R5). Chủ đề tối dùng đúng bộ token tối, không tự làm tối màu bằng bộ lọc.
 *
 * ## Luật của mối nối
 *
 * - Hai tên xuất — `AppearanceSection` và `AppearanceSectionProps` — đã có nơi nhập
 *   theo, nên **không đổi tên**. Mọi thứ khác trong file này là của T4:
 *   mở rộng `AppearanceSectionProps` thoải mái, thêm bao nhiêu trường cũng được, không
 *   phải xin phép ai và không phải sửa file nào của T2.
 * - Khung thẻ — nền `--bg-surface`, bo 12, đệm 20, tiêu đề `<h2>` —
 *   do `AccountSettings.tsx` vẽ sẵn. File này chỉ vẽ **ruột** của thẻ.
 * - Đây là `.tsx` trong `src/screens`, nên `local/no-data-layer-in-view`
 *   cấm nhập `src/api`, `src/store`, `src/domain`, `src/lib/http`
 *   (trừ `import type`). Việc đọc dữ liệu nằm ở hook đi kèm.
 */

export interface AppearanceSectionProps {
  /**
   * Câu giữ chỗ của khung xương. T4 xoá trường này khi dựng khối thật —
   * cả file này lẫn hook dựng nó đều thuộc T4, nên không ai khác phải
   * sửa theo.
   */
  readonly stubNote: string;
}

export function AppearanceSection({ stubNote }: AppearanceSectionProps) {
  return <p className="text-[13px] text-text-secondary">{stubNote}</p>;
}
