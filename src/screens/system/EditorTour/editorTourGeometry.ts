/** Hình học của lớp dạy việc: hằng số bố cục, vị trí thẻ nhắc và bốn tấm nền quanh ô được dạy. */

import type { CSSProperties } from 'react';

import type { TourPlacement, TourRect } from './useEditorTour';

/* -------------------------------------------------------------------------- */
/* Hình học. Không con số nào ở đây là thời lượng — xem mục chuyển động dưới.  */
/* -------------------------------------------------------------------------- */

/** Bề ngang thẻ nhắc. */
export const CARD_WIDTH = 320;
/** Cạnh mũi nhọn, trước khi xoay 45°. */
export const ARROW = 8;
/** Khe giữa mép neo và mép thẻ. */
const GAP = 12;
/** Lề tối thiểu giữa thẻ và mép khung nhìn. */
const MARGIN = 16;
/** Mũi nhọn không bò sát góc bo của thẻ. */
export const ARROW_INSET = 20;
/** Quãng trượt của thẻ lúc sang bước. */
export const SLIDE = 8;
/** Nền đậm nhất 28% — tối hơn nữa là che mất thứ đang dạy. */
export const BACKDROP_OPACITY = 0.28;
/** Nửa mũi nhọn thò ra khỏi mép thẻ. */
export const ARROW_OUT = -ARROW / 2;

/** Hai cạnh của hình vuông xoay 45° quay về phía neo. */
export const ARROW_EDGES: Readonly<Record<TourPlacement, string>> = {
  top: 'border-b border-r',
  bottom: 'border-l border-t',
  left: 'border-r border-t',
  right: 'border-b border-l',
  corner: '',
};

/** Nâng thẻ góc lên khỏi thanh trạng thái đáy (N1-06). */
const CORNER_LIFT = 48;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Mép trên-trái của thẻ, theo neo và hướng đứng, đã kẹp trong khung nhìn. */
export function cardOrigin(
  rect: TourRect,
  placement: TourPlacement,
  cardHeight: number,
  viewWidth: number,
  viewHeight: number,
): { readonly left: number; readonly top: number } {
  const centreX = rect.left + rect.width / 2 - CARD_WIDTH / 2;
  const centreY = rect.top + rect.height / 2 - cardHeight / 2;

  const raw =
    placement === 'corner'
      ? { left: viewWidth - CARD_WIDTH - MARGIN, top: viewHeight - cardHeight - MARGIN - CORNER_LIFT }
      : placement === 'top'
      ? { left: centreX, top: rect.top - cardHeight - GAP }
      : placement === 'bottom'
        ? { left: centreX, top: rect.top + rect.height + GAP }
        : placement === 'left'
          ? { left: rect.left - CARD_WIDTH - GAP, top: centreY }
          : { left: rect.left + rect.width + GAP, top: centreY };

  const fit = (point: { readonly left: number; readonly top: number }): { readonly left: number; readonly top: number } => ({
    left: clamp(point.left, MARGIN, Math.max(MARGIN, viewWidth - CARD_WIDTH - MARGIN)),
    top: clamp(point.top, MARGIN, Math.max(MARGIN, viewHeight - cardHeight - MARGIN)),
  });
  const covers = (box: { readonly left: number; readonly top: number }): boolean =>
    box.left < rect.left + rect.width &&
    box.left + CARD_WIDTH > rect.left &&
    box.top < rect.top + rect.height &&
    box.top + cardHeight > rect.top;

  const placed = fit(raw);
  // U44: kẹp vào khung nhìn có thể đẩy thẻ đè lên chính ô được dạy (nút Xuất sát mép trên/dưới): đứng bên cạnh ô.
  if (placement === 'corner' || !covers(placed)) return placed;
  const beside = fit({ left: rect.left - CARD_WIDTH - GAP, top: centreY });
  if (!covers(beside)) return beside;
  const besideRight = fit({ left: rect.left + rect.width + GAP, top: centreY });
  return covers(besideRight) ? placed : besideRight;
}

/**
 * Bốn tấm quanh ô được dạy.
 *
 * Không tấm nào phủ lên ô, nên phần tử bên trong vẫn nhận được con trỏ — đó là
 * cả lý do lớp này khoét bằng bốn hình chữ nhật thay vì một mặt nạ.
 */
export function backdropPanels(
  hole: TourRect,
): readonly { readonly side: string; readonly box: CSSProperties }[] {
  return [
    { side: 'top', box: { top: 0, left: 0, right: 0, height: Math.max(0, hole.top) } },
    { side: 'bottom', box: { top: hole.top + hole.height, left: 0, right: 0, bottom: 0 } },
    {
      side: 'left',
      box: { top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height },
    },
    {
      side: 'right',
      box: { top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height },
    },
  ];
}
