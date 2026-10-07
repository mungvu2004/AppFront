export declare let boxSelectHandled: boolean;
type PointerEventLike = {
    pointerId?: number;
    nativeEvent?: PointerEvent | PointerEventLike;
};
type SuppressBoxSelectOptions = {
    markHandled?: boolean;
};
export declare function markBoxSelectHandled(): void;
export declare function suppressBoxSelectForPointer(event: PointerEvent | PointerEventLike, options?: SuppressBoxSelectOptions): void;
export declare function isBoxSelectPointerSuppressed(event: PointerEvent | PointerEventLike): boolean;
export declare function clearBoxSelectHandled(): void;
export {};
//# sourceMappingURL=box-select-state.d.ts.map