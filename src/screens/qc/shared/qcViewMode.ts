import { useSyncExternalStore } from 'react';

import { ASK_CARD_WIDTH, type QcAskRect } from './qcAsk';

/**
 * Hai chế độ nhìn của bố cục L23 (mock `v9-sua2`), chung cho Tường · Cửa và nội thất · Phòng:
 * - `task` (Từng việc): chọn một mục thì bản vẽ phóng tới nó, phần còn lại phủ mờ;
 * - `overview` (Tổng thể): cả tầng vừa khung, mục còn cần xem mang ghim số theo thứ tự hàng đợi.
 * Phím F đổi qua lại. Chế độ giữ nguyên khi chuyển bước trong phiên (một biến của module).
 */
export type QcViewMode = 'task' | 'overview';

let mode: QcViewMode = 'task';
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function setQcViewMode(next: QcViewMode): void {
  if (next === mode) return;
  mode = next;
  for (const listener of listeners) listener();
}

export const toggleQcViewMode = (): void => setQcViewMode(mode === 'task' ? 'overview' : 'task');

export function useQcViewMode(): QcViewMode {
  return useSyncExternalStore(subscribe, () => mode, () => mode);
}

/** Một ghim số: mục còn cần xem, tâm ở pixel khung bản vẽ; `n` = số trong hàng đợi (`queueNumbersOf`), không phải chỉ số mảng — mục không vẽ được vẫn giữ chỗ số. */
export interface QcPin {
  readonly id: string;
  readonly n: number;
  readonly x: number;
  readonly y: number;
}

/** Dải phải chừa cho thẻ hỏi: rộng thẻ + khe 16 + lề 12 (`askCardPlacement`). */
const CARD_RESERVE_PX = ASK_CARD_WIDTH + 28;

/**
 * Phần khung mà Từng việc canh mục vào giữa: bỏ dải phải cho thẻ hỏi, để thẻ đứng cạnh mục thay vì
 * đè lên nó ở khung hẹp (1024). Giữ ít nhất nửa khung. Gốc toạ độ vẫn là góc trên trái của khung.
 */
export const focusFrameOf = (frame: { readonly width: number; readonly height: number }) => ({
  width: Math.max(frame.width / 2, frame.width - CARD_RESERVE_PX),
  height: frame.height,
});

/** Hộp nhìn tối thiểu mỗi chiều, theo phần của hộp cả tầng: Từng việc phóng tối đa ~250 % so với vừa khung. */
const FOCUS_MIN_SHARE = 0.4;

/**
 * Hộp mà Từng việc phủ vừa khung: hộp của mục, nới quanh tâm của nó cho tới ít nhất 40 % hộp cả tầng
 * mỗi chiều. Đoạn tường 56 mm không bị phóng tới mức mất hết ngữ cảnh xung quanh.
 */
export function focusBoundsOf(item: QcAskRect, whole: QcAskRect): QcAskRect {
  const width = Math.max(item.width, whole.width * FOCUS_MIN_SHARE);
  const height = Math.max(item.height, whole.height * FOCUS_MIN_SHARE);
  return { x: item.x + (item.width - width) / 2, y: item.y + (item.height - height) / 2, width, height };
}
