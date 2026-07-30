import React, { useRef, useEffect } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxLength?: number;
  label?: string;
  error?: string;
}

export function Textarea({
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
}: TextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const defaultId = React.useId();
  const internalId = id || defaultId;

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      // min 3 rows approx 72px, max 8 rows approx 192px (assuming 24px line height)
      const scrollHeight = textareaRef.current.scrollHeight;
      const height = Math.max(72, Math.min(192, scrollHeight));
      textareaRef.current.style.height = `${height}px`;
      
      // Add scrollbar if it exceeds max height
      textareaRef.current.style.overflowY = scrollHeight > 192 ? 'auto' : 'hidden';
    }
    onChange?.(e);
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const height = Math.max(72, Math.min(192, scrollHeight));
      textareaRef.current.style.height = `${height}px`;
      textareaRef.current.style.overflowY = scrollHeight > 192 ? 'auto' : 'hidden';
    }
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
          ref={textareaRef}
          id={internalId}
          value={value}
          onChange={handleInput}
          disabled={disabled}
          readOnly={readOnly}
          maxLength={maxLength}
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
          <span className="text-[13px] text-state-violation">{error}</span>
          {maxLength && (
            <span className="text-[13px] text-text-muted ml-auto">
              {length} / {maxLength}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
