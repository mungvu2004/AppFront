import { type FenceConstructionOptions as FenceCommitOptions, FenceNode, type WallNode } from '@pascal-app/core';
import { type WallPlanPoint } from '../wall/wall-drafting';
export type FencePlanPoint = WallPlanPoint;
export declare function snapFenceDraftPoint(args: {
    point: FencePlanPoint;
    walls: WallNode[];
    fences: FenceNode[];
    start?: FencePlanPoint;
    angleSnap?: boolean;
    ignoreFenceIds?: string[];
    bypassSnap?: boolean;
    magnetic?: boolean;
    /** Override the grid step. */
    step?: number;
    /**
     * Optional grid-snap function. When provided, replaces the default
     * local-axis snap — lets the 2D floor-plan keep snapping to the
     * world XZ grid even when the building is rotated. Wall / fence
     * endpoint snap precedence is preserved.
     */
    gridSnap?: (point: FencePlanPoint) => FencePlanPoint;
}): FencePlanPoint;
export declare function createFenceOnCurrentLevel(start: FencePlanPoint, end: FencePlanPoint, options?: FenceCommitOptions): FenceNode | null;
/**
 * Commit a smooth spline fence from a list of drawn control points. The
 * centerline becomes a Catmull-Rom curve through `path`; `start`/`end` are
 * pinned to the first/last point so endpoint handles, bbox, and miter
 * references stay valid. Requires >= 2 points spanning a usable distance.
 */
export declare function createSplineFenceOnCurrentLevel(path: FencePlanPoint[], tangents?: ([number, number] | null)[] | undefined, options?: FenceCommitOptions): FenceNode | null;
//# sourceMappingURL=fence-drafting.d.ts.map