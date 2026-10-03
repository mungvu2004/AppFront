export declare const BLOCK_WHEEL_OPTIONS: {
    readonly capture: true;
    readonly passive: false;
};
type BlockGestureWheelEvent = Pick<WheelEvent, 'deltaY' | 'preventDefault' | 'stopImmediatePropagation' | 'stopPropagation'>;
export declare function consumeBlockGestureWheel(event: BlockGestureWheelEvent): -1 | 0 | 1;
export {};
//# sourceMappingURL=gesture-wheel.d.ts.map