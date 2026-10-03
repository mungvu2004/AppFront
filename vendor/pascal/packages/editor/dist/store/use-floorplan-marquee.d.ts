import type { WallPlanPoint } from '@pascal-app/core';
export type FloorplanMarqueeDrag = {
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPlanPoint: WallPlanPoint;
    /** Moving corner under the cursor — the only field that changes per move. */
    currentPlanPoint: WallPlanPoint;
};
type FloorplanMarqueeState = {
    drag: FloorplanMarqueeDrag | null;
    begin(drag: FloorplanMarqueeDrag): void;
    /** Advance the moving corner. No-ops (skips the store update, so the overlay
     *  doesn't re-render) when the snapped point is unchanged or no drag is open. */
    setCurrent(point: WallPlanPoint): void;
    reset(): void;
};
export declare const useFloorplanMarquee: import("zustand").UseBoundStore<import("zustand").StoreApi<FloorplanMarqueeState>>;
export default useFloorplanMarquee;
//# sourceMappingURL=use-floorplan-marquee.d.ts.map