/**
 * The state every part of a combobox shares, and the one way to reach it.
 *
 * Pulled out of `Combobox.tsx` under invariant R-22, and it is the piece that
 * makes the rest of the split possible: the trigger, the dropdown and the list
 * items never talk to each other, they only read this. Splitting the file
 * therefore moved code without moving a single wire.
 *
 * {@link useComboboxContext} takes the caller's name so a part rendered outside
 * `<Combobox.Root>` says which part it was. The alternative — returning
 * `null` and letting the part crash on a missing field — reports the mistake
 * several frames away from where it was made.
 */
import { createContext, useContext, type KeyboardEvent, type RefObject } from 'react';

import type { SelectOption } from '../Select';

export interface ComboboxContextValue {
  isOpen: boolean;
  value: string | undefined;
  onChange: ((val: string) => void) | undefined;
  disabled: boolean;
  highlightedIndex: number;
  setHighlightedIndex: (i: number) => void;
  selectOption: (val: string) => void;
  handleKeyDown: (e: KeyboardEvent) => void;
  toggle: () => void;
  query: string;
  setQuery: (q: string) => void;
  filteredOptions: SelectOption[];
  triggerRef: RefObject<HTMLButtonElement>;
  listboxRef: RefObject<HTMLDivElement>;
  inputRef: RefObject<HTMLInputElement>;
  triggerId: string;
  listboxId: string;
  searchId: string;
}

export const ComboboxContext = createContext<ComboboxContextValue | null>(null);

export function useComboboxContext(name: string): ComboboxContextValue {
  const ctx = useContext(ComboboxContext);
  if (!ctx) throw new Error(`<${name}> phải dùng bên trong <Combobox.Root>`);
  return ctx;
}
