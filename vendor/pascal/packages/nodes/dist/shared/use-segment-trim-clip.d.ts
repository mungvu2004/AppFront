import { type RoofSegmentNode } from '@pascal-app/core';
import * as THREE from 'three';
/**
 * Clip a roof accessory's geometry by its host segment's trim, so the part of
 * the accessory standing in a trimmed-away region is sliced off exactly like
 * the roof shell.
 *
 * `geometry` is in accessory-local space; `localToSegment` maps it into the
 * segment-local frame the trim cut prisms live in (compose the same
 * `node.position` + inner-group quaternion the renderer mounts the mesh with).
 * The function bakes that transform, runs `clipGeometryBySegmentTrim`, then
 * strips the transform back off so the returned geometry is still
 * accessory-local and drops straight into the renderer's existing mesh.
 *
 * Returns the input geometry untouched when the segment is missing or has no
 * trim — zero cost for the overwhelmingly common case. The derived (clipped)
 * geometry is owned by the hook and disposed on change / unmount; the input
 * geometry is never consumed (we clip a clone), so the caller keeps owning it.
 */
export declare function useSegmentTrimClippedGeometry(geometry: THREE.BufferGeometry | null, segment: RoofSegmentNode | undefined, localToSegment: THREE.Matrix4): THREE.BufferGeometry | null;
/**
 * A `<mesh>` whose geometry is sliced by the host roof segment's trim, for
 * accessory sub-parts that live deeper than the registered group (skylight
 * glass panes, dormer window glass / frame / sill). Pass the matrix that maps
 * the part's own parent frame into the segment-local frame (`parentToSegment`)
 * plus the part's local `position` / `rotation`; the component composes the
 * full mesh→segment transform, clips, and renders the result at the same local
 * pose. When the segment has no trim the original geometry renders unchanged.
 *
 * `geometry` is owned by the caller (built once and reused); the clipped
 * derivative is owned by the hook and disposed on change / unmount.
 */
export declare function TrimClippedMesh({ geometry, segment, parentToSegment, position, rotation, material, name, castShadow, receiveShadow, }: {
    geometry: THREE.BufferGeometry;
    segment: RoofSegmentNode | undefined;
    parentToSegment: THREE.Matrix4;
    position?: [number, number, number];
    rotation?: [number, number, number];
    material: THREE.Material | THREE.Material[];
    name?: string;
    castShadow?: boolean;
    receiveShadow?: boolean;
}): import("react").JSX.Element;
//# sourceMappingURL=use-segment-trim-clip.d.ts.map