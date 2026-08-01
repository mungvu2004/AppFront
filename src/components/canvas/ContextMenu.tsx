import React, { forwardRef, useRef, useEffect, useCallback } from 'react';
import { cn } from '../../lib/utils';
import type { ContextMenuGroup, ContextMenuItem as ContextMenuItemType } from '../../hooks/useContextMenu';

const MENU_WIDTH = 220;
const ROW_HEIGHT = 32;

// ─── Kbd ──────────────────────────────────────────────────────────────────────

interface KbdProps {
  children: React.ReactNode;
}

function Kbd({ children }: KbdProps) {
  return (
    <kbd
      className={cn(
        'ml-auto font-mono text-[11px] text-text-muted leading-none',
        'px-1 py-0.5 rounded-[4px] bg-bg-sunken border border-border-default',
        'shrink-0'
      )}
    >
      {children}
    </kbd>
  );
}

// ─── ContextMenu.Root ─────────────────────────────────────────────────────────

interface ContextMenuRootProps {
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

    // Viewport clamping — menu width 220
    const safeLeft = Math.min(position.x, (typeof window !== 'undefined' ? window.innerWidth : 1440) - MENU_WIDTH - 8);
    const safeTop  = Math.min(position.y, (typeof window !== 'undefined' ? window.innerHeight : 900) - 8);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        const menu = menuRef.current;
        if (!menu) return;
        const items = Array.from(
          menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled]):not([aria-disabled="true"])')
        );
        const active = document.activeElement as HTMLElement;
        const idx = items.indexOf(active);

        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            items[(idx + 1) % items.length]?.focus();
            break;
          case 'ArrowUp':
            e.preventDefault();
            items[(idx - 1 + items.length) % items.length]?.focus();
            break;
          case 'Home':
            e.preventDefault();
            items[0]?.focus();
            break;
          case 'End':
            e.preventDefault();
            items[items.length - 1]?.focus();
            break;
          case 'Escape':
            e.preventDefault();
            onClose?.();
            break;
          case 'Tab':
            e.preventDefault();
            break;
        }
      },
      [menuRef, onClose]
    );

    // Focus item đầu tiên khi mở
    useEffect(() => {
      if (!isVisible || !menuRef.current) return;
      const first = menuRef.current.querySelector<HTMLElement>(
        '[role="menuitem"]:not([disabled]):not([aria-disabled="true"])'
      );
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
          'fixed z-[9999] bg-bg-surface py-1 outline-none',
          'rounded-[12px] shadow-float',
          'animate-dropdown-open', // 120ms từ tailwind config
          className
        )}
        style={{
          left: safeLeft,
          top: safeTop,
          width: MENU_WIDTH,
          minWidth: MENU_WIDTH,
        }}
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

interface ContextMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isDestructive?: boolean | undefined;
  icon?: React.ReactNode | undefined;
  kbd?: string | undefined;
  onSelect?: (() => void) | undefined;
  onClose?: (() => void) | undefined;
}

const ContextMenuItemComponent = forwardRef<HTMLButtonElement, ContextMenuItemProps>(
  ({ children, isDestructive, icon, kbd, onSelect, onClose, className, onClick, disabled, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
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
        disabled={disabled}
        aria-disabled={disabled}
        className={cn(
          'w-full flex items-center gap-2 px-3 text-sm',
          'transition-colors duration-120 text-left',
          'hover:bg-bg-hover',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          isDestructive ? 'text-state-violation-text' : 'text-text-primary',
          className
        )}
        style={{ height: ROW_HEIGHT }}
        {...props}
      >
        {icon && (
          <span className="w-4 h-4 flex items-center justify-center shrink-0 text-text-muted" aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="flex-1 truncate">{children}</span>
        {kbd && <Kbd>{kbd}</Kbd>}
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
      className={cn('my-1 h-px bg-border-default mx-3', className)}
      {...props}
    />
  )
);
ContextMenuSeparator.displayName = 'ContextMenu.Separator';

// ─── ContextMenu.Groups (helper) ─────────────────────────────────────────────

interface ContextMenuGroupsProps {
  groups: ContextMenuGroup[];
  onClose?: () => void;
}

function ContextMenuGroups({ groups, onClose }: ContextMenuGroupsProps) {
  return (
    <>
      {groups.map((group, gi) => (
        <React.Fragment key={group.id}>
          {gi > 0 && <ContextMenuSeparator />}
          {group.items.map((item: ContextMenuItemType) => (
            <ContextMenuItemComponent
              key={item.id}
              isDestructive={item.isDestructive}
              kbd={item.kbd}
              onSelect={item.action}
              onClose={onClose}
              disabled={item.isDisabled}
            >
              {item.label}
            </ContextMenuItemComponent>
          ))}
        </React.Fragment>
      ))}
    </>
  );
}

// ─── Namespace export ─────────────────────────────────────────────────────────

interface ContextMenuDefaultProps {
  isVisible: boolean;
  position: { x: number; y: number };
  groups: ContextMenuGroup[];
  onClose: () => void;
}

export const ContextMenu = Object.assign(
  function ContextMenuDefault({ isVisible, position, groups, onClose }: ContextMenuDefaultProps) {
    return (
      <ContextMenuRoot isVisible={isVisible} position={position} onClose={onClose}>
        <ContextMenuGroups groups={groups} onClose={onClose} />
      </ContextMenuRoot>
    );
  },
  {
    Root: ContextMenuRoot,
    Item: ContextMenuItemComponent,
    Separator: ContextMenuSeparator,
    Groups: ContextMenuGroups,
    Kbd,
  }
);

// Re-export types
export type { ContextMenuGroup, ContextMenuItemType as ContextMenuItemData };
