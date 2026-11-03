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

/** Lớp nội dung `translate(offset) scale(scale)` quanh tâm khung `width × height`. */
export interface QcContentView {
  readonly scale: number;
  readonly offset: { readonly x: number; readonly y: number };
  readonly width: number;
  readonly height: number;
}

/** Điểm ở toạ độ lớp nội dung → toạ độ khung, để thẻ/ghim đứng ngoài lớp phóng mà vẫn bám đối tượng. */
export function pointInFrame<P extends { readonly x: number; readonly y: number }>(point: P, view: QcContentView): P {
  const cx = view.width / 2;
  const cy = view.height / 2;
  return { ...point, x: cx + view.offset.x + view.scale * (point.x - cx), y: cy + view.offset.y + view.scale * (point.y - cy) };
}

export function rectInFrame(rect: QcAskRect, view: QcContentView): QcAskRect {
  return { ...pointInFrame(rect, view), width: rect.width * view.scale, height: rect.height * view.scale };
}

export const ASK_CARD_WIDTH = 300;
/** Lề giữa thẻ và mép khung bản vẽ; `focusFrameOf` chừa đúng rộng thẻ + hai lề này. */
export const ASK_CARD_MARGIN = 12;
/* Chừa chỗ cho chrome nổi: nút Hiển thị (trên phải, top 12 + cao 36) và cụm thu phóng (dưới phải). */
const TOP_RESERVE = 60;
const BOTTOM_RESERVE = 72;

/**
 * Chỗ đặt thẻ trong khung bản vẽ: luôn neo mép phải, ngay dưới nút Hiển thị. Từng việc canh mục vào
 * phần khung bên trái dải này (`focusFrameOf`), nên thẻ không che mục và vùng quanh nó, và không nhảy
 * chỗ khi đi qua các mục (U12: nút duyệt luôn ở đúng một chỗ).
 */
export function askCardPlacement(frame: { readonly width: number; readonly height: number }, width = ASK_CARD_WIDTH) {
  return {
    left: Math.max(ASK_CARD_MARGIN, frame.width - ASK_CARD_MARGIN - width),
    top: TOP_RESERVE,
    maxHeight: Math.max(160, frame.height - TOP_RESERVE - BOTTOM_RESERVE),
  };
}

/* U20: khung bản vẽ hẹp — thẻ hẹp lại để không phủ nửa bản vẽ. */
export const ASK_CARD_WIDTH_NARROW = 264;
const NARROW_FRAME = 760;
export const askCardWidthFor = (frameWidth: number): number => (frameWidth < NARROW_FRAME ? ASK_CARD_WIDTH_NARROW : ASK_CARD_WIDTH);

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
