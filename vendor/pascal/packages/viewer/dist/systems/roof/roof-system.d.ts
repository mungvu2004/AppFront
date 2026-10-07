import { type AnyNode, type RoofSegmentNode } from '@pascal-app/core';
import * as THREE from 'three';
import { Brush } from 'three-bvh-csg';
export declare const RoofSystem: () => null;
/**
 * Four dummy materials used as identity placeholders during CSG. Shared
 * across every input brush so three-bvh-csg can preserve reference
 * equality on the result and `mapRoofGroupMaterialIndex` can map result
 * groups back to slots 0..3. Exposed so kinds that compose additional
 * CSG ops on top of `getRoofSegmentBrushes` (e.g. dormer) use the same
 * identity refs.
 */
export declare const roofCsgDummyMats: [
    THREE.MeshBasicMaterial,
    THREE.MeshBasicMaterial,
    THREE.MeshBasicMaterial,
    THREE.MeshBasicMaterial
];
export declare const ROOF_MATERIAL_SLOT_COUNT = 4;
type RoofSegmentBrushSet = {
    deckSlab: Brush;
    shinSlab: Brush;
    wallBrush: Brush;
    innerBrush: Brush;
    rakeBoards: THREE.BufferGeometry | null;
};
export declare function mapRoofGroupMaterialIndex(groupMaterialIndex: number | undefined, csgMaterials: THREE.Material[], matToIndex: Map<THREE.Material, number>): number;
/**
 * Subtract a segment's trim cuts from an arbitrary segment-local geometry,
 * returning the clipped result. The input geometry is consumed (disposed) on
 * each successful CSG pass — callers that need to keep the original must pass a
 * clone. Returns the input untouched when the segment has no trim. Used
 * internally for rake-board / end-slope attachments and exported so roof
 * accessories (chimney, vents, skylight, …) can clip their own meshes by the
 * same trim, in the same segment-local frame.
 */
export declare function clipGeometryBySegmentTrim(geometry: THREE.BufferGeometry | null, segment: RoofSegmentNode): THREE.BufferGeometry | null;
/**
 * `fascia`: build the segment's fascia boards into its deck. Only the roof
 * renderer asks; a dormer, a chimney or a sibling's clip takes the bare shell.
 */
export declare function getRoofSegmentBrushes(node: RoofSegmentNode, options?: {
    fascia?: boolean;
}): RoofSegmentBrushSet | null;
export declare function generateRoofSegmentGeometry(node: RoofSegmentNode, nodes?: Record<string, AnyNode>): THREE.BufferGeometry;
export declare function remapRoofShellFaces(geometry: THREE.BufferGeometry, node: RoofSegmentNode): void;
export type SurfaceFrame = {
    point: THREE.Vector3;
    normal: THREE.Vector3;
};
/**
 * Returns the outer roof surface frame (point + normal) at a given segment-local XZ.
 * This is used for skylight placement + cut direction so cutouts remain perpendicular
 * to the true roof surface even on multi-slope roofs (gambrel/mansard/dutch).
 */
export declare function getRoofOuterSurfaceFrameAtPoint(segment: RoofSegmentNode, lx: number, lz: number): SurfaceFrame;
export {};
//# sourceMappingURL=roof-system.d.ts.map