import { createJSONStorage, type PersistStorage } from 'zustand/middleware'

/**
 * `localStorage` for a `skipHydration` persist store that ignores writes until the
 * store has rehydrated. zustand's persist writes on every `setState`, including the
 * ones child effects make on mount before `<Editor>`'s `persist.rehydrate()` effect
 * runs, so saved preferences (grid step, sidebar width…) were overwritten with the
 * defaults before they were read (AppFront BUG-648).
 */
export function hydratedLocalStorage<S>(hasHydrated: () => boolean): PersistStorage<S> | undefined {
  return createJSONStorage<S>(() => ({
    getItem: (name) => localStorage.getItem(name),
    setItem: (name, value) => {
      if (hasHydrated()) localStorage.setItem(name, value)
    },
    removeItem: (name) => localStorage.removeItem(name),
  }))
}
