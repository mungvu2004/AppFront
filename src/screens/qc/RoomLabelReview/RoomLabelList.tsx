/**
 * Danh sách phòng của panel trái — `src/screens/qc/RoomLabelReview`.
 *
 * View THUẦN (R-60): nhận đúng {@link RoomLabelListProps} của hợp đồng L1
 * (`roomLabelTypes.ts`, đã đóng băng) và chỉ hiển thị. Không một phép tính
 * nào ở đây: `areaText` tới nơi đã định dạng (A15), `hasName` tới nơi đã
 * `trim()` sẵn (R-61).
 *
 * KHÔNG dùng `Table.Row`: bảng "component nào KHÔNG dùng được với
 * `expectAccessible`" của hợp đồng giao diện (T2) đánh dấu nó KHÔNG dùng được
 * — vòng tiêu điểm của nó vẽ theo PROP `focused` chứ không theo
 * `focus-visible:`, nên một hàng ở trạng thái mặc định chỉ còn `outline-none`
 * và `expectAccessible` báo `focus-ring`. Cách thay thế mà hợp đồng chỉ ra
 * (và hai màn QC trước đã chạy thật: `WallLayerList.tsx`,
 * `FloorTableRow.tsx`) là một hàng `role="option"` thuần với vòng tiêu điểm
 * dạng class tĩnh — đúng thứ file này dùng.
 *
 * Bàn phím là đường đi hạng nhất (A12): mỗi hàng nhận tiêu điểm bằng Tab,
 * Enter/Space chọn, ↑/↓ đi giữa các hàng. Trình xử lý gắn TRÊN CHÍNH hàng
 * đang giữ tiêu điểm — view không bao giờ tự gắn `keydown` lên `window`
 * (việc đó của `shortcutRegistry`, R-54/R-72).
 */

import { Inbox } from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { cn } from '@/lib/utils';

import type { RoomLabelListProps, RoomLabelStatus, RoomLabelViewModel } from './roomLabelTypes';

/** Chiều cao một dòng danh sách, đúng chữ đặc tả ("mỗi dòng cao 40"). */
const ROW_HEIGHT_CLASS = 'h-10';

const LIST_ARIA_LABEL = 'Danh sách phòng';
const UNNAMED_PLACEHOLDER = 'chưa đặt tên';
const EMPTY_TITLE = 'Chưa có phòng nào';
const EMPTY_DESCRIPTION =
  'Không có phòng nào khớp bộ lọc đang bật. Tắt bộ lọc "Chưa đặt tên" để thấy lại cả danh sách.';

/**
 * Ba chấm trạng thái — đúng ba màu trạng thái của A4, không có màu thứ tư.
 * Xanh "đã xác minh" CHỈ gắn với `confirmed`, tức việc của người duyệt (A5).
 */
const STATUS_DOT_CLASS: Readonly<Record<RoomLabelStatus, string>> = {
  unnamed: 'bg-state-attention',
  suggested: 'bg-text-muted',
  confirmed: 'bg-state-verified',
};

const STATUS_LABEL: Readonly<Record<RoomLabelStatus, string>> = {
  unnamed: 'cần chú ý',
  suggested: 'AI đề xuất, chưa duyệt',
  confirmed: 'đã duyệt',
};

interface RoomLabelListRowProps {
  readonly room: RoomLabelViewModel;
  readonly isSelected: boolean;
  readonly onSelect: (roomId: RoomLabelViewModel['id'] | null) => void;
  readonly onHover: (roomId: RoomLabelViewModel['id'] | null) => void;
  readonly onMoveFocus: (event: KeyboardEvent<HTMLDivElement>) => void;
}

function RoomLabelListRow({ room, isSelected, onSelect, onHover, onMoveFocus }: RoomLabelListRowProps) {
  const nameText = room.hasName ? room.name : UNNAMED_PLACEHOLDER;

  return (
    <div
      aria-label={`${room.codeLabel} · ${nameText} · ${room.areaText} · ${STATUS_LABEL[room.status]}`}
      aria-selected={isSelected}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-[8px] px-2 text-[13px] outline-none',
        ROW_HEIGHT_CLASS,
        'transition-colors duration-120 hover:bg-bg-hover',
        'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent focus-visible:ring-offset-2',
        isSelected && 'bg-bg-selected hover:bg-bg-selected',
      )}
      onClick={() => onSelect(room.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(room.id);

          return;
        }

        onMoveFocus(event);
      }}
      onMouseEnter={() => onHover(room.id)}
      onMouseLeave={() => onHover(null)}
      role="option"
      tabIndex={0}
    >
      <span className="w-16 shrink-0 truncate font-mono text-text-secondary">{room.codeLabel}</span>
      <span className={cn('min-w-0 flex-1 truncate', room.hasName ? 'text-text-primary' : 'text-text-muted')}>
        {nameText}
      </span>
      <span className="shrink-0 font-mono tabular-nums text-text-secondary">{room.areaText}</span>
      <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_DOT_CLASS[room.status])} />
    </div>
  );
}

export function RoomLabelList({ rooms, selectedRoomId, onSelect, onHover }: RoomLabelListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  /**
   * ↑/↓ đi giữa các hàng. Đọc thẳng các hàng đang có trong DOM của chính danh
   * sách này thay vì giữ một chỉ số riêng: danh sách lọc lại theo chip "Chưa
   * đặt tên" nên một chỉ số nhớ sẵn sẽ trỏ nhầm ngay lượt lọc đầu tiên.
   */
  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }

    const container = containerRef.current;

    if (container === null) {
      return;
    }

    const items = Array.from(container.querySelectorAll<HTMLElement>('[role="option"]'));
    const current = items.indexOf(event.currentTarget);

    if (current === -1) {
      return;
    }

    const next = items[event.key === 'ArrowDown' ? current + 1 : current - 1];

    if (next === undefined) {
      return;
    }

    event.preventDefault();
    next.focus();
  };

  if (rooms.length === 0) {
    return <EmptyState description={EMPTY_DESCRIPTION} icon={<Inbox />} title={EMPTY_TITLE} />;
  }

  return (
    <div aria-label={LIST_ARIA_LABEL} className="flex flex-col" ref={containerRef} role="listbox">
      {rooms.map((room) => (
        <RoomLabelListRow
          isSelected={room.id === selectedRoomId}
          key={room.id}
          onHover={onHover}
          onMoveFocus={moveFocus}
          onSelect={onSelect}
          room={room}
        />
      ))}
    </div>
  );
}
