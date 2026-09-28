export declare const markToolCancelConsumed: () => void;
export declare const cancelActiveTool: () => boolean;
export declare const runHistoryShortcut: (direction: "undo" | "redo") => boolean;
/** Whether an armed tool owns the rotation key (`R` or `T`) instead of the selection. */
export declare const isToolOwnedRotation: (key?: "r" | "t") => boolean;
export declare const isToolOwnedCanopyForm: () => boolean;
export declare const canRunGlobalRotationShortcut: () => boolean;
export declare const canCycleSnappingModeShortcut: (hasActiveContext?: boolean) => boolean;
export declare function blocksSnappingShortcut(target: Pick<HTMLElement, 'tagName' | 'isContentEditable' | 'hasAttribute'> | null): boolean;
export declare const useKeyboard: ({ isVersionPreviewMode, disabled, }?: {
    isVersionPreviewMode?: boolean;
    disabled?: boolean;
}) => null;
//# sourceMappingURL=use-keyboard.d.ts.map