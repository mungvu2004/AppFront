/**
 * Một thẻ nhóm luật, và thẻ "Ngưỡng chung".
 *
 * `RuleSettingsGroup.enabled` là giá trị đã tính sẵn (bật khi còn ít nhất một
 * luật con bật) — file này chỉ vẽ nó, không tính lại. `onToggleGroup` là hành
 * động duy nhất nhóm phát ra; tắt/bật từng luật con vẫn đi qua `onToggleRule`
 * trên chính hàng đó, không phải qua nhóm.
 */

import { NumericField } from '@/components/ui/NumericField';
import { Toggle } from '@/components/ui/Toggle';

import { type RuleCode, RuleSettingsRuleRow } from './RuleSettingsRow';
import type { RuleSettingsGroup, RuleSettingsThreshold } from './types';

type RuleGroup = RuleSettingsGroup['group'];
type RuleSeverity = RuleSettingsGroup['rows'][number]['severity'];

export interface RuleSettingsGroupCardProps {
  readonly group: RuleSettingsGroup;
  readonly canEdit: boolean;
  readonly isCollapsed: boolean;
  /** Câu của luật theo mã, để hàng có `supersededBy` nói rõ nó bị luật nào thay thế. */
  readonly sentenceByCode: ReadonlyMap<RuleCode, string>;
  readonly onToggleGroup: (group: RuleGroup, enabled: boolean) => void;
  readonly onToggleRule: (code: RuleCode, enabled: boolean) => void;
  readonly onChangeSeverity: (code: RuleCode, severity: RuleSeverity) => void;
  readonly onChangeThreshold: (code: RuleCode, key: string, value: number) => void;
}

/** Một nhóm luật: tên, mô tả, toggle tổng, rồi từng luật con. */
export function RuleSettingsGroupCard({
  group,
  canEdit,
  isCollapsed,
  sentenceByCode,
  onToggleGroup,
  onToggleRule,
  onChangeSeverity,
  onChangeThreshold,
}: RuleSettingsGroupCardProps) {
  return (
    <section className="flex flex-col gap-4 rounded border border-border-default bg-bg-surface p-4">
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-base font-semibold text-text-primary">{group.label}</h3>
          <p className="text-sm text-text-secondary">{group.description}</p>
        </div>
        <Toggle
          aria-label={`bật hoặc tắt cả nhóm: ${group.label}`}
          checked={group.enabled}
          isReadOnly={!canEdit}
          onChange={(checked) => {
            onToggleGroup(group.group, checked);
          }}
        />
      </header>

      <div className="flex flex-col">
        {group.rows.map((row) => (
          <RuleSettingsRuleRow
            key={row.code}
            row={row}
            canEdit={canEdit}
            isCollapsed={isCollapsed}
            supersededByLabel={row.supersededBy === null ? null : sentenceByCode.get(row.supersededBy) ?? null}
            onToggleRule={onToggleRule}
            onChangeSeverity={onChangeSeverity}
            onChangeThreshold={onChangeThreshold}
          />
        ))}
      </div>
    </section>
  );
}

export interface RuleSettingsGeneralThresholdsCardProps {
  readonly thresholds: readonly RuleSettingsThreshold[];
  readonly canEdit: boolean;
  readonly onChangeGeneralThreshold: (key: string, value: number) => void;
}

/**
 * Thẻ "Ngưỡng chung" — dung sai hình học dùng chung cho nhiều luật, không
 * gồm "độ tin cậy tối thiểu để tự duyệt" hay Toggle "cho phép AI ghi đè": hai
 * thứ đó không có trong viewmodel (quyết định D5 của hợp đồng).
 */
export function RuleSettingsGeneralThresholdsCard({
  thresholds,
  canEdit,
  onChangeGeneralThreshold,
}: RuleSettingsGeneralThresholdsCardProps) {
  return (
    <section className="flex flex-col gap-4 rounded border border-border-default bg-bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-text-primary">ngưỡng chung</h3>
        <p className="text-sm text-text-secondary">
          Dung sai hình học dùng chung cho nhiều luật trong bộ này.
        </p>
      </div>

      {thresholds.length === 0 ? (
        <p className="text-sm text-text-secondary">Chưa có ngưỡng chung nào để chỉnh.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {thresholds.map((threshold) => (
            <NumericField
              key={threshold.key}
              label={threshold.label}
              unit={threshold.unit}
              value={threshold.value}
              min={threshold.min}
              max={threshold.max}
              step={threshold.step}
              error={threshold.error}
              isReadOnly={!canEdit}
              onChange={(value) => {
                if (value !== undefined) {
                  onChangeGeneralThreshold(threshold.key, value);
                }
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
