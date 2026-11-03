import { useSyncExternalStore } from 'react';

import { ASK_CARD_MARGIN, askCardWidthFor, type QcAskRect } from './qcAsk';

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

/**
 * Phần khung mà Từng việc canh mục vào giữa: bỏ dải phải nơi thẻ hỏi neo (rộng thẻ thật + hai lề,
 * `askCardPlacement`), để thẻ đứng cạnh vùng nhìn thay vì che nó. Giữ ít nhất nửa khung. Gốc toạ độ
 * vẫn là góc trên trái của khung.
 */
export const focusFrameOf = (frame: { readonly width: number; readonly height: number }) => ({
  width: Math.max(frame.width / 2, frame.width - askCardWidthFor(frame.width) - 2 * ASK_CARD_MARGIN),
  height: frame.height,
});

/** Lề ngữ cảnh quanh mục: nửa cạnh dài của nó — tường dài vẫn thấy hai chỗ nối ở hai đầu. */
export const focusPadOf = (item: QcAskRect): number => Math.max(item.width, item.height) / 2;

/*
 * Lề tối thiểu, theo phần cạnh dài của cả tầng. Hộp ở đây là px bản vẽ, mỗi màn một tỷ lệ, nên không
 * nói được "1500 mm": 10 % của căn hộ 12–15 m ≈ 1,2–1,5 m, đủ thấy phòng quanh đoạn tường ngắn.
 */
const FOCUS_MIN_PAD_SHARE = 0.1;

/**
 * Hộp mà Từng việc phủ vừa khung: hộp của mục nới đều mỗi phía max(nửa cạnh dài của mục, 10 % cạnh
 * dài của tầng). Đoạn 56 mm không bị phóng tới mức mất hết ngữ cảnh; đoạn dài không bị nới thừa.
 */
export function focusBoundsOf(item: QcAskRect, whole: QcAskRect): QcAskRect {
  const pad = Math.max(focusPadOf(item), Math.max(whole.width, whole.height) * FOCUS_MIN_PAD_SHARE);
  return { x: item.x - pad, y: item.y - pad, width: item.width + pad * 2, height: item.height + pad * 2 };
}
