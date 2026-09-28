import { type RoofEvent, type RoofNode, type RoofSegmentNode, type RoofSegmentWallFace } from '@pascal-app/core';
import { Vector3 } from 'three';
/**
 * Stateless target/cursor math shared by the door and window placement
 * + move tools' roof flows. The tools keep ownership of everything
 * stateful (draft lifecycle, undo/temporal sequencing, commit field
 * lists, SFX/selection) — only the settled geometry lives here.
 */
export type RoofWallOpeningTarget = {
    segment: RoofSegmentNode;
    face: RoofSegmentWallFace;
    /** FACE-LOCAL stored position: [u, v-center, 0] on the wall mid-plane. */
    position: [number, number, number];
    /** False when the rect overlaps a sibling on the same face. */
    valid: boolean;
};
export type RoofWallOpeningVertical = 
/** Doors: bottom on the segment base, only `u` slides. */
{
    kind: 'bottom-locked';
}
/** Windows: free height, optionally grid-snapped before the clamp. */
 | {
    kind: 'free';
    snap?: (v: number) => number;
};
/**
 * Resolve a roof pointer event to an opening placement on a segment
 * wall face: hit → vertical policy → profile clamp → overlap check.
 * Null when the pointer isn't over a placeable face or the rect cannot
 * fit at that spot.
 */
export declare function resolveRoofWallOpeningTarget(args: {
    event: RoofEvent;
    width: number;
    height: number;
    ignoreId?: string;
    vertical: RoofWallOpeningVertical;
}): RoofWallOpeningTarget | null;
/**
 * World → building-local. Tool cursor groups render inside the
 * building's frame (same conversion as the roof accessory tools).
 */
export declare function worldToSelectedBuildingLocal(point: Vector3): [number, number, number];
/**
 * Cursor pose for a resolved target: building-local position of the
 * opening center + total yaw (roof ∘ segment ∘ face).
 */
export declare function getRoofWallOpeningCursorPose(target: RoofWallOpeningTarget, roof: RoofNode): {
    position: [number, number, number];
    rotationY: number;
} | null;
//# sourceMappingURL=roof-wall-opening-placement.d.ts.map