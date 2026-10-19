/**
 * BUG-648 — Pascal editor preferences (grid step, sidebar width…) survive a reload.
 *
 * `useEditor` and `useSidebarStore` use zustand `persist` with `skipHydration`;
 * `<Editor>` calls `persist.rehydrate()` in its own effect, and a parent's effects run
 * AFTER its children's. `persist` writes the store to `localStorage` on EVERY
 * `setState`, hydrated or not, so a write a child effect makes on mount overwrote the
 * saved preferences with the defaults before they were read.
 *
 * The old fix patched `vendor/pascal`; this one stays outside it: it swaps both stores'
 * storage, through the public `persist.setOptions`, for a `localStorage` wrapper that
 * drops writes until the store has hydrated. Same keys and shape as upstream, so
 * already-saved preferences keep working.
 */

import { useEditor, useSidebarStore } from '@pascal-app/editor'

function guardedLocalStorage<V>(hasHydrated: () => boolean) {
  return {
    getItem: (name: string): V | null => {
      try {
        const raw = localStorage.getItem(name)
        return raw ? (JSON.parse(raw) as V) : null
      } catch {
        return null
      }
    },
    setItem: (name: string, value: V): void => {
      if (!hasHydrated()) return
      try {
        localStorage.setItem(name, JSON.stringify(value))
      } catch {
        // Private mode / quota: preferences just won't persist.
      }
    },
    removeItem: (name: string): void => {
      try {
        localStorage.removeItem(name)
      } catch {
        // ignore
      }
    },
  }
}

let installed = false

/**
 * Call during the render of a component above `<Editor>`: the swap then happens
 * before any child effect can write. Idempotent.
 */
export function useEditorPreferencesPersistence(): void {
  if (installed) return
  installed = true
  useEditor.persist.setOptions({
    storage: guardedLocalStorage(() => useEditor.persist.hasHydrated()),
  })
  useSidebarStore.persist.setOptions({
    storage: guardedLocalStorage(() => useSidebarStore.persist.hasHydrated()),
  })
}
