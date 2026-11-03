import { useSyncExternalStore } from 'react';

/**
 * "So sánh hai bên" của Tường và Cửa và nội thất: bên trái bản vẽ gốc, bên phải lớp đã nhận diện,
 * một khung nhìn chung. Bật/tắt trong menu "N% ▾" (`QcZoomMenu`); Esc thoát sau khi đã bỏ chọn.
 * Nhớ trong phiên (sessionStorage) để chuyển bước Tường ↔ Cửa vẫn giữ; trình duyệt chặn kho thì chỉ nhớ trong module.
 */
const STORAGE_KEY = 'qc.compareSplit';

const read = (): boolean => {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

let compare = typeof window === 'undefined' ? false : read();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function setQcCompare(next: boolean): void {
  if (next === compare) return;
  compare = next;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  } catch {
    /* Kho bị chặn (chế độ riêng tư): vẫn đổi trong phiên này. */
  }
  for (const listener of listeners) listener();
}

/** Giá trị hiện tại, cho handler phím (không cần dựng lại). */
export const isQcCompare = (): boolean => compare;

export function useQcCompare(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => compare,
    () => compare,
  );
}
