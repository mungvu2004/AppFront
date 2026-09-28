import { type AnyNodeId, type FloorplanAffordance } from '@pascal-app/core';
/**
 * Shared "drag a path point" floor-plan affordance for polyline
 * distribution kinds (duct-segment / pipe-segment / lineset). It is the
 * 2D counterpart of their 3D `affordanceTools.selection` handles: one
 * draggable handle per path vertex, moved freely on the plan (XZ) using
 * the active snapping mode. The vertex's Y (elevation / slope) is held
 * fixed — plan editing never changes height.
 *
 * Like the 3D handles, dragging a vertex that sits on a fitting carries the
 * joint along (port connectivity): the fitting follows, connected runs stretch
 * along their own axis and translate across it, and that perpendicular slide
 * propagates down the chain. And — duct / pipe only — dragging the free end
 * of a straight run whose other end sits on an elbow re-aims that elbow to
 * follow the drag (bend angle adapts) instead of translating it rigidly. Holding
 * **Alt** detaches: the joint breaks for the drag so the vertex moves on its
 * own (no elbow re-aim, no connectivity follow). Behavioral parity with the
 * 3D selection tool.
 *
 * Wired via `def.floorplanAffordances['move-path-point']`; the floor-plan
 * builders emit `endpoint-handle` primitives carrying `{ pointIndex }` so
 * the dispatcher routes pointer-downs here.
 */
export type PathPointPayload = {
    pointIndex: number;
};
type PathShape = {
    path: ReadonlyArray<readonly [number, number, number]>;
};
export declare function createPathPointMoveAffordance<N extends PathShape & {
    id: AnyNodeId;
}>(kind: string): FloorplanAffordance<N>;
export {};
//# sourceMappingURL=path-point-affordance.d.ts.map