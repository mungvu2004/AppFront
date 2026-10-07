import type { MovableConfig } from '../registry/types.js';
import type { AnyNode } from '../schema/types.js';
import { type Vec3 } from './snap.js';
/**
 * Pure movement constraint helpers. Given a node and a target position, apply
 * the constraints declared in `def.capabilities.movable` (axis lock, grid
 * snap, override callback) and return the constrained target.
 *
 * No scene access, no React, no Three.js — caller passes the node, this
 * returns the math result.
 */
export type AxisLock = ReadonlyArray<'x' | 'y' | 'z'>;
/**
 * Returns the MovableConfig effective for `node` after running its `override`
 * callback if declared. Returns `null` if the node's def doesn't declare
 * `movable` (i.e. the node is not movable).
 */
export declare function resolveMovable(node: AnyNode): MovableConfig | null;
/**
 * Projects a target X/Y/Z onto the axes a node is allowed to move on. Components
 * outside the lock fall back to the node's current values, so caller-supplied
 * positions can come from any 3D source without breaking axis-locked motion.
 */
export declare function applyAxisLock(current: Vec3, target: Vec3, axes: AxisLock): Vec3;
/**
 * Top-level helper: takes a node and a desired position, returns the position
 * filtered through the node's movable capability (axis lock + optional grid
 * snap). Returns `null` when the node is not movable.
 */
export declare function moveToward(node: AnyNode, current: Vec3, target: Vec3, options?: {
    gridStep?: number;
    gridSnap?: boolean;
}): Vec3 | null;
/**
 * 2D convenience: same as moveToward but for plan-view (X/Z) operations like
 * floor placement. Returns a tuple in the X/Z plane so callers don't have to
 * pack/unpack the dropped Y.
 */
export declare function movePlanToward(node: AnyNode, currentY: number, current: readonly [number, number], target: readonly [number, number], options?: {
    gridStep?: number;
    gridSnap?: boolean;
}): readonly [number, number] | null;
/**
 * Returns true when a node's def declares it as movable on any axis.
 * Quick predicate for tools/UI that gate on movability.
 */
export declare function isMovable(node: AnyNode): boolean;
//# sourceMappingURL=movement.d.ts.map