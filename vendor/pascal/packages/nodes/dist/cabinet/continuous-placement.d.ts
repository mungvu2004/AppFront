import type { AnyNodeId } from '@pascal-app/core';
import type { FloorPlacementClickTriggerEvent } from '../shared/floor-placement';
export type CabinetStretchPreview = {
    modules: {
        x: number;
        width: number;
    }[];
    length: number;
    centerLocalX: number;
    direction: 1 | -1;
};
export type StretchAnchor = {
    position: [number, number, number];
    yaw: number;
    snappedToWall: boolean;
    wallId?: AnyNodeId;
    wallLocalX?: number;
    wallSurfaceNormal?: [number, number, number];
    forcedDirection?: 1 | -1;
    leadingWidth?: number;
};
export type StretchContinuation = {
    hingePosition: [number, number, number];
    sourceYaw: number;
    sourceDirection: 1 | -1;
    straightAnchor: StretchAnchor;
    turnAnchor: StretchAnchor;
};
type PlacementCollisionResult = {
    conflictIds: string[];
    valid: boolean;
};
export declare function isForcePlacementEvent(event: FloorPlacementClickTriggerEvent): boolean;
export declare function fillCabinetContinuousSpan(length: number): number[];
export declare function planCabinetContinuousStretch({ anchor, previewWidth, rawPlanPosition, }: {
    anchor: StretchAnchor;
    previewWidth: number;
    rawPlanPosition: [number, number, number];
}): CabinetStretchPreview;
export declare function cabinetStretchExitSide(stretch: CabinetStretchPreview): 'left' | 'right';
export declare function cabinetStretchEndLocalX(stretch: CabinetStretchPreview, previewWidth: number): number;
export declare function createCabinetContinuousContinuation({ anchor, previewDepth, previewWidth, stretch, }: {
    anchor: StretchAnchor;
    previewDepth: number;
    previewWidth: number;
    stretch: CabinetStretchPreview;
}): StretchContinuation;
export declare function chooseCabinetContinuousAnchor(continuation: StretchContinuation, rawPlanPosition: [number, number, number]): StretchAnchor;
export declare function resolveCabinetContinuousValidity(result: PlacementCollisionResult, forcePlace: boolean): PlacementCollisionResult;
export declare function isCabinetContinuousFollowUpClick(clickCount: number): boolean;
export {};
//# sourceMappingURL=continuous-placement.d.ts.map