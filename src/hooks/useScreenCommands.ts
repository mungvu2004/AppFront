import { useEffect, useSyncExternalStore } from 'react';

import type { CommandItem } from './useCommandPalette';

/**
 * Lệnh của màn đang mở trong bảng lệnh Ctrl K.
 *
 * Bảng lệnh sống ở `AppShell`, còn lệnh thật (đi tới bước, mục cần xem tiếp, chuẩn hoá tên…)
 * sống trong màn. Màn gọi `useScreenCommands(lệnh)` lúc gắn; bảng đọc bằng
 * `useRegisteredScreenCommands()` và xếp chúng lên đầu. Nhiều chỗ trong một màn cùng đăng ký
 * được (cột bước, thẻ hỏi, màn): mỗi chỗ một khe, gỡ khi rời màn.
 */
const slots = new Map<symbol, readonly CommandItem[]>();
const listeners = new Set<() => void>();
let snapshot: readonly CommandItem[] = [];

const emit = () => {
  snapshot = [...slots.values()].flat();
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Đăng ký lệnh của màn; truyền mảng đã `useMemo` để không đăng ký lại mỗi lần vẽ. */
export function useScreenCommands(commands: readonly CommandItem[]): void {
  useEffect(() => {
    const slot = Symbol('screen-commands');
    slots.set(slot, commands);
    emit();
    return () => {
      slots.delete(slot);
      emit();
    };
  }, [commands]);
}

export function useRegisteredScreenCommands(): readonly CommandItem[] {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}
