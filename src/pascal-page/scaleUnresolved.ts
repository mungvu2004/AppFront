import { useSyncExternalStore } from 'react';

/** Tầng đầu tiên chưa hiệu chỉnh tỷ lệ (dải cảnh báo đang hiện); null = không có. */
let unresolvedFloor: string | null = null;
const listeners = new Set<() => void>();
export function setUnresolved(floorId: string | null) {
  if (unresolvedFloor === floorId) return;
  unresolvedFloor = floorId;
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const snapshot = () => unresolvedFloor;

/** Mã tầng cần hiệu chỉnh tỷ lệ (cho nút "Đặt tỷ lệ" của cổng); null khi tỷ lệ ổn. */
export function useScaleUnresolvedFloor(): string | null {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** `true` khi dải cảnh báo tỷ lệ đang hiện. */
export function useScaleUnresolved(): boolean {
  return useScaleUnresolvedFloor() !== null;
}
