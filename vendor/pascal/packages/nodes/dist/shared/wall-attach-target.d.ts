import { type AnyNode, type AnyNodeId, type WallNode } from '@pascal-app/core';
/**
 * Shared helpers for the kinds whose 2D move snaps onto a wall in plan
 * space (door, window, item with `attachTo === 'wall' | 'wall-side'`).
 *
 * The 3D move tools listen to R3F `WallEvent`s (mesh-hit with normal)
 * for wall snapping. The 2D path doesn't have that — pointer events
 * land on the SVG layer, not on the wall meshes. This helper does the
 * equivalent plan-space projection: for each wall on the level, find
 * the perpendicular projection of the pointer onto the wall line and
 * pick the closest one within a reasonable range.
 *
 * Curved walls are excluded — the legacy door / window placement also
 * rejects curved walls (mitering + arc + opening would tear in 3D).
 */
export type WallHit = {
    wall: WallNode;
    /** Distance along the wall from `start` (clamped to [0, length]). */
    localX: number;
    /** Signed perpendicular distance from the wall axis (+ on the "front" side). */
    perpDistance: number;
    /** Which face of the wall the pointer was on. */
    side: 'front' | 'back';
    /** Wall direction unit vector, x. */
    dirX: number;
    /** Wall direction unit vector, y (== z in plan). */
    dirY: number;
    /** Wall length in metres. */
    wallLength: number;
    /**
     * Rotation around Y in **wall-local** space — 0 for the front face,
     * π for the back. Matches the 3D `calculateItemRotation(normal)`
     * convention (normal +Z → 0, normal -Z → π). Items / doors / windows
     * are children of the wall mesh, so their `rotation.y` is in the
     * wall's local frame; writing a world-space rotation here would mis-
     * orient the node by `wallRotation` (off by 90° on vertical walls).
     */
    itemRotation: number;
};
export declare function projectWallLocalPointToPlan(wall: WallNode, localX: number, localZ?: number): [number, number];
/**
 * Return the single closest wall under `parentLevelId` to `planPoint` — the
 * wall whose segment-Voronoi cell the point lies in — or `null` if nothing is
 * within `WALL_SNAP_DISTANCE_M`. `excludeWallId` skips a specific wall.
 *
 * The nearest-segment scan + curved-wall filter live in core
 * (`collectLevelWallSegments` / `nearestWallSegment`) so the editor's 2D
 * Voronoi debug overlay classifies points with the exact same math — the
 * overlay is then a faithful picture of where this snaps.
 */
export declare function findClosestWallInPlan(planPoint: readonly [number, number], nodes: Record<AnyNodeId, AnyNode>, parentLevelId: AnyNodeId | null, excludeWallId?: AnyNodeId): WallHit | null;
export type WallPlanAttachment = Omit<WallHit, 'wall'> & {
    distance: number;
};
/** Resolve a plan point against one wall, including its curved centerline. */
export declare function resolveWallAttachmentAtPlanPoint(wall: WallNode, planPoint: readonly [number, number], maxDistance?: number): WallPlanAttachment | null;
export declare function projectPlanPointToWallLocalX(wall: WallNode, planPoint: readonly [number, number]): number;
/**
 * Return the closest wall attachment target in plan space, including curved
 * walls. This is deliberately separate from `findClosestWallInPlan`: doors,
 * windows, and wall-mounted items still use the straight-wall-only opening
 * query, while lean-to canopies have analytic curved-wall support.
 */
export declare function findClosestWallAttachmentInPlan(planPoint: readonly [number, number], nodes: Record<AnyNodeId, AnyNode>, parentLevelId: AnyNodeId | null, excludeWallId?: AnyNodeId): WallHit | null;
/**
 * Figma-style alignment for a wall-hosted opening / item, along the wall
 * axis. Snaps the moving node's edges (or centre) to other attachments'
 * edges/centres on the same wall, plus the wall ends. Edge-to-edge first,
 * so two doors line up flush.
 *
 * Returns the adjusted `localX` when a neighbour stop is within threshold,
 * or `null` when nothing aligns — callers treat `null` as "no alignment,
 * fall back to the grid snap". This lets along-wall alignment COMPETE with
 * the 0.5m grid (openings have arbitrary widths rarely on the grid, so
 * layering on top of the grid snap would almost never trigger).
 *
 * Snap-only for v1 — no guide is published (the floor-plan guide layer
 * renders XZ guides; an along-wall guide on a diagonal wall needs extra
 * projection work, deferred).
 */
export declare function snapLocalXToNeighbors(args: {
    wall: WallNode;
    localX: number;
    width: number;
    selfId: AnyNodeId;
    nodes: Record<AnyNodeId, AnyNode>;
    threshold?: number;
}): number | null;
/**
 * Does a wall-hosted opening of `width × height` centred at `(clampedX,
 * clampedY)` (wall-local) overlap any OTHER child of `wallId` (door / window /
 * wall-mounted item)? AABB test in the wall's local face plane. `ignoreId`
 * excludes the moving node itself. Returns `true` (blocked) if the wall is
 * gone.
 *
 * Single source of truth for door + window placement collision — door-math and
 * window-math had byte-identical copies of this. Y conventions differ per kind
 * (items store bottom Y; doors/windows store centre Y), handled inline.
 */
export declare function hasWallChildOverlap(wallId: string, nodes: Readonly<Record<string, AnyNode>>, clampedX: number, clampedY: number, width: number, height: number, ignoreId?: string): boolean;
/** Placement state for a wall-hosted opening — the SINGLE decision the preview
 *  tint and the commit gate both consume so they can never disagree. */
export type OpeningPlacement = {
    /** Geometric overlap with another wall child (independent of modifiers). */
    collides: boolean;
    /** May the opening be committed here? `true` unless it collides and the user
     *  isn't force-placing. */
    placeable: boolean;
    /** Ghost tint: green when placeable, red when not. */
    tint: 'valid' | 'invalid';
};
/**
 * Resolve the placement state from the raw collision result and whether the
 * user is force-placing (held Alt). Force-place lifts the collision block, so the
 * opening becomes placeable AND the tint goes green — the preview and the
 * commit gate stay in lockstep because both read this one result.
 */
export declare function resolveOpeningPlacement(args: {
    collides: boolean;
    forcePlace: boolean;
}): OpeningPlacement;
//# sourceMappingURL=wall-attach-target.d.ts.map