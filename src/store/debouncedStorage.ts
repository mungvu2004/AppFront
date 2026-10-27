import type { PersistStorage, StorageValue } from 'zustand/middleware';

/** How long a burst of `set` calls is gathered before one write (P7). */
export const PERSIST_DEBOUNCE_MS = 300;

export type DebouncedPersistStorage<S> = PersistStorage<S> & {
  /** Write whatever is pending now. Called on `pagehide` / hidden tab, and by tests. */
  flush: () => void;
};

/**
 * `persist` storage that does not touch `localStorage` on every `set` (P7).
 *
 * `persist` calls `setItem` after EVERY `set` of the root store — a hover, a
 * selection, a zoom step — and the stock JSON storage stringifies and writes
 * synchronously each time (measured: 100 writes for 100 mouse moves). Here
 * `setItem` only remembers the latest value; the first `set` of a burst arms
 * one timer and the latest value is written {@link PERSIST_DEBOUNCE_MS} later
 * (at most one write per window, even while the mouse keeps moving), skipped
 * when the string equals what storage already holds. Pending values are flushed on `pagehide` and when
 * the tab goes hidden, so closing the tab does not lose the last change.
 *
 * Returns `undefined` when storage is unreachable, like `createJSONStorage`,
 * so `persist` falls back to memory.
 */
export function createDebouncedJSONStorage<S>(
  getStorage: () => Storage,
  delayMs = PERSIST_DEBOUNCE_MS,
): DebouncedPersistStorage<S> | undefined {
  let storage: Storage;
  try {
    storage = getStorage();
  } catch {
    return undefined;
  }

  const pending = new Map<string, StorageValue<S>>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    for (const [name, value] of pending) {
      const next = JSON.stringify(value);
      if (storage.getItem(name) !== next) storage.setItem(name, next);
    }
    pending.clear();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }

  return {
    getItem: (name) => {
      const raw = storage.getItem(name);
      return raw === null ? null : (JSON.parse(raw) as StorageValue<S>);
    },
    setItem: (name, value) => {
      pending.set(name, value);
      if (timer === null) timer = setTimeout(flush, delayMs);
    },
    removeItem: (name) => {
      pending.delete(name);
      storage.removeItem(name);
    },
    flush,
  };
}
