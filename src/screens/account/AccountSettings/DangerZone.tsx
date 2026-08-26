/**
 * Khối "vùng nguy hiểm" của màn `/tai-khoan`. **Khung xương do T2 dựng — phần
 * thân thuộc về T3.**
 *
 * Việc ở đây A8 không hoàn tác được, nên A9 buộc phải hỏi trước bằng hộp thoại. Esc đóng hộp thoại qua `onClose` của `Modal.Root` (A12) — không tự nghe `keydown`.
 *
 * ## Luật của mối nối
 *
 * - Hai tên xuất — `DangerZone` và `DangerZoneProps` — đã có nơi nhập
 *   theo, nên **không đổi tên**. Mọi thứ khác trong file này là của T3:
 *   mở rộng `DangerZoneProps` thoải mái, thêm bao nhiêu trường cũng được, không
 *   phải xin phép ai và không phải sửa file nào của T2.
 * - Khung thẻ — nền `--bg-surface`, bo 12, đệm 20, tiêu đề `<h2>` —
 *   do `AccountSettings.tsx` vẽ sẵn. File này chỉ vẽ **ruột** của thẻ.
 * - Đây là `.tsx` trong `src/screens`, nên `local/no-data-layer-in-view`
 *   cấm nhập `src/api`, `src/store`, `src/domain`, `src/lib/http`
 *   (trừ `import type`). Việc đọc dữ liệu nằm ở hook đi kèm.
 */

export interface DangerZoneProps {
  /**
   * Câu giữ chỗ của khung xương. T3 xoá trường này khi dựng khối thật —
   * cả file này lẫn hook dựng nó đều thuộc T3, nên không ai khác phải
   * sửa theo.
   */
  readonly stubNote: string;
}

export function DangerZone({ stubNote }: DangerZoneProps) {
  return <p className="text-[13px] text-text-secondary">{stubNote}</p>;
}
