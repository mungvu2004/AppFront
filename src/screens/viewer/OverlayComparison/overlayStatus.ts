/**
 * Một nguồn trạng thái cho màn Đối chiếu bản vẽ (NGUYEN-TAC-BO-CUC §1): chip ở đầu panel trái,
 * câu có số, ba điều kiện của cổng và nút của cổng đều đọc từ đây, để không chỗ nào nói khác chỗ nào.
 * Hàm thuần trên viewmodel; định dạng số đi qua `lib/format` (A15).
 */
import { formatLength } from '@/lib/format/measure';

import type { DeviationRowViewModel, OverlayComparisonViewModel } from './types';

export type OverlayStatusKind = 'noModel' | 'noDrawing' | 'unmeasured' | 'deviating' | 'matched';

export interface OverlayStatus {
  readonly kind: OverlayStatusKind;
  readonly badge: Readonly<{ variant: 'verified' | 'attention' | 'neutral'; label: string }>;
  /** Câu có số dưới chip; `null` khi chưa đo (khối "chưa đo" của panel đã nói). */
  readonly summary: string | null;
  readonly toleranceText: string;
  readonly conditions: readonly Readonly<{ label: string; done: boolean }>[];
  readonly doneCount: number;
  readonly overRows: readonly DeviationRowViewModel[];
  readonly selectedRow: DeviationRowViewModel | null;
  /** Vùng vượt dung sai kế tiếp sau vùng đang chọn (vòng lại đầu); trùng vùng đang chọn thì `null`. */
  readonly nextOverRow: DeviationRowViewModel | null;
}

const BADGES = {
  noModel: { variant: 'neutral', label: 'Chưa có mô hình' },
  noDrawing: { variant: 'neutral', label: 'Chưa có bản vẽ' },
  unmeasured: { variant: 'neutral', label: 'Chưa đo' },
  deviating: { variant: 'attention', label: 'Lệch' },
  // A5: máy đo "khớp" không phải người duyệt — chưa xanh cho tới khi có người bấm xác nhận.
  matched: { variant: 'neutral', label: 'Khớp' },
} as const;

const CONFIRMED_BADGE = { variant: 'verified', label: 'Đã xác nhận khớp' } as const;

export function overlayStatusOf(model: OverlayComparisonViewModel): OverlayStatus {
  const measured = model.metrics.overToleranceCount !== null;
  const hasModel = measured || model.geometry.length > 0;
  const overRows = model.rows.filter((row) => row.statusCode === 'attention');
  const kind: OverlayStatusKind = !hasModel
    ? 'noModel'
    : !measured
      ? // Không ảnh bản vẽ thì không có gì để so, kể cả bằng mắt: không mời xác nhận (ảnh vòng 6).
        model.scanUrl === null
        ? 'noDrawing'
        : 'unmeasured'
      : overRows.length > 0
        ? 'deviating'
        : 'matched';
  const confirmed = model.confirmation.isConfirmed;
  const toleranceText = formatLength(model.toleranceMm, { unit: 'mm' });
  const total = String(model.rows.length);
  // Số chạy (useCountUp ở hook) khi đổi dung sai — cùng con số với danh sách khi đã dừng.
  const overCount = String(model.metrics.overToleranceCount ?? 0);

  const summary =
    kind === 'deviating'
      ? `${overCount}/${total} vùng vượt dung sai ${toleranceText}.`
      : kind === 'matched'
        ? `Cả ${total} vùng nằm trong dung sai ${toleranceText}.`
        : null;

  const conditions = [
    { label: 'Có mô hình', done: hasModel },
    { label: 'Trong dung sai', done: kind === 'matched' },
    { label: 'Đã xác nhận', done: confirmed },
  ];

  const selectedRow = model.rows.find((row) => row.isSelected) ?? null;
  const index = selectedRow === null ? -1 : overRows.indexOf(selectedRow);
  const next = overRows[(index + 1) % Math.max(overRows.length, 1)] ?? null;

  return {
    kind,
    badge: confirmed ? CONFIRMED_BADGE : BADGES[kind],
    summary,
    toleranceText,
    conditions,
    doneCount: conditions.filter((condition) => condition.done).length,
    overRows,
    selectedRow,
    nextOverRow: next === selectedRow ? null : next,
  };
}
