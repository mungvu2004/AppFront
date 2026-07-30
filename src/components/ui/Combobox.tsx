import React, { forwardRef, useImperativeHandle } from 'react';
import { useCombobox, UseComboboxProps } from '../../hooks/useCombobox';
import { ChevronDown, Check, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SelectOption } from './Select';

export interface ComboboxProps extends Omit<UseComboboxProps<string>, 'options'> {
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  isReadOnly?: boolean;
  isLoading?: boolean;
  label?: string;
}

export const Combobox = forwardRef<HTMLButtonElement, ComboboxProps>(
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
      query,
      setQuery,
      filteredOptions,
      inputRef,
    } = useCombobox({ value, onChange, options });

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
              className={cn(
                'flex flex-col rounded-xl bg-bg-surface shadow-float border border-border-default',
                'animate-dropdown-open origin-top'
              )}
            >
              <div className="p-2 border-b border-border-default">
                <div className="relative flex items-center">
                  <Search className="absolute left-2.5 h-[16px] w-[16px] text-text-muted" />
                  <input
                    ref={inputRef}
                    className="h-[36px] w-full rounded-lg bg-bg-sunken pl-9 pr-3 text-[14px] text-text-primary outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Search..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                </div>
              </div>
              
              <div ref={listboxRef} className="max-h-[250px] overflow-auto p-2">
                {filteredOptions.length === 0 ? (
                  <div className="py-4 px-3 text-[14px] text-text-muted text-center">
                    Không tìm thấy kết quả <br />
                    <span className="text-text-primary break-all">"{query}"</span>
                  </div>
                ) : (
                  filteredOptions.map((option, index) => {
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
          </div>
        )}
      </div>
    );
  }
);
Combobox.displayName = 'Combobox';
