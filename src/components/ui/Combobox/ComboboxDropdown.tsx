/**
 * The parts of a combobox that are drawn into a portal, not into the page.
 *
 * Content, search box, listbox, option, empty message, and the auto-list the
 * legacy wrapper uses. Split out of `Combobox.tsx` under invariant R-22 along
 * the line that already existed: everything here lives on `document.body` and
 * is positioned from a measured rectangle, so none of it takes part in the
 * layout its trigger sits in.
 *
 * **The portal is the reason the position is measured rather than inherited.**
 * A dropdown rendered in place gets clipped by any ancestor with `overflow:
 * hidden` — a table cell, a drawer, a card. Going through the portal escapes
 * the clipping and costs a listener on `resize` and on `scroll` in the capture
 * phase, so the panel keeps up with the trigger.
 *
 * Motion comes from `@/components/motion`, never from `framer-motion` directly:
 * `local/no-framer-outside-motion` (invariant R-39) enforces the single gate
 * where `reducedMotion="user"` is set, so a person who asked the system for
 * less movement gets it here without this file having to ask.
 */
import React, { forwardRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Search } from 'lucide-react';

import { AnimatePresence, motion } from '@/components/motion';
import { durationSeconds, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';

import { useComboboxContext } from './context';

// ─── Combobox.Content ─────────────────────────────────────────────────────────

export const ComboboxContent = forwardRef<HTMLDivElement, { children: React.ReactNode; className?: string }>(
  ({ children, className }, ref) => {
    const { isOpen, triggerRef } = useComboboxContext('Combobox.Content');
    const [rect, setRect] = useState<DOMRect | null>(null);

    useEffect(() => {
      if (!isOpen || !triggerRef.current) return;
      const measure = () => setRect(triggerRef.current!.getBoundingClientRect());
      measure();
      window.addEventListener('resize', measure);
      window.addEventListener('scroll', measure, true);
      return () => {
        window.removeEventListener('resize', measure);
        window.removeEventListener('scroll', measure, true);
      };
    }, [isOpen, triggerRef]);

    const dropdown = (
      <AnimatePresence>
        {isOpen && rect && (
          <motion.div
            ref={ref}
            initial={{ opacity: 0, scaleY: 0.96 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0.96, transition: { duration: durationSeconds('instant') } }}
            transition={{ duration: durationSeconds('fast'), ease: EASE.standard }}
            className={cn(
              'flex flex-col rounded-xl bg-bg-surface shadow-float border border-border-default origin-top',
              className
            )}
            style={{
              position: 'fixed',
              top: rect.bottom + 4,
              left: rect.left,
              width: rect.width,
              zIndex: 9999,
            }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    );

    return typeof document !== 'undefined' ? createPortal(dropdown, document.body) : null;
  }
);
ComboboxContent.displayName = 'Combobox.Content';

// ─── Combobox.Search ──────────────────────────────────────────────────────────

export const ComboboxSearch = forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>>(
  ({ className, ...props }, ref) => {
    const { query, setQuery, handleKeyDown, inputRef, listboxId, searchId } =
      useComboboxContext('Combobox.Search');

    const mergedRef = (node: HTMLInputElement | null) => {
      (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
    };

    return (
      <div className="p-2 border-b border-border-default">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 h-[16px] w-[16px] text-text-muted pointer-events-none" aria-hidden="true" />
          <input
            ref={mergedRef}
            id={searchId}
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={true}
            className={cn(
              'h-[36px] w-full rounded-lg bg-bg-sunken pl-9 pr-3 text-[14px] text-text-primary outline-none',
              'focus:ring-2 focus:ring-accent',
              className
            )}
            placeholder="Tìm kiếm..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            {...props}
          />
        </div>
      </div>
    );
  }
);
ComboboxSearch.displayName = 'Combobox.Search';

// ─── Combobox.List ────────────────────────────────────────────────────────────

export const ComboboxList = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => {
    const { listboxRef, listboxId, triggerId } = useComboboxContext('Combobox.List');

    const mergedRef = (node: HTMLDivElement | null) => {
      (listboxRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    };

    return (
      <div
        ref={mergedRef}
        id={listboxId}
        role="listbox"
        aria-labelledby={triggerId}
        className={cn('max-h-[250px] overflow-auto p-2', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ComboboxList.displayName = 'Combobox.List';

// ─── Combobox.Item ────────────────────────────────────────────────────────────

export interface ComboboxItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  children: React.ReactNode;
  index?: number;
}

export const ComboboxItem = forwardRef<HTMLDivElement, ComboboxItemProps>(
  ({ value: itemValue, children, className, index = -1, ...props }, ref) => {
    const { value: selectedValue, highlightedIndex, setHighlightedIndex, selectOption } =
      useComboboxContext('Combobox.Item');

    const isSelected = itemValue === selectedValue;
    const isHighlighted = index === highlightedIndex;

    return (
      <div
        ref={ref}
        role="option"
        aria-selected={isSelected}
        tabIndex={-1}
        className={cn(
          'flex h-[36px] cursor-pointer items-center justify-between rounded-lg px-3 text-[14px]',
          'transition-colors duration-120',
          isSelected ? 'bg-bg-selected text-accent font-medium' : 'text-text-primary hover:bg-bg-hover',
          isHighlighted && !isSelected && 'bg-bg-hover',
          className
        )}
        onClick={() => selectOption(itemValue)}
        onMouseEnter={() => index >= 0 && setHighlightedIndex(index)}
        {...props}
      >
        <span className="truncate">{children}</span>
        {isSelected && <Check className="ml-2 h-4 w-4 flex-shrink-0" />}
      </div>
    );
  }
);
ComboboxItem.displayName = 'Combobox.Item';

// ─── Combobox.Empty ───────────────────────────────────────────────────────────

export const ComboboxEmpty = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => {
    const { query } = useComboboxContext('Combobox.Empty');
    return (
      <div
        ref={ref}
        className={cn('py-4 px-3 text-[14px] text-text-muted text-center', className)}
        {...props}
      >
        {children ?? (
          <span>
            Không tìm thấy{' '}
            <span className="text-text-primary break-all">"{query}"</span>
          </span>
        )}
      </div>
    );
  }
);
ComboboxEmpty.displayName = 'Combobox.Empty';

// ─── Internal auto-list ───────────────────────────────────────────────────────

export function ComboboxAutoList() {
  const ctx = useComboboxContext('ComboboxAutoList');
  return ctx.filteredOptions.length === 0 ? (
    <ComboboxEmpty />
  ) : (
    <>
      {ctx.filteredOptions.map((option, index) => (
        <ComboboxItem key={option.value} value={option.value} index={index}>
          {option.label}
        </ComboboxItem>
      ))}
    </>
  );
}
