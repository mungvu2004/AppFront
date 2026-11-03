import { createContext, useContext, type ReactNode } from 'react';

/** Phép tính của panel chi tiết phải (bố cục hai panel, 04/11); thành phần ở `QcAskCard.tsx`. */
export interface QcAskRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const QcAskSlotContext = createContext<ReactNode>(null);
/**
 * @deprecated Shim chuyển tiếp: truyền thẳng panel vào prop `inspector` của `QcWorkspace`. Trong lúc chờ,
 * `QcWorkspace` (chế độ `column`, không có `inspector`) tự đọc khe này và neo nó ở panel phải.
 */
export const QcAskSlot = QcAskSlotContext.Provider;
/** @deprecated Shim chuyển tiếp (xem `QcAskSlot`); bản vẽ không còn cần đọc khe này. */
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
