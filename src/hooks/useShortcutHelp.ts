import { useState, useCallback, useRef } from 'react';

export function useShortcutHelp() {
  const [isOpen, setIsOpen] = useState(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const open = useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    requestAnimationFrame(() => previousFocusRef.current?.focus());
  }, []);

  return { isOpen, open, close };
}
