/**
 * D1: ô "Căn rộng × dài (mm)" của panel trái. Hai số + "Đổi chiều" + chọn mép ngoài/tim tường;
 * tỷ lệ suy ra đi đúng đường xác nhận tỷ lệ hiện có (hook tính, view chỉ bày).
 */

import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

import type { FlatSizeEntryState, ScaleSizeEntryViewModel } from './types';

const TITLE = 'Căn rộng × dài (mm)';
const WIDTH_LABEL = 'Rộng';
const LENGTH_LABEL = 'Dài';
const SWAP_LABEL = 'Đổi chiều';
const EDGE_ARIA_LABEL = 'Cách tính cỡ căn';
const EDGE_OPTIONS = [
  { label: 'Từ mép ngoài tường', value: 'outer' },
  { label: 'Theo tim tường', value: 'centre' },
] as const;

interface SizeEntryProps {
  readonly entry: ScaleSizeEntryViewModel;
  readonly onChange: (patch: Partial<FlatSizeEntryState>) => void;
}

export function ScaleCalibrationSizeEntry({ entry, onChange }: SizeEntryProps) {
  return (
    <section aria-label={TITLE} className="flex flex-col gap-2 border-b border-border-default px-4 py-3">
      <h3 className="text-[13px] font-medium text-text-primary">{TITLE}</h3>
      <div className="grid grid-cols-2 items-end gap-2 [&>*]:min-w-0">
        <Input
          className="font-mono text-[13px] leading-5"
          inputMode="numeric"
          label={WIDTH_LABEL}
          onChange={(event) => {
            onChange({ widthText: event.target.value });
          }}
          value={entry.widthText}
        />
        <Input
          className="font-mono text-[13px] leading-5"
          inputMode="numeric"
          label={LENGTH_LABEL}
          onChange={(event) => {
            onChange({ lengthText: event.target.value });
          }}
          value={entry.lengthText}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          onClick={() => {
            onChange({ isSwapped: !entry.isSwapped });
          }}
          size="sm"
          variant="secondary"
        >
          {SWAP_LABEL}
        </Button>
        <SegmentedControl
          aria-label={EDGE_ARIA_LABEL}
          onChange={(value) => {
            onChange({ isOuter: value === 'outer' });
          }}
          options={EDGE_OPTIONS.map((option) => ({ label: option.label, value: option.value }))}
          value={entry.isOuter ? 'outer' : 'centre'}
        />
      </div>
      {entry.error !== null && <InlineAlert level="attention" message={entry.error} />}
    </section>
  );
}
