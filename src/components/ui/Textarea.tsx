import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { Skeleton } from '../feedback/Skeleton';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxLength?: number;
  label?: string;
  error?: string;
  hint?: string;
  isLoading?: boolean;
  isReadOnly?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    value,
    onChange,
    maxLength,
    disabled,
    readOnly,
    isReadOnly,
    isLoading,
    className = '',
    id,
    label,
    error,
    hint,
    ...props
  },
  forwardedRef
) {
  const internalRef = React.useRef<HTMLTextAreaElement>(null);
  const defaultId = React.useId();
  const internalId = id || defaultId;
  const errorId = error ? `${internalId}-error` : undefined;
  const hintId = hint ? `${internalId}-hint` : undefined;

  // Merge refs
  const setRef = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      (internalRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef)
        (forwardedRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
    },
    [forwardedRef]
  );

  const adjustHeight = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    const scrollHeight = el.scrollHeight;
    // 3 lines min (≈72px) – 10 lines max (≈240px)
    const height = Math.max(72, Math.min(240, scrollHeight));
    el.style.height = `${height}px`;
    el.style.overflowY = scrollHeight > 240 ? 'auto' : 'hidden';
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    adjustHeight(e.currentTarget);
    onChange?.(e);
  };

  React.useEffect(() => {
    if (internalRef.current) adjustHeight(internalRef.current);
  }, [value]);

  const length = String(value || '').length;
  const effectiveReadOnly = readOnly || isReadOnly;

  return (
    <div className={cn('flex flex-col w-full', className)}>
      {label && (
        <label htmlFor={internalId} className="text-[14px] font-medium text-text-secondary mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {isLoading ? (
          <Skeleton className="h-[72px] w-full rounded-lg" />
        ) : (
          <textarea
            ref={setRef}
            id={internalId}
            value={value}
            onChange={handleInput}
            disabled={disabled}
            readOnly={effectiveReadOnly}
            maxLength={maxLength}
            aria-invalid={error ? true : undefined}
            aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
            className={cn(
              'w-full min-h-[72px] max-h-[240px] px-3 py-2.5 text-[14px] leading-[22px] bg-bg-surface border rounded-lg outline-none resize-none',
              'transition-[height,border-color,box-shadow] duration-180',
              error
                ? 'border-state-violation focus-visible:ring-2 focus-visible:ring-state-violation focus-visible:ring-offset-2'
                : 'border-border-default focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
              !effectiveReadOnly && !disabled && !error && 'hover:border-text-secondary',
              disabled && 'opacity-50 cursor-not-allowed bg-bg-sunken',
              effectiveReadOnly && 'bg-bg-sunken focus-visible:ring-0 cursor-default'
            )}
            {...props}
          />
        )}
      </div>
      {!isLoading && (error || hint || maxLength) && (
        <div className="flex justify-between items-start mt-1.5">
          {error ? (
            <p id={errorId} role="alert" className="text-[13px] leading-[18px] text-state-violation-text flex-1">
              {error}
            </p>
          ) : hint ? (
            <p id={hintId} className="text-[13px] leading-[18px] text-text-muted flex-1">
              {hint}
            </p>
          ) : (
            <span />
          )}
          {maxLength && (
            <span className="text-[13px] text-text-muted ml-2 tabular-nums shrink-0" aria-live="polite">
              {length} / {maxLength}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';
