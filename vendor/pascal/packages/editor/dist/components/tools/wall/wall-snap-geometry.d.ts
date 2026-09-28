import { type WallNode } from '@pascal-app/core';
export type WallPlanPoint = [number, number];
/** Which kind of existing-geometry snap produced a drafted point. */
export type WallDraftSnapKind = 'endpoint' | 'midpoint' | 'intersection' | 'wall';
export type WallSnapRadii = Partial<Record<WallDraftSnapKind, number>>;
export type WallDraftSnapResult = {
    point: WallPlanPoint;
    /**
     * Set when `point` locked onto existing wall geometry (a corner, midpoint,
     * crossing, or wall body) rather than a plain grid/angle position. This is
     * the "magnetic" snap the beacon visualises; `null` for grid/angle-only.
     */
    snap: WallDraftSnapKind | null;
    /**
     * Walls whose geometry produced the snap. Kept separate from `snap` so a
     * caller can use geometry for XZ alignment while independently deciding
     * whether the target is allowed to transfer its construction plane.
     */
    targetWallIds: string[];
};
export declare const WALL_JOIN_SNAP_RADIUS = 0.35;
export declare const WALL_CONNECT_SNAP_RADIUS = 0.05;
export declare const WALL_ENDPOINT_SNAP_RADIUS = 0.7;
export declare const WALL_MIDPOINT_SNAP_RADIUS = 0.5;
export declare const WALL_INTERSECTION_SNAP_RADIUS = 0.5;
export declare function distanceSquared(a: WallPlanPoint, b: WallPlanPoint): number;
export declare function projectPointOntoWall(point: WallPlanPoint, wall: WallNode): WallPlanPoint | null;
export declare function findWallSnapTarget(point: WallPlanPoint, walls: WallNode[], options?: {
    ignoreWallIds?: string[];
    radius?: number;
}): WallPlanPoint | null;
/**
 * Wall ids that contain an already-resolved snap point.
 *
 * This is provenance, not another snap pass: the tolerance only absorbs float
 * drift around a point the snap pipeline already chose.
 */
export declare function wallIdsAtSnapPoint(point: WallPlanPoint, walls: WallNode[], ignoreWallIds?: string[], tolerance?: number): string[];
/**
 * Endpoint-only snap from the *raw* cursor (no grid pre-snap), with a
 * generous radius. Use this before `findWallSnapTarget` so the strong
 * "attach to an existing wall corner" intent isn't accidentally pushed
 * out of range by an interim grid snap that moved the cursor away from
 * the endpoint.
 */
export declare function findWallEndpointFromRaw(point: WallPlanPoint, walls: WallNode[], ignoreWallIds?: string[], radius?: number): WallPlanPoint | null;
/** Nearest wall midpoint to the raw cursor, within `WALL_MIDPOINT_SNAP_RADIUS`. */
export declare function findWallMidpointFromRaw(point: WallPlanPoint, walls: WallNode[], ignoreWallIds?: string[], radius?: number): WallPlanPoint | null;
/**
 * Nearest point where two existing straight walls cross, within
 * `WALL_INTERSECTION_SNAP_RADIUS`. Curved walls are skipped. O(n²) over the
 * level's walls — fine at editor scale.
 */
export declare function findWallIntersectionFromRaw(point: WallPlanPoint, walls: WallNode[], ignoreWallIds?: string[], radius?: number): WallPlanPoint | null;
export declare const WALL_CHAIN_JOIN_TOLERANCE = 0.001;
/**
 * True when a committed chain segment's resolved `end` lies on wall geometry
 * (an endpoint, or a straight wall's interior) of a wall outside the current
 * draft chain. The wall tools stop chaining there: a segment that tees into
 * the existing network is a termination — continuing would draft the next
 * segment on top of existing walls. `chainWallIds` excludes the chain's own
 * segments (including the just-committed one) so edge/midpoint snaps onto a
 * previous own segment don't read as a join. Curved wall interiors are
 * skipped (their endpoints still count) — resolving an end onto a curve body
 * is rare and continuing there matches the previous behaviour.
 */
export declare function chainEndJoinsExistingWall(end: WallPlanPoint, walls: WallNode[], chainWallIds: string[], tolerance?: number): boolean;
/**
 * Discrete "special point" snap from the raw cursor, in priority order:
 *   1. corners (endpoints) — strongest intent, largest radius
 *   2. midpoints / crossings — next tier; the nearer of the two wins
 * A corner within range always wins over a midpoint/crossing. Returns null
 * when no special point is in range (caller falls back to grid/edge snap).
 */
export declare function findWallSpecialPointSnap(point: WallPlanPoint, walls: WallNode[], ignoreWallIds?: string[], radii?: WallSnapRadii): WallDraftSnapResult | null;
//# sourceMappingURL=wall-snap-geometry.d.ts.map