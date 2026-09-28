/**
 * Pure snap math — no React, no R3F, no scene access.
 *
 * Phase 1 ships the kind-agnostic snappers (grid + angle). Wall-specific
 * snapping (snap-to-endpoint, snap-along-T) currently lives in
 * `editor/src/components/tools/wall/wall-drafting.ts` and stays there until
 * Phase 3, when the wall migration ports it here behind a `wallSnap` namespace.
 *
 * The functions here are stable contract — Phase 3 only adds, never removes.
 */
import type { BuildingPose } from './alignment.js';
export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
/** Default planar grid spacing in meters. Matches the editor's wall tool. */
export declare const DEFAULT_GRID_STEP = 0.25;
/** Default angle-snap step — π/12 = 15°. */
export declare const DEFAULT_ANGLE_STEP: number;
/** Snaps a single scalar to the nearest multiple of `step`. */
export declare function snapScalar(value: number, step?: number): number;
/** Snaps a 2D point to a regular planar grid. */
export declare function snapPointToGrid(point: Vec2, step?: number): Vec2;
/** Snaps a 3D point to a regular grid in the X/Z plane, preserving Y. */
export declare function snapVec3ToGrid(point: Vec3, step?: number): Vec3;
/**
 * Snap a world XZ point to the grid, then express it in the local frame of
 * a building positioned at `buildingPosition` with rotation `buildingRotationY`
 * (radians, around the Y axis). Returns both the snapped world point and its
 * local-frame equivalent, so callers can render in either frame without
 * recomputing the rotation.
 *
 * Use when a tool needs to keep snapping on the world grid (the grid the
 * editor renders) even when the active building is rotated. Snapping in the
 * building's local frame would otherwise chase the rotated axes and miss
 * the visible grid lines.
 */
export declare function snapWorldXZToBuildingLocal(worldX: number, worldZ: number, buildingPosition: Vec3, buildingRotationY: number, step?: number): {
    world: [number, number];
    local: [number, number];
};
/** Snap in model-world axes, without presentation transforms affecting the grid. */
export declare function snapLocalXZInWorld(local: Vec2, pose: BuildingPose | null, snap: (value: number, axis: 0 | 1) => number): [number, number];
/**
 * Snaps a cursor point to the nearest angle multiple of `angleStep` (radians)
 * measured from `from`, preserving distance. Useful for axis/diagonal-locked
 * placement and wall draft endpoint locking.
 *
 * After the angle snap, the result is grid-snapped if `gridStep` is provided
 * — keeps endpoints landing on grid intersections.
 */
export declare function snapPointToAngle(from: Vec2, cursor: Vec2, angleStep?: number, gridStep?: number): Vec2;
/**
 * Snaps a cursor point onto the nearest angle ray from `from` (multiples of
 * `angleStep`), projecting the cursor onto that ray, then snaps the distance
 * ALONG the ray to `distanceStep`. Unlike `snapPointToAngle` with a
 * `gridStep`, the result stays exactly on the snapped ray — grid-snapping
 * after the angle projection pulls points off non-axis rays.
 */
export declare function snapPointAlongAngleRay(from: Vec2, cursor: Vec2, angleStep?: number, distanceStep?: number): Vec2;
/**
 * Snaps an angle (in radians) to the nearest entry in `snapAngles` (also in
 * radians). Returns the original angle if no entry is within `toleranceRad`.
 */
export declare function snapAngleToList(angle: number, snapAngles: readonly number[], toleranceRad?: number): number;
/**
 * Stable surface that `DragAction.snap` callbacks receive. Phase 1 ships
 * `grid` and `angle`. Phase 3 adds a `wall` namespace populated by wall
 * migration. Plugin authors should target this facade rather than importing
 * the individual functions, so future Phase contributions become visible
 * without code changes.
 */
export type SnapServices = {
    grid: {
        snap: (point: Vec2, step?: number) => Vec2;
        snapVec3: (point: Vec3, step?: number) => Vec3;
        snapScalar: (value: number, step?: number) => number;
    };
    angle: {
        snapTo: (from: Vec2, cursor: Vec2, angleStep?: number, gridStep?: number) => Vec2;
        snapToList: (angle: number, list: readonly number[], toleranceRad?: number) => number;
    };
};
export declare const snapServices: SnapServices;
//# sourceMappingURL=snap.d.ts.map