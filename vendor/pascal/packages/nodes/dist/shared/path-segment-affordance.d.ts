import { type AnyNodeId, type FloorplanAffordance } from '@pascal-app/core';
/**
 * Shared "side-move a path segment" floor-plan affordance for polyline
 * distribution kinds (duct-segment / pipe-segment). It is the 2D counterpart
 * of the in-world side-move arrows in the kind's 3D
 * `affordanceTools.selection` handles.
 *
 *  - **move-segment**: slide one segment perpendicular to itself. Both its
 *    vertices translate by the same plan-normal offset (the offset is the
 *    cursor's projection onto the segment normal); neighbours stretch and any
 *    mated joint follows via port connectivity. Grid-snapped (Shift bypasses).
 *
 * The vertices' Y (elevation) is always held — plan editing never changes
 * height, matching the path-point affordance. Behavioral parity with the 3D
 * selection arrows. (Length editing stays on the per-vertex hex handles.)
 *
 * Wired via `def.floorplanAffordances['move-segment']`; the floor-plan
 * builder emits `move-arrow` primitives carrying the segment index so the
 * dispatcher routes pointer-downs here.
 */
export type SegmentMovePayload = {
    /** Index of the segment's first vertex (it spans [i, i+1]). */
    segmentIndex: number;
    /** Unit plan normal [nx, nz] the segment slides along. */
    normal: [number, number];
};
type PathShape = {
    path: ReadonlyArray<readonly [number, number, number]>;
    id: AnyNodeId;
};
export declare function createSegmentMoveAffordance<N extends PathShape>(kind: string): FloorplanAffordance<N>;
export {};
//# sourceMappingURL=path-segment-affordance.d.ts.map