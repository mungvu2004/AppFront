import { createContext, useContext, type ReactNode } from 'react';

/** Khe và phép tính của thẻ hỏi L23 (đợt 2); thành phần ở `QcAskCard.tsx`. */
export interface QcAskRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const QcAskSlotContext = createContext<ReactNode>(null);
export const QcAskSlot = QcAskSlotContext.Provider;
export const useQcAskSlot = (): ReactNode => useContext(QcAskSlotContext);

export const ASK_CARD_WIDTH = 360;
const GAP = 16;
const MARGIN = 12;
/* Chừa chỗ cho chrome nổi: nút Hiển thị (trên phải) và cụm thu phóng (dưới phải). */
const TOP_RESERVE = 60;
const BOTTOM_RESERVE = 72;

/** Chỗ đặt thẻ trong khung bản vẽ: phải đối tượng nếu đủ, không thì trái, không nữa thì sát mép phải. */
export function askCardPlacement(rect: QcAskRect, frame: { readonly width: number; readonly height: number }, width = ASK_CARD_WIDTH) {
  const right = rect.x + rect.width + GAP;
  const leftSide = rect.x - GAP - width;
  let left: number;
  if (right + width <= frame.width - MARGIN) left = right;
  else if (leftSide >= MARGIN) left = leftSide;
  else left = Math.max(MARGIN, frame.width - MARGIN - width);
  /* Thẻ cần chỗ cho thân (tới ~560 px): mép trên kéo lên để không bị cắt ở nửa dưới bản vẽ. */
  const room = Math.min(560, Math.round(frame.height * 0.75));
  const top = Math.min(Math.max(TOP_RESERVE, rect.y - 80), Math.max(TOP_RESERVE, frame.height - BOTTOM_RESERVE - room));
  return { left, top, maxHeight: Math.max(160, frame.height - top - BOTTOM_RESERVE) };
}

/* U20: dưới 1024 px khung bản vẽ hẹp — thẻ hẹp lại để không phủ nửa bản vẽ. */
export const ASK_CARD_WIDTH_NARROW = 288;
const NARROW_FRAME = 760;
export const askCardWidthFor = (frameWidth: number): number => (frameWidth < NARROW_FRAME ? ASK_CARD_WIDTH_NARROW : ASK_CARD_WIDTH);

export type AskCardPlace = ReturnType<typeof askCardPlacement>;

/**
 * U12: giữ thẻ đứng yên khi người duyệt đi qua các mục của cùng một bước — nút duyệt ở đúng
 * chỗ cũ, bấm liên tiếp một chỗ được. Chỉ tính chỗ mới khi chỗ cũ ra ngoài khung hoặc che mục mới.
 */
export function stableAskPlacement(
  previous: AskCardPlace | null,
  rect: QcAskRect,
  frame: { readonly width: number; readonly height: number },
  width = ASK_CARD_WIDTH,
): AskCardPlace {
  if (previous !== null) {
    const fits = previous.left >= MARGIN && previous.left + width <= frame.width - MARGIN && previous.top >= TOP_RESERVE && frame.height - BOTTOM_RESERVE - previous.top >= 160;
    const clear = rect.x + rect.width + GAP <= previous.left || rect.x - GAP >= previous.left + width;
    if (fits && clear) return { left: previous.left, top: previous.top, maxHeight: frame.height - previous.top - BOTTOM_RESERVE };
  }
  return askCardPlacement(rect, frame, width);
}

/** Vị trí trong hàng đợi: "k trong N" của mục đang chọn và hai mục kề để ‹ K / › J. */
export function askNavOf<Id extends string>(items: readonly { readonly id: Id; readonly pending: boolean }[], selectedId: Id | null) {
  const pending = items.filter((item) => item.pending);
  const at = pending.findIndex((item) => item.id === selectedId);
  return {
    position: at < 0 ? null : at + 1,
    total: pending.length,
    prevId: at > 0 ? pending[at - 1]!.id : (null as Id | null),
    nextId: at < 0 ? (pending[0]?.id ?? null) : (pending[at + 1]?.id ?? null),
  };
}


/** Số thứ tự của mục còn cần xem trong hàng đợi (1..N) — cùng số với ghim Tổng thể (`QcViewLayer`). */
export function queueNumbersOf<Id extends string>(items: readonly { readonly id: Id; readonly pending: boolean }[]): ReadonlyMap<Id, number> {
  return new Map(items.filter((item) => item.pending).map((item, index) => [item.id, index + 1]));
}
