/**
 * Khối "phím tắt" của màn `/tai-khoan`. **Khung xương do T2 dựng — phần
 * thân thuộc về T5.**
 *
 * **Không viết tay danh sách phím tắt.** `ShortcutRegistry` không có API liệt kê, nên nguồn đếm được duy nhất là `buildGlobalShortcuts(handlers)`; chuỗi hiển thị của một tổ hợp lấy bằng `formatCombo(parseCombo(combo))`. Khối này chỉ đọc, không lưu gì.
 *
 * ## Luật của mối nối
 *
 * - Hai tên xuất — `ShortcutsSection` và `ShortcutsSectionProps` — đã có nơi nhập
 *   theo, nên **không đổi tên**. Mọi thứ khác trong file này là của T5:
 *   mở rộng `ShortcutsSectionProps` thoải mái, thêm bao nhiêu trường cũng được, không
 *   phải xin phép ai và không phải sửa file nào của T2.
 * - Khung thẻ — nền `--bg-surface`, bo 12, đệm 20, tiêu đề `<h2>` —
 *   do `AccountSettings.tsx` vẽ sẵn. File này chỉ vẽ **ruột** của thẻ.
 * - Đây là `.tsx` trong `src/screens`, nên `local/no-data-layer-in-view`
 *   cấm nhập `src/api`, `src/store`, `src/domain`, `src/lib/http`
 *   (trừ `import type`). Việc đọc dữ liệu nằm ở hook đi kèm.
 */

export interface ShortcutsSectionProps {
  /**
   * Câu giữ chỗ của khung xương. T5 xoá trường này khi dựng khối thật —
   * cả file này lẫn hook dựng nó đều thuộc T5, nên không ai khác phải
   * sửa theo.
   */
  readonly stubNote: string;
}

export function ShortcutsSection({ stubNote }: ShortcutsSectionProps) {
  return <p className="text-[13px] text-text-secondary">{stubNote}</p>;
}
