/**
 * Danh sách gộp nhóm của panel 344 — file anh em của `RoomAreaPanel.tsx`.
 *
 * VIEW THUẦN (R-60): không `src/api`, không `src/store`, không `src/domain`,
 * không `src/lib/http`. Mọi con số tới đây ĐÃ là chuỗi (`row.areaText`,
 * `group.countText`, `group.subtotalText`) — `local/no-raw-number` chặn mọi lượt
 * định dạng lại ở tầng này, và A15 đặt việc đó ở viewmodel.
 *
 * Tách khỏi `RoomAreaPanel.tsx` theo mục D của CLAUDE.md (view vượt trần 400
 * dòng của R-22 thì phần con ra file anh em TRONG CÙNG thư mục màn), cùng khuôn
 * `FloorSectionCut.tsx`: props khai bằng `Pick<>` chứ không khai lại chữ ký
 * handler lần thứ hai. Chuỗi tĩnh của một hàng có bản sao trong
 * `RoomAreaPanel.vi.fragment.json` (R-67).
 *
 * ## Vì sao hàng là `<li>` tự dựng, không phải `Table.Row`
 *
 * Phán quyết PQ-2 của điều phối viên: `src/components/ui/Table.tsx:84` đặt
 * `outline-none` rồi chỉ đổi màu nền ở `focus-visible`, còn vòng
 * `ring-2 ring-accent` (dòng 89) chạy bằng prop `focused` do CHA điều khiển —
 * không phải tiêu điểm thật của bàn phím. `expectAccessible` từ chối đúng hình
 * dạng đó ("tắt viền tiêu điểm mặc định mà không thay bằng cái khác"), và
 * `src/components/**` là vùng cấm sửa (R-68). Nên hàng tương tác được dựng tại
 * chỗ, và mọi thứ bấm được trong hàng đều mang
 * `focus-visible:ring-2 ring-offset-2` lấy từ token.
 *
 * ## Bàn phím tới được mọi thứ trong hàng (A12)
 *
 * Một hàng có đúng hai điểm dừng: ô sửa tên, rồi con số diện tích. Con số là
 * một `<button>` thật — đó là đường bàn phím tới `onRoomActivate` (khuôn camera
 * vào phòng), và cũng là chỗ `Tooltip` treo câu chú giải `row.explain`, nên chú
 * giải hiện ra cả khi trỏ chuột lẫn khi tab tới. Bấm chuột vào bất kỳ đâu khác
 * trong hàng cũng gọi `onRoomActivate`; vùng ô nhập chặn nổi bọt để gõ tên
 * không vô tình dời camera. `Esc` trong ô tên rời tiêu điểm — lớp trên cùng của
 * hàng đóng lại, đúng lời hứa A12.
 *
 * ## 36px là chiều cao TỐI THIỂU
 *
 * `Input` mang sẵn khung cao 38px của riêng nó và `src/components/**` không sửa
 * được (R-68), nên hàng dùng `min-h-9` — đúng cách `FieldRow.tsx:57` viết
 * `min-h-[36px]` cho cùng loại hàng nhãn/giá trị cao 36.
 *
 * ## Thanh tỷ trọng 2px không có phép tính nào
 *
 * `row.areaRatio` là 0..1 và đi thẳng vào `transform: scaleX(...)` với gốc biến
 * hình ở mép trái — không nhân, không chia, không phần trăm. Cùng kỹ thuật
 * `style={{ flexGrow: band.bandHeightRatio }}` của `FloorSectionCut.tsx`.
 */

import { motion } from '@/components/motion';
import { Input } from '@/components/ui/Input';
import { Tooltip } from '@/components/ui/Tooltip';
import { durationSeconds } from '@/lib/motion';
import { cn } from '@/lib/utils';

import type {
  RoomAreaGroup,
  RoomAreaPanelProps,
  RoomAreaRow,
  RoomAreaStatus,
} from './roomAreaTypes';

/**
 * Đúng ba màu trạng thái (A4).
 *
 * `reviewed` là xanh "đã xác minh" của A5 — chỉ việc người duyệt đặt được nó,
 * không đầu ra suy diễn nào. `suspect` là màu cần chú ý. `trusted` KHÔNG lấy màu
 * thứ ba của bảng trạng thái: một phòng máy dò ra và chưa ai duyệt thì không
 * phải vi phạm, nên nó nhận chấm trung tính, đúng cách `Badge.tsx:29` tô biến
 * thể `neutral`.
 */
