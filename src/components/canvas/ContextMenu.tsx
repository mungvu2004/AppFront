import React, { forwardRef, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { cn } from '../../lib/utils';
import type { ContextMenuGroup, ContextMenuItem as ContextMenuItemType } from '../../hooks/useContextMenu';

/** Menu width, for a caller that anchors the menu's right edge to its trigger. */
export const CONTEXT_MENU_WIDTH = 220;
const MENU_WIDTH = CONTEXT_MENU_WIDTH;
/** Gap kept between the menu and the viewport edge. */
const VIEWPORT_MARGIN = 8;

// ─── Kbd ──────────────────────────────────────────────────────────────────────

interface KbdProps {
  children: React.ReactNode;
}

function Kbd({ children }: KbdProps) {
  return (
    <kbd
      className={cn(
        'ml-auto font-mono text-[11px] text-text-muted leading-none',
        'px-1 py-0.5 rounded-sm bg-bg-sunken border border-border-default',
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

    // Viewport clamping — menu width 220. `clientWidth`, not `innerWidth`: the latter counts the
    // vertical scrollbar, which then covered the menu's right edge (BUG-116 at 768 px).
    const viewportWidth = typeof document !== 'undefined' ? document.documentElement.clientWidth : 1440;
    const safeLeft = Math.max(VIEWPORT_MARGIN, Math.min(position.x, viewportWidth - MENU_WIDTH - VIEWPORT_MARGIN));
    const safeTop = Math.max(VIEWPORT_MARGIN, position.y);

    // The height is only known once drawn: lift a menu that would run past the bottom edge.
    useLayoutEffect(() => {
      const menu = menuRef.current;
      if (!isVisible || !menu) return;
      const maxTop = document.documentElement.clientHeight - menu.offsetHeight - VIEWPORT_MARGIN;
      menu.style.top = `${String(Math.max(VIEWPORT_MARGIN, Math.min(safeTop, maxTop)))}px`;
    }, [isVisible, menuRef, safeTop]);

    // The position is read from the trigger once, at open. When the page re-lays out under an open menu
    // (1440 -> 900: the card dropped ~60 px and the menu covered its own button), move it by as much as the
    // trigger — the element focused at open — moved, each frame, so it rides the cards' layout animation too
    // (BUG-211). Closing on resize instead (QA-02b) lost the menu the person had just opened.
    // ponytail: one rect read per frame while open; a ResizeObserver set if menus ever stay open for long.
    useEffect(() => {
      const menu = menuRef.current;
      const anchor = document.activeElement;
      if (!isVisible || !menu || !(anchor instanceof HTMLElement) || anchor === document.body || menu.contains(anchor)) return;
      const start = anchor.getBoundingClientRect();
      let frame = requestAnimationFrame(function follow() {
        const now = anchor.getBoundingClientRect();
        const { clientWidth, clientHeight } = document.documentElement;
        const left = Math.max(VIEWPORT_MARGIN, Math.min(position.x + now.left - start.left, clientWidth - MENU_WIDTH - VIEWPORT_MARGIN));
        const top = Math.max(VIEWPORT_MARGIN, Math.min(position.y + now.top - start.top, clientHeight - menu.offsetHeight - VIEWPORT_MARGIN));
        if (now.left !== start.left || now.top !== start.top) Object.assign(menu.style, { left: `${String(left)}px`, top: `${String(top)}px` });
        frame = requestAnimationFrame(follow);
      });
      return () => cancelAnimationFrame(frame);
    }, [isVisible, menuRef, position.x, position.y]);

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

    // Focus item đầu tiên khi mở; đóng thì trả focus cho nơi đã mở (WCAG 2.4.3, A12) — trừ khi
    // hành động vừa chọn đã tự đặt focus ở chỗ khác (ô đổi tên tự focus).
    useEffect(() => {
      if (!isVisible || !menuRef.current) return;
      const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const first = menuRef.current.querySelector<HTMLElement>(
        '[role="menuitem"]:not([disabled]):not([aria-disabled="true"])'
      );
      const raf = requestAnimationFrame(() => first?.focus());
      return () => {
        cancelAnimationFrame(raf);
        const focused = document.activeElement;
        if (focused === null || focused === document.body) opener?.focus();
      };
    }, [isVisible, menuRef]);

    if (!isVisible) return null;

    return (
      <div
        ref={menuRef}
        role="menu"
        aria-label="Tuỳ chọn"
        tabIndex={-1}
        className={cn(
          'fixed z-9999 bg-bg-surface py-1 outline-hidden',
          'rounded-xl shadow-float',
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
          // 44 px rows below `sm` (a thumb target, like `Button`), 32 px from 640 px up (BUG-156).
          'w-full flex h-11 items-center gap-2 px-3 text-sm sm:h-8',
          'transition-colors duration-120 text-left',
          'hover:bg-bg-hover',
          'focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          isDestructive ? 'text-state-violation-text' : 'text-text-primary',
          className
        )}
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
