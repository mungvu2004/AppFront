import React, { createContext, useContext } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown } from 'lucide-react';

// ─── Context ──────────────────────────────────────────────────────────────────

interface TableContextValue {
  sortKey: string | undefined;
  sortDir: 'asc' | 'desc' | null | undefined;
  onSort: ((key: string) => void) | undefined;
}

const TableContext = createContext<TableContextValue>({ sortKey: undefined, sortDir: undefined, onSort: undefined });

// ─── Table.Root ───────────────────────────────────────────────────────────────

export interface TableRootProps extends React.HTMLAttributes<HTMLDivElement> {
  sortKey?: string;
  sortDir?: 'asc' | 'desc' | null;
  onSort?: (key: string) => void;
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

const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(({
  selected,
  focused,
  isAttention,
  isFlash,
  layoutId,
  className,
  children,
  ...props
}, ref) => {
  const Component = (layoutId ? motion.tr : 'tr') as React.ElementType;

  return (
    <Component
      ref={ref}
      layout={!!layoutId}
      layoutId={layoutId}
      transition={{ duration: 0.26, ease: 'easeOut' }}
      aria-selected={selected}
      className={twMerge(
        'group h-10 border-b border-border-default/50 last:border-0 outline-none transition-colors',
        'hover:bg-bg-hover focus-visible:bg-bg-hover',
        selected && 'bg-bg-selected hover:bg-bg-selected',
        isFlash && 'bg-bg-flash hover:bg-bg-flash',
        focused && 'ring-2 ring-inset ring-accent',
        '[&>td:first-child]:relative [&>td:first-child]:before:absolute [&>td:first-child]:before:left-0 [&>td:first-child]:before:top-0 [&>td:first-child]:before:bottom-0 [&>td:first-child]:before:w-[2px] [&>td:first-child]:before:bg-accent [&>td:first-child]:before:origin-center [&>td:first-child]:before:transition-transform [&>td:first-child]:before:duration-120 [&>td:first-child]:before:ease-out',
        selected ? '[&>td:first-child]:before:scale-y-100' : '[&>td:first-child]:before:scale-y-0 group-hover:[&>td:first-child]:before:scale-y-100',
        isAttention && '[&>td]:relative [&>td]:after:absolute [&>td]:after:inset-0 [&>td]:after:pointer-events-none [&>td]:after:opacity-[0.06] [&>td]:after:bg-[image:repeating-linear-gradient(45deg,#000_0,#000_2px,transparent_2px,transparent_8px)]',
        className
      )}
      tabIndex={-1}
      {...props}
    >
      {children}
    </Component>
  );
});
TableRow.displayName = 'Table.Row';

// ─── Table.Head ───────────────────────────────────────────────────────────────

interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc' | null;
  onSort?: () => void;
}

function TableHead({
  className,
  children,
  sortable,
  sortKey: colKey,
  sortDirection,
  onSort,
  ...props
}: TableHeadProps) {
  const ctx = useContext(TableContext);

  // Support both local onSort and Context-driven onSort
  const handleSort = onSort ?? (ctx.onSort && colKey ? () => ctx.onSort!(colKey) : undefined);
  const activeDir = sortDirection ?? (ctx.sortKey === colKey ? ctx.sortDir : null);
  const isSortable = sortable || (!!ctx.onSort && !!colKey);

  const ariaSort = activeDir === 'asc' ? 'ascending' : activeDir === 'desc' ? 'descending' : isSortable ? 'none' : undefined;

  return (
    <th
      className={twMerge(
        'h-10 px-3 align-middle font-semibold text-[13px] leading-[18px] text-text-primary whitespace-nowrap',
        isSortable && 'cursor-pointer select-none hover:bg-bg-hover/50 group',
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
            'flex flex-col opacity-0 group-hover:opacity-50 transition-opacity',
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

function TableCell({ className, children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={twMerge('h-10 px-3 align-middle text-text-primary whitespace-nowrap', className)} {...props}>
      {children}
    </td>
  );
}
TableCell.displayName = 'Table.Cell';

// ─── Namespace ────────────────────────────────────────────────────────────────

export const Table = Object.assign(
  // Legacy API: <Table> wraps a native <table>
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
  }
);

// ─── Legacy named exports (backward compat) ───────────────────────────────────

export { TableHeader, TableRow, TableHead, TableCell, TableBody };
