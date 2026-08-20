import React, { createContext, useContext, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown, AlertCircle, Inbox } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Checkbox } from './Checkbox';
import { EmptyState } from '../feedback/EmptyState';
import { durationSeconds } from '../../lib/motion';
import { Skeleton } from '../feedback/Skeleton';

// ─── Context ──────────────────────────────────────────────────────────────────

interface TableContextValue {
  sortKey: string | undefined;
  sortDir: 'asc' | 'desc' | null | undefined;
  onSort: ((key: string) => void) | undefined;
}

const TableContext = createContext<TableContextValue>({
  sortKey: undefined,
  sortDir: undefined,
  onSort: undefined,
});

// ─── Table.Root ───────────────────────────────────────────────────────────────

export interface TableRootProps extends React.HTMLAttributes<HTMLDivElement> {
  sortKey?: string | undefined;
  sortDir?: 'asc' | 'desc' | null | undefined;
  onSort?: ((key: string) => void) | undefined;
}

function TableRoot({ className, children, sortKey, sortDir, onSort, ...props }: TableRootProps) {
  return (
    <TableContext.Provider value={{ sortKey, sortDir, onSort }}>
      <div className={twMerge('w-full h-full overflow-auto relative', className)} {...props}>
        <table className="w-full text-left border-collapse text-sm">
          {children}
        </table>
      </div>
    </TableContext.Provider>
  );
}
TableRoot.displayName = 'Table.Root';

// ─── Table.Header ─────────────────────────────────────────────────────────────

function TableHeader({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={twMerge('sticky top-0 z-10 bg-bg-sunken', className)} {...props}>
      {children}
    </thead>
  );
}
TableHeader.displayName = 'Table.Header';

// ─── Table.Body ───────────────────────────────────────────────────────────────

function TableBody({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={className} {...props}>
      {children}
    </tbody>
  );
}
TableBody.displayName = 'Table.Body';

// ─── Table.Row ────────────────────────────────────────────────────────────────

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  focused?: boolean;
  isAttention?: boolean;
  isFlash?: boolean;
  layoutId?: string;
}

const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>((
  { selected, focused, isAttention, isFlash, layoutId, className, children, ...props },
  ref
) => {
  const rowClassName = twMerge(
    'group h-10 border-b border-border-default/50 last:border-0 outline-none transition-colors duration-120',
    'hover:bg-bg-hover focus-visible:bg-bg-hover',
    selected && 'bg-bg-selected hover:bg-bg-selected',
    isFlash && 'bg-bg-flash hover:bg-bg-flash',
    isAttention && 'bg-state-attention-tint',
    focused && 'ring-2 ring-inset ring-accent',
    // Accent 2px left edge via before pseudo on first-child td
    '[&>td:first-child]:relative [&>td:first-child]:before:absolute [&>td:first-child]:before:left-0 [&>td:first-child]:before:top-0 [&>td:first-child]:before:bottom-0 [&>td:first-child]:before:w-[2px] [&>td:first-child]:before:bg-accent [&>td:first-child]:before:origin-center [&>td:first-child]:before:transition-transform [&>td:first-child]:before:duration-120 [&>td:first-child]:before:ease-out',
    selected ? '[&>td:first-child]:before:scale-y-100' : '[&>td:first-child]:before:scale-y-0 group-hover:[&>td:first-child]:before:scale-y-100',
    className
  );

  if (layoutId) {
    const MotionTableRow = motion.tr as React.ElementType;

    return (
      <MotionTableRow
        ref={ref}
        layout
        layoutId={layoutId}
        transition={{ duration: durationSeconds('standard'), ease: 'easeOut' }}
        aria-selected={selected}
        className={rowClassName}
        tabIndex={-1}
        {...props}
      >
        {children}
      </MotionTableRow>
    );
  }

  return (
    <tr
      ref={ref}
      aria-selected={selected}
      className={rowClassName}
      tabIndex={-1}
      {...props}
    >
      {children}
    </tr>
  );
});
TableRow.displayName = 'Table.Row';

