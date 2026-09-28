import { type EditorApi } from '@pascal-app/core';
/**
 * Concrete {@link EditorApi} backed by `useEditor` + the interaction scope.
 * Descriptors call into editor state through this interface; the editor owns
 * the actual store wiring so core stays decoupled.
 *
 * `engageMove` no longer clears any in-progress endpoint drag or curve gesture:
 * `setMovingNode` begins the `moving` scope, and the scope is single-owner, so
 * it atomically replaces any prior reshape — there is no separate flag to reset.
 */
export declare function createEditorApi(): EditorApi;
//# sourceMappingURL=editor-api.d.ts.map