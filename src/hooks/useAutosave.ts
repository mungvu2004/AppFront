import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { createAutosave, type Autosave } from '../lib/autosave/createAutosave';
import { formatClockTime } from '../lib/format/datetime';
import type { RootState } from '../store';
import { useStore } from '../store';

export interface UseAutosaveHandle {
  /**
   * The exact string this hook has always returned: `null` before the first
   * completed cycle, then `"Đã lưu lúc HH:mm"` or `"Lưu thất bại"`. Kept
   * byte-for-byte on purpose — `ConnectedSaveIndicator`
   * (`components/feedback/SaveIndicator.tsx:109`, outside this task's
   * whitelist) recognizes a failed save by exact string match
   * (`saveLabel === 'Lưu thất bại'`); the longer, friendlier failure copy in
   * `src/i18n/vi.json` (`autosave.failed`) belongs to `useSaveIndicator`
   * (`hooks/useSaveIndicator.ts`), a separate read-only view onto the same
   * engine, not to this one.
   */
  label: string | null;
  /**
   * Saves right now instead of waiting out the debounce window. Safe with
   * nothing pending — resolves without calling `onSave`. This is the export
   * `docs/contracts/property-inspector/commands.md` C8#7 found missing: with
   * nothing to call, Ctrl+S had nothing to do.
   */
  flush: () => Promise<void>;
}

/**
 * The engine shared by {@link useAutosave} and {@link useAutosaveFlush}: a
 * thin React face over `createAutosave`
 * (`src/lib/autosave/createAutosave.ts`), which is now the ONLY autosave
 * debounce implementation in the repo — this hook used to hand-roll its own
 * `setTimeout` (`AUTOSAVE_DEBOUNCE_MS`); it no longer does, and the 800 ms
 * figure itself is not written here — it is `createAutosave`'s own
 * `DEFAULT_DEBOUNCE_MS`, per invariant A7.
 *
 * Watches `state.spatial` directly, exactly as before: every existing caller
 * only supplies *where* a save goes
 * (`usePropertyInspector.ts:1059`, `useScaleCalibration.ts:625`,
 * `useDimensionOcrReview.ts:576`), never the data itself. A failed `onSave`
 * now runs through `createAutosave`'s own retry schedule
 * (`retrySchedule.ts`: 5s/15s/45s) and offline detection instead of flipping
 * straight to "Lưu thất bại" after one attempt.
 */
function useAutosaveHandle(onSave: (data: RootState['spatial']) => Promise<void>): UseAutosaveHandle {
  const spatial = useStore((state) => state.spatial);

  const spatialRef = useRef(spatial);
  spatialRef.current = spatial;

  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const autosave = useMemo<Autosave>(
    () =>
      createAutosave<NonNullable<RootState['spatial']>>({
        getChanges: () => spatialRef.current ?? undefined,
        // Returns the callback's own promise directly (no `async`/`await`
        // wrapper here) so a failing save rejects in the same number of
        // microtask turns as before this hook grew an engine underneath it.
        save: (changes) => onSaveRef.current(changes),
      }),
    [],
  );

  const state = useSyncExternalStore(autosave.subscribe, autosave.getState, autosave.getState);
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!spatial) {
      return;
    }

    autosave.notifyChange();
  }, [spatial, autosave]);

  useEffect(() => {
    if (state === 'saved') {
      const lastSavedAt = autosave.getLastSavedAt();

      if (lastSavedAt !== undefined) {
        setLabel(`Đã lưu lúc ${formatClockTime(new Date(lastSavedAt))}`);
      }

      return;
    }

    if (state === 'failed') {
      setLabel('Lưu thất bại');
    }

    // 'dirty' | 'saving' | 'offline': sticky — the label already on screen
    // stays put, exactly as it did while the old hand-rolled timer counted
    // down (it only ever wrote a new label from inside its own callback).
  }, [state, autosave]);

  return { flush: autosave.saveNow, label };
}

/**
 * Invariant A7's autosave: waits for 800 ms of silence after the last store
 * change, then calls `onSave` with the current `state.spatial`. Signature and
 * return value are unchanged from before this file gained an engine
 * underneath it.
 */
export function useAutosave(onSave: (data: RootState['spatial']) => Promise<void>): string | null {
  return useAutosaveHandle(onSave).label;
}

/**
 * Same engine as {@link useAutosave}, plus `flush` for a caller that needs to
 * save on demand (a keyboard shortcut, a "before you leave" guard) rather
 * than only after the debounce window. Not wired to a key yet —
 * `src/lib/input/shortcutRegistry.ts` is outside this task's whitelist; the
 * first caller is whoever connects a panel's autosave to Ctrl+S.
 */
export function useAutosaveFlush(onSave: (data: RootState['spatial']) => Promise<void>): UseAutosaveHandle {
  return useAutosaveHandle(onSave);
}
