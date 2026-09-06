/**
 * Dải chế độ sửa, cao `editBandHeightPx` (36), nằm ngang trên cùng canvas.
 *
 * View con thuần — nhận `WallGeometryEditBand` đã đủ chữ để vẽ, không tự nối
 * chuỗi, không tự định dạng (A15). Nút "Xong" là chữ, không phải biểu tượng,
 * nên không cần `aria-label` riêng (R-72 chỉ bắt buộc với nút chỉ-biểu-tượng).
 */
import type { ReactNode } from 'react';

import { WALL_GEOMETRY_EDITOR_LAYOUT, type WallGeometryEditBand } from './wallGeometryEditorTypes';

const BUTTON_FOCUS_CLASS =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface';

export interface WallGeometryEditorBandProps {
  readonly band: WallGeometryEditBand;
}

export function WallGeometryEditorBand({ band }: WallGeometryEditorBandProps): ReactNode {
  return (
    <div
      className="flex shrink-0 items-center justify-between bg-bg-surface px-4"
      style={{ height: WALL_GEOMETRY_EDITOR_LAYOUT.editBandHeightPx }}
    >
      <span className="truncate text-[13px] font-medium text-text-primary">{band.label}</span>
      <button
        className={`rounded-[6px] px-2 py-1 text-[13px] font-medium text-accent hover:bg-bg-hover ${BUTTON_FOCUS_CLASS}`}
        onClick={band.onDone}
        type="button"
      >
        {band.doneLabel}
      </button>
    </div>
  );
}
