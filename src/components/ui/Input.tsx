import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';
// import { Skeleton } from '../feedback/Skeleton';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: React.ReactNode | undefined;
  error?: React.ReactNode | undefined;
  hint?: React.ReactNode | undefined;
  prefix?: React.ReactNode | undefined;
  suffix?: React.ReactNode | undefined;
  isLoading?: boolean | undefined;
  isReadOnly?: boolean | undefined;
  wrapperClassName?: string | undefined;
  flash?: boolean | undefined;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      hint,
      prefix,
      suffix,
      isLoading,
      isReadOnly,
      disabled,
      wrapperClassName,
      flash,
      id,
      'aria-describedby': callerDescribedBy,
      ...props
    },
    ref
  ) => {
    const defaultId = React.useId();
    const inputId = id || defaultId;
    const isError = !!error;
    const errorId = isError ? `${inputId}-error` : undefined;
    // Gợi ý chỉ hiện khi không có lỗi (xem khối dưới ô), nên chỉ trỏ tới nó lúc ấy.
    const hintId = !isError && hint ? `${inputId}-hint` : undefined;
    // Ghép, không đè: mô tả nơi gọi đưa vào vẫn đứng cạnh câu lỗi/gợi ý của chính ô; bỏ id trùng
    // (nơi gọi như `PasswordField` có thể đã ghép sẵn id lỗi này).
    const describedBy =
      [...new Set([callerDescribedBy, errorId, hintId].join(' ').split(/\s+/).filter(Boolean))].join(' ') ||
      undefined;

    return (
      <div className={cn('flex flex-col', wrapperClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="mb-2 text-[14px] font-medium leading-[20px] text-text-secondary"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center group">
          {isLoading ? (
            <div className="h-[46px] sm:h-[38px] w-full rounded-lg bg-border-default animate-pulse motion-reduce:animate-none" />
          ) : isReadOnly ? (
            <div className="flex h-[46px] sm:h-[38px] w-full items-center px-3 text-text-primary">
              {prefix && <span className="mr-2 flex-shrink-0 text-text-muted">{prefix}</span>}
              <span className="flex-1 truncate">{props.value as React.ReactNode}</span>
              {suffix && <span className="ml-2 flex-shrink-0 text-text-muted">{suffix}</span>}
            </div>
          ) : (
            /* 46 px under `sm`: the field inside the 1 px border is a 44 px touch target (BUG-048). */
            <div
              className={cn(
                'relative flex h-[46px] sm:h-[38px] w-full items-center rounded-lg bg-bg-surface',
                'border border-border-control transition-colors duration-120',
                isError && 'border-state-violation',
                !disabled && !isError && 'hover:border-text-primary',
                disabled && 'opacity-50 cursor-not-allowed bg-bg-sunken',
                flash && 'bg-bg-flash',
                'focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 focus-within:ring-offset-bg-surface focus-within:animate-focus-ring'
              )}
            >
              {prefix && (
                <div className="pl-3 pr-1 text-text-muted flex items-center justify-center">
                  {prefix}
                </div>
              )}
              <input
                id={inputId}
                ref={ref}
                disabled={disabled}
                aria-invalid={isError || undefined}
                className={cn(
                  'flex-1 h-full min-w-0 bg-transparent px-3 text-text-primary outline-none placeholder:text-text-muted',
                  prefix && 'pl-1',
                  suffix && 'pr-1',
                  className
                )}
                {...props}
                aria-describedby={describedBy}
              />
              {suffix && (
                <div className="pr-3 pl-1 text-[13px] font-mono text-text-muted flex items-center justify-center">
                  {suffix}
                </div>
              )}
            </div>
          )}
        </div>

        {!isLoading && !isReadOnly && (error || hint) && (
          <div className="mt-1.5 flex items-start">
            {error ? (
              <>
                <span className="mt-[6px] mr-2 h-[6px] w-[6px] flex-shrink-0 rounded-full bg-state-violation" aria-hidden="true" />
                <p id={`${inputId}-error`} role="alert" className="text-balance text-[13px] leading-[18px] text-state-violation-text">{error}</p>
              </>
            ) : hint ? (
              <p id={hintId} className="text-[13px] leading-[18px] text-text-muted">{hint}</p>
            ) : null}
          </div>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
