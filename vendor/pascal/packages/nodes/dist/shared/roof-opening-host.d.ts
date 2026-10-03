import type { AnyNode, AnyNodeId, RoofWallFaceId } from '@pascal-app/core';
/**
 * Host-side helpers for openings (door / window) hosted on a roof-segment
 * wall face: resize-handle limits derived from the face profile, and the
 * plan-space anchors the 2D floor-plan move path needs. Hosted children
 * store FACE-LOCAL coords ([u, v, z-from-mid-plane]) + `roofFace`.
 */
type RoofHostedOpening = {
    roofSegmentId?: string;
    roofFace?: RoofWallFaceId;
    parentId: string | null;
    position: [number, number, number];
    width: number;
    height: number;
};
type SceneReader = {
    get: (id: AnyNodeId) => unknown;
};
/**
 * Resize-handle width limit for a roof-hosted opening: the opposite edge
 * is anchored, `growSign` (+1 = door-local +X arrow) is the direction
 * the dragged edge moves. Null when the node is not roof-hosted.
 */
export declare function readRoofFaceWidthMax(node: RoofHostedOpening, scene: SceneReader, growSign: number): number | null;
/**
 * Resize-handle height limit for a roof-hosted opening. `growSign` +1 =
 * bottom edge anchored, top grows up; -1 = top anchored, bottom grows
 * down. Null when the node is not roof-hosted.
 */
export declare function readRoofFaceHeightMax(node: RoofHostedOpening, scene: SceneReader, growSign: number): number | null;
/**
 * Level hosting a roof-hosted opening's roof (opening → segment → roof →
 * level). Null when the parent chain isn't roof-shaped.
 */
export declare function getRoofHostedOpeningLevelId(node: {
    parentId: string | null;
}, nodes: Record<string, AnyNode | undefined>): AnyNodeId | null;
/**
 * The level that owns the wall-snap candidates for an opening (door /
 * window), across all three parentings the 2D move can start from:
 *   - roof-hosted: opening → segment → roof → level (`getRoofHostedOpeningLevelId`).
 *   - wall-hosted (existing opening): parent is a wall → its parent is the level.
 *   - fresh placement (preset/catalog): the clone is parented straight to the
 *     LEVEL (`place-preset` sets `parentId: levelId`), so the parent IS the level.
 *
 * The fresh-placement case is the subtle one: treating the parent as always a
 * wall (`parent.parentId`) resolves a fresh opening's level to the BUILDING,
 * and `collectLevelWallSegments(building)` finds no walls — so a new door /
 * window never snapped in 2D. Returns null when the parent chain is none of
 * the above.
 */
export declare function getOpeningHostLevelId(node: {
    parentId: string | null;
}, nodes: Record<string, AnyNode | undefined>): AnyNodeId | null;
/**
 * Level-plan [x, z] of a roof-hosted node — its face-local center mapped
 * through the face frame, then composed through the segment's and roof's
 * yaw + position.
 */
export declare function getRoofHostedOpeningPlanPoint(node: {
    parentId: string | null;
    roofFace?: RoofWallFaceId;
    position: [number, number, number];
}, nodes: Record<string, AnyNode | undefined>): [number, number] | null;
export {};
//# sourceMappingURL=roof-opening-host.d.ts.map