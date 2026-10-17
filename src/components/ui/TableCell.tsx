import React from 'react';
import { twMerge } from 'tailwind-merge';

// ─── Table.Cell ───────────────────────────────────────────────────────────────

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  sticky?: boolean;
  /** Ghim ô vào mép phải: cột hành động không trôi khỏi khung nhìn khi bảng cuộn ngang. */
  stickyEnd?: boolean;
  /** Chữ dài bị cắt bằng dấu …; chữ đầy đủ nằm trong tooltip (chỉ khi nội dung là chuỗi). */
  truncate?: boolean;
}

export function TableCell({ className, children, sticky, stickyEnd, truncate, title, ...props }: TableCellProps) {
  return (
    <td
      className={twMerge(
        'h-10 px-3 align-middle text-text-primary whitespace-nowrap',
        sticky && 'sticky left-0 z-10 bg-inherit',
        // Nền đặc (không `bg-inherit`): hàng thường không có nền, ô ghim trong suốt sẽ để chữ cột khác lộ ra bên dưới.
        stickyEnd && 'sticky right-0 z-10 bg-bg-surface',
        truncate && 'max-w-[20rem] truncate',
        className
      )}
      title={title ?? (truncate && typeof children === 'string' ? children : undefined)}
      {...props}
    >
      {children}
    </td>
  );
}
TableCell.displayName = 'Table.Cell';
