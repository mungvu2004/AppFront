export declare function resetNodeBatchState(): void;
export declare function subscribeBatchInteractions(invalidate: () => void): () => void;
export declare function captureChangedNodes(): void;
export declare function runBatchFrame(invalidate: () => void, wakeRef: {
    current: ReturnType<typeof setTimeout> | null;
}): void;
export declare const NodeBatchSystem: () => import("react").JSX.Element | null;
//# sourceMappingURL=system.d.ts.map