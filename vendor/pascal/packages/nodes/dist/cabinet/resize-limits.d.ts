export declare const MIN_CABINET_WIDTH = 0.3;
export declare const MIN_CABINET_DEPTH = 0.3;
export declare const MAX_CABINET_WIDTH = 1.2;
export declare const MAX_CABINET_DEPTH = 0.8;
export declare function cabinetResizeUpperBound(currentValue: number, limit: number): number;
export declare function connectedCabinetDepthUpperBound(currentDepth: number, sourceWidth?: number): number;
export declare function cabinetConnectedDepthBounds(currentDepth: number, compensatedWidths: readonly number[]): {
    min: number;
    max: number;
};
//# sourceMappingURL=resize-limits.d.ts.map