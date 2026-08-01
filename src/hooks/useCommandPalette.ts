import { useState, useCallback, useRef } from 'react';
import { Z_INDEX } from '../lib/zIndex';


// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommandItem {
  id: string;
  label: string;
  group: string;
  shortcut?: string;
  keywords?: string[];
  onSelect: () => void;
}

export interface CommandGroup {
  key: string;
  label: string;
  items: CommandItem[];
}

export interface UseCommandPaletteReturn {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
  open: () => void;
  close: () => void;
  handleQueryChange: (q: string) => void;
  setSelectedIndex: (i: number) => void;
  moveSelection: (delta: -1 | 1, total: number) => void;
  zIndex: number;
}

// ─── useCommandPalette ────────────────────────────────────────────────────────

export function useCommandPalette(): UseCommandPaletteReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  /** Phần tử được focus trước khi mở, để trả về khi đóng */
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const open = useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    setIsOpen(true);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    // Trả focus về phần tử trước đó
    requestAnimationFrame(() => previousFocusRef.current?.focus());
  }, []);

  const handleQueryChange = useCallback((q: string) => {
    setQuery(q);
    setSelectedIndex(0);
  }, []);

  const moveSelection = useCallback((delta: -1 | 1, total: number) => {
    setSelectedIndex(prev => {
      const next = prev + delta;
      if (next < 0) return total - 1;
      if (next >= total) return 0;
      return next;
    });
  }, []);

  return {
    isOpen,
    query,
    selectedIndex,
    open,
    close,
    handleQueryChange,
    setSelectedIndex,
    moveSelection,
    zIndex: Z_INDEX.commandPalette,
  };
}

// ─── filterCommands ───────────────────────────────────────────────────────────

export function filterCommands(items: CommandItem[], query: string): CommandItem[] {
  if (!query.trim()) return items;
  const q = query.toLowerCase();
  return items.filter(item =>
    item.label.toLowerCase().includes(q) ||
    item.group.toLowerCase().includes(q) ||
    (item.keywords ?? []).some(k => k.toLowerCase().includes(q))
  );
}

export function groupCommands(items: CommandItem[]): CommandGroup[] {
  const groupMap = new Map<string, CommandItem[]>();
  for (const item of items) {
    if (!groupMap.has(item.group)) groupMap.set(item.group, []);
    groupMap.get(item.group)!.push(item);
  }
  return Array.from(groupMap.entries()).map(([key, groupItems]) => ({
    key,
    label: key,
    items: groupItems,
  }));
}
