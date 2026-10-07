export type KeyboardPanState = {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
};
export declare function isEditableKeyboardTarget(target: EventTarget | null): boolean;
export declare function setKeyboardPanKey(state: KeyboardPanState, code: string, pressed: boolean): boolean;
export declare function isKeyboardPanKey(code: string): boolean;
export declare function hasKeyboardPanInput(state: KeyboardPanState): boolean;
export declare function clearKeyboardPanKeys(state: KeyboardPanState): void;
/** Pan keys are ignored with a modifier held (shortcuts) or while typing. */
export declare function acceptsKeyboardPan(event: KeyboardEvent): boolean;
/** Screen-space direction: `horizontal` +1 is right, `vertical` +1 is forward (up). */
export declare function keyboardPanDirection(state: KeyboardPanState): {
    horizontal: number;
    vertical: number;
};
/** World units per second for a view `viewWidth` wide. */
export declare function keyboardPanSpeed(viewWidth: number): number;
//# sourceMappingURL=keyboard-pan.d.ts.map