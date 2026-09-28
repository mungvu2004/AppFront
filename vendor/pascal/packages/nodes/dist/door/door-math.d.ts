import { type WallNode } from '@pascal-app/core';
/**
 * Keep the door handle at the same relative height when the door is resized:
 * scale it by the height ratio, then clamp to the panel's slider bounds
 * [0.5, height - 0.1] so it never lands outside the (possibly shrunk) door.
 * Used by both the height-resize arrow and the panel's Height slider so the
 * handle tracks the door whichever way it's resized.
 */
export declare function scaleHandleHeight(handleHeight: number, oldHeight: number, newHeight: number): number;
/**
 * Converts wall-local (X along wall, Y = height above wall base) to world XYZ.
 */
export declare function wallLocalToWorld(wallNode: WallNode, localX: number, localY: number, levelYOffset?: number, slabElevation?: number): [number, number, number];
/**
 * Clamps door center X so it stays fully within wall bounds.
 * Y is always height/2 — doors sit at floor level.
 */
export declare function clampToWall(wallNode: WallNode, localX: number, width: number, height: number): {
    clampedX: number;
    clampedY: number;
};
export { hasWallChildOverlap } from '../shared/wall-attach-target';
//# sourceMappingURL=door-math.d.ts.map