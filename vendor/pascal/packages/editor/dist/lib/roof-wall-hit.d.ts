import { type RoofNode, type RoofSegmentNode, type RoofSegmentWallFace, type RoofWallFaceId } from '@pascal-app/core';
import * as THREE from 'three';
export type RoofWallHit = {
    segment: RoofSegmentNode;
    face: RoofSegmentWallFace;
    /** Face coords of the hit (u along the face, v above the segment base). */
    u: number;
    v: number;
};
/**
 * Resolve a pointer hit on a roof to one of its segments' vertical wall
 * faces (base walls under the roof + the coplanar gable/shed/gambrel end
 * faces). Counterpart of `resolveRoofSegmentHit`, which resolves to the
 * sloped top surface instead.
 *
 * `normal` must be the raw `NodeEvent.normal` (hit-object-local) together
 * with the `object` it came from — roof events can originate from the
 * merged-roof mesh (roof-local frame) or a painted segment mesh
 * (segment-local frame), so the normal is normalised through world space
 * here instead of trusting the event frame.
 *
 * Lives in `@pascal-app/editor` because both the kind-owned door/window
 * tools (in `@pascal-app/nodes`, which depends on editor) and the item
 * placement coordinator (in editor itself) consume it.
 */
export declare function resolveRoofWallHit(roof: RoofNode, position: [number, number, number], normal: [number, number, number] | undefined, object: THREE.Object3D | undefined): RoofWallHit | null;
/**
 * Overlap guard for nodes sharing a roof-segment wall face — the
 * roof-host analogue of `hasWallChildOverlap`. Hosted children store
 * FACE-LOCAL coords + an explicit `roofFace`, so siblings compare
 * directly: doors/windows are center-anchored in v, wall items
 * bottom-anchored.
 */
export declare function hasRoofFaceChildOverlap(segment: RoofSegmentNode, faceId: RoofWallFaceId, u: number, v: number, width: number, height: number, ignoreId?: string): boolean;
//# sourceMappingURL=roof-wall-hit.d.ts.map