import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown } from 'lucide-react';

export function Table({ className, children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full h-full overflow-auto relative">
      <table className={twMerge('w-full text-left border-collapse text-sm', className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={twMerge('sticky top-0 z-10 bg-bg-sunken', className)} {...props}>
      {children}
    </thead>
  );
}

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  focused?: boolean;
  isAttention?: boolean;
  isFlash?: boolean;
}

export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps & { layoutId?: string }>(({ 
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
        // Accent bar on the left of the first cell
        '[&>td:first-child]:relative [&>td:first-child]:before:absolute [&>td:first-child]:before:left-0 [&>td:first-child]:before:top-0 [&>td:first-child]:before:bottom-0 [&>td:first-child]:before:w-[2px] [&>td:first-child]:before:bg-accent [&>td:first-child]:before:origin-center [&>td:first-child]:before:transition-transform [&>td:first-child]:before:duration-120 [&>td:first-child]:before:ease-out',
        selected ? '[&>td:first-child]:before:scale-y-100' : '[&>td:first-child]:before:scale-y-0 group-hover:[&>td:first-child]:before:scale-y-100',
        // Hatch overlay if attention
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

export function TableHead({ 
  className, 
  children,
  sortable,
  sortDirection,
  onSort,
  ...props 
}: React.ThHTMLAttributes<HTMLTableCellElement> & { 
  sortable?: boolean;
  sortDirection?: 'asc' | 'desc' | null;
  onSort?: () => void;
}) {
  return (
    <th 
      className={twMerge(
        'h-10 px-3 align-middle font-semibold text-[13px] leading-[18px] text-text-primary whitespace-nowrap',
        sortable && 'cursor-pointer select-none hover:bg-bg-hover/50 group',
        className
      )} 
      onClick={sortable ? onSort : undefined}
      {...props}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortable && (
          <span className={clsx(
            "flex flex-col opacity-0 group-hover:opacity-50 transition-opacity",
            sortDirection && "opacity-100 group-hover:opacity-100 text-accent"
          )}>
            {sortDirection === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </span>
        )}
      </div>
    </th>
  );
}

export function TableCell({ className, children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={twMerge('h-10 px-3 align-middle text-text-primary whitespace-nowrap', className)} {...props}>
      {children}
    </td>
  );
}
