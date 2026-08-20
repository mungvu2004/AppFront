import React, {
  createContext,
  useContext,
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
} from 'react';
import { createPortal } from 'react-dom';
import { useCombobox } from '../../hooks/useCombobox';
import { useCompoundId } from '../../hooks/useCompoundId';
import { ChevronDown, Check, Search } from 'lucide-react';
import { durationSeconds, EASE } from '../../lib/motion';
import { cn } from '../../lib/utils';
import { AnimatePresence, motion } from '../motion';
import type { SelectOption } from './Select';
// import { Skeleton } from '../feedback/Skeleton';

// ─── Context ──────────────────────────────────────────────────────────────────

interface ComboboxContextValue {
  isOpen: boolean;
  value: string | undefined;
  onChange: ((val: string) => void) | undefined;
  disabled: boolean;
  highlightedIndex: number;
  setHighlightedIndex: (i: number) => void;
  selectOption: (val: string) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  toggle: () => void;
  query: string;
  setQuery: (q: string) => void;
  filteredOptions: SelectOption[];
  triggerRef: React.RefObject<HTMLButtonElement>;
  listboxRef: React.RefObject<HTMLDivElement>;
  inputRef: React.RefObject<HTMLInputElement>;
  triggerId: string;
  listboxId: string;
  searchId: string;
}

const ComboboxContext = createContext<ComboboxContextValue | null>(null);

function useComboboxContext(name: string) {
  const ctx = useContext(ComboboxContext);
  if (!ctx) throw new Error(`<${name}> phải dùng bên trong <Combobox.Root>`);
  return ctx;
}

// ─── Combobox.Root ────────────────────────────────────────────────────────────

export interface ComboboxRootProps {
  value?: string | undefined;
  onChange?: ((val: string) => void) | undefined;
  options?: SelectOption[] | undefined;
  children: React.ReactNode;
  className?: string | undefined;
  disabled?: boolean | undefined;
}

function ComboboxRoot({
  value,
  onChange,
  options = [],
  children,
  className,
  disabled = false,
}: ComboboxRootProps) {
  const { triggerId, contentId: listboxId } = useCompoundId('combobox');
  const searchId = `${triggerId}-search`;

  const ctx = useCombobox({ value, onChange, options });

  return (
    <ComboboxContext.Provider
      value={{
        ...ctx,
        value,
        onChange,
        disabled,
        triggerId,
        listboxId,
        searchId,
      }}
    >
      <div className={cn('relative flex flex-col', className)}>
        {children}
      </div>
    </ComboboxContext.Provider>
  );
}
ComboboxRoot.displayName = 'Combobox.Root';

// ─── Combobox.Label ───────────────────────────────────────────────────────────

const ComboboxLabel = forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ children, className, ...props }, ref) => {
    const { triggerId } = useComboboxContext('Combobox.Label');
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
  }
);
ComboboxLabel.displayName = 'Combobox.Label';

// ─── Combobox.Trigger ─────────────────────────────────────────────────────────

export interface ComboboxTriggerProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  placeholder?: string;
  options?: SelectOption[];
}

const ComboboxTrigger = forwardRef<HTMLButtonElement, ComboboxTriggerProps>(
  ({ placeholder = 'Chọn...', options = [], className, ...props }, ref) => {
    const { isOpen, value, disabled, toggle, handleKeyDown, triggerRef, triggerId, listboxId } =
      useComboboxContext('Combobox.Trigger');

    useImperativeHandle(ref, () => triggerRef.current as HTMLButtonElement);

    const selectedOption = options.find((o) => o.value === value);

    return (
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
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
          className
        )}
        {...props}
      >
        <span className={cn('truncate text-[14px]', !selectedOption && 'text-text-muted')}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            'ml-2 h-[18px] w-[18px] flex-shrink-0 text-text-secondary transition-transform duration-180',
            isOpen && 'rotate-180'
          )}
        />
      </button>
    );
  }
);
ComboboxTrigger.displayName = 'Combobox.Trigger';

// ─── Combobox.Content ─────────────────────────────────────────────────────────

