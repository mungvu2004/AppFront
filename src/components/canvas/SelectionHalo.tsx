import React from 'react';
import { cn } from '../../lib/utils';
import { selectionBorderToken, selectionFillToken } from './materialMap';
import type { SelectionVariant } from '../../hooks/useSelectionHalo';

interface SelectionHaloProps {
  /** Vị trí và kích thước trong canvas (px) */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Trạng thái hiển thị */
  isVisible: boolean;
  /** Biến thể: selected (1,5px + fill) hay hover (1px, không fill) */
  variant?: SelectionVariant;
  /** Đã qua 120ms animation enter */
  hasEntered?: boolean;
  className?: string;
}

/**
 * SelectionHalo — viền chọn canvas.
 * - selected: viền accent 1,5px + nền accent-wash
 * - hover: viền accent 1px, không fill
 * - Xuất hiện 120ms ease-out
 * - Màu từ materialMap
 */
export function SelectionHalo({
  x,
  y,
  width,
  height,
  isVisible,
  variant = 'selected',
  hasEntered = false,
  className,
}: SelectionHaloProps) {
  if (!isVisible) return null;

  const isSelected = variant === 'selected';
  const borderToken = selectionBorderToken();
  const fillToken = selectionFillToken();

  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={cn(
        'absolute pointer-events-none',
        // Animation: fade + scale khi mới xuất hiện
        !hasEntered ? 'animate-[dropdown-open_120ms_ease-out_forwards]' : '',
        className
      )}
      style={{
        left: x,
        top: y,
        width,
        height,
      }}
    >
      {/* Lớp fill (chỉ khi selected) */}
      {isSelected && (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: fillToken, opacity: 0.12 }}
        />
      )}

      {/* Viền accent */}
      <div
        className="absolute inset-0"
        style={{
          outline: `${isSelected ? 1.5 : 1}px solid ${borderToken}`,
          outlineOffset: 0,
        }}
      />
    </div>
  );
}
