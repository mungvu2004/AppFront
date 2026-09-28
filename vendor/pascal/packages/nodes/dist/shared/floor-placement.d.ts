import { type AnyNode, type GridEvent, type NodeEvent, resolveAlignment } from '@pascal-app/core';
export declare const FLOOR_PLACEMENT_ALIGNMENT_THRESHOLD_M = 0.08;
export type FloorPlacementClickTriggerEvent = GridEvent | NodeEvent<AnyNode>;
export declare function isForcePlacementEvent(event: FloorPlacementClickTriggerEvent): boolean;
type FloorPlacementAlignmentArgs = {
    node: AnyNode;
    rawX: number;
    rawZ: number;
    gridStep: number;
    candidates: Parameters<typeof resolveAlignment>[0]['candidates'];
    showAlignment?: boolean;
    applyAlignmentSnap?: boolean;
    bypassGrid?: boolean;
    rotationY?: number;
};
export declare function getLevelLocalSnappedPosition(levelId: string, event: FloorPlacementClickTriggerEvent, gridStep: number, bypassGrid?: boolean): [number, number, number];
export declare function resolveAlignedFloorPlacement({ node, rawX, rawZ, gridStep, candidates, showAlignment, applyAlignmentSnap, bypassGrid, rotationY, }: FloorPlacementAlignmentArgs): {
    position: [number, number, number];
    guides: import("@pascal-app/core").AlignmentGuide[];
};
export declare function stopPlacementCommitPropagation(event: FloorPlacementClickTriggerEvent): void;
export declare function subscribeFloorPlacementClicks(onClick: (event: FloorPlacementClickTriggerEvent) => void): () => void;
export declare function subscribeFloorPlacementDoubleClicks(onDoubleClick: (event: FloorPlacementClickTriggerEvent) => void): () => void;
export {};
//# sourceMappingURL=floor-placement.d.ts.map