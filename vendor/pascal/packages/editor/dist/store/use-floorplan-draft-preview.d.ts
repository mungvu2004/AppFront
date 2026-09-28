import type { WallPlanPoint } from '@pascal-app/core';
/** Screen-space (SVG-local px) cursor point — drives the coordinate badge. */
type SvgPoint = {
    x: number;
    y: number;
};
export type FloorplanPolygonDraftType = 'ceiling' | 'slab' | 'zone';
type FloorplanDraftPreviewState = {
    /** Snapped plan-XZ point under the cursor; drives the crosshair + the
     *  cursor-following polygon-draft preview. `null` when idle. */
    cursorPoint: WallPlanPoint | null;
    /** Screen-space cursor point driving the coordinate-indicator badge. Set on
     *  every SVG `pointermove` while a build/select tool is active, so it's the
     *  single hottest 2D update — keeping it out of panel state is what stops the
     *  panel re-rendering per move. `null` when idle. */
    cursorPosition: SvgPoint | null;
    /** Live END point of the open wall / fence / roof draft segment — the per-move
     *  endpoint that drives the 2D draft polygon + measurement. Each is `null`
     *  unless that tool's draft is open. The START points are mirrored here (set
     *  per click / per 3D draft move) so out-of-tree consumers — e.g. the hosted
     *  host-owned preview publishers — can observe the whole open
     *  segment; panel state remains the 2D interaction source of truth. */
    wallDraftEnd: WallPlanPoint | null;
    fenceDraftEnd: WallPlanPoint | null;
    roofDraftEnd: WallPlanPoint | null;
    wallDraftStart: WallPlanPoint | null;
    fenceDraftStart: WallPlanPoint | null;
    roofDraftStart: WallPlanPoint | null;
    /** First corner of an open rectangle-wall draft; the live cursor is the
     *  opposite corner, so the rectangle tool publishes only per click. */
    wallRectangleDraftStart: WallPlanPoint | null;
    roofDraftQuarterTurn: boolean;
    polygonDraftType: FloorplanPolygonDraftType | null;
    polygonDraftPoints: WallPlanPoint[];
    /** Set the snapped cursor point. No-ops (skips the store update, so
     *  subscribers don't re-render) when unchanged — `grid:move` fires far more
     *  often than the snapped cell actually changes. */
    setCursorPoint(point: WallPlanPoint | null): void;
    /** Set the screen-space cursor point (deduped on x/y). */
    setCursorPosition(point: SvgPoint | null): void;
    setWallDraftEnd(point: WallPlanPoint | null): void;
    setFenceDraftEnd(point: WallPlanPoint | null): void;
    setRoofDraftEnd(point: WallPlanPoint | null): void;
    setWallDraftStart(point: WallPlanPoint | null): void;
    setFenceDraftStart(point: WallPlanPoint | null): void;
    setRoofDraftStart(point: WallPlanPoint | null): void;
    setWallRectangleDraftStart(point: WallPlanPoint | null): void;
    setRoofDraftQuarterTurn(quarterTurn: boolean): void;
    setPolygonDraft(type: FloorplanPolygonDraftType | null, points: readonly WallPlanPoint[]): void;
    reset(): void;
};
export declare const useFloorplanDraftPreview: import("zustand").UseBoundStore<import("zustand").StoreApi<FloorplanDraftPreviewState>>;
export {};
//# sourceMappingURL=use-floorplan-draft-preview.d.ts.map