/**
 * Hằng chung của bố cục Duyệt tầng (L23, kế hoạch `ui-review/research/bo-cuc-5/L23/KE-HOACH-APPFRONT.md`):
 * cột việc 360 px bên trái (câu việc · cây 4 bước · cổng ở đáy), bản vẽ chiếm phần còn lại, chrome nổi.
 * Từ 29/10/2026 đây là bố cục duy nhất của Tỷ lệ · Tường · Cửa và nội thất · Phòng (đã gỡ cờ `qc-layout`).
 */

/** Nhóm lệnh của Duyệt tầng trong bảng lệnh Ctrl K (`useScreenCommands`). */
export const QC_COMMAND_GROUP = 'Duyệt tầng';

/** Dưới 1024 cột việc là ngăn kéo phủ từ trái mép khung làm việc (`QcColumnHandle` mở, `QcColumnScrim` đóng). */
export const QC_COLUMN_ID = 'qc-step-column';
export const QC_COLUMN_DRAWER_CLASS =
  'max-lg:absolute max-lg:bottom-2 max-lg:left-2 max-lg:top-2 max-lg:z-40 max-lg:w-[min(360px,calc(100%-4rem))] max-lg:rounded-xl max-lg:shadow-overlay';
