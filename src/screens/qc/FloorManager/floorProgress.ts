/**
 * Tiến độ và "Việc tiếp" của màn Quản lý tầng (S-19, bản Z) — phép suy THUẦN từ các dòng
 * `FloorRowVm` mà `useFloorManager` đã dựng. Một nguồn trạng thái: không đọc gì ngoài `rows`.
 *
 * App hiện chỉ biết một tầng CÓ hay CHƯA CÓ bản vẽ. Các bước "AI đang đọc", "Đang duyệt",
 * "Duyệt xong", "Xử lý lỗi" của demo cần BE trả tiến độ theo tầng (GHI-CHU §CẦN BE 1) —
 * ở đây không bịa chúng.
 *
 * File `.ts` (không phải view) nên được định dạng số qua `src/lib/format` (A15).
 */

import { millimetres, millimetresToMetres } from '@/domain/units/types';
import { formatNumber } from '@/lib/format/number';

import type { FloorRowVm } from './floorManagerTypes';
import { elevationSignedText, heightMmText } from './floorFormat';
import { draftToMillimetres } from './useFloorManager';

const MAX_CONDITIONS = 3;

export { elevationSignedText, heightMmText };

/** Số mm đang có trong nháp chiều cao (nháp của hook tính bằng mét). */
export const heightDraftMm = (row: FloorRowVm): number | undefined =>
  draftToMillimetres(row.draft.height) ?? undefined;

/** Ô chiều cao nhập mm; hook nhận nháp bằng mét — đổi đơn vị ở đây, không ở view. */
export const heightDraftFromMm = (valueMm: number | undefined): string =>
  valueMm === undefined ? '' : formatNumber(millimetresToMetres(millimetres(valueMm)), { fractionDigits: 3, grouping: false });

export type FloorStepTone = 'attention' | 'neutral';

export interface FloorStepVm {
  readonly label: string;
  readonly tone: FloorStepTone;
  readonly nextText: string;
  /** Dòng phụ dưới tên tầng; rỗng khi chip đã nói đủ (không lặp "Chưa có bản vẽ", BUG-250). */
  readonly summaryText: string;
}

export function floorStepOf(row: FloorRowVm): FloorStepVm {
  if (row.needsDrawing) {
    return { label: 'Chưa có bản vẽ', tone: 'attention', nextText: 'tải bản vẽ mặt bằng', summaryText: '' };
  }

  return {
    label: 'Đã có bản vẽ',
    tone: 'neutral',
    nextText: 'duyệt tường, phòng',
    summaryText: `${row.wallCountText} tường, ${row.roomCountText} phòng, ${row.areaText}`,
  };
}

export interface NextTaskVm {
  readonly floorId: string;
  readonly kind: 'upload' | 'review';
  readonly title: string;
  readonly reason: string;
  readonly conditions: readonly string[];
  readonly actionLabel: string;
  readonly doneCount: number;
  readonly totalCount: number;
  readonly meterText: string;
}

/** Tầng cần làm nhất: tầng đầu tiên chưa có bản vẽ; đủ bản vẽ thì tầng đầu tiên để duyệt. */
export function nextTaskOf(rows: readonly FloorRowVm[]): NextTaskVm | null {
  const first = rows[0];

  if (first === undefined) {
    return null;
  }

  const missing = rows.filter((row) => row.needsDrawing);
  const doneCount = rows.length - missing.length;
  const meterText = `${formatNumber(doneCount, { fractionDigits: 0 })}/${formatNumber(rows.length, { fractionDigits: 0 })} tầng có bản vẽ`;
  const target = missing[0];

  if (target !== undefined) {
    return {
      floorId: target.id,
      kind: 'upload',
      title: `Tải bản vẽ mặt bằng ${target.name}`,
      reason: `${target.name} ở cao độ ${elevationSignedText(target.elevationMm)}. Tải bản vẽ để AI đọc tường, phòng của tầng này.`,
      conditions: missing.slice(0, MAX_CONDITIONS).map((row) => `${row.name}: tải bản vẽ`),
      actionLabel: `Tải bản vẽ ${target.name}`,
      doneCount,
      totalCount: rows.length,
      meterText,
    };
  }

  return {
    floorId: first.id,
    kind: 'review',
    title: 'Duyệt tường, phòng từng tầng',
    reason: 'Mọi tầng đã có bản vẽ. Duyệt tường, phòng AI đọc được trước khi sang Mô hình 3D.',
    conditions: [],
    actionLabel: `Duyệt tường ${first.name}`,
    doneCount,
    totalCount: rows.length,
    meterText,
  };
}

/** Câu trạng thái dưới tiêu đề, ví dụ "4 tầng, từ cao độ −3.000 đến +10.200, cao tổng 13.200 mm." */
export function stackSummaryText(rows: readonly FloorRowVm[]): string | null {
  if (rows.length === 0) {
    return null;
  }

  const bottom = Math.min(...rows.map((row) => row.elevationMm));
  const top = Math.max(...rows.map((row) => row.elevationMm + row.heightMm));

  return `${formatNumber(rows.length, { fractionDigits: 0 })} tầng, từ cao độ ${elevationSignedText(bottom)} đến ${elevationSignedText(top)}, cao tổng ${heightMmText(top - bottom)} mm.`;
}