// ─── Table.Head ───────────────────────────────────────────────────────────────

interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc' | null;
  onSort?: () => void;
  sticky?: boolean;
}

function TableHead({
  className,
  children,
  sortable,
  sortKey: colKey,
  sortDirection,
  onSort,
  sticky,
  ...props
}: TableHeadProps) {
  const ctx = useContext(TableContext);

  const handleSort = onSort ?? (ctx.onSort && colKey ? () => ctx.onSort!(colKey) : undefined);
  const activeDir = sortDirection ?? (ctx.sortKey === colKey ? ctx.sortDir : null);
  const isSortable = sortable || (!!ctx.onSort && !!colKey);

  const ariaSort = activeDir === 'asc' ? 'ascending' : activeDir === 'desc' ? 'descending' : isSortable ? 'none' : undefined;

  return (
    <th
      className={twMerge(
        // "section-label" style: normal sentence case, NOT uppercase
        'h-10 px-3 align-middle font-semibold text-[13px] leading-[18px] text-text-secondary whitespace-nowrap bg-bg-sunken',
        isSortable && 'cursor-pointer select-none hover:bg-bg-hover/50 group',
        sticky && 'sticky left-0 z-20',
        className
      )}
      aria-sort={ariaSort}
      onClick={isSortable ? handleSort : undefined}
      {...props}
    >
      <div className="flex items-center gap-1">
        {children}
        {isSortable && (
          <span className={clsx(
            'flex flex-col opacity-0 group-hover:opacity-50 transition-opacity duration-120',
            activeDir && 'opacity-100 group-hover:opacity-100 text-accent'
          )}>
            {activeDir === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </span>
        )}
      </div>
    </th>
  );
}
TableHead.displayName = 'Table.Head';

// ─── Table.Cell ───────────────────────────────────────────────────────────────

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  sticky?: boolean;
}

function TableCell({ className, children, sticky, ...props }: TableCellProps) {
  return (
    <td
      className={twMerge(
        'h-10 px-3 align-middle text-text-primary whitespace-nowrap',
        sticky && 'sticky left-0 z-10 bg-inherit',
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}
TableCell.displayName = 'Table.Cell';

// ─── Table.Skeleton ───────────────────────────────────────────────────────────

interface TableSkeletonProps {
  columns: number;
  rows?: number;
}

function TableSkeleton({ columns, rows = 8 }: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="border-b border-border-default/50">
          <td colSpan={columns} className="p-0">
            <Skeleton preset="table-row" className="h-10" />
          </td>
        </tr>
      ))}
    </>
  );
}
TableSkeleton.displayName = 'Table.Skeleton';

// ─── Table.Empty ──────────────────────────────────────────────────────────────

interface TableEmptyProps {
  colSpan: number;
  message?: string;
}

function TableEmpty({ colSpan, message = 'Không có dữ liệu' }: TableEmptyProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12">
        <EmptyState
          icon={<Inbox className="text-text-tertiary" />}
          title="Không có dữ liệu"
          description={message}
        />
      </td>
    </tr>
  );
}
TableEmpty.displayName = 'Table.Empty';

// ─── Table.Error ──────────────────────────────────────────────────────────────

interface TableErrorProps {
  colSpan: number;
  message?: string;
  onRetry?: () => void;
}

function TableError({ colSpan, message = 'Đã xảy ra lỗi', onRetry }: TableErrorProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-4">
        <EmptyState
          icon={<AlertCircle className="text-state-violation-text" />}
          title="Đã xảy ra lỗi"
          description={message}
          {...(onRetry ? { action: { label: 'Thử lại', onClick: onRetry, variant: 'secondary' } } : {})}
        />
      </td>
    </tr>
  );
}
TableError.displayName = 'Table.Error';

// ─── Table.CheckboxHead ───────────────────────────────────────────────────────
// Header checkbox for select-all / deselect-all

interface TableCheckboxHeadProps {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
}

