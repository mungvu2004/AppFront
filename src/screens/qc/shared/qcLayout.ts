/**
 * Cờ bố cục Duyệt tầng L23 (kế hoạch `ui-review/research/bo-cuc-5/L23/KE-HOACH-APPFRONT.md`, đợt 1):
 * cột việc 360 px bên trái (câu việc · cây 4 bước · cổng ở đáy), bản vẽ chiếm phần còn lại, chrome nổi.
 * Bật bằng biến dựng `VITE_QC_LAYOUT=l23`, hoặc tại máy: `localStorage.setItem('qc-layout', 'l23')`.
 * Tắt thì các màn giữ nguyên bố cục cũ (`QcWorkspace`) cho tới khi đợt cuối gỡ cờ.
 */
export const QC_LAYOUT_STORAGE_KEY = 'qc-layout';
const L23 = 'l23';

/** Nhóm lệnh của Duyệt tầng trong bảng lệnh Ctrl K (`useScreenCommands`). */
export const QC_COMMAND_GROUP = 'Duyệt tầng';

/** Dưới 1024 cột việc là ngăn kéo phủ từ trái mép khung làm việc (`QcColumnHandle` mở, `QcColumnScrim` đóng). */
export const QC_COLUMN_ID = 'qc-step-column';
export const QC_COLUMN_DRAWER_CLASS =
  'max-lg:absolute max-lg:bottom-2 max-lg:left-2 max-lg:top-2 max-lg:z-40 max-lg:w-[min(360px,calc(100%-4rem))] max-lg:rounded-xl max-lg:shadow-overlay';

export function isL23Layout(): boolean {
  if (import.meta.env.VITE_QC_LAYOUT === L23) return true;
  try {
    return globalThis.localStorage?.getItem(QC_LAYOUT_STORAGE_KEY) === L23;
  } catch {
    /* Trình duyệt chặn lưu trữ: coi như tắt. */
    return false;
  }
}
