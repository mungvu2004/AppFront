import React, { useState, useId, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { durationSeconds, EASE } from '../../lib/motion';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SegmentedControlOption<T extends string = string> {
  label: string;
  value: T;
  swatch?: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[];
  value?: T | undefined;
  defaultValue?: T | undefined;
  onChange?: ((value: T) => void) | undefined;
  className?: string | undefined;
  'aria-label'?: string | undefined;
  disabled?: boolean | undefined;
  isLoading?: boolean | undefined;
}

// ─── Logic hook ───────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export function useSegmentedControl<T extends string>({
  value,
  defaultValue,
  onChange,
  options,
}: SegmentedControlProps<T>) {
  const initial = value ?? defaultValue ?? options[0]?.value;
  const [internalValue, setInternalValue] = useState<T>(initial as T);

  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  const handleChange = (newValue: T, disabled?: boolean) => {
    if (disabled || currentValue === newValue) return;
    if (!isControlled) setInternalValue(newValue);
    onChange?.(newValue);
  };

  return { currentValue, handleChange };
}

// ─── Segmented.Item ───────────────────────────────────────────────────────────

export interface SegmentedItemProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value'> {
  value: string;
  swatch?: string | undefined;
  isActive?: boolean;
  layoutId?: string;
}

const SegmentedItem = React.forwardRef<HTMLButtonElement, SegmentedItemProps>(
  ({ value, swatch, isActive = false, layoutId, children, className, ...props }, ref) => (
    <button
      ref={ref}
      data-value={value}
      role="radio"
      aria-checked={isActive}
      className={cn(
        'relative flex h-full flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded px-3 text-sm font-medium outline-none transition-colors duration-120',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-sunken',
        isActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary',
        props.disabled && 'cursor-not-allowed opacity-40 hover:text-text-secondary',
        className
      )}
      {...props}
    >
      {isActive && layoutId && (
        <motion.div
          layoutId={layoutId}
          className="absolute inset-0 rounded bg-bg-surface shadow-rest"
          transition={{ type: 'tween', ease: EASE.default, duration: durationSeconds('fast') }}
        />
      )}
      <span className="relative z-10 flex items-center justify-center gap-1.5">
        {swatch && (
          <span
            className="block h-3 w-3 rounded-sm"
            style={{ backgroundColor: swatch }}
            aria-hidden="true"
          />
        )}
        {children}
      </span>
    </button>
  )
);
SegmentedItem.displayName = 'SegmentedControl.Item';

// ─── Segmented.Root ───────────────────────────────────────────────────────────

export interface SegmentedRootProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const SegmentedRoot = React.forwardRef<HTMLDivElement, SegmentedRootProps>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      role="radiogroup"
      className={cn('relative flex h-9 items-center rounded-lg bg-bg-sunken p-1', className)}
      {...props}
    >
      {children}
    </div>
  )
);
SegmentedRoot.displayName = 'SegmentedControl.Root';

// ─── Namespace ────────────────────────────────────────────────────────────────

export const SegmentedControl = Object.assign(
  function SegmentedControlLegacy<T extends string = string>(props: SegmentedControlProps<T>) {
    const { options, className, 'aria-label': ariaLabel, disabled, isLoading } = props;
    const { currentValue, handleChange } = useSegmentedControl(props);
    const layoutId = useId();
    const containerRef = useRef<HTMLDivElement>(null);

    // Keyboard: ArrowLeft / ArrowRight navigate between segments
    const handleKeyDown = (e: React.KeyboardEvent) => {
      const activeIndex = options.findIndex((o) => o.value === currentValue);
      let nextIndex = -1;
      if (e.key === 'ArrowRight') nextIndex = (activeIndex + 1) % options.length;
      else if (e.key === 'ArrowLeft') nextIndex = (activeIndex - 1 + options.length) % options.length;
      if (nextIndex !== -1) {
        e.preventDefault();
        const opt = options[nextIndex];
        if (opt && !opt.disabled) handleChange(opt.value, opt.disabled);
        // Move focus to the button
        const btns = containerRef.current?.querySelectorAll<HTMLButtonElement>('button');
        btns?.[nextIndex]?.focus();
      }
    };

    if (isLoading) {
      return <div className={cn('h-9 w-full rounded-lg bg-bg-sunken animate-pulse', className)} />;
    }

    return (
      <SegmentedRoot
        className={className}
        aria-label={ariaLabel}
        ref={containerRef}
        onKeyDown={handleKeyDown}
      >
        {options.map((option) => {
          const isActive = currentValue === option.value;
          return (
            <SegmentedItem
              key={option.value}
              value={option.value}
              swatch={option.swatch}
              isActive={isActive}
              layoutId={`thumb-${layoutId}`}
              disabled={disabled || option.disabled}
              onClick={() => handleChange(option.value, option.disabled)}
            >
              {option.label}
            </SegmentedItem>
          );
        })}
      </SegmentedRoot>
    );
  },
  {
    Root: SegmentedRoot,
    Item: SegmentedItem,
  }
);
