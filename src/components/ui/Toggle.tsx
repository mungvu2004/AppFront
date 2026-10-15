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
  /** Extra description ids (e.g. why the switch is locked), read after `description`. */
  'aria-describedby'?: string | undefined;
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
  // The span below carries `descId` alone; the caller's ids follow it on the switch (BUG-196).
  const describedBy = [descId, props['aria-describedby']].filter(Boolean).join(' ') || undefined;

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="h-5 w-9 rounded-full bg-border-default animate-pulse" />
        {label && <div className="h-4 w-20 rounded bg-border-default animate-pulse" />}
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
      aria-describedby={describedBy}
      disabled={disabled || isReadOnly}
      onClick={() => {
        if (!disabled && !isReadOnly) toggle();
      }}
      className={cn(
        // Hộp 36×24 thật (WCAG 2.5.8) mà rãnh nhìn thấy vẫn 36×20: lớp giả `::before` cũ cho vùng bấm 24
        // nhưng hộp phần tử vẫn 20, nên mọi phép đo vùng chạm (getBoundingClientRect, axe) vẫn đọc 20 (BUG-158).
        // `-my-0.5` trả lại 4 px ấy cho bố cục: hàng nào cũng giữ đúng chỗ như rãnh 20 px.
        'group relative flex h-6 w-9 -my-0.5 shrink-0 items-center rounded-full outline-none',
        (disabled || isReadOnly) && 'cursor-not-allowed opacity-40',
      )}
    >
      <span
        className={cn(
          'flex h-5 w-full items-center rounded-full p-0.5 transition-colors duration-180',
          // The focus ring hugs the visible 36×20 track, 2 px off on every side — on the 36×24 box it sat 4 px
          // above and below but 2 px at the sides, a pill fatter than the switch (review-1 #27).
          'group-focus-visible:ring-2 group-focus-visible:ring-accent group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-bg-surface group-focus-visible:animate-focus-ring',
          // Rãnh tắt bằng `--border-control` (≥ 3:1 với nền và với núm, cả hai chủ đề — WCAG 1.4.11);
          // `bg-sunken` cũ chỉ ~1,16:1 trên trắng nên công tắc tắt gần như vô hình.
          // `justify-end` moves the knob to the right when on; `layout` animates the move. It was lost
          // with the old 20 px translate in d9bfe4a4, so an "on" switch kept its knob on the left.
          currentChecked ? 'justify-end bg-accent' : 'bg-border-control',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'tween', ease: EASE.default, duration: durationSeconds('fast') }}
          className="block h-4 w-4 rounded-full bg-bg-surface shadow-rest"
        />
      </span>
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
            className="text-[14px] font-medium leading-5 text-text-primary select-none cursor-default"
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
