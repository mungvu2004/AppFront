import React, { forwardRef } from 'react';
import type { InputProps } from './Input';
import { Input } from './Input';
import type { UseNumericFieldProps } from '../../hooks/useNumericField';
import { useNumericField } from '../../hooks/useNumericField';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface NumericFieldProps
  extends Omit<InputProps, 'value' | 'onChange' | 'min' | 'max'>,
    UseNumericFieldProps {
  unit?: string;
}

export const NumericField = forwardRef<HTMLInputElement, NumericFieldProps>(
  ({ value, onChange, min, max, unit, className, disabled, isReadOnly, isLoading, ...props }, ref) => {
    const {
      displayValue,
      error,
      flash,
      handleChange,
      handleFocus,
      handleBlur,
      handleKeyDown,
      handleStepper,
    } = useNumericField({ value, onChange, min, max });

    const stepper = !disabled && !isReadOnly && !isLoading && (
      <div className="absolute left-1 top-1 bottom-1 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-120 z-10">
        <button
          type="button"
          tabIndex={-1}
          className="flex-1 px-1.5 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-t transition-colors"
          onMouseDown={(e) => handleStepper(1, e)}
        >
          <ChevronUp className="w-3 h-3 stroke-[2.5px]" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          className="flex-1 px-1.5 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-b transition-colors"
          onMouseDown={(e) => handleStepper(-1, e)}
        >
          <ChevronDown className="w-3 h-3 stroke-[2.5px]" />
        </button>
      </div>
    );

    return (
      <div className="relative group/numeric">
        <Input
          ref={ref}
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          error={error || props.error}
          flash={flash}
          disabled={disabled}
          isReadOnly={isReadOnly}
          isLoading={isLoading}
          suffix={unit}
          className={cn('font-mono text-[13px] leading-[20px] text-right', className)}
          // padding left to make room for steppers on hover
          prefix={stepper}
          {...props}
        />
      </div>
    );
  }
);
NumericField.displayName = 'NumericField';
