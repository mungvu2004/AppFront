import React, { useState, useId, useRef } from 'react';
import { cn } from '../../lib/utils';

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

/* eslint-disable-next-line react-refresh/only-export-components -- hook logic đứng
   cạnh view của nó là khuôn tách logic/giao diện của mục D. Tách sang file riêng chỉ
   để làm vừa lòng Fast Refresh thì đổi kiến trúc lấy tiện nghi lúc phát triển. */
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
  /**
   * Có thì ô đang chọn vẽ con trượt nổi. Con trượt là một khối CSS nằm TRONG ô (`inset-0`), nên nó
   * luôn đúng chỗ ô — bản framer `layoutId` cũ đo vị trí một lần rồi chiếu lại, và lệch khỏi ô
   * khi khung cuộn hay đổi bề rộng (BUG-410). Đổi lại: con trượt nhảy, không trượt.
   */
  layoutId?: string;
}

const SegmentedItem = React.forwardRef<HTMLButtonElement, SegmentedItemProps>(
  ({ value, swatch, isActive = false, layoutId, children, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
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
        <span aria-hidden="true" className="absolute inset-0 rounded bg-bg-surface shadow-rest" data-segment-thumb />
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
    // Roving tabindex: one tab stop — the selected radio, else the first enabled one.
    const selected = options.find((o) => o.value === currentValue);
    const tabStopValue = selected && !selected.disabled ? selected.value : options.find((o) => !o.disabled)?.value;

    const handleKeyDown = (e: React.KeyboardEvent) => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (step === 0 || options.length === 0) return;
      e.preventDefault();
      // Relative to the FOCUSED radio (fallback: the selected one), skipping disabled options.
      const btns = containerRef.current?.querySelectorAll<HTMLButtonElement>('button');
      const focusedIndex = btns ? Array.from(btns).findIndex((b) => b === document.activeElement) : -1;
      const fromIndex = focusedIndex !== -1 ? focusedIndex : options.findIndex((o) => o.value === currentValue);
      for (let i = 1; i <= options.length; i += 1) {
        const nextIndex = (fromIndex + step * i + options.length * i) % options.length;
        const opt = options[nextIndex];
        if (opt && !opt.disabled) {
          handleChange(opt.value, opt.disabled);
          btns?.[nextIndex]?.focus();
          return;
        }
      }
    };

    if (isLoading) {
      return <div className={cn('h-9 w-full rounded-lg bg-border-default animate-pulse', className)} />;
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
              tabIndex={option.value === tabStopValue ? 0 : -1}
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
