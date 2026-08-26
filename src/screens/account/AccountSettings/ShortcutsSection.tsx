/**
 * Khối "phím tắt" của màn `/tai-khoan`. Chỉ đọc, hai cột, có ô tìm lọc ngay
 * khi gõ.
 *
 * **Không viết tay danh sách phím tắt.** `ShortcutRegistry` không có API liệt
 * kê — chỉ `findOverlaps()`/`reportOverlaps()`, và hai hàm đó báo *trùng lặp*
 * chứ không báo toàn bộ — nên nguồn đếm được duy nhất là
 * `buildGlobalShortcuts(handlers)`. Việc dựng danh sách nằm ở
 * `useAccountTables.buildShortcutRows`; view này nhận `rows` đã xong và không
 * biết phím tắt từ đâu ra. Đó là mục D, và nó cũng là thứ giữ cho số hàng vẽ
 * ra luôn bằng số mục I-01 khai: không có chỗ nào ở đây để một mảng viết tay
 * len vào.
 *
 * ## Vì sao là `<table>` thuần chứ không phải compound `Table`
 *
 * Cùng lý do đã viết ở `NotificationsSection.tsx`, cộng một lý do riêng:
 *
 * - `Table.Row` vẽ vạch `bg-accent` ở mép trái khi rê chuột. Bảng này **không
 *   tương tác được** — không bấm được hàng nào, không sắp xếp, không chọn — nên
 *   một vạch nhấn theo con trỏ hứa một việc không có thật (A2).
 * - `Table.Row` chỉ chạy hoạt cảnh xếp lại khi nhận `layoutId`, và khi ấy nó
 *   tự chốt `durationSeconds('standard')`, không có đường nào truyền vào
 *   `duration: 0`. Mà "bật giảm chuyển động thì mọi hoạt cảnh tắt ngay lập
 *   tức" là một yêu cầu của màn này, nên thời lượng phải là thứ truyền vào
 *   được — xem {@link ShortcutRowMotion}.
 *
 * Không có component mới nào được tạo ở đây: đây là thẻ `<table>`, `<th>`,
 * `<td>` của HTML, cùng cách `AccountSettings.tsx` tự vẽ khung thẻ thay vì
 * thêm một `Card` vào bộ thiết kế.
 *
 * ## Hoạt cảnh
 *
 * Lọc ngay khi gõ; danh sách xếp lại bằng layout animation của `motion` —
 * nhập từ `@/components/motion`, cửa duy nhất `local/no-framer-outside-motion`
 * cho phép. `LayoutGroup` không được tái xuất ở đó, nên phần xếp lại dựng bằng
 * `motion` + `AnimatePresence`, đúng hai thứ có sẵn.
 *
 * Khi người dùng bật "giảm chuyển động", `useAccountTables` gửi xuống
 * `rowMotion = { layout: false, transition: { duration: 0 } }`: framer thôi
 * chiếu layout và không còn gì để chạy. Luật `no-raw-duration` cho phép số 0
 * đúng vì nó không phải một thời lượng mà là câu "không hoạt cảnh".
 *
 * ## Luật của mối nối
 *
 * - Hai tên xuất — `ShortcutsSection` và `ShortcutsSectionProps` — đã có nơi
 *   nhập theo, nên **không đổi tên**.
 * - Khung thẻ — nền `--bg-surface`, bo 12, đệm 20, tiêu đề `<h2>` — do
 *   `AccountSettings.tsx` vẽ sẵn. File này chỉ vẽ **ruột** của thẻ.
 * - Đây là `.tsx` trong `src/screens`, nên `local/no-data-layer-in-view` cấm
 *   nhập `src/api`, `src/store`, `src/domain`, `src/lib/http` (trừ
 *   `import type`). Việc đọc dữ liệu nằm ở `useAccountTables.ts`.
 */

import { Search } from 'lucide-react';

import { AnimatePresence, motion } from '@/components/motion';
import { Input } from '@/components/ui/Input';
import { Kbd } from '@/components/ui/Kbd';

