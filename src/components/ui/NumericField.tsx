import React, { forwardRef } from 'react';
import type { InputProps } from './Input';
import { Input } from './Input';
import type { UseNumericFieldProps } from '../../hooks/useNumericField';
import { useNumericField } from '../../hooks/useNumericField';
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
    } = useNumericField({ value, onChange, min, max, unit });

    // No hover stepper: its two 24×18 px arrows sat over the left of the value,
    // appeared only under the pointer and could not be reached by Tab or touch
    // (BUG-158, BUG-163). ArrowUp/ArrowDown (Shift for ×10) step the value.
    return (
      <div className="relative">
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
          {...props}
        />
      </div>
    );
  }
);
NumericField.displayName = 'NumericField';
