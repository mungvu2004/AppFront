/**
 * Một hàng phòng của `RoomAreaTable` — <tr> THẬT, không phải `Table.Row`.
 *
 * `Table.Row` của thư viện dùng chung tắt viền tiêu điểm mặc định mà không thay
 * bằng cái khác (`src/components/ui/Table.tsx:84-89`): vòng `ring-2 ring-accent`
 * ở đó chỉ bật khi prop `focused` do cha điều khiển, không phải khi bàn phím
 * thật sự lấy tiêu điểm — trượt `expectAccessible` (A12). Quyết định của điều
 * phối viên (PQ-2) là dựng hàng thật ở đây, kèm `focus-visible:ring-2` lấy
 * tiêu điểm thật, còn khung không tương tác (ô, tiêu đề cột) vẫn dùng
 * `Table.Cell` của thư viện.
 */

import type { KeyboardEvent, SyntheticEvent } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';

import type { RoomAreaRow, RoomAreaStatus } from './roomAreaTypes';

type RoomId = RoomAreaRow['id'];
type BadgeVariant = 'verified' | 'attention' | 'violation' | 'neutral';

/** Nhãn tiếng Việt của A4 — đúng ba trạng thái, không trạng thái thứ tư. */
const STATUS_LABELS: Readonly<Record<RoomAreaStatus, string>> = {
  trusted: 'đã dò',
  suspect: 'cần kiểm tra',
  reviewed: 'đã xác minh',
};

/** A5: xanh "đã xác minh" chỉ gắn với `reviewed`, giá trị người duyệt đặt. */
const STATUS_BADGE_VARIANTS: Readonly<Record<RoomAreaStatus, BadgeVariant>> = {
  trusted: 'neutral',
  suspect: 'attention',
  reviewed: 'verified',
};

const RENAME_INPUT_CLASS_NAME = cn(
  'w-full rounded-[6px] border border-transparent bg-transparent px-1.5 py-1 text-text-primary',
  'transition-colors duration-180 hover:border-border-default',
  'focus-visible:border-border-default focus-visible:outline-none focus-visible:ring-2',
  'focus-visible:ring-accent focus-visible:ring-offset-1',
);

const ROW_CLASS_NAME = cn(
  'h-10 cursor-pointer border-b border-border-default/50 outline-none',
  'transition-colors duration-180 hover:bg-bg-hover focus-visible:bg-bg-hover',
  'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
  'focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface',
);

const NUMERIC_CELL_CLASS_NAME = 'text-right tabular-nums';

export interface RoomAreaTableRowProps {
  readonly row: RoomAreaRow;
  readonly isHovered: boolean;
  readonly isFlashed: boolean;
  /** Sai ở trạng thái `forbidden` — bảng chỉ xem, không sửa tên được. */
  readonly canRename: boolean;
  readonly onHover: (roomId: RoomId | null) => void;
  readonly onActivate: (roomId: RoomId) => void;
  readonly onRename: (roomId: RoomId, name: string) => void;
}

/** Chặn sự kiện lan lên hàng, để bấm/gõ vào ô sửa tên không khuôn camera. */
function stopBubbling(event: SyntheticEvent): void {
  event.stopPropagation();
}

export function RoomAreaTableRow({
  row,
  isHovered,
  isFlashed,
  canRename,
  onHover,
  onActivate,
  onRename,
}: RoomAreaTableRowProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onActivate(row.id);
  };

  return (
    <tr
      className={cn(ROW_CLASS_NAME, isHovered && 'bg-bg-hover', isFlashed && 'bg-bg-flash')}
      tabIndex={0}
      onBlur={() => onHover(null)}
      onClick={() => onActivate(row.id)}
      onFocus={() => onHover(row.id)}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => onHover(row.id)}
      onMouseLeave={() => onHover(null)}
    >
      <Table.Cell>{row.levelName}</Table.Cell>
      <Table.Cell>
        {canRename ? (
          <input
            aria-label={`tên phòng ${row.name}`}
            className={cn(RENAME_INPUT_CLASS_NAME, row.isUnnamed && 'italic text-text-muted')}
            onChange={(event) => onRename(row.id, event.target.value)}
            onClick={stopBubbling}
            onKeyDown={stopBubbling}
            value={row.name}
          />
        ) : (
          <span className={cn(row.isUnnamed && 'italic text-text-muted')}>{row.name}</span>
        )}
      </Table.Cell>
      <Table.Cell>{row.usageLabel}</Table.Cell>
      <Table.Cell className={NUMERIC_CELL_CLASS_NAME}>
        <Tooltip label={row.explain}>
          <span>{row.areaText}</span>
        </Tooltip>
      </Table.Cell>
      <Table.Cell className={NUMERIC_CELL_CLASS_NAME}>{row.perimeterText}</Table.Cell>
      <Table.Cell className={NUMERIC_CELL_CLASS_NAME}>{row.clearHeightText}</Table.Cell>
      <Table.Cell className={NUMERIC_CELL_CLASS_NAME}>{row.doorCountText}</Table.Cell>
      <Table.Cell className={NUMERIC_CELL_CLASS_NAME}>{row.windowCountText}</Table.Cell>
      <Table.Cell>
        <Badge variant={STATUS_BADGE_VARIANTS[row.status]}>{STATUS_LABELS[row.status]}</Badge>
      </Table.Cell>
    </tr>
  );
}
