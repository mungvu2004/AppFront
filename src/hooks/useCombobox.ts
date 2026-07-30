import { useState, useMemo, useRef, useEffect } from 'react';
import { useSelect } from './useSelect';

export interface UseComboboxProps<T> {
  value?: T | undefined;
  onChange?: ((val: T) => void) | undefined;
  options: { label: string; value: T }[];
}

// Simple fuzzy matching: check if characters appear in order
function fuzzyMatch(str: string, query: string) {
  let i = 0, j = 0;
  const s = str.toLowerCase();
  const q = query.toLowerCase();
  while (i < s.length && j < q.length) {
    if (s[i] === q[j]) j++;
    i++;
  }
  return j === q.length;
}

export function useCombobox<T>({ value, onChange, options }: UseComboboxProps<T>) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = useMemo(() => {
    if (!query) return options;
    return options.filter(o => fuzzyMatch(o.label, query));
  }, [options, query]);

  const selectHook = useSelect({
    value,
    onChange: (val: T) => {
      onChange?.(val);
      setQuery(''); // Reset query on selection
    },
    options: filteredOptions,
  });

  const handleOpen = () => {
    selectHook.handleOpen();
    // Use timeout to let render happen then focus input inside menu
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const toggle = () => {
    if (selectHook.isOpen) {
      selectHook.handleClose();
    } else {
      handleOpen();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      selectHook.handleClose();
      return;
    }
    // Let the select hook handle standard navigation
    selectHook.handleKeyDown(e);
  };

  // Re-highlight the first item if filtering changes and highlighted index is out of bounds
  useEffect(() => {
    if (selectHook.highlightedIndex >= filteredOptions.length) {
      selectHook.setHighlightedIndex(filteredOptions.length > 0 ? 0 : -1);
    }
  }, [filteredOptions.length, selectHook]);

  return {
    ...selectHook,
    handleOpen,
    toggle,
    handleKeyDown,
    query,
    setQuery,
    filteredOptions,
    inputRef,
  };
}
