import { type AnyNode, type OpeningSpan, type WallNode } from '@pascal-app/core';
/** Maps a wall-local point (s along the wall, y above the wall base) to the move
 *  tool's render frame — the caller passes its own `wallLocalToWorld` closure so
 *  the guides land in exactly the same (building-local) frame as the drag cursor. */
type ToWorld = (s: number, y: number) => [number, number, number];
/** The moving opening's same-wall neighbours, as wall-local spans. */
export declare function collectOpeningSiblings(wall: WallNode, movingId: string, nodes: Record<string, AnyNode>): OpeningSpan[];
/**
 * Vertical sill/centre/top snap for a window — the chosen "snap + guide"
 * behaviour. Returns the snapped wall-local Y when a sibling sill/centre/top is
 * within threshold, else null so the caller falls back to the grid. Mirrors
 * `snapLocalXToNeighbors` on the vertical axis.
 */
export declare function resolveSillSnap(args: {
    wall: WallNode;
    movingId: string;
    localX: number;
    localY: number;
    width: number;
    height: number;
    nodes: Record<string, AnyNode>;
}): number | null;
/** Compute and publish the 3D opening guides for the current drag tick. */
export declare function publishOpeningGuides3D(args: {
    wall: WallNode;
    movingId: string;
    centerS: number;
    centerY: number;
    width: number;
    height: number;
    includeVertical: boolean;
    toWorld: ToWorld;
    nodes: Record<string, AnyNode>;
}): void;
export declare function clearOpeningGuides3D(): void;
/** Like {@link makeWallToWorld} but derives the level Y + slab elevation from the
 *  scene, for callers without a wall event — i.e. the resize handles. */
export declare function wallToWorld(wall: WallNode): ToWorld;
/**
 * Publish 3D opening guides for an opening being placed or moved on a wall via a
 * wall event. The caller passes the level Y + slab elevation it already computed
 * for the drag cursor, so the guides share the cursor's frame exactly — the one
 * place the door/window move + placement tools publish from.
 */
export declare function publishOpeningGuidesForWallEvent(args: {
    wall: WallNode;
    movingId: string;
    centerS: number;
    centerY: number;
    width: number;
    height: number;
    includeVertical: boolean;
    levelYOffset: number;
    slabElevation: number;
}): void;
/**
 * Publish 3D opening guides for an opening being RESIZED via a handle arrow.
 * Resolves the host wall + transform from the scene (no wall event), then reuses
 * the shared publish. Doors pass `includeVertical: false` (they sit on the
 * floor); windows pass `true` so a height drag also shows the live sill/head.
 */
export declare function publishOpeningResizeGuides(node: {
    id: string;
    parentId?: string | null;
    position: readonly [number, number, number];
    width: number;
    height: number;
}, includeVertical: boolean): void;
export {};
//# sourceMappingURL=opening-guides-runtime.d.ts.map