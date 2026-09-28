import { type AnyNodeId } from '@pascal-app/core';
export declare const WINDOW_TOGGLE_ANIMATION_MS = 520;
type WindowOpenAnimationOptions = {
    persist?: boolean;
};
export declare function isOperableWindowType(windowType: string | undefined): windowType is "sliding" | "casement" | "awning" | "hopper" | "single-hung" | "double-hung" | "louvered";
export declare function getDisplayedWindowValue(windowId: AnyNodeId, nodeValue: number | undefined): number;
export declare function toggleWindowOpenState(windowId: AnyNodeId, options?: WindowOpenAnimationOptions): void;
export declare function closeWindowOpenState(windowId: AnyNodeId, options?: WindowOpenAnimationOptions): void;
export {};
//# sourceMappingURL=window-interaction.d.ts.map