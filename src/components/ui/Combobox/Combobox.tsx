/**
 * The combobox, as one name with two ways to use it.
 *
 * `<Combobox options={...} />` is the whole control in one tag. `Combobox.Root`
 * and its eight parts are the same control taken apart, for a caller that needs
 * to put the label somewhere else or filter the list itself. The compound form
 * is the real one; the single tag is written in terms of it, a few lines below,
 * which is what keeps the two from drifting.
 *
 * The parts themselves live next door — `ComboboxRoot.tsx` for what is drawn in
 * the page, `ComboboxDropdown.tsx` for what is drawn in the portal — because
 * the file crossed invariant R-22's 400-line ceiling. This file assembles; it
 * decides nothing.
 */
import { forwardRef } from 'react';

import type { SelectOption } from '../Select';
import {
  ComboboxAutoList,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxSearch,
} from './ComboboxDropdown';
import {
  ComboboxLabel,
  ComboboxRoot,
  ComboboxSkeleton,
  ComboboxTrigger,
} from './ComboboxRoot';

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
