import React, {
  createContext,
  useContext,
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
} from 'react';
import { createPortal } from 'react-dom';
import { useSelect } from '../../hooks/useSelect';
import { useCompoundId } from '../../hooks/useCompoundId';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
// import { Skeleton } from '../feedback/Skeleton';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectContextValue {
  isOpen: boolean;
  value: string | undefined;
  onChange: ((val: string) => void) | undefined;
  disabled: boolean;
  highlightedIndex: number;
  setHighlightedIndex: (i: number) => void;
  selectOption: (val: string) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  toggle: () => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
  listboxRef: React.RefObject<HTMLDivElement>;
  triggerId: string;
  listboxId: string;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const SelectContext = createContext<SelectContextValue | null>(null);

function useSelectContext(componentName: string) {
  const ctx = useContext(SelectContext);
  if (!ctx) throw new Error(`<${componentName}> phải dùng bên trong <Select.Root>`);
  return ctx;
}

// ─── Select.Root ─────────────────────────────────────────────────────────────

export interface SelectRootProps {
  value?: string | undefined;
  onChange?: ((val: string) => void) | undefined;
  options?: SelectOption[] | undefined;
  isOpen?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  children: React.ReactNode;
  className?: string | undefined;
  disabled?: boolean | undefined;
}

function SelectRoot({
  value,
  onChange,
  options = [],
  isOpen: controlledIsOpen,
  onOpenChange,
  children,
  className,
  disabled = false,
}: SelectRootProps) {
  const { triggerId, contentId: listboxId } = useCompoundId('select');

  const ctx = useSelect({ value, onChange, options, isOpen: controlledIsOpen, onOpenChange });

  return (
    <SelectContext.Provider
      value={{
        ...ctx,
        value,
        onChange,
        disabled,
        triggerId,
        listboxId,
      }}
    >
      <div className={cn('relative flex flex-col', className)}>{children}</div>
    </SelectContext.Provider>
  );
}
SelectRoot.displayName = 'Select.Root';

// ─── Select.Label ─────────────────────────────────────────────────────────────

const SelectLabel = forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ children, className, ...props }, ref) => {
    const { triggerId } = useSelectContext('Select.Label');
    return (
      <label
        ref={ref}
        htmlFor={triggerId}
        className={cn('mb-2 text-[14px] font-medium text-text-secondary', className)}
        {...props}
      >
        {children}
      </label>
    );
  },
);
SelectLabel.displayName = 'Select.Label';

// ─── Select.Trigger ───────────────────────────────────────────────────────────

export interface SelectTriggerProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  placeholder?: string;
  options?: SelectOption[];
}

const SelectTrigger = forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ placeholder = 'Chọn...', options = [], className, ...props }, ref) => {
    const { isOpen, value, disabled, toggle, handleKeyDown, triggerRef, triggerId, listboxId } =
      useSelectContext('Select.Trigger');

    useImperativeHandle(ref, () => triggerRef.current as HTMLButtonElement);

    const selectedOption = options.find((o) => o.value === value);

    return (
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex h-[38px] w-full items-center justify-between rounded-lg bg-bg-surface px-3',
          'border border-border-default transition-all duration-120',
          !disabled && 'hover:border-text-secondary',
          disabled && 'opacity-50 cursor-not-allowed bg-bg-sunken',
          'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface focus-visible:animate-focus-ring',
          className,
        )}
        {...props}
      >
        <span className={cn('truncate text-[14px]', !selectedOption && 'text-text-muted')}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            'ml-2 h-[18px] w-[18px] flex-shrink-0 text-text-secondary transition-transform duration-180',
            isOpen && 'rotate-180',
          )}
        />
      </button>
    );
  },
);
SelectTrigger.displayName = 'Select.Trigger';

// ─── Select.Content ───────────────────────────────────────────────────────────

const SelectContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className }, ref) => {
    const { isOpen, listboxRef, listboxId, triggerId, triggerRef } =
      useSelectContext('Select.Content');
    const [rect, setRect] = useState<DOMRect | null>(null);

    // Đo trigger mỗi khi dropdown mở hoặc window resize/scroll
    useEffect(() => {
      if (!isOpen || !triggerRef.current) return;
      const measure = () => setRect(triggerRef.current!.getBoundingClientRect());
      measure();
      window.addEventListener('resize', measure);
      window.addEventListener('scroll', measure, true);
      return () => {
        window.removeEventListener('resize', measure);
        window.removeEventListener('scroll', measure, true);
      };
    }, [isOpen, triggerRef]);

    const mergedRef = (node: HTMLDivElement | null) => {
      (listboxRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    };

    const dropdown = (
      <AnimatePresence>
        {isOpen && rect && (
          <motion.div
            ref={mergedRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={triggerId}
            initial={{ opacity: 0, scaleY: 0.96 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0.96, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className={cn(
              'max-h-[300px] overflow-auto rounded-xl bg-bg-surface p-2 shadow-float border border-border-default origin-top',
              className,
            )}
            style={{
              position: 'fixed',
              top: rect.bottom + 4,
              left: rect.left,
              width: rect.width,
              zIndex: 9999,
            }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    );

    return typeof document !== 'undefined' ? createPortal(dropdown, document.body) : null;
  },
);
SelectContent.displayName = 'Select.Content';

// ─── Select.Item ──────────────────────────────────────────────────────────────

export interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  children: React.ReactNode;
  index?: number;
}

const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(
  ({ value: itemValue, children, className, index = -1, ...props }, ref) => {
    const {
      value: selectedValue,
      highlightedIndex,
      setHighlightedIndex,
      selectOption,
    } = useSelectContext('Select.Item');

    const isSelected = itemValue === selectedValue;
    const isHighlighted = index === highlightedIndex;

    return (
      <div
        ref={ref}
        role="option"
        aria-selected={isSelected}
        tabIndex={-1}
        className={cn(
          'flex h-[36px] cursor-pointer items-center justify-between rounded-lg px-3 text-[14px]',
          'transition-colors duration-120',
          isSelected
            ? 'bg-bg-selected text-accent font-medium'
            : 'text-text-primary hover:bg-bg-hover',
          isHighlighted && !isSelected && 'bg-bg-hover',
          className,
        )}
        onClick={() => selectOption(itemValue)}
        onMouseEnter={() => index >= 0 && setHighlightedIndex(index)}
        {...props}
      >
        <span className="truncate">{children}</span>
        {isSelected && <Check className="ml-2 h-4 w-4 flex-shrink-0" />}
      </div>
    );
  },
);
SelectItem.displayName = 'Select.Item';

// ─── Select.Empty ─────────────────────────────────────────────────────────────

const SelectEmpty = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('py-2 px-3 text-[14px] text-text-muted text-center', className)}
      {...props}
    >
      {children ?? 'Không có lựa chọn'}
    </div>
  ),
);
SelectEmpty.displayName = 'Select.Empty';

// ─── Select.Skeleton ─────────────────────────────────────────────────────────

const SelectSkeleton = forwardRef<HTMLDivElement, { label?: React.ReactNode; className?: string }>(
  ({ label, className }, ref) => (
    <div ref={ref} className={cn('flex flex-col', className)}>
      {label && <span className="mb-2 text-[14px] font-medium text-text-secondary">{label}</span>}
      <div className="h-[38px] w-full rounded-lg bg-bg-sunken animate-pulse motion-reduce:animate-none" />
    </div>
  ),
);
SelectSkeleton.displayName = 'Select.Skeleton';

// ─── Select — Namespace ───────────────────────────────────────────────────────

export const Select = Object.assign(
  // Legacy API — backward compatible: <Select options={...} value={...} onChange={...} />
  forwardRef<HTMLButtonElement, LegacySelectProps>(function SelectLegacy(
    {
      value,
      onChange,
      options = [],
      placeholder = 'Chọn...',
      className,
      disabled = false,
      isReadOnly = false,
      isLoading = false,
      label,
    },
    ref,
  ) {
    if (isLoading) return <SelectSkeleton label={label} />;

    if (isReadOnly) {
      const selectedOption = options.find((o) => o.value === value);
      return (
        <div className="flex flex-col">
          {label && (
            <span className="mb-2 text-[14px] font-medium text-text-secondary">{label}</span>
          )}
          <div className="flex h-[38px] w-full items-center px-3 text-text-primary">
            {selectedOption ? selectedOption.label : placeholder}
          </div>
        </div>
      );
    }

    return (
      <SelectRoot
        value={value}
        onChange={onChange}
        options={options}
        disabled={disabled}
        className={className}
      >
        {label && <SelectLabel>{label}</SelectLabel>}
        <SelectTrigger ref={ref} placeholder={placeholder} options={options} />
        <SelectContent>
          {options.length === 0 ? (
            <SelectEmpty />
          ) : (
            options.map((option, index) => (
              <SelectItem key={option.value} value={option.value} index={index}>
                {option.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </SelectRoot>
    );
  }),
  {
    Root: SelectRoot,
    Label: SelectLabel,
    Trigger: SelectTrigger,
    Content: SelectContent,
    Item: SelectItem,
    Empty: SelectEmpty,
    Skeleton: SelectSkeleton,
  },
);

Select.displayName = 'Select';

// ─── Legacy Props ─────────────────────────────────────────────────────────────

export interface LegacySelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  isReadOnly?: boolean;
  isLoading?: boolean;
  label?: string;
}
