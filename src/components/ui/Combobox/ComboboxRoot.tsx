/**
 * The parts of a combobox that are drawn where you put them.
 *
 * Root, label, trigger and the loading placeholder — everything visible while
 * the list is shut. The other half, `ComboboxDropdown.tsx`, renders into a
 * portal on `document.body`, and that difference is the seam this file was
 * split along under invariant R-22: these four take part in the page's layout,
 * those five do not.
 *
 * `ComboboxRoot` owns nothing but the ids and the provider. All of the state
 * comes from `useCombobox`, which is where the keyboard handling and the
 * filtering live — invariant A12 makes the keyboard the first-class path, so it
 * belongs in a hook that can be tested without rendering anything.
 */
import React, { forwardRef, useImperativeHandle } from 'react';
import { ChevronDown } from 'lucide-react';

import { useCombobox } from '@/hooks/useCombobox';
import { useCompoundId } from '@/hooks/useCompoundId';
import { cn } from '@/lib/utils';

import type { SelectOption } from '../Select';
import { ComboboxContext, useComboboxContext } from './context';

// ─── Combobox.Root ────────────────────────────────────────────────────────────

export interface ComboboxRootProps {
  value?: string | undefined;
  onChange?: ((val: string) => void) | undefined;
  options?: SelectOption[] | undefined;
  children: React.ReactNode;
  className?: string | undefined;
  disabled?: boolean | undefined;
}

export function ComboboxRoot({
  value,
  onChange,
  options = [],
  children,
  className,
  disabled = false,
}: ComboboxRootProps) {
  const { triggerId, contentId: listboxId } = useCompoundId('combobox');
  const searchId = `${triggerId}-search`;

  const ctx = useCombobox({ value, onChange, options });

  return (
    <ComboboxContext.Provider
      value={{
        ...ctx,
        value,
        onChange,
        disabled,
        triggerId,
        listboxId,
        searchId,
      }}
    >
      <div className={cn('relative flex flex-col', className)}>
        {children}
      </div>
    </ComboboxContext.Provider>
  );
}
ComboboxRoot.displayName = 'Combobox.Root';

// ─── Combobox.Label ───────────────────────────────────────────────────────────

export const ComboboxLabel = forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ children, className, ...props }, ref) => {
    const { triggerId } = useComboboxContext('Combobox.Label');
    return (
      <label
        ref={ref}
        htmlFor={triggerId}
        className={cn('mb-2 text-[14px] font-medium text-text-secondary', className)}
        {...props}
      >
        {children}
      </label>
    );
  }
);
ComboboxLabel.displayName = 'Combobox.Label';

// ─── Combobox.Trigger ─────────────────────────────────────────────────────────

export interface ComboboxTriggerProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  placeholder?: string;
  options?: SelectOption[];
}

export const ComboboxTrigger = forwardRef<HTMLButtonElement, ComboboxTriggerProps>(
  ({ placeholder = 'Chọn...', options = [], className, ...props }, ref) => {
    const { isOpen, value, disabled, toggle, handleKeyDown, triggerRef, triggerId, listboxId } =
      useComboboxContext('Combobox.Trigger');

    useImperativeHandle(ref, () => triggerRef.current as HTMLButtonElement);

    const selectedOption = options.find((o) => o.value === value);

    return (
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex h-[38px] w-full items-center justify-between rounded-lg bg-bg-surface px-3',
          'border border-border-default transition-all duration-120',
          !disabled && 'hover:border-text-secondary',
          disabled && 'opacity-50 cursor-not-allowed bg-bg-sunken',
          'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface focus-visible:animate-focus-ring',
          className
        )}
        {...props}
      >
        <span className={cn('truncate text-[14px]', !selectedOption && 'text-text-muted')}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            'ml-2 h-[18px] w-[18px] flex-shrink-0 text-text-secondary transition-transform duration-180',
            isOpen && 'rotate-180'
          )}
        />
      </button>
    );
  }
);
ComboboxTrigger.displayName = 'Combobox.Trigger';

// ─── Combobox.Skeleton ────────────────────────────────────────────────────────

export const ComboboxSkeleton = forwardRef<HTMLDivElement, { label?: React.ReactNode; className?: string }>(
  ({ label, className }, ref) => (
    <div ref={ref} className={cn('flex flex-col', className)}>
      {label && <span className="mb-2 text-[14px] font-medium text-text-secondary">{label}</span>}
      <div className="h-[38px] w-full rounded-lg bg-bg-sunken animate-pulse motion-reduce:animate-none" />
    </div>
  )
);
ComboboxSkeleton.displayName = 'Combobox.Skeleton';
