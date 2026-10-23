import { useSyncExternalStore } from 'react';

let unresolved = false;
const listeners = new Set<() => void>();
export function setUnresolved(value: boolean) {
  if (unresolved === value) return;
  unresolved = value;
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const snapshot = () => unresolved;

/** `true` khi dải cảnh báo tỷ lệ đang hiện. */
export function useScaleUnresolved(): boolean {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
