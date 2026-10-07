export type HistoryCommandState = {
    canRedo: boolean;
    canUndo: boolean;
    mode: 'collaborative' | 'standalone';
    status: 'offline' | 'ready' | 'syncing' | 'unavailable';
};
export type HistoryCommandResult = {
    kind: 'applied';
    persistence: 'local' | 'queued';
} | {
    kind: 'empty';
} | {
    kind: 'unavailable';
};
export type HistoryCommandDelegate = {
    getState: () => HistoryCommandState;
    redo: () => HistoryCommandResult;
    subscribe: (listener: () => void) => () => void;
    undo: () => HistoryCommandResult;
};
export declare function installHistoryCommandDelegate(delegate: HistoryCommandDelegate): () => void;
export declare function getHistoryCommandState(): HistoryCommandState;
export declare function subscribeHistoryCommandState(listener: () => void): () => void;
export declare function shouldCancelDraftOnHistoryJump(): boolean;
export declare function runUndo(): HistoryCommandResult;
export declare function runRedo(): HistoryCommandResult;
/**
 * ⌘Z / ⌘⇧Z (undo/redo). Pointer-drag sessions intercept these in the capture
 * phase and cancel the gesture instead — mid-drag, "undo" means "abort what my
 * mouse is doing", never a history jump under a live pointer.
 */
export declare function isHistoryShortcut(e: KeyboardEvent): boolean;
//# sourceMappingURL=history.d.ts.map