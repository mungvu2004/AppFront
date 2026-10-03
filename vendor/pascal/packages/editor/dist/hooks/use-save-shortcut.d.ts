/**
 * Claims Cmd/Ctrl+S for the app's save.
 *
 * Capture phase and ungated on purpose: the browser's "Save page" dialog must
 * never appear anywhere in the editor — including first-person, studio mode and
 * while focus sits in an input, where people still expect the chord to save.
 * `e.code` keeps it on the physical S key across keyboard layouts.
 */
export declare function useSaveShortcut(onSave: () => void): void;
//# sourceMappingURL=use-save-shortcut.d.ts.map