const ComboboxContent = forwardRef<HTMLDivElement, { children: React.ReactNode; className?: string }>(
  ({ children, className }, ref) => {
    const { isOpen, triggerRef } = useComboboxContext('Combobox.Content');
    const [rect, setRect] = useState<DOMRect | null>(null);

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

    const dropdown = (
      <AnimatePresence>
        {isOpen && rect && (
          <motion.div
            ref={ref}
            initial={{ opacity: 0, scaleY: 0.96 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0.96, transition: { duration: durationSeconds('instant') } }}
            transition={{ duration: durationSeconds('fast'), ease: EASE.standard }}
            className={cn(
              'flex flex-col rounded-xl bg-bg-surface shadow-float border border-border-default origin-top',
              className
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
  }
);
ComboboxContent.displayName = 'Combobox.Content';

// ─── Combobox.Search ──────────────────────────────────────────────────────────

const ComboboxSearch = forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>>(
  ({ className, ...props }, ref) => {
    const { query, setQuery, handleKeyDown, inputRef, listboxId, searchId } =
      useComboboxContext('Combobox.Search');

    const mergedRef = (node: HTMLInputElement | null) => {
      (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
    };

    return (
      <div className="p-2 border-b border-border-default">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 h-[16px] w-[16px] text-text-muted pointer-events-none" aria-hidden="true" />
          <input
            ref={mergedRef}
            id={searchId}
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={true}
            className={cn(
              'h-[36px] w-full rounded-lg bg-bg-sunken pl-9 pr-3 text-[14px] text-text-primary outline-none',
              'focus:ring-2 focus:ring-accent',
              className
            )}
            placeholder="Tìm kiếm..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            {...props}
          />
        </div>
      </div>
    );
  }
);
ComboboxSearch.displayName = 'Combobox.Search';

// ─── Combobox.List ────────────────────────────────────────────────────────────

const ComboboxList = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => {
    const { listboxRef, listboxId, triggerId } = useComboboxContext('Combobox.List');

    const mergedRef = (node: HTMLDivElement | null) => {
      (listboxRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    };

    return (
      <div
        ref={mergedRef}
        id={listboxId}
        role="listbox"
        aria-labelledby={triggerId}
        className={cn('max-h-[250px] overflow-auto p-2', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ComboboxList.displayName = 'Combobox.List';

// ─── Combobox.Item ────────────────────────────────────────────────────────────

export interface ComboboxItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  children: React.ReactNode;
  index?: number;
}

const ComboboxItem = forwardRef<HTMLDivElement, ComboboxItemProps>(
  ({ value: itemValue, children, className, index = -1, ...props }, ref) => {
    const { value: selectedValue, highlightedIndex, setHighlightedIndex, selectOption } =
      useComboboxContext('Combobox.Item');

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
          isSelected ? 'bg-bg-selected text-accent font-medium' : 'text-text-primary hover:bg-bg-hover',
          isHighlighted && !isSelected && 'bg-bg-hover',
          className
        )}
        onClick={() => selectOption(itemValue)}
        onMouseEnter={() => index >= 0 && setHighlightedIndex(index)}
        {...props}
      >
        <span className="truncate">{children}</span>
        {isSelected && <Check className="ml-2 h-4 w-4 flex-shrink-0" />}
      </div>
    );
  }
);
ComboboxItem.displayName = 'Combobox.Item';

// ─── Combobox.Empty ───────────────────────────────────────────────────────────

const ComboboxEmpty = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => {
    const { query } = useComboboxContext('Combobox.Empty');
    return (
      <div
        ref={ref}
        className={cn('py-4 px-3 text-[14px] text-text-muted text-center', className)}
        {...props}
      >
        {children ?? (
          <span>
            Không tìm thấy{' '}
            <span className="text-text-primary break-all">"{query}"</span>
          </span>
        )}
      </div>
    );
  }
);
ComboboxEmpty.displayName = 'Combobox.Empty';

// ─── Combobox.Skeleton ────────────────────────────────────────────────────────

const ComboboxSkeleton = forwardRef<HTMLDivElement, { label?: React.ReactNode; className?: string }>(
  ({ label, className }, ref) => (
    <div ref={ref} className={cn('flex flex-col', className)}>
      {label && <span className="mb-2 text-[14px] font-medium text-text-secondary">{label}</span>}
      <div className="h-[38px] w-full rounded-lg bg-bg-sunken animate-pulse motion-reduce:animate-none" />
    </div>
  )
);
ComboboxSkeleton.displayName = 'Combobox.Skeleton';

// ─── Internal auto-list ───────────────────────────────────────────────────────

function ComboboxAutoList() {
  const ctx = useComboboxContext('ComboboxAutoList');
  return ctx.filteredOptions.length === 0 ? (
    <ComboboxEmpty />
  ) : (
    <>
      {ctx.filteredOptions.map((option, index) => (
        <ComboboxItem key={option.value} value={option.value} index={index}>
          {option.label}
        </ComboboxItem>
      ))}
    </>
  );
}

// ─── Namespace ────────────────────────────────────────────────────────────────

export const Combobox = Object.assign(
  // Legacy API — backward compatible
  forwardRef<HTMLButtonElement, LegacyComboboxProps>(function ComboboxLegacy(
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
    ref
  ) {
    if (isLoading) return <ComboboxSkeleton label={label} />;

    if (isReadOnly) {
      const selectedOption = options.find((o) => o.value === value);
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
      <ComboboxRoot value={value} onChange={onChange} options={options} disabled={disabled} className={className}>
        {label && <ComboboxLabel>{label}</ComboboxLabel>}
        <ComboboxTrigger ref={ref} placeholder={placeholder} options={options} />
        <ComboboxContent>
          <ComboboxSearch />
          <ComboboxList>
            <ComboboxAutoList />
          </ComboboxList>
        </ComboboxContent>
      </ComboboxRoot>
    );
  }),
  {
    Root: ComboboxRoot,
    Label: ComboboxLabel,
    Trigger: ComboboxTrigger,
    Content: ComboboxContent,
    Search: ComboboxSearch,
    List: ComboboxList,
    Item: ComboboxItem,
    Empty: ComboboxEmpty,
    Skeleton: ComboboxSkeleton,
  }
);

Combobox.displayName = 'Combobox';

// ─── Legacy Props ─────────────────────────────────────────────────────────────

export interface LegacyComboboxProps {
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
