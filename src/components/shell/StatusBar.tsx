import React from 'react';
import { Z_INDEX } from '../../lib/zIndex';

// ─── useSaveState (logic tách biệt) ──────────────────────────────────────────

export interface StatusBarProps {
  /** Toạ độ X (pixel không gian thiết kế) */
  x: number;
  /** Toạ độ Y (pixel không gian thiết kế) */
  y: number;
  /** Tỷ lệ nguyên đồ, ví dụ "1:100" */
  scaleRatio: string;
  /** Mật độ px, ví dụ "12 mm/px" */
  scaleDensity: string;
  /** Văn bản trạng thái lưu, ví dụ "Đã lưu lúc 14:32" hoặc "Đang lưu..." */
  saveText: string;
}

// Định dạng số thập phân bằng dấu phẩy (theo quy ước hệ thống)
function formatCoord(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

// ─── StatusBar View ───────────────────────────────────────────────────────────

export function StatusBar({ x, y, scaleRatio, scaleDensity, saveText }: StatusBarProps) {
  return (
    <div
      className="h-8 shrink-0 flex items-center justify-between px-4 bg-bg-surface border-t border-border-default select-none"
      style={{ zIndex: Z_INDEX.statusBar }}
      role="status"
      aria-label="Thanh trạng thái"
    >
      {/* Mục 1: Toạ độ con trỏ — mono, tabular-nums */}
      <span className="font-mono tabular-nums text-[12px] text-text-secondary leading-none">
        <span aria-label={`Toạ độ X: ${formatCoord(x)}`}>
          X: {formatCoord(x)}
        </span>
        <span className="mx-3 text-border-default" aria-hidden="true">│</span>
        <span aria-label={`Toạ độ Y: ${formatCoord(y)}`}>
          Y: {formatCoord(y)}
        </span>
      </span>

      {/* Mục 2: Tỷ lệ */}
      <span className="text-[12px] text-text-secondary tabular-nums">
        <span>{scaleRatio}</span>
        <span className="mx-1 text-text-muted" aria-hidden="true">·</span>
        <span>{scaleDensity}</span>
      </span>

      {/* Mục 3: Trạng thái lưu — chỉ một trong ba mục */}
      <span className="text-[12px] text-text-muted" aria-live="polite">
        {saveText}
      </span>
    </div>
  );
}
