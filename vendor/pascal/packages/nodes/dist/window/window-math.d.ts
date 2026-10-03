import { type AnyNode, type AnyNodeId, type WallNode } from '@pascal-app/core';
/**
 * Default sill height (metres from the floor to the BOTTOM of a window) for a
 * fresh window that has no wall-face height yet — the off-wall ghost and the
 * floor-cursor placement use it so a new window floats slightly above the
 * ground rather than sitting on it. The committed Y is the window's CENTRE, so
 * callers add `height / 2`. An existing window keeps its own sill.
 */
export declare const DEFAULT_WINDOW_SILL_M = 0.5;
/**
 * Converts wall-local (X along wall, Y = height above wall base) to world XYZ.
 * Wall XZ uses level-local coordinates (levels only offset in Y, not XZ).
 * Pass levelYOffset (the level group's current world Y) and slabElevation (the
 * wall mesh's Y within the level group) so the cursor lands at the correct world
 * height — matching how WallSystem positions the wall mesh at slabElevation.
 */
export declare function wallLocalToWorld(wallNode: WallNode, localX: number, localY: number, levelYOffset?: number, slabElevation?: number): [number, number, number];
/**
 * Clamps window center position so it stays fully within wall bounds. The Y
 * ceiling is the wall's RESOLVED top (storey plane for plane-bound walls,
 * stored height for explicit ones, minus the elected slab base) — `nodes` is
 * required because a plane-bound wall's top lives on its level, not on the
 * wall record.
 */
export declare function clampToWall(wallNode: WallNode, localX: number, localY: number, width: number, height: number, nodes: Readonly<Record<AnyNodeId, AnyNode>>): {
    clampedX: number;
    clampedY: number;
};
/**
 * Wall-child overlap is shared by door + window placement (one source of
 * truth in `shared/wall-attach-target.ts`). Re-exported here so existing
 * `./window-math` importers don't change.
 */
export { hasWallChildOverlap } from '../shared/wall-attach-target';
//# sourceMappingURL=window-math.d.ts.map