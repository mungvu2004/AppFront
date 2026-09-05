import type { AutosaveState } from './createAutosave';

/**
 * Structurally identical to `SaveState` in
 * `src/components/feedback/SaveIndicator.tsx` (`'idle' | 'pending' | 'saving'
 * | 'saved' | 'error'`), but not imported from there: `src/lib/**` may not
 * import `src/components/**` (CLAUDE.md 0.4, enforced by
 * `eslint-rules/configs/project.js`). A caller wiring this into
 * `<SaveIndicator saveState={...} />` gets a type TypeScript accepts by shape.
 */
export type SaveIndicatorState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/**
 * Maps the five-value `AutosaveState` (`createAutosave.ts`) onto the
 * five-value `SaveIndicatorState` above — the two vocabularies exist because
 * `SaveIndicator` predates `createAutosave` and nothing in the repo bridges
 * them yet (`docs/contracts/property-inspector/commands.md` C6/C8#6).
 *
 * `'dirty'` reads naturally as `'pending'` ("a change is waiting to sync"),
 * and `'failed'` as `'error'` — both exact matches in meaning, not just name.
 *
 * `'offline'` has no dedicated `SaveIndicatorState` slot, and the choice of
 * where to fold it is deliberate: `'error'` would tell the user a save was
 * *attempted and failed*, which is false — offline mode never calls `save` at
 * all, and resumes on its own once the network returns (`retrySchedule.ts`
 * is not even involved; see `OFFLINE_RECHECK_MS` in `createAutosave.ts`).
 * `'saved'` would tell the user their edit is safe on a server it never
 * reached, which is the one lie A7's indicator exists to prevent. `'pending'`
 * is the only state whose own label — "Có thay đổi chờ đồng bộ" ("changes
 * waiting to sync") — stays true while offline: the change really is
 * waiting, just for connectivity instead of the debounce window.
 */
export function toSaveIndicatorState(state: AutosaveState): SaveIndicatorState {
  switch (state) {
    case 'dirty':
      return 'pending';
    case 'offline':
      return 'pending';
    case 'saving':
      return 'saving';
    case 'saved':
      return 'saved';
    case 'failed':
      return 'error';
  }
}
