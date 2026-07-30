import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { ContextMenuItem } from './useContextMenu';

// ─── ContextMenu.Root ─────────────────────────────────────────────────────────

export interface ContextMenuRootProps {
  isVisible: boolean;
  position: { x: number; y: number };
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

const ContextMenuRoot = forwardRef<HTMLDivElement, ContextMenuRootProps>(
  ({ isVisible, position, children, className, ...props }, ref) => {
    if (!isVisible) return null;

    return (
      <div
        ref={ref}
        role="menu"
        aria-label="Tùy chọn"
        className={cn(
          'absolute bg-bg-surface rounded-[12px] shadow-float py-1 z-50 flex flex-col min-w-[160px] animate-dropdown-open',
          className
        )}
        style={{ left: position.x, top: position.y }}
        onContextMenu={(e) => e.preventDefault()}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ContextMenuRoot.displayName = 'ContextMenu.Root';

// ─── ContextMenu.Item ─────────────────────────────────────────────────────────

export interface ContextMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isDestructive?: boolean | undefined;
  icon?: React.ReactNode;
  onSelect?: () => void;
  onClose?: () => void;
}

const ContextMenuItemComponent = forwardRef<HTMLButtonElement, ContextMenuItemProps>(
  ({ children, isDestructive, icon, onSelect, onClose, className, onClick, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      onSelect?.();
      onClose?.();
    };

    return (
      <button
        ref={ref}
        role="menuitem"
        onClick={handleClick}
        className={cn(
          'h-[36px] px-4 flex items-center gap-2 text-sm transition-colors',
          'hover:bg-bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent text-left w-full',
          isDestructive ? 'text-state-violation-text' : 'text-text-primary',
          className
        )}
        {...props}
      >
        {icon && <span className="w-4 h-4 flex items-center justify-center shrink-0" aria-hidden="true">{icon}</span>}
        {children}
      </button>
    );
  }
);
ContextMenuItemComponent.displayName = 'ContextMenu.Item';

// ─── ContextMenu.Separator ────────────────────────────────────────────────────

const ContextMenuSeparator = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="separator"
      className={cn('my-1 h-px bg-border-default mx-2', className)}
      {...props}
    />
  )
);
ContextMenuSeparator.displayName = 'ContextMenu.Separator';

// ─── Namespace ────────────────────────────────────────────────────────────────

export const ContextMenu = Object.assign(
  // Legacy API: <ContextMenu isVisible={...} position={...} items={[...]} onClose={...} />
  function ContextMenuLegacy({ isVisible, position, items, onClose }: LegacyContextMenuProps) {
    return (
      <ContextMenuRoot isVisible={isVisible} position={position} onClose={onClose}>
        {items.map((item) => (
          <ContextMenuItemComponent
            key={item.id}
            isDestructive={item.isDestructive}
            onSelect={item.action}
            onClose={onClose}
          >
            {item.label}
          </ContextMenuItemComponent>
        ))}
      </ContextMenuRoot>
    );
  },
  {
    Root: ContextMenuRoot,
    Item: ContextMenuItemComponent,
    Separator: ContextMenuSeparator,
  }
);

// ─── Legacy Types ─────────────────────────────────────────────────────────────

interface LegacyContextMenuProps {
  isVisible: boolean;
  position: { x: number; y: number };
  items: ContextMenuItem[];
  onClose: () => void;
}
