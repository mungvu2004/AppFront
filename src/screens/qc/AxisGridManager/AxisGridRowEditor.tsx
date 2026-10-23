/** Ô sửa tại chỗ của một hàng trục (tách từ `AxisGridLeftPanel.tsx`, trần 400 dòng). View thuần. */

import { useState, type FormEvent } from 'react';

import type { AxisRowViewModel } from './axisGridTypes';

/** G4b-20: sửa tên + khoảng cách (mm) ngay trên hàng; Enter lưu, Esc huỷ. */
export function AxisGridRowEditor({
  row,
  onClose,
  onRename,
  onSpacingChange,
}: {
  readonly row: AxisRowViewModel;
  readonly onClose: () => void;
  readonly onRename?: ((axisId: string, label: string) => string | null) | undefined;
  readonly onSpacingChange?: ((axisId: string, spacingMm: number) => string | null) | undefined;
}) {
  const [label, setLabel] = useState(row.label);
  const [spacing, setSpacing] = useState(row.spacingMm === null ? '' : String(Math.round(row.spacingMm)));
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    /*
     * RV1-6: khoảng cách trước, tên sau. Đổi tên làm mã hàng đổi và hàng mount lại,
     * nên câu lỗi khoảng cách đặt sau lượt đổi tên sẽ rơi vào component đã unmount.
     */
    const spacingMm = Number(spacing.replace(/\./g, '').replace(',', '.'));
    const original = row.spacingMm === null ? '' : String(Math.round(row.spacingMm));
    const spacingError = spacing === original || spacing === '' ? null : (onSpacingChange?.(row.id, spacingMm) ?? null);

    if (spacingError !== null) {
      setError(spacingError);
      return;
    }

    const renameError = label.trim().toUpperCase() === row.label ? null : (onRename?.(row.id, label) ?? null);

    if (renameError !== null) {
      setError(renameError);
      return;
    }

    onClose();
  };

  return (
    <form
      aria-label={`Sửa trục ${row.label}`}
      className="flex flex-col gap-1 px-2 py-1"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
      onSubmit={submit}
    >
      <div className="flex items-center gap-2">
        <input
          aria-label="Tên trục"
          autoFocus
          className="h-8 w-14 rounded-md border border-border-control bg-bg-surface px-2 text-[13px] font-semibold"
          maxLength={4}
          onChange={(event) => setLabel(event.target.value)}
          value={label}
        />
        <input
          aria-label="Khoảng cách tới trục kế (mm)"
          className="h-8 min-w-0 flex-1 rounded-md border border-border-control bg-bg-surface px-2 text-right text-[13px] tabular-nums"
          disabled={row.spacingMm === null}
          inputMode="numeric"
          onChange={(event) => setSpacing(event.target.value)}
          placeholder={row.spacingMm === null ? 'Trục cuối' : undefined}
          value={spacing}
        />
        <span className="text-[12px] text-text-secondary">mm</span>
      </div>
      {error === null ? null : (
        <p className="text-[12px] text-state-violation-text" role="alert">
          {error}
        </p>
      )}
      <p className="text-[12px] text-text-secondary">Enter để áp dụng, Esc để huỷ.</p>
      {/* RV1-10: nút submit ẩn giữ Enter cho trình đọc màn hình — không mang nhãn "Lưu" (A7). */}
      <button className="sr-only" type="submit">
        Áp dụng
      </button>
    </form>
  );
}
