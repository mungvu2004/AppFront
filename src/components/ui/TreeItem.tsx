import React from 'react';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import { ChevronRight, Eye, EyeOff } from 'lucide-react';

interface TreeItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  level?: number;
  expanded?: boolean;
  onToggleExpand?: () => void;
  visible?: boolean;
  onToggleVisible?: () => void;
  colorChip?: string;
  count?: number;
  label: string;
}

export const TreeItem = React.forwardRef<HTMLButtonElement, TreeItemProps>(({
  level = 0,
  expanded = false,
  onToggleExpand,
  visible = true,
  onToggleVisible,
  colorChip,
  count,
  label,
  className,
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      className={twMerge(
        'group flex items-center w-full h-8 px-2 rounded-lg text-sm text-text-primary hover:bg-bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        className
      )}
      style={{ paddingLeft: `${(level * 16) + 8}px` }}
      {...props}
    >
      <div 
        role="button"
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand?.();
        }}
        className="flex items-center justify-center w-5 h-5 mr-1 rounded hover:bg-accent-wash text-text-secondary shrink-0"
      >
        <ChevronRight 
          size={18} 
          className={clsx(
            'transition-transform duration-180 ease-out',
            expanded ? 'rotate-90' : 'rotate-0'
          )} 
        />
      </div>

      {colorChip && (
        <div 
          className="w-3 h-3 rounded-sm mr-2 shrink-0 border border-border-default/50" 
          style={{ backgroundColor: colorChip }}
        />
      )}

      <span className="truncate mr-auto text-left">{label}</span>

      {count !== undefined && (
        <span className="ml-2 font-mono text-[13px] text-text-muted shrink-0">
          {count}
        </span>
      )}

      <div 
        role="button"
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisible?.();
        }}
        className={clsx(
          "ml-2 flex items-center justify-center w-6 h-6 rounded hover:bg-accent-wash text-text-secondary transition-opacity shrink-0",
          visible ? "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" : "opacity-100"
        )}
      >
        {visible ? <Eye size={14} /> : <EyeOff size={14} />}
      </div>
    </button>
  );
});

TreeItem.displayName = 'TreeItem';
