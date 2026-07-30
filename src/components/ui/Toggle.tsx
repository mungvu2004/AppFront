import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

export interface ToggleProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => Promise<void> | void;
  onError?: (error: unknown) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

// Tách logic và giao diện
// eslint-disable-next-line react-refresh/only-export-components
export function useToggle({
  checked,
  defaultChecked,
  onChange,
  onError,
}: ToggleProps) {
  const isControlled = checked !== undefined;
  const [internalChecked, setInternalChecked] = useState(defaultChecked ?? false);
  const [optimisticState, setOptimisticState] = useState<{ value: boolean } | null>(null);
  
  const baseChecked = isControlled ? checked : internalChecked;
  const currentChecked = optimisticState ? optimisticState.value : baseChecked;

  const toggle = async () => {
    const nextState = !currentChecked;

    // Start optimistic update
    setOptimisticState({ value: nextState });

    if (!isControlled) {
      setInternalChecked(nextState);
    }

    if (onChange) {
      try {
        await onChange(nextState);
        setOptimisticState(null);
      } catch (error) {
        // Rollback
        if (!isControlled) {
          setInternalChecked(baseChecked);
        }
        setOptimisticState(null);
        onError?.(error);
      }
    } else {
      setOptimisticState(null);
    }
  };

  return { currentChecked, toggle };
}

export function Toggle(props: ToggleProps) {
  const { disabled, className, id, 'aria-label': ariaLabel } = props;
  const { currentChecked, toggle } = useToggle(props);

  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={currentChecked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        if (!disabled) toggle();
      }}
      className={cn(
        'group relative flex h-6 w-11 items-center rounded-full p-0.5 outline-none transition-colors duration-180',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface focus-visible:animate-focus-ring',
        currentChecked ? 'bg-accent' : 'bg-bg-sunken',
        disabled && 'cursor-not-allowed opacity-40',
        className
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={cn(
          'block h-5 w-5 rounded-full bg-bg-surface shadow-rest',
          currentChecked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}
