/**
 * One property row, rendered from its `PropertyRow` shape alone.
 *
 * The switch over `controlType` is the reason this file exists apart from
 * `PropertyInspectorGroups.tsx`: eight control types, each with its own
 * accessible-name plumbing, would otherwise crowd out the group-list logic.
 *
 * U2 of `docs/contracts/property-inspector/ui.md` found `Slider` state-driven
 * and therefore invisible to `expectAccessible` (its focus ring only appears
 * once `isFocused` is true, which jsdom never triggers). The coordinator's
 * decision — record here because it is the one deviation from the original
 * eight-control-type list — is to render every `slider` row with
 * `NumericField` instead: same `sliderMin`/`sliderMax`/`sliderValue` numbers,
 * a control that actually passes.
 */
import type { ReactNode } from 'react';

import { FieldRow } from '@/components/ui/FieldRow';
import { Input } from '@/components/ui/Input';
import { NumericField } from '@/components/ui/NumericField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { Toggle } from '@/components/ui/Toggle';

import type {
  PropertyGroupId,
  PropertyRow as PropertyRowData,
  PropertyRowOption,
} from './propertyInspectorTypes';

const MIXED_HINT = 'Giá trị khác nhau';
const RETRY_LABEL = 'Thử lại';
const ERROR_TITLE = 'Không lưu được thay đổi';
const RULE_SCREEN_LABEL = 'Xem quy tắc';

const LINK_BUTTON_CLASS =
  'truncate text-left text-[14px] text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface';

/** The single-value text of a row, or `''` for `mixed`/`unavailable` — those render through their own branch below and never reach a control. */
function formattedValue(row: PropertyRowData): string {
  return row.value.kind === 'single' ? row.value.formatted : '';
}

/** The option whose label matches the row's formatted value — the only link between the two that the data carries. */
function selectedOptionValue(row: PropertyRowData, options: readonly PropertyRowOption[]): string | undefined {
  const formatted = formattedValue(row);

  return options.find((option) => option.label === formatted)?.value;
}

function warningNode(row: PropertyRowData): ReactNode {
  const warning = row.warning;

  if (warning === undefined) {
    return undefined;
  }

  if (warning.level === 'blocking') {
    return (
      <span className="flex flex-col items-start gap-1">
        <span className="font-medium text-state-violation-text">{ERROR_TITLE}</span>
        <span>{warning.message}</span>
        {warning.onRetry !== undefined && (
          <button type="button" onClick={warning.onRetry} className={LINK_BUTTON_CLASS}>
            {RETRY_LABEL}
          </button>
        )}
      </span>
    );
  }

  return <span className="text-state-attention-text">{warning.message}</span>;
}

function ruleScreenButton(row: PropertyRowData): ReactNode {
  if (row.onNavigate === undefined) {
    return null;
  }

  return (
    <button type="button" onClick={row.onNavigate} className={LINK_BUTTON_CLASS}>
      {RULE_SCREEN_LABEL}
    </button>
  );
}

/** `inspection` rows describe a violation rather than an editable value: the control column becomes the message plus a way to see the rule. */
function inspectionControl(row: PropertyRowData): ReactNode {
  return (
    <div className="flex flex-col items-start gap-1 text-[13px] text-text-primary">
      <span>{formattedValue(row)}</span>
      {ruleScreenButton(row)}
    </div>
  );
}

function readOnlyOptionText(row: PropertyRowData, options: readonly PropertyRowOption[]): string {
  const selected = options.find((option) => option.value === selectedOptionValue(row, options));

  return selected?.label ?? formattedValue(row);
}