const STATUS_DOT_CLASS: Readonly<Record<RoomAreaStatus, string>> = {
  trusted: 'bg-text-muted',
  suspect: 'bg-state-attention',
  reviewed: 'bg-state-verified',
};

/** Chữ cho trình đọc màn hình, vì chấm màu là thứ duy nhất nhìn thấy được. */
const STATUS_LABEL: Readonly<Record<RoomAreaStatus, string>> = {
  trusted: 'máy dò được, chưa duyệt',
  suspect: 'cần xem lại',
  reviewed: 'đã xác minh',
};

const NAME_FIELD_LABEL_PREFIX = 'tên phòng';
const AREA_BUTTON_LABEL_PREFIX = 'xem cách tính và khuôn hình vào phòng';
const UNNAMED_HINT = 'phòng chưa đặt tên';
const GROUP_COUNT_SUFFIX = 'phòng';

/** Vòng tiêu điểm 2px, lệch 2px — đúng A12, và lấy hẳn từ token. */
const FOCUS_RING_CLASS =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface';

export interface RoomAreaRowItemProps
  extends Pick<
    RoomAreaPanelProps,
    'hoveredRoomId' | 'flashedRoomId' | 'onRoomHover' | 'onRoomActivate' | 'onRoomRename'
  > {
  readonly row: RoomAreaRow;
  /** `"m²"` — đứng cạnh con số như một phần tử riêng, không nối vào chuỗi. */
  readonly unitLabel: string;
}

/**
 * Một hàng phòng.
 *
 * `motion.li layout` là hoạt ảnh đổi chỗ khi người dùng đổi cách sắp xếp — nhịp
 * `fast`, đúng `MOVE_DURATION` mà `src/lib/motion/listMotion.ts` đặt cho một
 * hàng dời chỗ trong danh sách. `framer-motion` vào đây qua đúng cửa
 * `@/components/motion` (R-39), nơi `MotionProvider` đã bật `reducedMotion="user"`
 * một lần cho toàn ứng dụng.
 */
