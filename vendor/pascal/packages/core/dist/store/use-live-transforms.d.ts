export type LiveTransform = {
    position: [number, number, number];
    rotation: number;
    /**
     * Pointer-decided support cap (level-local Y) published by 3D drags:
     * the elevation of the surface the cursor ray actually points at. The
     * floor-elevation system passes it to the slab-support election so a
     * deck above the aimed-at floor never lifts the dragged node. Absent
     * for 2D floorplan drags (no camera ray) — election stays uncapped.
     */
    supportElevationCap?: number;
};
type LiveTransformState = {
    transforms: Map<string, LiveTransform>;
    set(nodeId: string, transform: LiveTransform): void;
    get(nodeId: string): LiveTransform | undefined;
    clear(nodeId: string): void;
    clearAll(): void;
};
declare const useLiveTransforms: import("zustand").UseBoundStore<import("zustand").StoreApi<LiveTransformState>>;
export default useLiveTransforms;
//# sourceMappingURL=use-live-transforms.d.ts.map