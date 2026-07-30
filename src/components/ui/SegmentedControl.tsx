import React, { useId, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export interface SegmentedControlOption<T extends string = string> {
  label: string;
  value: T;
  swatch?: string; // Optional hex color for the 12px swatch
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[];
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  className?: string;
}

// Tách logic và giao diện
// eslint-disable-next-line react-refresh/only-export-components
export function useSegmentedControl<T extends string>({
  value,
  defaultValue,
  onChange,
  options,
}: SegmentedControlProps<T>) {
  // Ensure we always have a valid default if controlled value is missing on mount
  const initial = value ?? defaultValue ?? options[0]?.value;
  const [internalValue, setInternalValue] = useState<T>(initial as T);
  
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  const handleChange = (newValue: T, disabled?: boolean) => {
    if (disabled || currentValue === newValue) return;
    if (!isControlled) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  };

  return { currentValue, handleChange };
}

export function SegmentedControl<T extends string = string>(props: SegmentedControlProps<T>) {
  const { options, className } = props;
  const { currentValue, handleChange } = useSegmentedControl(props);
  const layoutId = useId();

  return (
    <div
      role="radiogroup"
      className={cn(
        'relative flex h-[38px] items-center rounded-lg bg-bg-sunken p-1',
        className
      )}
    >
      {options.map((option) => {
        const isActive = currentValue === option.value;

        return (
          <button
            key={option.value}
            role="radio"
            aria-checked={isActive}
            disabled={option.disabled}
            onClick={() => handleChange(option.value, option.disabled)}
            className={cn(
              'relative flex h-full flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded px-3 text-sm font-medium outline-none transition-colors duration-120',
              'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-sunken',
              isActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary',
              option.disabled && 'cursor-not-allowed opacity-40 hover:text-text-secondary'
            )}
          >
            {/* Active Thumb (animated) */}
            {isActive && (
              <motion.div
                layoutId={`thumb-${layoutId}`}
                className="absolute inset-0 rounded bg-bg-surface shadow-rest"
                transition={{
                  type: 'tween',
                  ease: [0.32, 0.72, 0, 1],
                  duration: 0.34,
                }}
              />
            )}

            {/* Label Content */}
            <span className="relative z-10 flex items-center justify-center gap-1.5">
              {option.swatch && (
                <span
                  className="block h-3 w-3 rounded-sm"
                  style={{ backgroundColor: option.swatch }}
                  aria-hidden="true"
                />
              )}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