export function RoomAreaRowItem({
  row,
  unitLabel,
  hoveredRoomId,
  flashedRoomId,
  onRoomHover,
  onRoomActivate,
  onRoomRename,
}: RoomAreaRowItemProps) {
  const isHovered = hoveredRoomId === row.id;
  const isFlashed = flashedRoomId === row.id;

  return (
    <motion.li
      layout
      transition={{ duration: durationSeconds('fast') }}
      className={cn(
        'relative flex min-h-9 items-center gap-2 rounded-md pl-2 pr-1',
        'transition-colors duration-fast motion-reduce:transition-none',
        isHovered && 'bg-bg-hover',
        isFlashed && 'bg-bg-flash',
      )}
      onMouseEnter={() => onRoomHover(row.id)}
      onMouseLeave={() => onRoomHover(null)}
      onClick={() => onRoomActivate(row.id)}
    >
      <span
        aria-hidden="true"
        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_DOT_CLASS[row.status])}
      />
      <span className="sr-only">{STATUS_LABEL[row.status]}</span>

      {/* Ô sửa tên chặn nổi bọt: gõ tên không được dời camera sang phòng khác. */}
      <div
        className="min-w-0 flex-1"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <Input
          aria-label={`${NAME_FIELD_LABEL_PREFIX} ${row.name}`}
          className={cn('text-[14px]', row.isUnnamed && 'text-text-muted')}
          flash={isFlashed}
          onChange={(event) => onRoomRename(row.id, event.target.value)}
          onBlur={() => onRoomHover(null)}
          onFocus={() => onRoomHover(row.id)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.currentTarget.blur();
            }
          }}
          title={row.isUnnamed ? UNNAMED_HINT : undefined}
          value={row.name}
          wrapperClassName="min-w-0"
        />
      </div>

      <Tooltip label={row.explain}>
        <button
          aria-label={`${AREA_BUTTON_LABEL_PREFIX} ${row.name}, ${row.areaText} ${unitLabel}`}
          className={cn(
            'shrink-0 rounded px-2 py-1 font-mono text-[13px] tabular-nums text-text-primary',
            'transition-colors duration-fast motion-reduce:transition-none hover:bg-bg-sunken',
            FOCUS_RING_CLASS,
          )}
          onClick={(event) => {
            event.stopPropagation();
            onRoomActivate(row.id);
          }}
          type="button"
        >
          {row.areaText}
        </button>
      </Tooltip>

      {/* Thanh tỷ trọng 2px, dính đáy hàng. `scaleX` nhận thẳng 0..1. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-2 right-1 h-[2px] overflow-hidden rounded-full bg-bg-sunken"
      >
        <span
          className="block h-full w-full origin-left rounded-full bg-wall-330"
          style={{ transform: `scaleX(${row.areaRatio})` }}
        />
      </span>
    </motion.li>
  );
}

export interface RoomAreaRowListProps
  extends Pick<
    RoomAreaPanelProps,
    'hoveredRoomId' | 'flashedRoomId' | 'onRoomHover' | 'onRoomActivate' | 'onRoomRename'
  > {
  readonly rows: readonly RoomAreaRow[];
  readonly unitLabel: string;
}

/**
 * Một danh sách hàng phẳng.
 *
 * Tấm trượt đáy ở trạng thái thu gọn dùng thẳng cái này: nó không có đầu nhóm
 * nào để hiện, và một "nhóm giả" chỉ để mượn khuôn thì phải bịa ra `countText`
 * với `subtotalText` — đúng thứ R-69 cấm.
 */
export function RoomAreaRowList({
  rows,
  unitLabel,
  hoveredRoomId,
  flashedRoomId,
  onRoomHover,
  onRoomActivate,
  onRoomRename,
}: RoomAreaRowListProps) {
  return (
    <ul className="flex flex-col">
      {rows.map((row) => (
        <RoomAreaRowItem
          flashedRoomId={flashedRoomId}
          hoveredRoomId={hoveredRoomId}
          key={row.id}
          onRoomActivate={onRoomActivate}
          onRoomHover={onRoomHover}
          onRoomRename={onRoomRename}
          row={row}
          unitLabel={unitLabel}
        />
      ))}
    </ul>
  );
}

export interface RoomAreaGroupListProps
  extends Pick<
    RoomAreaPanelProps,
    'groups' | 'hoveredRoomId' | 'flashedRoomId' | 'onRoomHover' | 'onRoomActivate' | 'onRoomRename'
  > {
  /** `"m²"`, viết đúng một lần cạnh mỗi tổng phụ — không nhét vào chuỗi số. */
  readonly unitLabel: string;
  /** Tiêu đề nhóm ẩn đi khi tấm trượt đáy chỉ còn một danh sách phẳng. */
  readonly showGroupHeadings?: boolean;
}

/**
 * Danh sách gộp nhóm.
 *
 * Đầu mỗi nhóm mang SỐ LƯỢNG và TỔNG PHỤ bằng chữ đều (`tabular-nums`), cả hai
 * đến từ props ở dạng chuỗi — panel không cộng gì, đúng CẤM TUYỆT ĐỐI "không tự
 * tính tổng" và đúng PQ-4 (tổng chỉ có một nguồn, làm tròn đúng một lần).
 */
export function RoomAreaGroupList({
  groups,
  unitLabel,
  hoveredRoomId,
  flashedRoomId,
  onRoomHover,
  onRoomActivate,
  onRoomRename,
  showGroupHeadings = true,
}: RoomAreaGroupListProps) {
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group: RoomAreaGroup) => (
        <section aria-label={group.label} key={group.key}>
          {showGroupHeadings && (
            <header className="flex items-baseline justify-between gap-2 px-2 pb-1">
              <h3 className="truncate text-[13px] font-medium leading-[18px] text-text-secondary">
                {group.label}
              </h3>
              <p className="shrink-0 text-[13px] leading-[18px] text-text-muted">
                <span className="font-mono tabular-nums">{group.countText}</span>{' '}
                {GROUP_COUNT_SUFFIX} ·{' '}
                <span className="font-mono tabular-nums text-text-secondary">
                  {group.subtotalText}
                </span>{' '}
                {unitLabel}
              </p>
            </header>
          )}
          <RoomAreaRowList
            flashedRoomId={flashedRoomId}
            hoveredRoomId={hoveredRoomId}
            onRoomActivate={onRoomActivate}
            onRoomHover={onRoomHover}
            onRoomRename={onRoomRename}
            rows={group.rows}
            unitLabel={unitLabel}
          />
        </section>
      ))}
    </div>
  );
}
