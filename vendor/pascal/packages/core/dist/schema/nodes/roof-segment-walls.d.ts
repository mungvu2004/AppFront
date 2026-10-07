import type { RoofSegmentNode } from './roof-segment.js';
/**
 * Wall-face math for roof segments — the vertical surfaces a wall-mounted
 * opening (door / window) can attach to. A segment's generated volume has
 * four vertical faces; on gable-family roofs the end faces extend past the
 * eave line into the gable (rect + triangle/pentagon, coplanar with the
 * base wall). These helpers describe each face as a 2D frame
 * (`u` along the face, `v` height above the segment base) plus the
 * placeable profile polygon, so placement tools, renderers, and CSG cut
 * builders all share one definition of "the wall under the roof".
 *
 * The numbers MUST mirror the outer wall volume built by
 * `getRoofSegmentBrushes` in the viewer's roof system
 * (`getVol(wallThickness / 2, 0, 0, …)`): the volume is the segment
 * footprint extended outward by `wallThickness / 2`, which drops the eave
 * line by `(wallThickness / 2) · tanθ` and raises the ridge by the same
 * amount so the apex stays at `wallHeight + activeRh` unless the eave
 * hits the CSG minimum. The base stays at 0; the eave is raised to at
 * least 0.05 above it to avoid sinking the shell into the supporting wall.
 */
export type RoofWallFaceId = 'front' | 'back' | 'right' | 'left';
export type RoofSegmentWallFace = {
    id: RoofWallFaceId;
    /** Outward normal in segment-local space. */
    normal: [number, number, number];
    /**
     * Yaw (radians, rotation-y) mapping opening-local +Z to the outward
     * normal and opening-local +X to the face's +U direction — the same
     * frame a wall-hosted door/window uses relative to its wall mesh.
     */
    yaw: number;
    /** Face length along U. */
    length: number;
    /**
     * Placeable region, CCW polygon in face coords. `u ∈ [0, length]`,
     * `v` is height above the segment base (segment-local Y).
     */
    profile: [number, number][];
};
type SegmentWallInputs = Pick<RoofSegmentNode, 'roofType' | 'width' | 'depth' | 'wallHeight' | 'wallThickness' | 'pitch'> & Partial<Pick<RoofSegmentNode, 'gambrelLowerWidthRatio' | 'gambrelLowerHeightRatio' | 'mansardSteepWidthRatio' | 'mansardSteepHeightRatio' | 'dutchHipWidthRatio' | 'dutchHipHeightRatio' | 'dutchWaistLengthRatio'>>;
export declare function getRoofSegmentWallFace(node: SegmentWallInputs, id: RoofWallFaceId): RoofSegmentWallFace;
export declare function getRoofSegmentWallFaces(node: SegmentWallInputs): RoofSegmentWallFace[];
/**
 * Segment-local point → face coords. `dist` is the signed offset off the
 * outer wall plane along the face normal (0 = on the plane, positive =
 * outside the volume).
 */
export declare function segmentPointToRoofWallFace(node: SegmentWallInputs, id: RoofWallFaceId, point: [number, number, number]): {
    u: number;
    v: number;
    dist: number;
};
/**
 * The face's render frame in segment-local space: a group placed at
 * `origin` and yawed by `yaw` maps face coords to segment space —
 * frame X = U (along the face), frame Y = V (height), frame Z = the
 * outward normal, with z = 0 on the WALL MID-PLANE. The mid-plane of
 * the generated wall volume lands exactly on the nominal footprint
 * (`±width/2` / `±depth/2`), so hosted children use the same position
 * conventions as wall children (openings at z = 0, wall-side items
 * pushed +thickness/2 at render time). Renderers derive this from the
 * live-override-merged segment, which is what makes hosted children
 * track segment edits live instead of jumping on commit.
 */
export declare function getRoofWallFaceFrame(node: SegmentWallInputs, id: RoofWallFaceId): {
    origin: [number, number, number];
    yaw: number;
};
/** Face-frame point ([u, v, z-from-mid-plane]) → segment-local point. */
export declare function roofFacePointToSegment(node: SegmentWallInputs, id: RoofWallFaceId, point: [number, number, number]): [number, number, number];
/**
 * Max width of a rect growing from an anchored vertical edge (`anchorU`)
 * in direction `growSign` (±1 along U) while staying inside the face
 * profile at the fixed vertical center `vCenter`. Resize-handle limit:
 * the anchored-edge model matches the handles' apply math (opposite
 * edge stays put, center re-derives).
 */
export declare function getMaxRoofRectWidthFromAnchor(face: RoofSegmentWallFace, anchorU: number, growSign: number, vCenter: number, height: number): number;
/**
 * Max height of a rect growing from an anchored horizontal edge
 * (`anchorV`) in direction `growSign` (+1 = bottom anchored, grows up)
 * while staying inside the face profile at the fixed horizontal center
 * `uCenter`.
 */
export declare function getMaxRoofRectHeightFromAnchor(face: RoofSegmentWallFace, uCenter: number, width: number, anchorV: number, growSign: number): number;
/**
 * Clamp a rect center so the rect fits inside the face profile.
 *
 * - `lockV: true` (doors): `v` is fixed; only `u` slides. Returns null
 *   when no `u` keeps the rect inside at that height.
 * - otherwise (windows): the center is projected into the eroded convex
 *   region (cyclic projection — profiles are convex by construction).
 *
 * Returns null when the rect cannot fit anywhere on the face.
 */
export declare function clampRectToRoofWallFace(face: RoofSegmentWallFace, u: number, v: number, width: number, height: number, opts?: {
    lockV?: boolean;
}): {
    u: number;
    v: number;
} | null;
export {};
//# sourceMappingURL=roof-segment-walls.d.ts.map