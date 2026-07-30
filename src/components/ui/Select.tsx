import React, { forwardRef, useImperativeHandle } from 'react';
import { useSelect, UseSelectProps } from '../../hooks/useSelect';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends Omit<UseSelectProps<string>, 'options'> {
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  isReadOnly?: boolean;
  isLoading?: boolean;
  label?: string;
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  ({ value, onChange, options, placeholder = 'Select...', className, disabled, isReadOnly, isLoading, label }, ref) => {
    const {
      isOpen,
      toggle,
      highlightedIndex,
      setHighlightedIndex,
      selectOption,
      handleKeyDown,
      triggerRef,
      listboxRef,
    } = useSelect({ value, onChange, options });

    useImperativeHandle(ref, () => triggerRef.current as HTMLButtonElement);

    const selectedOption = options.find((o) => o.value === value);

    if (isLoading) {
      return (
        <div className="flex flex-col">
          {label && <span className="mb-2 text-[14px] font-medium text-text-secondary">{label}</span>}
          <div className="h-[38px] w-full rounded-lg bg-bg-hover animate-pulse" />
        </div>
      );
    }

    if (isReadOnly) {
      return (
        <div className="flex flex-col">
          {label && <span className="mb-2 text-[14px] font-medium text-text-secondary">{label}</span>}
          <div className="flex h-[38px] w-full items-center px-3 text-text-primary">
            {selectedOption ? selectedOption.label : placeholder}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col relative">
        {label && <span className="mb-2 text-[14px] font-medium text-text-secondary">{label}</span>}
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={toggle}
          onKeyDown={handleKeyDown}
          className={cn(
            'flex h-[38px] w-full items-center justify-between rounded-lg bg-bg-surface px-3',
            'border border-border-default transition-all duration-120',
            !disabled && 'hover:border-text-secondary',
            disabled && 'opacity-50 cursor-not-allowed bg-bg-sunken',
            'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface focus-visible:animate-focus-ring',
            className
          )}
        >
          <span className={cn('truncate', !selectedOption && 'text-text-muted')}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown
            className={cn('ml-2 h-[18px] w-[18px] flex-shrink-0 text-text-secondary transition-transform duration-180', {
              'rotate-180': isOpen,
            })}
          />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 z-50 pt-1">
            <div
              ref={listboxRef}
              className={cn(
                'max-h-[300px] overflow-auto rounded-xl bg-bg-surface p-2 shadow-float border border-border-default',
                'animate-dropdown-open origin-top'
              )}
            >
              {options.length === 0 ? (
                <div className="py-2 px-3 text-[14px] text-text-muted text-center">No options</div>
              ) : (
                options.map((option, index) => {
                  const isSelected = option.value === value;
                  const isHighlighted = index === highlightedIndex;

                  return (
                    <div
                      key={option.value}
                      className={cn(
                        'flex h-[36px] cursor-pointer items-center justify-between rounded-lg px-3 text-[14px]',
                        'transition-colors duration-120',
                        isSelected ? 'bg-bg-selected text-accent font-medium' : 'text-text-primary hover:bg-bg-hover',
                        isHighlighted && !isSelected && 'bg-bg-hover'
                      )}
                      onClick={() => selectOption(option.value)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <span className="truncate">{option.label}</span>
                      {isSelected && <Check className="ml-2 h-4 w-4 flex-shrink-0" />}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);
Select.displayName = 'Select';
