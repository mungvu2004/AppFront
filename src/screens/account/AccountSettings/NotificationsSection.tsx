/**
 * Khối "thông báo" của màn `/tai-khoan`.
 *
 * Ma trận sự việc nhân kênh: năm hàng, hai cột, mỗi ô một `Checkbox`.
 * Lựa chọn lưu qua `port.stage('notifications', …)` — mối nối tự lưu D-07 mà
 * `useAccountTables` cầm; view này không biết bộ đếm 800 ms nằm ở đâu và không
 * cần biết.
 *
 * ## [CẤM TUYỆT ĐỐI] không tô màu ô nào trong ma trận
 *
 * Và đó là lý do khối này vẽ `<table>` bằng thẻ thuần thay vì dùng compound
 * `Table` của bộ thiết kế. Ba chỗ tô màu nằm sẵn trong compound ấy:
 *
 * - `Table.Header` và `Table.Head` đều đặt `bg-bg-sunken`. Đặc tả nói **đầu
 *   bảng không tô màu**.
 * - `Table.Row` đặt `hover:bg-bg-hover` cho cả hàng.
 * - `Table.Row` còn vẽ một vạch `bg-accent` 2px ở mép trái khi rê chuột. Đó là
 *   màu nhấn đặt lên một hàng **không** tương tác được — thứ tương tác được ở
 *   đây là mười ô tích, và chúng tự mang màu của chúng. Bất biến A2 nói màu
 *   nhấn dành cho thứ tương tác được **và chỉ nhờ nó** người ta biết thứ đó
 *   tương tác được; một vạch nhấn trên hàng làm lời hứa ấy sai đi.
 *
 * Ghi đè ba thứ đó bằng `className` thì hai cái đầu qua được `twMerge`, cái
 * thứ ba là một utility biến thể tuỳ ý (`[&>td:first-child]:before:…`) mà
 * `twMerge` không gộp — nó chỉ thắng hay thua tuỳ thứ tự trong bảng kiểu, tức
 * là một lời hứa không có ai canh. Nên bảng ở đây là **cấu trúc thuần**: lưới,
 * tiêu đề hàng, tiêu đề cột, không một mảng nền nào. Đây không phải một
 * component mới — cùng lý do `AccountSettings.tsx` tự vẽ khung thẻ của nó thay
 * vì thêm một `Card` vào bộ thiết kế.
 *
 * ## Trạng thái 7 — thu gọn
 *
 * Dưới 640 px, ma trận đổi thành danh sách sự việc và mỗi sự việc mang hai
 * `Toggle`. Một ô tích 18px giữa hai cột bị bóp không phải mục tiêu bấm được
 * bằng ngón tay, còn `Toggle` thì rộng gấp đôi và có nhãn chữ đi kèm.
 *
 * ## Luật của mối nối
 *
 * - Hai tên xuất — `NotificationsSection` và `NotificationsSectionProps` — đã có
 *   nơi nhập theo, nên **không đổi tên**.
 * - Khung thẻ — nền `--bg-surface`, bo 12, đệm 20, tiêu đề `<h2>` —
 *   do `AccountSettings.tsx` vẽ sẵn. File này chỉ vẽ **ruột** của thẻ.
 * - Đây là `.tsx` trong `src/screens`, nên `local/no-data-layer-in-view`
 *   cấm nhập `src/api`, `src/store`, `src/domain`, `src/lib/http`
 *   (trừ `import type`). Việc đọc dữ liệu nằm ở `useAccountTables.ts`.
 */

import { Checkbox } from '@/components/ui/Checkbox';
import { Toggle } from '@/components/ui/Toggle';

/** Một cột: kênh nhận thông báo. */
export interface NotificationChannelModel {
  /** Mã tiếng Anh (mục E.11). */
  readonly id: string;
  readonly label: string;
}

/** Một ô của ma trận. */
export interface NotificationCellModel {
  readonly channelId: string;
  /**
   * Tên đầy đủ cho trình đọc màn hình — "AI xử lý xong — Thư điện tử".
   *
   * Ghép sẵn ở viewmodel: một ô tích trong ma trận không có chữ nào bên cạnh,
   * nên mười ô sẽ đọc lên giống hệt nhau nếu không có nhãn này.
   */
  readonly label: string;
  readonly isOn: boolean;
}

/** Một hàng: sự việc, cùng đúng một ô cho mỗi kênh. */
export interface NotificationEventModel {
  readonly id: string;
  readonly label: string;
  readonly cells: readonly NotificationCellModel[];
}

export interface NotificationsSectionProps {
  readonly channels: readonly NotificationChannelModel[];
  readonly events: readonly NotificationEventModel[];
  /** Trạng thái 7. Màn hẹp thì ma trận thành danh sách hai `Toggle` mỗi mục. */
  readonly isCollapsed: boolean;
  readonly onChange: (eventId: string, channelId: string, isOn: boolean) => void;
}

/** Câu đặt tên cho bảng, chỉ trình đọc màn hình nghe thấy. */
const TABLE_CAPTION = 'Hàng là sự việc, cột là kênh nhận thông báo.';

export function NotificationsSection({
  channels,
  events,
  isCollapsed,
  onChange,
}: NotificationsSectionProps) {
  if (isCollapsed) {
    return (
      <ul className="flex flex-col">
        {events.map((event) => {
          const labelId = `notification-${event.id}-label`;

          return (
            <li
              key={event.id}
              className="flex flex-col gap-2 border-b border-border-default py-3 first:pt-0 last:border-0 last:pb-0"
            >
              <span id={labelId} className="text-[14px] font-medium text-text-primary">
                {event.label}
              </span>
              {/* Nhóm có tên, nên hai `Toggle` cùng nhãn "Trong ứng dụng" ở hai
                  sự việc khác nhau vẫn phân biệt được khi nghe. */}
              <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2 pl-1">
                {event.cells.map((cell) => (
                  <Toggle
                    key={cell.channelId}
                    checked={cell.isOn}
                    label={labelOf(channels, cell.channelId)}
                    onChange={(next) => onChange(event.id, cell.channelId, next)}
                  />
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">{TABLE_CAPTION}</caption>
      <thead>
        <tr className="border-b border-border-default">
          <th scope="col" className="pb-2 text-[13px] font-semibold text-text-secondary">
            sự việc
          </th>
          {channels.map((channel) => (
            <th
              key={channel.id}
              scope="col"
              className="w-[136px] pb-2 text-center text-[13px] font-semibold text-text-secondary"
            >
              {channel.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {events.map((event) => (
          <tr key={event.id} className="border-b border-border-default last:border-0">
            <th
              scope="row"
              className="py-2 pr-3 text-[14px] font-normal leading-[20px] text-text-primary"
            >
              {event.label}
            </th>
            {event.cells.map((cell) => (
              <td key={cell.channelId} className="py-2">
                <Checkbox
                  className="justify-center"
                  checked={cell.isOn}
                  aria-label={cell.label}
                  onChange={(next) => onChange(event.id, cell.channelId, next)}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Nhãn của một kênh; mã lạ thì trả về chính nó thay vì vẽ một ô không tên. */
function labelOf(channels: readonly NotificationChannelModel[], channelId: string): string {
  return channels.find((channel) => channel.id === channelId)?.label ?? channelId;
}
