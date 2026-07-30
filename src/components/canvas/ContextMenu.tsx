import React, { forwardRef, useRef, useEffect, useCallback } from 'react';
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
  ({ isVisible, position, children, onClose, className }, ref) => {
    const internalRef = useRef<HTMLDivElement>(null);
    const menuRef = (ref as React.RefObject<HTMLDivElement>) ?? internalRef;

    // Viewport boundary clamping: đảm bảo menu không vượt ra ngoài màn hình
    const safeLeft = Math.min(position.x, window.innerWidth - 180);
    const safeTop  = Math.min(position.y, window.innerHeight - 40); // 40 = min height estimate

    // ArrowUp/ArrowDown/Home/End navigation (ARIA Menu Pattern)
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
      const menu = menuRef.current;
      if (!menu) return;
      const items = Array.from(
        menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')
      );
      const active = document.activeElement as HTMLElement;
      const idx = items.indexOf(active);

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const next = items[(idx + 1) % items.length];
          next?.focus();
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const prev = items[(idx - 1 + items.length) % items.length];
          prev?.focus();
          break;
        }
        case 'Home': {
          e.preventDefault();
          items[0]?.focus();
          break;
        }
        case 'End': {
          e.preventDefault();
          items[items.length - 1]?.focus();
          break;
        }
        case 'Escape': {
          e.preventDefault();
          onClose?.();
          break;
        }
        case 'Tab': {
          // Ngăn focus thoát ra ngoài menu
          e.preventDefault();
          break;
        }
      }
    }, [menuRef, onClose]);

    // Focus item đầu tiên khi menu mở
    useEffect(() => {
      if (!isVisible || !menuRef.current) return;
      const first = menuRef.current.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])');
      // Delay nhỏ để animation hoàn tất trước khi focus
      const raf = requestAnimationFrame(() => first?.focus());
      return () => cancelAnimationFrame(raf);
    }, [isVisible, menuRef]);

    if (!isVisible) return null;

    return (
      <div
        ref={menuRef}
        role="menu"
        aria-label="Tùy chọn"
        tabIndex={-1}
        className={cn(
          'fixed bg-bg-surface rounded-[12px] shadow-float py-1 z-[9999] flex flex-col min-w-[160px] animate-dropdown-open outline-none',
          className
        )}
        style={{ left: safeLeft, top: safeTop }}
        onKeyDown={handleKeyDown}
        onContextMenu={(e) => e.preventDefault()}
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
        type="button"
        role="menuitem"
        onClick={handleClick}
        className={cn(
          'h-[36px] px-4 flex items-center gap-2 text-sm transition-colors duration-120',
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
      aria-orientation="horizontal"
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
