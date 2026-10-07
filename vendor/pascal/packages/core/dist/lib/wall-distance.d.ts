import type { WallNode } from '../schema/nodes/wall.js';
import type { AnyNode, AnyNodeId } from '../schema/types.js';
/**
 * Pure plan-space wall-distance math shared by the 2D opening snap
 * (`findClosestWallInPlan` in @pascal-app/nodes) and the editor's 2D
 * Voronoi debug overlay. One source of truth means the overlay is a
 * faithful picture of what the snap actually decides.
 *
 * A wall segment's Voronoi cell is exactly "the points whose nearest wall
 * is this segment", so nearest-segment classification == the segment
 * Voronoi diagram. Curved walls are excluded (the opening snap rejects
 * them — mitering + arc + opening tears in 3D).
 */
/**
 * Max cursor-to-wall plan distance (metres) for a 2D opening to snap onto a
 * wall. Tight, because plan walls are thin and often close together — a large
 * radius would let a far wall's region reach across a nearer one. Shared so the
 * snap and the Voronoi debug overlay clip to the exact same range.
 */
export declare const WALL_SNAP_DISTANCE_M = 0.4;
export type WallSegment = {
    wall: WallNode;
    /** [x, z] plan start. */
    start: readonly [number, number];
    /** [x, z] plan end. */
    end: readonly [number, number];
    /** Unit direction (start → end) in plan. */
    dirX: number;
    dirY: number;
    /** Segment length in metres. */
    length: number;
};
export type WallSegmentClosest = {
    segment: WallSegment;
    /** Distance from the query point to the closest point on the segment. */
    distance: number;
    /** Distance along the wall from `start`, clamped to [0, length]. */
    along: number;
    /** Signed perpendicular offset from the wall axis (+ on the front side). */
    perp: number;
};
/**
 * Collect the straight (non-curved) wall segments that are direct children
 * of a level — the candidates an opening can snap onto.
 */
export declare function collectLevelWallSegments(nodes: Record<AnyNodeId, AnyNode>, levelId: AnyNodeId | null): WallSegment[];
/** Closest point + signed offset of one query point against one segment. */
export declare function closestOnSegment(segment: WallSegment, pointX: number, pointY: number): {
    distance: number;
    along: number;
    perp: number;
};
/**
 * The single nearest wall segment to a plan point — its Voronoi cell. Returns
 * null when `segments` is empty or (when `maxDistance` is given) nothing is
 * within range. Ties resolve to the first segment scanned; callers pass an
 * already-curved-filtered list from `collectLevelWallSegments`.
 */
export declare function nearestWallSegment(segments: readonly WallSegment[], pointX: number, pointY: number, maxDistance?: number, excludeWallId?: AnyNodeId): WallSegmentClosest | null;
//# sourceMappingURL=wall-distance.d.ts.map