import React from 'react';
import { cn } from '../../lib/utils';
import { SegmentedControl } from './SegmentedControl';
import { formatMm } from '../../lib/format';

// The four allowed wall thickness values
export type WallThickness = '110' | '220' | '330' | 'btct';

export interface ThicknessFieldProps {
  value?: WallThickness;
  onChange?: (value: WallThickness) => void;
  /** Original AI-detected value for reference (in mm), shown as caption */
  aiOriginalMm?: number;
  disabled?: boolean;
  isLoading?: boolean;
  isReadOnly?: boolean;
  /** Error message */
  error?: string;
  className?: string;
}

const THICKNESS_OPTIONS: { label: string; value: WallThickness }[] = [
  { label: '110', value: '110' },
  { label: '220', value: '220' },
  { label: '330', value: '330' },
  { label: 'Cột BTCT', value: 'btct' },
];

/**
 * ThicknessField — variant chuyên biệt cho độ dày tường.
 * KHÔNG cho nhập số tự do; chỉ chọn từ 4 giá trị chuẩn qua SegmentedControl.
 * Hiển thị caption so sánh giá trị AI gốc.
 */
export function ThicknessField({
  value,
  onChange,
  aiOriginalMm,
  disabled,
  isLoading,
  isReadOnly,
  error,
  className,
}: ThicknessFieldProps) {
  const effectiveDisabled = disabled || isReadOnly;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <SegmentedControl
        options={THICKNESS_OPTIONS}
        {...(value !== undefined ? { value } : {})}
        onChange={onChange}
        disabled={effectiveDisabled}
        isLoading={isLoading}
        aria-label="Độ dày tường"
      />

      {/* Caption: AI original value for reference */}
      {aiOriginalMm !== undefined && !isLoading && (
        <p className="text-[12px] leading-[16px] text-text-muted">
          Giá trị AI gốc:{' '}
          <span className="font-mono">{formatMm(aiOriginalMm)}</span>
        </p>
      )}

      {/* Error caption */}
      {error && !isLoading && (
        <p className="text-[12px] leading-[16px] text-state-violation-text">
          {error}
        </p>
      )}
    </div>
  );
}

ThicknessField.displayName = 'ThicknessField';
