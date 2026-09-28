import { type WallConstructionOptions, type WallNode } from '@pascal-app/core';
import { type WallDraftSnapResult, type WallPlanPoint, type WallSnapRadii } from './wall-snap-geometry';
export { chainEndJoinsExistingWall, findWallSnapTarget, WALL_CONNECT_SNAP_RADIUS, WALL_JOIN_SNAP_RADIUS, type WallDraftSnapKind, type WallDraftSnapResult, type WallPlanPoint, type WallSnapRadii, } from './wall-snap-geometry';
export declare const WALL_GRID_STEP = 0.5;
export declare const WALL_MIN_LENGTH = 0.01;
export declare function getSegmentGridStep(): number;
export declare function snapScalarToGrid(value: number, step?: number): number;
export declare function snapPointToGrid(point: WallPlanPoint, step?: number): WallPlanPoint;
export declare function resolveEndpointWallSplit(args: {
    point: WallPlanPoint;
    /** Level the moved wall lives on — only its walls are split candidates. */
    levelId: string | null;
    /** The moved wall + every wall receiving an endpoint update in the same commit. */
    ignoreWallIds: string[];
    /**
     * Capture radius. The endpoint already snapped onto the wall body during
     * the drag, so the tight connect radius (drop genuinely on the wall) is
     * the default.
     */
    radius?: number;
}): WallPlanPoint | null;
type SnapWallDraftArgs = {
    point: WallPlanPoint;
    walls: WallNode[];
    start?: WallPlanPoint;
    angleSnap?: boolean;
    ignoreWallIds?: string[];
    bypassSnap?: boolean;
    /** Override the grid step. */
    step?: number;
    /**
     * Magnetic snapping to existing wall geometry (corners, midpoints,
     * crossings, wall bodies). When `false`, only grid/angle snap applies and
     * `snap` is always `null`. Defaults to `true` so callers that don't care
     * keep the prior behaviour.
     */
    magnetic?: boolean;
    /**
     * Optional grid-snap override. Lets the caller route grid snapping
     * through a world-XZ aligned snap (so a rotated building's draft
     * lands on the visible grid). When omitted, falls back to the
     * local-axis grid at `step`.
     */
    gridSnap?: (point: WallPlanPoint) => WallPlanPoint;
    /** Optional magnetic snap radii. Omitted means wall tools keep their defaults. */
    snapRadii?: WallSnapRadii;
};
export declare function snapWallDraftPointDetailed(args: SnapWallDraftArgs): WallDraftSnapResult;
export declare function snapWallDraftPoint(args: SnapWallDraftArgs): WallPlanPoint;
export declare function isSegmentLongEnough(start: WallPlanPoint, end: WallPlanPoint): boolean;
export declare function createWallOnCurrentLevel(start: WallPlanPoint, end: WallPlanPoint, options?: WallConstructionOptions): WallNode | null;
//# sourceMappingURL=wall-drafting.d.ts.map