import React from 'react';
import { motion } from 'framer-motion';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  checked?: boolean;
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
}

export function Checkbox({
  checked = false,
  indeterminate = false,
  onChange,
  disabled = false,
  readOnly = false,
  label,
  id,
  className = '',
  ...props
}: CheckboxProps) {
  const defaultId = React.useId();
  const internalId = id || defaultId;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' && !disabled && !readOnly) {
      e.preventDefault();
      onChange?.(!checked);
    }
  };

  return (
    <label 
      htmlFor={internalId}
      className={`flex items-center min-h-[32px] cursor-pointer outline-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      <div className="relative flex items-center justify-center">
        <input
          id={internalId}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled || readOnly}
          onChange={(e) => onChange?.(e.target.checked)}
          onKeyDown={handleKeyDown}
          {...props}
        />
        
        <motion.div
          className={`w-[18px] h-[18px] rounded-[6px] border-[1.5px] flex items-center justify-center transition-colors duration-120
            peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2
            ${checked || indeterminate ? 'bg-accent border-accent' : 'border-border-default bg-bg-surface'}
          `}
          whileTap={!disabled && !readOnly ? { scale: 0.94 } : {}}
          transition={{ duration: 0.12 }}
        >
          {indeterminate ? (
            <div className="w-[10px] h-[2px] bg-white rounded-full" />
          ) : (
            <svg 
              width="14" 
              height="14" 
              viewBox="0 0 14 14" 
              fill="none" 
              className={`text-white transition-opacity duration-120 ${checked ? 'opacity-100' : 'opacity-0'}`}
            >
              <motion.path
                d="M3 7L6 10L11 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: checked ? 1 : 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              />
            </svg>
          )}
        </motion.div>
      </div>
      
      {label && (
        <span className={`ml-2 text-[15px] leading-[24px] select-none ${disabled ? 'text-text-muted' : 'text-text-primary'}`}>
          {label}
        </span>
      )}
    </label>
  );
}
