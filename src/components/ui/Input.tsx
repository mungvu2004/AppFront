import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { Skeleton } from '../feedback/Skeleton';

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
      ...props
    },
    ref
  ) => {
    const defaultId = React.useId();
    const inputId = id || defaultId;
    const isError = !!error;

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
            <Skeleton className="h-[38px] w-full rounded-lg" />
          ) : isReadOnly ? (
            <div className="flex h-[38px] w-full items-center px-3 text-text-primary">
              {prefix && <span className="mr-2 flex-shrink-0 text-text-muted">{prefix}</span>}
              <span className="flex-1 truncate">{props.value as React.ReactNode}</span>
              {suffix && <span className="ml-2 flex-shrink-0 text-text-muted">{suffix}</span>}
            </div>
          ) : (
            <div
              className={cn(
                'relative flex h-[38px] w-full items-center rounded-lg bg-bg-surface',
                'border border-border-default transition-colors duration-120',
                isError && 'border-state-violation',
                !disabled && !isError && 'hover:border-text-secondary',
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
                aria-describedby={isError ? `${inputId}-error` : undefined}
                className={cn(
                  'flex-1 h-full min-w-0 bg-transparent px-3 text-text-primary outline-none placeholder:text-text-muted',
                  prefix && 'pl-1',
                  suffix && 'pr-1',
                  className
                )}
                {...props}
              />
              {suffix && (
                <div className="pr-3 pl-1 text-[13px] font-mono text-text-muted flex items-center justify-center pointer-events-none">
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
                <p id={`${inputId}-error`} role="alert" className="text-[13px] leading-[18px] text-state-violation-text">{error}</p>
              </>
            ) : hint ? (
              <p className="text-[13px] leading-[18px] text-text-muted">{hint}</p>
            ) : null}
          </div>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
