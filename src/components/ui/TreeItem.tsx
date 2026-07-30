import React from 'react';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import { ChevronRight, Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';

// ─── TreeItem ─────────────────────────────────────────────────────────────────
// Outer element là div[role="treeitem"] vì <button> không được chứa
// interactive elements con theo HTML spec.

interface TreeItemProps {
  level?: number;
  expanded?: boolean;
  onToggleExpand?: () => void;
  visible?: boolean;
  onToggleVisible?: () => void;
  colorChip?: string;
  count?: number;
  label: string;
  hasChildren?: boolean;
  selected?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  tabIndex?: number;
  className?: string;
  id?: string;
}

export const TreeItem = React.forwardRef<HTMLDivElement, TreeItemProps>((
  {
    level = 0,
    expanded = false,
    onToggleExpand,
    visible = true,
    onToggleVisible,
    colorChip,
    count,
    label,
    hasChildren = true,
    selected = false,
    onClick,
    onKeyDown,
    tabIndex = 0,
    className,
    id,
  },
  ref
) => {
  const handleRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
    }
    onKeyDown?.(e);
  };

  return (
    <div
      ref={ref}
      id={id}
      role="treeitem"
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected={selected}
      tabIndex={tabIndex}
      onClick={onClick}
      onKeyDown={handleRowKeyDown}
      className={cn(
        'group flex items-center w-full h-8 px-2 rounded-lg text-sm text-text-primary',
        'hover:bg-bg-hover outline-none',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        selected && 'bg-bg-selected',
        className
      )}
      style={{ paddingLeft: `${(level * 16) + 8}px` }}
    >
      {/* Expand toggle — standalone button, không lồng trong interactive parent */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={expanded ? 'Thu gọn' : 'Mở rộng'}
        aria-hidden={!hasChildren}
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand?.();
        }}
        className={twMerge(
          'flex items-center justify-center w-5 h-5 mr-1 rounded',
          'hover:bg-accent-wash text-text-secondary shrink-0',
          !hasChildren && 'pointer-events-none opacity-0'
        )}
      >
        <ChevronRight
          size={18}
          className={clsx(
            'transition-transform duration-180 ease-out',
            expanded ? 'rotate-90' : 'rotate-0'
          )}
        />
      </button>

      {colorChip && (
        <div
          className="w-3 h-3 rounded-sm mr-2 shrink-0 border border-border-default/50"
          style={{ backgroundColor: colorChip }}
          aria-hidden="true"
        />
      )}

      <span className="truncate mr-auto text-left select-none">{label}</span>

      {count !== undefined && (
        <span
          className="ml-2 font-mono text-[13px] text-text-muted shrink-0"
          aria-label={`${count} phần tử`}
        >
          {count}
        </span>
      )}

      {/* Visibility toggle — standalone button */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={visible ? 'Ẩn layer' : 'Hiện layer'}
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisible?.();
        }}
        className={clsx(
          'ml-2 flex items-center justify-center w-6 h-6 rounded',
          'hover:bg-accent-wash text-text-secondary transition-opacity shrink-0',
          visible ? 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100' : 'opacity-100'
        )}
      >
        {visible ? <Eye size={14} /> : <EyeOff size={14} />}
      </button>
    </div>
  );
});

TreeItem.displayName = 'TreeItem';
