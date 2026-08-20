import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { motion } from '../motion';
import { durationSeconds, EASE } from '../../lib/motion';

export interface ToggleProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => Promise<void> | void;
  onError?: (error: unknown) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
  /** Optional label displayed beside the toggle */
  label?: React.ReactNode;
  /** Optional description below the label */
  description?: React.ReactNode;
  isLoading?: boolean;
  isReadOnly?: boolean;
}

// Tách logic và giao diện
/* eslint-disable-next-line react-refresh/only-export-components -- như SegmentedControl:
   hook logic đứng cạnh view theo mục D, không tách chỉ vì Fast Refresh. */
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
    setOptimisticState({ value: nextState });
    if (!isControlled) setInternalChecked(nextState);

    if (onChange) {
      try {
        await onChange(nextState);
        setOptimisticState(null);
      } catch (error) {
        if (!isControlled) setInternalChecked(baseChecked);
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
  const { disabled, isReadOnly, isLoading, className, id, 'aria-label': ariaLabel, label, description } = props;
  const { currentChecked, toggle } = useToggle(props);

  const defaultId = React.useId();
  const toggleId = id || defaultId;
  const descId = description ? `${toggleId}-desc` : undefined;

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="h-5 w-9 rounded-full bg-bg-sunken animate-pulse" />
        {label && <div className="h-4 w-20 rounded bg-bg-sunken animate-pulse" />}
      </div>
    );
  }

  const btn = (
    <button
      type="button"
      id={toggleId}
      role="switch"
      aria-checked={currentChecked}
      aria-label={!label ? ariaLabel : undefined}
      aria-labelledby={label ? `${toggleId}-label` : undefined}
      aria-describedby={descId}
      disabled={disabled || isReadOnly}
      onClick={() => {
        if (!disabled && !isReadOnly) toggle();
      }}
      className={cn(
        'relative flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 outline-none transition-colors duration-180',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface focus-visible:animate-focus-ring',
        currentChecked ? 'bg-accent' : 'bg-bg-sunken',
        (disabled || isReadOnly) && 'cursor-not-allowed opacity-40',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'tween', ease: EASE.default, duration: durationSeconds('fast') }}
        className="block h-4 w-4 rounded-full bg-bg-surface shadow-rest"
      />
    </button>
  );

  if (!label && !description) {
    return <div className={className}>{btn}</div>;
  }

  return (
    <div className={cn('flex items-start gap-3', className)}>
      {btn}
      <div className="flex flex-col">
        {label && (
          <span
            id={`${toggleId}-label`}
            className="text-[14px] font-medium leading-[20px] text-text-primary select-none cursor-default"
          >
            {label}
          </span>
        )}
        {description && (
          <span id={descId} className="text-[13px] leading-[18px] text-text-secondary select-none">
            {description}
          </span>
        )}
      </div>
    </div>
  );
}