function TableCheckboxHead({ checked, indeterminate, onChange }: TableCheckboxHeadProps) {
  return (
    <th className="h-10 w-10 px-3 align-middle bg-bg-sunken sticky left-0 z-20" aria-label="Chọn tất cả">
      <Checkbox
        checked={checked}
        indeterminate={indeterminate}
        onChange={onChange}
        aria-label="Chọn tất cả"
      />
    </th>
  );
}
TableCheckboxHead.displayName = 'Table.CheckboxHead';

// ─── Table.CheckboxCell ───────────────────────────────────────────────────────

interface TableCheckboxCellProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  rowId: string;
}

function TableCheckboxCell({ checked, onChange, rowId }: TableCheckboxCellProps) {
  return (
    <td className="h-10 w-10 px-3 align-middle sticky left-0 z-10 bg-inherit">
      <Checkbox
        checked={checked}
        onChange={onChange}
        aria-label={`Chọn dòng ${rowId}`}
        onClick={(e) => e.stopPropagation()}
      />
    </td>
  );
}
TableCheckboxCell.displayName = 'Table.CheckboxCell';

// ─── Table.Virtual ────────────────────────────────────────────────────────────
// Virtualized body — enables when rows > 100

interface TableVirtualProps<TRow extends { id: string }> {
  rows: TRow[];
  estimateSize?: number;
  renderRow: (row: TRow, virtualIndex: number) => React.ReactNode;
  colSpan: number;
}

function TableVirtual<TRow extends { id: string }>({
  rows,
  estimateSize = 40,
  renderRow,
  colSpan,
}: TableVirtualProps<TRow>) {
  const parentRef = useRef<HTMLTableSectionElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: useCallback(() => {
      // Scroll on the nearest scrolling ancestor (Table.Root wrapper)
      let el: HTMLElement | null = parentRef.current;
      while (el) {
        const overflow = getComputedStyle(el).overflow + getComputedStyle(el).overflowY;
        if (/auto|scroll/.test(overflow)) return el;
        el = el.parentElement;
      }
      return document.scrollingElement as HTMLElement;
    }, []),
    estimateSize: () => estimateSize,
    overscan: 5,
  });

  const totalHeight = rowVirtualizer.getTotalSize();
  const virtualItems = rowVirtualizer.getVirtualItems();
  const firstItem = virtualItems[0];
  const lastItem = virtualItems[virtualItems.length - 1];
  const paddingTop = firstItem ? firstItem.start : 0;
  const paddingBottom = lastItem ? totalHeight - lastItem.end : 0;

  return (
    <tbody ref={parentRef}>
      {paddingTop > 0 && (
        <tr>
          <td colSpan={colSpan} style={{ height: `${paddingTop}px`, padding: 0 }} />
        </tr>
      )}
      {virtualItems.map((virtualRow) => {
        const row = rows[virtualRow.index];
        if (!row) return null;
        return (
          <React.Fragment key={row.id}>
            {renderRow(row, virtualRow.index)}
          </React.Fragment>
        );
      })}
      {paddingBottom > 0 && (
        <tr>
          <td colSpan={colSpan} style={{ height: `${paddingBottom}px`, padding: 0 }} />
        </tr>
      )}
    </tbody>
  );
}

// ─── Namespace ────────────────────────────────────────────────────────────────

export const Table = Object.assign(
  function TableLegacy({ className, children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
    return (
      <div className="w-full h-full overflow-auto relative">
        <table className={twMerge('w-full text-left border-collapse text-sm', className)} {...props}>
          {children}
        </table>
      </div>
    );
  },
  {
    Root: TableRoot,
    Header: TableHeader,
    Body: TableBody,
    Row: TableRow,
    Head: TableHead,
    Cell: TableCell,
    Skeleton: TableSkeleton,
    Empty: TableEmpty,
    Error: TableError,
    CheckboxHead: TableCheckboxHead,
    CheckboxCell: TableCheckboxCell,
    Virtual: TableVirtual,
  }
);

// ─── Legacy named exports ─────────────────────────────────────────────────────

export { TableHeader, TableRow, TableHead, TableCell, TableBody, TableSkeleton, TableEmpty, TableError };
