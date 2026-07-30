import { useState, useRef, useEffect } from 'react';

export interface UseSelectProps<T> {
  value?: T | undefined;
  onChange?: ((val: T) => void) | undefined;
  options: { label: string; value: T }[];
  isOpen?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
}

export function useSelect<T>({ value, onChange, options, isOpen: controlledIsOpen, onOpenChange }: UseSelectProps<T>) {
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false);
  const isOpen = controlledIsOpen ?? uncontrolledIsOpen;
  
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const setIsOpen = (open: boolean) => {
    if (onOpenChange) onOpenChange(open);
    else setUncontrolledIsOpen(open);
  };

  const handleOpen = () => {
    setIsOpen(true);
    // highlight selected if any
    const index = options.findIndex((o) => o.value === value);
    setHighlightedIndex(index >= 0 ? index : 0);
  };

  const handleClose = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const selectOption = (val: T) => {
    onChange?.(val);
    handleClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        handleOpen();
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        handleClose();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % Math.max(options.length, 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + options.length) % Math.max(options.length, 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
          const option = options[highlightedIndex];
          if (option) {
            selectOption(option.value);
          }
        }
        break;
      case 'Tab':
        handleClose();
        break;
    }
  };

  useEffect(() => {
    if (isOpen && listboxRef.current && highlightedIndex >= 0) {
      const children = listboxRef.current?.children;
      if (children && children.length > highlightedIndex) {
        const optionEl = children[highlightedIndex] as HTMLElement;
        if (optionEl) {
          optionEl.scrollIntoView({ block: 'nearest' });
        }
      }
    }
  }, [highlightedIndex, isOpen]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        listboxRef.current && !listboxRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return {
    isOpen,
    handleOpen,
    handleClose,
    toggle: () => isOpen ? handleClose() : handleOpen(),
    highlightedIndex,
    setHighlightedIndex,
    selectOption,
    handleKeyDown,
    triggerRef,
    listboxRef,
  };
}
