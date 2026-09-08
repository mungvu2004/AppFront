/**
 * Hàng bộ luật sẵn — mỗi nút kèm hậu quả (bao nhiêu luật sẽ đổi) đo trước, hiện
 * ra TRƯỚC khi bấm chứ không phải sau. Số chạy số qua `useCountUp` (bản bọc
 * React của `src/lib/motion/useCountUp.ts`, chạy ở `standard` = 260 ms).
 *
 * File này không tự gác cổng năng lực: `capabilities.canApplyPreset` quyết
 * định có render component này hay không, ở nơi gọi.
 */

import { useCountUp } from '@/hooks/useCountUp';
import { cn } from '@/lib/utils';

import { FOCUS_RING } from './RuleSettingsRow';
import type { RuleSettingsPresetOption, BuildingKind } from './types';

interface PresetButtonProps {
  readonly preset: RuleSettingsPresetOption;
  readonly onApplyPreset: (kind: BuildingKind) => void;
}

function PresetButton({ preset, onApplyPreset }: PresetButtonProps) {
  const { text: changedText } = useCountUp(preset.changedRuleCount, { format: { fractionDigits: 0 } });

  return (
    <button
      type="button"
      onClick={() => {
        onApplyPreset(preset.kind);
      }}
      className={cn(
        'flex flex-col items-start gap-1 rounded border border-border-default bg-bg-surface p-3 text-left',
        'transition-colors duration-standard hover:bg-bg-hover',
        FOCUS_RING,
      )}
    >
      <span className="text-sm font-medium text-text-primary">{preset.label}</span>
      <span className="text-xs text-text-secondary">{preset.caption}</span>
      <span className="font-mono text-xs tabular-nums text-text-secondary">
        {changedText} luật sẽ đổi
      </span>
    </button>
  );
}

export interface RuleSettingsPresetsRowProps {
  readonly presets: readonly RuleSettingsPresetOption[];
  readonly onApplyPreset: (kind: BuildingKind) => void;
}

/** Ba nút bộ luật sẵn (nhà ở / thương mại / công nghiệp), đầu trang. */
export function RuleSettingsPresetsRow({ presets, onApplyPreset }: RuleSettingsPresetsRowProps) {
  return (
    <section aria-label="bộ luật sẵn" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-text-secondary">bộ luật sẵn</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {presets.map((preset) => (
          <PresetButton key={preset.kind} preset={preset} onApplyPreset={onApplyPreset} />
        ))}
      </div>
    </section>
  );
}
