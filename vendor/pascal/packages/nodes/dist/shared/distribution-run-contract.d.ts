import type { AnyNodeId } from '@pascal-app/core';
export type RunPoint = [number, number, number];
export type RunWallSide = 'front' | 'back';
export type RunSurfaceFrame = {
    origin: RunPoint;
    normal: RunPoint;
    tangent: RunPoint;
    bitangent: RunPoint;
};
export type RunSurfaceBounds = {
    minU: number;
    maxU: number;
    minV: number;
    maxV: number;
};
export type RunWallAttachment = {
    wallId: Extract<AnyNodeId, `wall_${string}`>;
    side: RunWallSide;
    startUV: [number, number];
    endUV: [number, number];
    offset: number;
};
/**
 * The surface selected for the current run. A wall target is semantic: the
 * host id and side are required so later snapping cannot fall back to any
 * other object that happens to be close in the viewport.
 */
export type RunSurfaceTarget = {
    kind: 'floor' | 'ceiling' | 'surface';
    hostId?: AnyNodeId;
    levelId: AnyNodeId;
    frame: RunSurfaceFrame;
} | {
    kind: 'wall';
    levelId: AnyNodeId;
    hostId: AnyNodeId;
    side: RunWallSide;
    frame: RunSurfaceFrame;
    bounds: RunSurfaceBounds;
};
/** Move a run centerline clear of a wall face along the captured normal. */
export declare function offsetRunPointFromSurface(point: RunPoint, target: RunSurfaceTarget | null, offset: number): RunPoint;
export declare function runPointToSurfaceUV(point: RunPoint, target: Extract<RunSurfaceTarget, {
    kind: 'wall';
}>): [number, number];
export declare function createRunWallAttachment(wallId: Extract<AnyNodeId, `wall_${string}`>, side: RunWallSide, start: RunPoint, end: RunPoint, target: Extract<RunSurfaceTarget, {
    kind: 'wall';
}>, offset: number): RunWallAttachment;
//# sourceMappingURL=distribution-run-contract.d.ts.map