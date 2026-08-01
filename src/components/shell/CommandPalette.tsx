// Re-export types và hook từ overlay/ để shell/ có thể re-export backward compat
export { CommandPalette } from '../overlay/CommandPalette';
export type { CommandPaletteProps } from '../overlay/CommandPalette';
// Re-export CommandItem từ hook
export type { CommandItem } from '../../hooks/useCommandPalette';

