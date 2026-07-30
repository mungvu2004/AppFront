import React, { useRef, useEffect, forwardRef, useCallback } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxLength?: number;
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    value,
    onChange,
    maxLength,
    disabled,
    readOnly,
    className = '',
    id,
    label,
    error,
    ...props
  },
  forwardedRef
) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const defaultId = React.useId();
  const internalId = id || defaultId;
  const errorId = error ? `${internalId}-error` : undefined;

  // Merge refs: internal dùng cho auto-resize, external dùng cho caller
  const setRef = useCallback((node: HTMLTextAreaElement | null) => {
    (internalRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
  }, [forwardedRef]);

  const adjustHeight = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    const scrollHeight = el.scrollHeight;
    const height = Math.max(72, Math.min(192, scrollHeight));
    el.style.height = `${height}px`;
    el.style.overflowY = scrollHeight > 192 ? 'auto' : 'hidden';
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    adjustHeight(e.currentTarget);
    onChange?.(e);
  };

  useEffect(() => {
    if (internalRef.current) adjustHeight(internalRef.current);
  }, [value]);

  const length = String(value || '').length;

  return (
    <div className={`flex flex-col w-full ${className}`}>
      {label && (
        <label htmlFor={internalId} className="text-[13px] font-medium text-text-primary mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <textarea
          ref={setRef}
          id={internalId}
          value={value}
          onChange={handleInput}
          disabled={disabled}
          readOnly={readOnly}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={`w-full min-h-[72px] max-h-[192px] px-3 py-2 text-[15px] leading-[24px] bg-bg-surface border rounded-[8px] outline-none transition-[height,border-color,box-shadow] duration-180 resize-none
            ${error ? 'border-state-violation focus-visible:ring-2 focus-visible:ring-state-violation focus-visible:ring-offset-2' 
                    : 'border-border-default focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 hover:border-text-muted'}
            ${disabled ? 'opacity-50 cursor-not-allowed bg-bg-sunken' : ''}
            ${readOnly ? 'bg-bg-sunken focus-visible:ring-0 cursor-default' : ''}
          `}
          {...props}
        />
      </div>
      {(maxLength || error) && (
        <div className="flex justify-between items-center mt-1">
          <span id={errorId} role={error ? 'alert' : undefined} className="text-[13px] text-state-violation">{error}</span>
          {maxLength && (
            <span className="text-[13px] text-text-muted ml-auto" aria-live="polite">
              {length} / {maxLength}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';
