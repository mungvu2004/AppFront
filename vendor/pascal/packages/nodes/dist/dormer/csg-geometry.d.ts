import { type DormerNode, type RoofSegmentNode, type WindowNode } from '@pascal-app/core';
import * as THREE from 'three';
export declare const DORMER_GABLE_MATERIAL_INDEX = 4;
/**
 * Cheap silhouette geometry. Used as a fallback when CSG cannot run
 * (missing host brushes, thrown exception, degenerate inputs) and as
 * the live preview during slider drags so we don't re-run CSG on every
 * pointer move. Also used by the placement / move-tool ghost.
 *
 * The wall sits at material slot 0 and the roof at slot 3 so it picks
 * up the same material array the renderer passes for the CSG output.
 */
export declare function buildDormerFallbackGeometry(dormer: DormerNode): THREE.BufferGeometry;
/**
 * Build the trimmed dormer geometry hosted on a roof segment. The
 * dormer's own walls+roof are generated via `getRoofSegmentBrushes`
 * on a virtual segment, then the host segment's filled solid is
 * CSG-subtracted in dormer-mesh-local space. Window openings are then
 * subtracted on each exposed gable face.
 */
export declare function generateDormerGeometry(dormer: DormerNode, hostSegment: RoofSegmentNode, hostedWindows?: readonly WindowNode[]): THREE.BufferGeometry;
/**
 * Build the dormer cut shape in dormer-mesh-local coordinates. The
 * returned geometry is centered at X=Z=0 and spans Y ∈ [-skirt, peak]
 * — the caller layers on the dormer's yaw + position to bring it into
 * segment-local space.
 *
 * Shapes per roof type:
 * - **flat**:                a plain box (top flush with the eave; the
 *                            dormer body has no roof above wallH).
 * - **shed**:                trapezoid in YZ, extruded along X. The
 *                            base shape is high at z=-d/2; the caller
 *                            flips it when the configured high side is
 *                            the front.
 * - **gable / gambrel**:     pentagon (rectangle + symmetric triangle)
 *                            in XY, extruded along Z. Ridge runs
 *                            along Z (mesh-Z = virtualSegment-X after
 *                            the yaw bake).
 * - **hip / dutch / mansard**: pyramid — rectangular base, single
 *                            apex at the peak. Narrows on all four
 *                            sides.
 *
 * Gambrel / dutch / mansard fall back to gable / hip rather than the
 * legacy CSG-derived geometry, because three-bvh-csg's three-way
 * subtraction in the merged-roof loop can't accept CSG-derived
 * brushes without corrupting the result. The dormer body itself still
 * carries the precise per-type shape; the cut just needs to clear
 * enough of the host shell for the body to sit cleanly.
 */
export declare function buildDormerCutShape(roofType: DormerNode['roofType'], innerW: number, innerD: number, skirt: number, wallH: number, roofH: number): THREE.BufferGeometry;
/**
 * Build the segment-local cut geometry the host roof's merge loop
 * subtracts from its shin / deck / wall brushes so the dormer has a
 * clean hole to poke through. Mirrors `generateDormerGeometry`'s
 * virtual-segment + bake: build the inner shape in
 * virtual-segment-local, apply the dormer's yaw + drop-below bake,
 * then the dormer's segment-local position + rotation, so the
 * geometry lives in host-segment-local — the same frame the
 * merged-roof CSG loop operates in.
 *
 * Returns null on degenerate input so the caller can skip the cut.
 *
 * Coordinates are SEGMENT-LOCAL. The viewer welds vertices, attaches
 * a single material group, and wraps the result in a Brush — see
 * `wiki/architecture/node-definitions.md` (`capabilities.roofAccessory.buildCut`).
 */
export declare function buildDormerRoofCut(dormer: DormerNode): THREE.BufferGeometry | null;
//# sourceMappingURL=csg-geometry.d.ts.map