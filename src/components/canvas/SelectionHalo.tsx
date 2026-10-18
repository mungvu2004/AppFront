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
  /** Biến thể: selected (3px + khe nền + fill) hay hover (1,5px, không fill) */
  variant?: SelectionVariant;
  /** Đã qua 120ms animation enter */
  hasEntered?: boolean;
  className?: string;
}

/**
 * SelectionHalo — viền chọn canvas.
 * - selected: viền accent 3px cách khe nền 2px + nền accent-wash
 * - hover: viền accent 1,5px, không fill
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
        !hasEntered ? 'animate-selection-enter' : '',
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
          style={{ backgroundColor: fillToken, opacity: 0.24 }}
        />
      )}

      {/* Viền accent */}
      <div
        className="absolute inset-0"
        style={{
          // G4a-11: viền chọn 1,5px chìm vào tường nâu. Đoạn chọn: viền accent 3px tách khỏi
          // nét bằng một khe nền 2px (box-shadow), nên nổi trên cả tường đậm lẫn nền nhạt.
          outline: `${isSelected ? 3 : 1.5}px solid ${borderToken}`,
          outlineOffset: isSelected ? 2 : 0,
          boxShadow: isSelected ? '0 0 0 2px var(--bg-surface)' : undefined,
        }}
      />
    </div>
  );
}
