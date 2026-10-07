export type ContextualShortcutHint = {
    keys: Array<string | string[]>;
    label: string;
    subtitle?: string;
    active?: boolean;
};
export declare const ROTATE_HANDLE_DRAG_LABEL = "rotate-handle";
export declare const RESIZE_HANDLE_DRAG_LABEL = "resize-handle";
export declare const GROUP_MOVE_DRAG_LABEL = "group-move-handle";
export declare const GROUP_ROTATE_DRAG_LABEL = "group-rotate-handle";
export declare function resolveRotateHandleHelpHints(altPressed: boolean): ContextualShortcutHint[];
export type SelectModeHelpContext = {
    selectedCount: number;
    hasMovableSelection: boolean;
    hasRotatableSelection: boolean;
    hasOpeningRadiusSelection?: boolean;
    commandPressed: boolean;
    shiftPressed: boolean;
    mepSelection?: 'run' | 'fitting' | null;
};
export declare function resolveSelectModeHelpHints({ selectedCount, hasMovableSelection, hasRotatableSelection, hasOpeningRadiusSelection, commandPressed, shiftPressed, mepSelection, }: SelectModeHelpContext): ContextualShortcutHint[];
//# sourceMappingURL=contextual-help.d.ts.map