/** Một hàng của bảng, dựng sẵn từ một `ShortcutDefinition` của I-01. */
export interface ShortcutRowModel {
  /** `definition.id` — định danh kỹ thuật, cũng là khoá React. */
  readonly id: string;
  /** `formatCombo(parseCombo(combo))`, ví dụ `Mod+Shift+Z`. Dùng để lọc. */
  readonly combo: string;
  /** Cùng tổ hợp ấy, tách sẵn thành từng phím để vẽ mỗi phím một `Kbd`. */
  readonly keys: readonly string[];
  /** Câu tiếng Việt của `definition.description`. */
  readonly description: string;
}

/**
 * Một lượt xếp lại chạy như thế nào — quyết định ở viewmodel, không ở view.
 *
 * Mục D nói view test được chỉ từ props, và "giảm chuyển động thì tắt hết" là
 * một *quyết định* chứ không phải một cách vẽ: đặt nó vào props thì bộ kiểm đọc
 * thẳng được `{ layout: false, transition: { duration: 0 } }` thay vì phải moi
 * nội tình của framer-motion ra khỏi DOM. Thang thời lượng và đường cong đều
 * lấy từ `src/lib/motion` ở `useAccountTables.ts`; không con số nào viết tay.
 */
export interface ShortcutRowMotion {
  /** `false` khi giảm chuyển động: framer thôi chiếu layout hoàn toàn. */
  readonly layout: false | 'position';
  /** `duration: 0` là câu "không hoạt cảnh", thứ `no-raw-duration` cho phép. */
  readonly transition: {
    readonly duration: number;
    readonly ease?: [number, number, number, number];
  };
}

export interface ShortcutsSectionProps {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  /** Đã lọc theo `query`. Rỗng nghĩa là không khớp gì, không phải chưa tải. */
  readonly rows: readonly ShortcutRowModel[];
  /** Câu đếm, đã định dạng ở viewmodel (A15). */
  readonly countLabel: string;
  readonly emptyMessage: string;
  readonly rowMotion: ShortcutRowMotion;
}

/** Câu đặt tên cho bảng, chỉ trình đọc màn hình nghe thấy. */
const TABLE_CAPTION = 'Tổ hợp phím và việc mà nó làm.';

export function ShortcutsSection({
  query,
  onQueryChange,
  rows,
  countLabel,
  emptyMessage,
  rowMotion,
}: ShortcutsSectionProps) {
  return (
    <div className="flex flex-col gap-3">
      <Input
        label="tìm phím tắt"
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Gõ để lọc ngay"
        prefix={<Search size={16} aria-hidden="true" />}
      />

      {/* Lọc ngay khi gõ thì con số đổi ngay khi gõ, và người dùng trình đọc
          màn hình cũng phải nghe được điều đó. */}
      <p role="status" className="text-[13px] text-text-secondary">
        {countLabel}
      </p>

      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{TABLE_CAPTION}</caption>
        <thead>
          <tr className="border-b border-border-default">
            <th
              scope="col"
              className="w-[168px] pb-2 text-[13px] font-semibold text-text-secondary"
            >
              tổ hợp phím
            </th>
            <th scope="col" className="pb-2 text-[13px] font-semibold text-text-secondary">
              việc
            </th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {rows.map((row) => (
              <motion.tr
                key={row.id}
                layout={rowMotion.layout}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={rowMotion.transition}
                className="border-b border-border-default last:border-0"
              >
                <td className="py-2 align-middle">
                  <span className="flex flex-wrap items-center gap-1">
                    {row.keys.map((keyName, index) => (
                      <Kbd key={`${row.id}-${String(index)}`}>{keyName}</Kbd>
                    ))}
                  </span>
                </td>
                <td className="py-2 align-middle text-[14px] leading-[20px] text-text-primary">
                  {row.description}
                </td>
              </motion.tr>
            ))}
          </AnimatePresence>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={2} className="py-3 text-[13px] text-text-secondary">
                {emptyMessage}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