function controlFor(row: PropertyRowData, groupId: PropertyGroupId): ReactNode {
  if (groupId === 'inspection') {
    return inspectionControl(row);
  }

  const isReadOnly = row.isLocked;
  const error = row.warning?.level === 'blocking' ? warningNode(row) : undefined;
  const hint = row.warning?.level === 'attention' ? warningNode(row) : undefined;

  switch (row.controlType) {
    case 'numeric':
    case 'text':
    case 'readonly':
      return (
        <Input
          value={formattedValue(row)}
          suffix={row.unit}
          isReadOnly={isReadOnly || row.controlType === 'readonly'}
          error={error}
          hint={hint}
          aria-label={row.label}
          onChange={(event) => row.onChange?.(event.target.value)}
        />
      );

    case 'select': {
      const options = row.options ?? [];

      if (isReadOnly) {
        return (
          <div className="flex h-[38px] w-full items-center px-3 text-[14px] text-text-primary">
            {readOnlyOptionText(row, options)}
          </div>
        );
      }

      return (
        <Select.Root
          value={selectedOptionValue(row, options)}
          onChange={(value) => row.onChange?.(value)}
          options={options.map((option) => ({ value: option.value, label: option.label }))}
        >
          <Select.Label className="sr-only">{row.label}</Select.Label>
          <Select.Trigger
            placeholder={row.label}
            options={options.map((option) => ({ value: option.value, label: option.label }))}
          />
          <Select.Content>
            {options.length === 0 ? (
              <Select.Empty />
            ) : (
              options.map((option, index) => (
                <Select.Item key={option.value} value={option.value} index={index}>
                  {option.label}
                </Select.Item>
              ))
            )}
          </Select.Content>
        </Select.Root>
      );
    }

    case 'segmented': {
      const options = row.options ?? [];

      return (
        <SegmentedControl
          options={options.map((option) => ({
            value: option.value,
            label: option.label,
            ...(option.colorToken !== undefined ? { swatch: `var(${option.colorToken})` } : {}),
          }))}
          value={selectedOptionValue(row, options)}
          onChange={(value) => row.onChange?.(value)}
          disabled={isReadOnly}
          aria-label={row.label}
        />
      );
    }

    case 'toggle':
      return (
        <Toggle
          {...(row.isChecked !== undefined ? { checked: row.isChecked } : {})}
          onChange={(checked) => row.onChange?.(String(checked))}
          isReadOnly={isReadOnly}
          aria-label={row.label}
        />
      );

    case 'slider':
      // U2: NumericField replaces Slider — see the file docblock.
      return (
        <NumericField
          value={row.sliderValue}
          min={row.sliderMin}
          max={row.sliderMax}
          {...(row.unit !== undefined ? { unit: row.unit } : {})}
          isReadOnly={isReadOnly}
          aria-label={row.label}
          onChange={(value) => row.onChange?.(String(value))}
        />
      );

    case 'link':
      return (
        <button type="button" onClick={row.onNavigate} className={LINK_BUTTON_CLASS}>
          {formattedValue(row)}
        </button>
      );

    default:
      return null;
  }
}

export interface PropertyInspectorRowProps {
  readonly row: PropertyRowData;
  readonly groupId: PropertyGroupId;
  readonly isLast: boolean;
}

/**
 * CẤM TUYỆT ĐỐI số 4: `value.kind === 'mixed'` never falls through to a
 * control — it always renders the dash plus the "giá trị khác nhau" hint, and
 * never a single value that would misrepresent a multi-selection.
 */
export function PropertyInspectorRow({ row, groupId, isLast }: PropertyInspectorRowProps) {
  if (row.value.kind === 'mixed') {
    return (
      <FieldRow label={row.label} isLast={isLast} isMixed title={MIXED_HINT}>
        {null}
      </FieldRow>
    );
  }

  if (row.value.kind === 'unavailable') {
    return (
      <FieldRow label={row.label} isLast={isLast} isReadOnly={row.isLocked}>
        <span className="flex h-[36px] items-center text-[13px] text-text-muted">{row.value.caption}</span>
      </FieldRow>
    );
  }

  return (
    <FieldRow label={row.label} isLast={isLast} isReadOnly={row.isLocked}>
      {controlFor(row, groupId)}
    </FieldRow>
  );
}
