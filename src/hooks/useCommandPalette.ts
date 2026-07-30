import { useState, useEffect, useCallback } from 'react';

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const close = useCallback(() => setIsOpen(false), []);
  const handleQueryChange = useCallback((q: string) => {
    setQuery(q);
    setSelectedIndex(0);
  }, []);

  return {
    isOpen,
    query,
    selectedIndex,
    setSelectedIndex,
    handleQueryChange,
    close
  };
}
