/**
 * The combobox's public surface, unchanged by the split.
 *
 * `Combobox` is what callers import; the nine parts reach them through it, as
 * `Combobox.Root`, `Combobox.Trigger` and so on. The part modules are not
 * re-exported by name — they were separated to satisfy invariant R-22's line
 * ceiling, and a second way to import the same component would turn a file
 * layout decision into an API.
 */

export { Combobox } from './Combobox';
export type { LegacyComboboxProps } from './Combobox';
export type { ComboboxRootProps, ComboboxTriggerProps } from './ComboboxRoot';
export type { ComboboxItemProps } from './ComboboxDropdown';
export type { ComboboxContextValue } from './context';
