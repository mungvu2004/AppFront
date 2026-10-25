import type { AxisGridViewModel, FloorAlignRowViewModel } from './axisGridTypes';

/**
 * Cổng sang Mô hình 3D của màn trục (câu 3, demo Z/S-18): ba điều kiện chặn đọc thẳng từ
 * view-model — không tự tính lệch, chỉ đọc trạng thái hook đã so ngưỡng (M-11).
 * Một nguồn: FlowGate, chip trạng thái và nút đều đọc cùng đối tượng này.
 */
export interface AxisGridGate {
  readonly conditions: readonly { readonly label: string; readonly done: boolean }[];
  readonly isReady: boolean;
  /** Hướng trục còn thiếu (nút "Vẽ trục ngang/dọc"); `null` khi đủ hai hướng. */
  readonly missingDirection: 'horizontal' | 'vertical' | null;
  /** Tầng lệch cần xem trước (nút "Xem lệch <tầng>"); `null` khi mọi tầng thẳng trục. */
  readonly laggingFloor: FloorAlignRowViewModel | null;
}

export const AXIS_GATE_LABELS = {
  twoWay: 'Trục hai hướng',
  origin: 'Gốc ±0.000',
  aligned: 'Tầng thẳng trục',
} as const;

/** Chữ của thẻ trên bản vẽ và nút cổng (một chỗ, dùng chung `AxisGridCanvasCard` + view). */
export const AXIS_CARD_TEXT = {
  emptyTitle: 'Chưa có trục nào',
  missingHorizontalTitle: 'Chưa có trục ngang nên chưa đặt được gốc',
  missingHorizontalBody: 'Gốc ±0.000 phải nằm ở một giao trục, cần ít nhất một trục ngang (A, B, C…).',
  missingVerticalTitle: 'Chưa có trục dọc nên chưa đặt được gốc',
  missingVerticalBody: 'Gốc ±0.000 phải nằm ở một giao trục, cần ít nhất một trục dọc (1, 2, 3…).',
  drawHorizontal: 'Vẽ trục ngang',
  drawVertical: 'Vẽ trục dọc',
  errorTitle: 'Không tính được trục',
  retry: 'Thử lại',
  drawManual: 'Vẽ trục thủ công',
} as const;

export function axisGridGateOf(viewModel: AxisGridViewModel): AxisGridGate {
  const hasRows = (direction: 'horizontal' | 'vertical'): boolean =>
    viewModel.groups.some((group) => group.direction === direction && group.rows.length > 0);
  /* Ngang trước: chưa có trục ngang thì chưa có giao trục để đặt gốc (cùng lối ra của trạng thái rỗng). */
  const missingDirection = !hasRows('horizontal') ? 'horizontal' : !hasRows('vertical') ? 'vertical' : null;
  const hasAxes = !viewModel.hasNoAxes && viewModel.errorMessage === null;
  const hasOrigin = hasAxes && missingDirection === null && viewModel.origin.selectedAnchor !== null;
  const laggingFloor = !hasAxes
    ? null
    : (viewModel.floors.find((floor) => floor.levelId === viewModel.warningBanner?.levelId) ??
      viewModel.floors.find((floor) => floor.status !== 'ok') ??
      null);
  const isAligned = hasAxes && laggingFloor === null && viewModel.warningBanner === null;
  const conditions = [
    { label: AXIS_GATE_LABELS.twoWay, done: hasAxes && missingDirection === null },
    { label: AXIS_GATE_LABELS.origin, done: hasOrigin },
    { label: AXIS_GATE_LABELS.aligned, done: isAligned },
  ];

  return {
    conditions,
    isReady: conditions.every((condition) => condition.done),
    missingDirection: viewModel.errorMessage === null ? missingDirection : null,
    laggingFloor,
  };
}
