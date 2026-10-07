export type StairPreviewPoint = [number, number];
type StairBuildPreviewState = {
    /** Snapped plan-XZ point the ghost staircase sits at; `null` when idle. */
    point: StairPreviewPoint | null;
    /** Yaw (radians), cycled by R / T. */
    rotation: number;
    /** Set the snapped point. No-ops (skips the store update, so subscribers
     *  don't re-render) when the point is unchanged — `grid:move` fires far more
     *  often than the snapped cell actually changes. */
    setPoint(point: StairPreviewPoint | null): void;
    setPreview(point: StairPreviewPoint | null, rotation: number): void;
    rotateBy(deltaRadians: number): void;
    reset(): void;
};
export declare const useStairBuildPreview: import("zustand").UseBoundStore<import("zustand").StoreApi<StairBuildPreviewState>>;
export {};
//# sourceMappingURL=use-stair-build-preview.d.ts.map