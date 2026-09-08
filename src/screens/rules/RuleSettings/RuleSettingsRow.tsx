/**
 * Một luật: toggle, câu luật, severity, và ngưỡng của nó.
 *
 * "Bỏ qua" không phải mức thứ tư (quyết định D2 của hợp đồng) — `Toggle` tắt là
 * bỏ qua, `Select` chỉ đổi giữa ba severity thật. Một luật tắt vẫn đứng nguyên
 * trong danh sách, chỉ mờ đi (opacity 0.4, `duration-standard` = 260 ms lấy từ
 * `MOTION_DURATIONS_MS.standard`), vì "luật đã tắt vẫn phải nhìn thấy được".
 */

import { Select } from '@/components/ui/Select';
import { NumericField } from '@/components/ui/NumericField';
import { Toggle } from '@/components/ui/Toggle';
import { cn } from '@/lib/utils';

import type { RuleSettingsRow as RuleSettingsRowModel, RuleSettingsThreshold } from './types';

export type RuleCode = RuleSettingsRowModel['code'];
type RuleSeverity = RuleSettingsRowModel['severity'];

/**
 * Ba severity thật của sổ đăng ký — không phải bốn (A4). Không export: đối
 * tượng/mảng export cạnh một component làm `react-refresh/only-export-components`
 * kêu (`allowConstantExport` chỉ tha hằng nguyên thuỷ), và chỉ file này cần bảng.
 */
const SEVERITY_LABELS: Readonly<Record<RuleSeverity, string>> = {
  critical: 'nghiêm trọng',
  warning: 'cảnh báo',
  suggestion: 'gợi ý',
};

const SEVERITY_OPTIONS: readonly { label: string; value: RuleSeverity }[] = [
  { label: SEVERITY_LABELS.critical, value: 'critical' },
  { label: SEVERITY_LABELS.warning, value: 'warning' },
  { label: SEVERITY_LABELS.suggestion, value: 'suggestion' },
];

export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app';

interface SeverityPickerProps {
  readonly ruleSentence: string;
  readonly value: RuleSeverity;
  readonly canEdit: boolean;
  readonly onChange: (value: RuleSeverity) => void;
}

/**
 * `Select.Trigger` mang `role="combobox"`, vai đó không tự lấy tên từ chữ bên
 * trong — thiếu `label` là thiếu tên cho trình đọc màn hình. Dòng này chật ở
 * 56px nên nhãn ẩn bằng `sr-only` thay vì bỏ, gắn bằng `htmlFor` như mọi
 * `Select.Label` khác.
 */
function SeverityPicker({ ruleSentence, value, canEdit, onChange }: SeverityPickerProps) {
  if (!canEdit) {
    return (
      <span className="w-[128px] shrink-0 text-sm text-text-secondary">{SEVERITY_LABELS[value]}</span>
    );
  }

  return (
    <Select.Root
      value={value}
      onChange={(next) => {
        onChange(next as RuleSeverity);
      }}
      options={SEVERITY_OPTIONS.map((option) => ({ ...option }))}
      className="w-[128px] shrink-0"
    >
      <Select.Label className="sr-only">{`mức độ của luật: ${ruleSentence}`}</Select.Label>
      <Select.Trigger options={SEVERITY_OPTIONS.map((option) => ({ ...option }))} />
      <Select.Content>
        {SEVERITY_OPTIONS.map((option) => (
          <Select.Item key={option.value} value={option.value}>
            {option.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}

interface ThresholdFieldProps {
  readonly threshold: RuleSettingsThreshold;
  readonly canEdit: boolean;
  readonly onChange: (value: number) => void;
}

function ThresholdField({ threshold, canEdit, onChange }: ThresholdFieldProps) {
  return (
    <NumericField
      aria-label={threshold.label}
      className="h-8 w-[104px] shrink-0"
      unit={threshold.unit}
      value={threshold.value}
      min={threshold.min}
      max={threshold.max}
      step={threshold.step}
      error={threshold.error}
      isReadOnly={!canEdit}
      onChange={(value) => {
        if (value !== undefined) {
          onChange(value);
        }
      }}
    />
  );
}

export interface RuleSettingsRuleRowProps {
  readonly row: RuleSettingsRowModel;
  readonly canEdit: boolean;
  readonly isCollapsed: boolean;
  /** Câu của luật `row.supersededBy`, đã tra sẵn ở file cha — hàng này không tra lại. */
  readonly supersededByLabel: string | null;
  readonly onToggleRule: (code: RuleCode, enabled: boolean) => void;
  readonly onChangeSeverity: (code: RuleCode, severity: RuleSeverity) => void;
  readonly onChangeThreshold: (code: RuleCode, key: string, value: number) => void;
}

/** Một dòng luật — cao 56 từ 1024 trở lên, xuống dòng dưới tên luật khi thu gọn. */
export function RuleSettingsRuleRow({
  row,
  canEdit,
  isCollapsed,
  supersededByLabel,
  onToggleRule,
  onChangeSeverity,
  onChangeThreshold,
}: RuleSettingsRuleRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 border-b border-border-default py-3 last:border-b-0',
        'transition-opacity duration-standard',
        !row.enabled && 'opacity-40',
        isCollapsed ? 'flex-wrap' : 'min-h-[56px]',
      )}
    >
      <Toggle
        aria-label={`bật hoặc tắt luật: ${row.sentence}`}
        checked={row.enabled}
        isReadOnly={!canEdit}
        onChange={(checked) => {
          onToggleRule(row.code, checked);
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-sm text-text-primary">{row.sentence}</p>
        <p className="truncate text-xs text-text-secondary">{row.description}</p>
        {row.supersededBy !== null && (
          <p className="text-xs text-state-attention-text">
            Đã được thay thế bởi {supersededByLabel ?? row.supersededBy}
          </p>
        )}
      </div>

      <div
        className={cn(
          'flex shrink-0 flex-wrap items-center gap-2',
          isCollapsed && 'basis-full justify-end pl-11',
        )}
      >
        <SeverityPicker
          ruleSentence={row.sentence}
          value={row.severity}
          canEdit={canEdit}
          onChange={(severity) => {
            onChangeSeverity(row.code, severity);
          }}
        />
        {row.thresholds.map((threshold) => (
          <ThresholdField
            key={threshold.key}
            threshold={threshold}
            canEdit={canEdit}
            onChange={(value) => {
              onChangeThreshold(row.code, threshold.key, value);
            }}
          />
        ))}
        <span className="whitespace-nowrap text-xs text-text-secondary">{row.impactCaption}</span>
      </div>
    </div>
  );
}
