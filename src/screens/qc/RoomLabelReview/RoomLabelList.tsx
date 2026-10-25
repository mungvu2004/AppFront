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
 * `focus-visible:`, nên một hàng ở trạng thái mặc định chỉ còn `outline-hidden`
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

import { Inbox, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { cn } from '@/lib/utils';

import type { RoomLabelListProps, RoomLabelStatus, RoomLabelViewModel } from './roomLabelTypes';

/** Chiều cao một dòng danh sách, đúng chữ đặc tả ("mỗi dòng cao 40"). */
const ROW_HEIGHT_CLASS = 'min-h-10';

const LIST_ARIA_LABEL = 'Danh sách phòng';
const PENDING_GROUP_LABEL = 'Chưa duyệt';
const CONFIRMED_GROUP_LABEL = 'Đã duyệt';
const UNNAMED_PLACEHOLDER = 'Chưa đặt tên';
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
  unnamed: 'Cần chú ý',
  suggested: 'AI đề xuất, chưa duyệt',
  confirmed: 'Đã duyệt',
};

interface RoomLabelListRowProps {
  readonly room: RoomLabelViewModel;
  readonly isSelected: boolean;
  readonly onSelect: (roomId: RoomLabelViewModel['id'] | null) => void;
  readonly onHover: (roomId: RoomLabelViewModel['id'] | null) => void;
  readonly onMoveFocus: (event: KeyboardEvent<HTMLDivElement>) => void;
  /** Cờ "chiếm >80 % sàn" của riêng phòng này (Z/S-20); `null` khi không có. */
  readonly flag: string | null;
}

function RoomLabelListRow({ room, isSelected, onSelect, onHover, onMoveFocus, flag }: RoomLabelListRowProps) {
  const nameText = room.hasName ? room.name : UNNAMED_PLACEHOLDER;

  return (
    <div
      aria-label={`${room.codeLabel} · ${nameText} · ${room.areaText} · ${STATUS_LABEL[room.status]}${flag === null ? '' : ` · ${flag}`}`}
      aria-selected={isSelected}
      className={cn(
        'flex cursor-pointer flex-col justify-center gap-0.5 rounded-lg px-2 py-1 text-[13px] outline-hidden',
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
      <span className="flex items-center gap-2">
        <span className="w-16 shrink-0 truncate font-mono text-text-secondary">{room.codeLabel}</span>
        <span className={cn('min-w-0 flex-1 wrap-break-word', room.hasName ? 'text-text-primary' : 'text-text-muted')}>
          {nameText}
        </span>
        {/* Diện tích co được tới 45% hàng, chữ đầy đủ ở `title`: "Chưa có · tỷ lệ tạm" không còn nuốt tên phòng (BUG-624). */}
        <span className="max-w-[45%] wrap-break-word text-right font-mono tabular-nums text-text-secondary" title={room.areaText}>
          {room.areaText}
        </span>
        <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_DOT_CLASS[room.status])} />
      </span>
      {flag === null ? null : (
        <span className="flex items-start gap-1 pl-[72px] text-[12px] text-state-attention-text">
          <TriangleAlert aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {flag}
        </span>
      )}
    </div>
  );
}

export function RoomLabelList({
  rooms,
  selectedRoomId,
  onSelect,
  onHover,
  oversizedRoom = null,
}: RoomLabelListProps & { readonly oversizedRoom?: { readonly id: RoomLabelViewModel['id']; readonly text: string } | null }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  /* Z/S-20: hai nhóm "Chưa duyệt" rồi "Đã duyệt"; thứ tự DOM = thứ tự mảng này (mũi tên đọc theo nó). */
  const { pending, confirmed, ordered } = useMemo(() => {
    const notYet = rooms.filter((room) => room.status !== 'confirmed');
    const done = rooms.filter((room) => room.status === 'confirmed');

    return { pending: notYet, confirmed: done, ordered: [...notYet, ...done] };
  }, [rooms]);

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

    const nextIndex = event.key === 'ArrowDown' ? current + 1 : current - 1;
    const next = items[nextIndex];
    const nextRoom = ordered[nextIndex];

    if (next === undefined) {
      return;
    }

    event.preventDefault();
    next.focus();

    /* Mũi tên đổi luôn dòng chọn, không chỉ dời tiêu điểm (Impeccable A3). */
    if (nextRoom !== undefined) {
      onSelect(nextRoom.id);
    }
  };

  /* Chọn đổi từ bản vẽ hay phím A: cuộn tới dòng, kéo tiêu điểm theo nếu nó đang ở một dòng. */
  useEffect(() => {
    const container = containerRef.current;

    if (selectedRoomId === null || container === null) {
      return;
    }

    const index = ordered.findIndex((room) => room.id === selectedRoomId);
    const target = index === -1 ? undefined : container.querySelectorAll<HTMLElement>('[role="option"]')[index];

    if (target === undefined) {
      return;
    }

    target.scrollIntoView?.({ block: 'nearest' });

    const focused = document.activeElement;

    if (focused !== null && focused !== target && container.contains(focused) && focused.getAttribute('role') === 'option') {
      target.focus({ preventScroll: true });
    }
  }, [ordered, selectedRoomId]);

  if (rooms.length === 0) {
    return <EmptyState description={EMPTY_DESCRIPTION} icon={<Inbox />} title={EMPTY_TITLE} />;
  }

  return (
    <div aria-label={LIST_ARIA_LABEL} className="flex flex-col gap-3" ref={containerRef} role="listbox">
      {[
        { label: PENDING_GROUP_LABEL, items: pending },
        { label: CONFIRMED_GROUP_LABEL, items: confirmed },
      ].map((group) => (
        <div aria-label={group.label} className="flex flex-col" key={group.label} role="group">
          <p aria-hidden="true" className="flex items-center gap-2 px-2 pb-1 text-[12px] font-medium text-text-secondary">
            {group.label}
            <span className="tabular-nums text-text-muted">{group.items.length}</span>
          </p>
          {group.items.map((room) => (
            <RoomLabelListRow
              flag={oversizedRoom !== null && oversizedRoom.id === room.id ? oversizedRoom.text : null}
              isSelected={room.id === selectedRoomId}
              key={room.id}
              onHover={onHover}
              onMoveFocus={moveFocus}
              onSelect={onSelect}
              room={room}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
